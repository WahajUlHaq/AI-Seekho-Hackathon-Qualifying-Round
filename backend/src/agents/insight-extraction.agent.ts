/**
 * Module 5 — RAG Insight Extraction (V2).
 *
 * Antigravity invokes this module as a passive tool. The execution flow:
 *   1. Read `PipelineState.resolvedFacts` FIRST  (single source of truth).
 *   2. Spin up an EPHEMERAL `PipelineVectorStore` scoped to this pipeline_id.
 *   3. Ingest pre-serialized Phase-1 tabular chunks (no raw row dumps).
 *   4. Run MULTI-QUERY retrieval over 5 hard-coded supply-chain questions.
 *   5. Deduplicate insights by embedding cosine similarity (>0.80 = dupe).
 *   6. Hand the structured output to the BLOCK + BASE MODEL AMCE gate.
 *      If BLOCK → Antigravity re-prompts the primary model with the
 *      judge's critique appended (one retry, then deterministic fallback).
 *   7. Destroy the vector store before returning (no cross-run contamination).
 *
 * NEVER imports an AI SDK directly — all calls flow through `llmClient`.
 */

import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { NormalizedSource } from "./multi-source-ingestion.agent";
import { CredibilityScore } from "./credibility-scorer.agent";
import { Contradiction } from "./contradiction-detector.agent";
import { TemporalPattern } from "./temporal-analysis.agent";
import { pipelineState } from "./pipeline-state";
import { PipelineVectorStore, RetrievalResult } from "../rag/vector-store";
import { cosineSimilarity } from "../utils/cosine-similarity";
import { antigravityFileLogger } from "../tracing/file-logger";
import { validateWithBaseModel, AMCEBlockError } from "../contracts/base-model-benchmark";

export interface Insight {
    insight_id: string;
    title: string;
    description: string;
    category: "trend" | "risk" | "opportunity" | "contradiction";
    severity: "critical" | "high" | "medium" | "low";
    confidence: number;
    supporting_sources: string[];
    requires_resolution: boolean;
    contradiction_details: unknown | null;
    temporal_pattern: string | null;
    affected_entities: string[];
    data_points: string[];
}

export interface InsightExtractionInput extends AgentInput {
    filtered_sources: NormalizedSource[];
    credibility_scores: CredibilityScore[];
    contradictions: Contradiction[];
    temporal_patterns: TemporalPattern[];
}

export interface InsightExtractionOutput extends AgentOutput {
    insights: Insight[];
    rag_context_chunks_used: number;
    resolved_facts_topics_used: string[];
    base_model_block_count: number;
    base_model_score: number;
}

/**
 * Five domain-specific supply-chain questions used for Multi-Query retrieval.
 * Each query is embedded independently and the union of top hits is taken
 * (deduped by chunk id), giving M5 up to 5 × 5 = 25 distinct context chunks.
 */
const DOMAIN_QUERIES: readonly string[] = [
    "What is the current inventory shortage, stock level and out-of-stock risk?",
    "What is the demand trajectory — sales spike, seasonal surge, or forecast change?",
    "Are there supplier delays, transport disruptions, or logistics constraints?",
    "What is the budgetary impact — costs, revenue at risk, or compliance exposure?",
    "Are there contradictions, anomalies, or data-quality issues across sources?",
] as const;

const DEDUP_SIMILARITY_THRESHOLD = 0.80;
const MAX_CHUNKS_PER_QUERY = 5;

export class InsightExtractionAgent extends BaseAgent<
    InsightExtractionInput,
    InsightExtractionOutput
> {
    constructor() {
        super("InsightExtractionAgent", "");
    }

    protected async execute(
        input: InsightExtractionInput
    ): Promise<InsightExtractionOutput> {
        const {
            pipeline_id,
            filtered_sources,
            credibility_scores,
            contradictions,
            temporal_patterns,
        } = input;
        const startTime = Date.now();

        // ── 1. Read resolvedFacts FIRST — single source of truth from M7. ──
        const stateSnapshot = pipelineState.get(pipeline_id);
        const resolvedFacts = stateSnapshot.resolvedFacts;
        const resolvedTopics = Object.keys(resolvedFacts);

        this.logDecision(
            pipeline_id,
            `M5 read ${resolvedTopics.length} resolvedFacts topic(s) from PipelineState before RAG retrieval — ${resolvedTopics.join(", ") || "(none — Phase 1 produced no conflicts to resolve)"}`,
            "resolvedFacts_loaded",
            1.0
        );

        // ── 2. Ephemeral vector store, scoped to this pipeline_id only. ──
        const store = new PipelineVectorStore(pipeline_id, {
            embeddingBatchSize: 4,
            interBatchDelayMs: 250,
        });

        try {
            // ── 3. Ingest serialized tabular chunks (Phase-1 safe form). ──
            const ingestInputs = this.buildIngestInputs(filtered_sources, resolvedFacts);
            await store.ingest(ingestInputs);

            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: "M5_EphemeralVectorStore_Populated",
                tool_called: this.agentName,
                reasoning: `Ephemeral PipelineVectorStore populated with ${store.size()} chunks from ${filtered_sources.length} filtered sources + ${resolvedTopics.length} resolvedFact topics`,
                status: "SUCCESS",
                rollback_action: "Store will be destroyed at end of M5 execution",
                latency_ms: Date.now() - startTime,
                cost: 0,
                rubric_category: "task_execution",
            });

            // ── 4. Multi-Query retrieval over 5 domain questions. ──
            const queryEmbeddings = await Promise.all(
                DOMAIN_QUERIES.map((q) => this.llmEmbed(pipeline_id, q))
            );
            const retrieved = store.multiQuery(queryEmbeddings, MAX_CHUNKS_PER_QUERY);

            this.logDecision(
                pipeline_id,
                `Multi-Query retrieval: ${DOMAIN_QUERIES.length} domain queries → ${retrieved.length} unique chunks`,
                "multi_query_retrieved",
                retrieved.length > 0 ? 0.9 : 0.4
            );

            // ── 5. First LLM pass → primary insights. ──
            const context = this.formatContext(retrieved);
            let insights = await this.generateInsights(
                pipeline_id,
                context,
                contradictions,
                credibility_scores,
                temporal_patterns,
                resolvedFacts,
                /* judgeCritique */ null
            );

            // ── 6. Deduplicate insights by embedding similarity (>0.80). ──
            insights = await this.deduplicateByEmbedding(pipeline_id, insights);

            // ── 7. AMCE BLOCK + BASE MODEL validation (Gemini 1.5 Pro). ──
            // The base-model judge is the SOLE AMCE gate for M5. No ZodValidator
            // path — the Phase 2 audit caught that as an orchestration bypass.
            let amceBlockCount = 0;
            let amceScore = 1.0;
            let judgeReasoning = "";

            // Deterministic safety net BEFORE judging: if the LLM produced
            // nothing usable, synthesize fallback insights from resolvedFacts /
            // contradictions / temporal patterns so the judge has a real payload.
            if (insights.length === 0) {
                insights = this.generateFallbackInsights(
                    contradictions,
                    temporal_patterns,
                    credibility_scores,
                    resolvedFacts
                );
                this.logDecision(
                    pipeline_id,
                    `M5 LLM produced no usable insights — pre-judge fallback synthesized ${insights.length} insights`,
                    "fallback_insights_pre_judge",
                    0.5
                );
            }

            const judgementCriteria = [
                "Every insight has a clear, specific title (not a generic placeholder)",
                "Severity matches the data (e.g. critical only if stockout/revenue loss imminent)",
                "supporting_sources cite actual source_ids from the input",
                "If insights reference numeric facts (stock, demand), values agree with resolvedFacts",
                "No two insights cover the same finding with the same evidence",
                "Output cardinality is between 1 and 7 inclusive",
            ];

            const firstJudge = await validateWithBaseModel({
                pipelineId: pipeline_id,
                moduleName: "M5_InsightExtraction",
                schemaName: "insight_extraction_v1",
                contextSummary:
                    "Phase C insight extraction — 3-7 supply-chain insights derived from resolvedFacts + multi-query RAG retrieval over 5 domain questions",
                moduleOutput: { insights, resolved_facts_topics_used: resolvedTopics },
                judgementCriteria,
            });
            amceScore = firstJudge.score;
            judgeReasoning = firstJudge.reasoning;

            // ── 8. If BLOCK → re-prompt with critique, then re-judge. ──
            if (firstJudge.decision === "BLOCK") {
                amceBlockCount++;
                antigravityFileLogger.append({
                    timestamp: new Date().toISOString(),
                    step: "AMCE_BLOCK_M5_BaseModelReprompt",
                    tool_called: "BaseModelValidator",
                    reasoning: `Base-model judge BLOCKed M5 (score=${firstJudge.score.toFixed(2)}): ${firstJudge.reasoning}. Antigravity re-prompting M5 LLM with critique appended; retry uses base model.`,
                    status: "ROLLED_BACK",
                    rollback_action: "Re-prompt primary LLM with judge critique appended; re-run base-model judge",
                    latency_ms: Date.now() - startTime,
                    cost: 0,
                    rubric_category: "failure_recovery",
                });

                const reprompted = await this.generateInsights(
                    pipeline_id,
                    context,
                    contradictions,
                    credibility_scores,
                    temporal_patterns,
                    resolvedFacts,
                    firstJudge.reasoning + (firstJudge.issues.length ? ` // Issues: ${firstJudge.issues.join("; ")}` : "")
                );
                const repromptedDeduped = await this.deduplicateByEmbedding(pipeline_id, reprompted);
                if (repromptedDeduped.length >= 1) {
                    insights = repromptedDeduped;
                } else {
                    // Fall back to deterministic generator so we present the
                    // judge a real payload on the second pass.
                    insights = this.generateFallbackInsights(
                        contradictions,
                        temporal_patterns,
                        credibility_scores,
                        resolvedFacts
                    );
                }

                // ── 9. RE-JUDGE the corrected output with Gemini 1.5 Pro. ──
                const secondJudge = await validateWithBaseModel({
                    pipelineId: pipeline_id,
                    moduleName: "M5_InsightExtraction_PostReprompt",
                    schemaName: "insight_extraction_v1",
                    contextSummary:
                        "Phase C insight extraction — second pass after AMCE BLOCK + BASE MODEL re-prompt with judge critique",
                    moduleOutput: { insights, resolved_facts_topics_used: resolvedTopics },
                    judgementCriteria,
                });
                amceScore = secondJudge.score;
                judgeReasoning = secondJudge.reasoning;

                if (secondJudge.decision === "BLOCK") {
                    amceBlockCount++;
                    // ── 10. STRICT BLOCK — halt the pipeline. ──
                    antigravityFileLogger.append({
                        timestamp: new Date().toISOString(),
                        step: "AMCE_BLOCK_M5_BaseModelFinal",
                        tool_called: "BaseModelValidator",
                        reasoning: `M5 still failing AMCE after re-prompt (score=${secondJudge.score.toFixed(2)}): ${secondJudge.reasoning}. Antigravity halts Phase C. Issues: ${secondJudge.issues.join("; ")}`,
                        status: "FAILED",
                        rollback_action: "Pipeline halts — strict BLOCK enforcement per V2 AMCE contract. Antigravity must not propagate unverified insights to M8/M9.",
                        latency_ms: Date.now() - startTime,
                        cost: 0,
                        rubric_category: "failure_recovery",
                    });
                    throw new AMCEBlockError(
                        "M5_InsightExtraction",
                        "insight_extraction_v1",
                        secondJudge.score,
                        secondJudge.reasoning,
                        secondJudge.issues
                    );
                }
            }

            this.logDecision(
                pipeline_id,
                `M5 complete: ${insights.length} insights, ${retrieved.length} RAG chunks, ${resolvedTopics.length} resolvedFacts read, ${amceBlockCount} AMCE BLOCK events (recovered). Base-model judge: ${judgeReasoning.slice(0, 120)}`,
                "insights_extracted",
                insights.reduce((sum, i) => sum + i.confidence, 0) / (insights.length || 1)
            );

            return {
                pipeline_id,
                agent_name: this.agentName,
                completed_at: new Date().toISOString(),
                insights,
                rag_context_chunks_used: retrieved.length,
                resolved_facts_topics_used: resolvedTopics,
                base_model_block_count: amceBlockCount,
                base_model_score: amceScore,
            };
        } finally {
            // ── 10. EXPLICIT DESTRUCTION — V2 cross-run-contamination guard. ──
            store.destroy();
            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: "M5_EphemeralVectorStore_Destroyed",
                tool_called: this.agentName,
                reasoning: `Ephemeral vector store for pipeline ${pipeline_id} destroyed. Stats: ${JSON.stringify(store.stats())}`,
                status: "SUCCESS",
                rollback_action: "none",
                latency_ms: Date.now() - startTime,
                cost: 0,
                rubric_category: "task_execution",
            });
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────

    private buildIngestInputs(
        sources: NormalizedSource[],
        resolvedFacts: Record<string, { value: unknown; unit?: string; sources_involved: string[]; resolution_strategy: string }>
    ): Array<{ source_id: string; text: string; source_type: string }> {
        const ingest: Array<{ source_id: string; text: string; source_type: string }> = [];

        // 1. resolvedFacts come FIRST — these are the truth. One chunk per topic.
        for (const [topic, fact] of Object.entries(resolvedFacts)) {
            const unit = fact.unit ? ` ${fact.unit}` : "";
            ingest.push({
                source_id: "RESOLVED",
                source_type: "resolved_fact",
                text: `RESOLVED FACT — topic: ${topic} | value: ${String(fact.value)}${unit} | strategy: ${fact.resolution_strategy} | sources_involved: ${fact.sources_involved.join(", ")}`,
            });
        }

        // 2. Then the serialized tabular text from Phase 1. NEVER raw rows.
        for (const source of sources) {
            const text = (source.serialized_text && source.serialized_text.length > 0)
                ? source.serialized_text
                : source.raw_text;
            const chunks = PipelineVectorStore.chunkText(text, 220, 40);
            for (const chunk of chunks) {
                ingest.push({
                    source_id: source.source_id,
                    text: chunk,
                    source_type: source.source_type,
                });
            }
        }

        return ingest;
    }

    private formatContext(retrieved: RetrievalResult[]): string {
        if (retrieved.length === 0) return "(no RAG chunks retrieved)";
        return retrieved
            .map((r) => `[${r.metadata.source_id} | sim=${r.similarity.toFixed(3)}] ${r.text}`)
            .join("\n\n---\n\n");
    }

    private async generateInsights(
        pipelineId: string,
        ragContext: string,
        contradictions: Contradiction[],
        credibilityScores: CredibilityScore[],
        temporalPatterns: TemporalPattern[],
        resolvedFacts: Record<string, { value: unknown; unit?: string; resolution_strategy: string }>,
        judgeCritique: string | null
    ): Promise<Insight[]> {
        const prompt = this.buildInsightPrompt(
            ragContext,
            contradictions,
            credibilityScores,
            temporalPatterns,
            resolvedFacts,
            judgeCritique
        );

        try {
            const useBaseModel = judgeCritique !== null; // on retry, swap to base model
            const raw = await this.llmComplete(
                pipelineId,
                prompt,
                useBaseModel,
                judgeCritique ? "insight_extraction_reprompt" : "insight_extraction"
            );
            const parsed = this.parseLLMJSON<{ insights: Insight[] }>(raw);
            if (parsed?.insights && parsed.insights.length > 0) {
                return parsed.insights.map((ins, i) => ({
                    ...ins,
                    insight_id: ins.insight_id || `INS-${String(i + 1).padStart(3, "0")}`,
                }));
            }
        } catch (err) {
            console.warn("[InsightExtraction] LLM call failed:", err);
        }
        return [];
    }

    private async deduplicateByEmbedding(
        pipelineId: string,
        insights: Insight[]
    ): Promise<Insight[]> {
        if (insights.length <= 1) return insights;

        const embeddings: number[][] = [];
        for (const ins of insights) {
            const text = `${ins.title}. ${ins.description}`;
            try {
                embeddings.push(await this.llmEmbed(pipelineId, text));
            } catch {
                embeddings.push([]);
            }
        }

        const kept: Insight[] = [];
        const keptEmb: number[][] = [];

        for (let i = 0; i < insights.length; i++) {
            const emb = embeddings[i];
            let isDuplicate = false;
            if (emb.length > 0) {
                for (let j = 0; j < keptEmb.length; j++) {
                    if (keptEmb[j].length === 0) continue;
                    const sim = cosineSimilarity(emb, keptEmb[j]);
                    if (sim > DEDUP_SIMILARITY_THRESHOLD) {
                        isDuplicate = true;
                        antigravityFileLogger.append({
                            timestamp: new Date().toISOString(),
                            step: "M5_InsightDeduplicated",
                            tool_called: this.agentName,
                            reasoning: `Insight "${insights[i].title}" dropped — cos similarity ${sim.toFixed(3)} > ${DEDUP_SIMILARITY_THRESHOLD} with kept insight "${kept[j].title}"`,
                            status: "SUCCESS",
                            rollback_action: "none",
                            latency_ms: 0,
                            cost: 0,
                            rubric_category: "task_execution",
                        });
                        break;
                    }
                }
            }
            if (!isDuplicate) {
                kept.push(insights[i]);
                keptEmb.push(emb);
            }
        }

        return kept;
    }

    private buildInsightPrompt(
        context: string,
        contradictions: Contradiction[],
        credibilityScores: CredibilityScore[],
        temporalPatterns: TemporalPattern[],
        resolvedFacts: Record<string, { value: unknown; unit?: string; resolution_strategy: string }>,
        judgeCritique: string | null
    ): string {
        const resolvedSummary =
            Object.entries(resolvedFacts)
                .map(([topic, f]) => `  - ${topic} = ${String(f.value)}${f.unit ? " " + f.unit : ""} (strategy: ${f.resolution_strategy})`)
                .join("\n") || "  (no resolved conflicts — read RAG chunks directly)";

        const critiqueBlock = judgeCritique
            ? `\nPRIOR ATTEMPT WAS BLOCKED BY THE AMCE BASE-MODEL JUDGE. Address this critique in your new output:\n"${judgeCritique}"\n`
            : "";

        return `You are an expert supply-chain analyst. Extract 3-7 actionable insights.

RESOLVED FACTS (single source of truth — trust these over raw RAG):
${resolvedSummary}

RELEVANT RAG CONTEXT (multi-query retrieval over 5 domain questions):
${context}

DETECTED CONTRADICTIONS:
${JSON.stringify(
    contradictions.map((c) => ({
        topic: c.topic,
        severity: c.severity,
        claim_a: c.claim_a,
        claim_b: c.claim_b,
        sources: c.sources_involved,
    })),
    null,
    2
)}

SOURCE CREDIBILITY SCORES:
${JSON.stringify(
    credibilityScores.map((s) => ({
        source_id: s.source_id,
        total_score: s.total_score,
        tier: s.credibility_tier,
    })),
    null,
    2
)}

TEMPORAL PATTERNS:
${JSON.stringify(
    temporalPatterns.map((p) => ({
        metric: p.metric_name,
        pattern: p.pattern_type,
        change_pct: p.change_magnitude,
        direction: p.change_direction,
    })),
    null,
    2
)}
${critiqueBlock}
RULES:
1. Generate 3-7 specific insights (no more, no less).
2. Cite source_ids in supporting_sources for every insight.
3. If sources contradict and no resolvedFact exists, set requires_resolution: true and explain in contradiction_details.
4. Where a resolvedFact exists for a topic, use its value — never the raw conflicting numbers.
5. Prioritize HIGH-credibility sources.
6. Categories: "trend" | "risk" | "opportunity" | "contradiction".
7. Severities: "critical" | "high" | "medium" | "low".

Respond with ONLY valid JSON, no markdown:
{
  "insights": [
    {
      "insight_id": "INS-001",
      "title": "...",
      "description": "...",
      "category": "risk",
      "severity": "critical",
      "confidence": 0.85,
      "supporting_sources": ["SRC-001"],
      "requires_resolution": false,
      "contradiction_details": null,
      "temporal_pattern": "spike",
      "affected_entities": ["SKU-1234"],
      "data_points": ["Demand: +30%"]
    }
  ]
}`;
    }

    private generateFallbackInsights(
        contradictions: Contradiction[],
        temporalPatterns: TemporalPattern[],
        credibilityScores: CredibilityScore[],
        resolvedFacts: Record<string, { value: unknown; unit?: string }>
    ): Insight[] {
        const insights: Insight[] = [];

        for (const [topic, fact] of Object.entries(resolvedFacts)) {
            insights.push({
                insight_id: `INS-${String(insights.length + 1).padStart(3, "0")}`,
                title: `Resolved fact: ${topic.replace(/_/g, " ")}`,
                description: `${topic} = ${String(fact.value)}${fact.unit ? " " + fact.unit : ""} (post-conflict resolution)`,
                category: "trend",
                severity: "medium",
                confidence: 0.7,
                supporting_sources: credibilityScores.map((s) => s.source_id),
                requires_resolution: false,
                contradiction_details: null,
                temporal_pattern: null,
                affected_entities: [topic],
                data_points: [`${topic}=${String(fact.value)}`],
            });
        }

        contradictions
            .filter((c) => c.severity === "CRITICAL" || c.severity === "HIGH")
            .forEach((c) => {
                insights.push({
                    insight_id: `INS-${String(insights.length + 1).padStart(3, "0")}`,
                    title: `Conflicting information on ${c.topic.replace(/_/g, " ")}`,
                    description: `${c.claim_a} vs ${c.claim_b}`,
                    category: "contradiction",
                    severity: c.severity === "CRITICAL" ? "critical" : "high",
                    confidence: c.confidence,
                    supporting_sources: c.sources_involved,
                    requires_resolution: true,
                    contradiction_details: { type: c.type, claim_a: c.claim_a, claim_b: c.claim_b },
                    temporal_pattern: null,
                    affected_entities: [],
                    data_points: [c.claim_a, c.claim_b],
                });
            });

        temporalPatterns
            .filter((p) => p.pattern_type === "spike" || p.pattern_type === "decline")
            .forEach((p) => {
                insights.push({
                    insight_id: `INS-${String(insights.length + 1).padStart(3, "0")}`,
                    title: `${p.pattern_type === "spike" ? "Spike" : "Decline"} detected in ${p.metric_name.replace(/_/g, " ")}`,
                    description: `${p.metric_name} shows a ${p.pattern_type} pattern with ${p.change_magnitude.toFixed(1)}% change (${p.change_direction})`,
                    category: "risk",
                    severity: p.change_magnitude > 30 ? "critical" : "high",
                    confidence: p.confidence,
                    supporting_sources: credibilityScores.map((s) => s.source_id),
                    requires_resolution: false,
                    contradiction_details: null,
                    temporal_pattern: p.pattern_type,
                    affected_entities: [p.metric_name],
                    data_points: [`${p.metric_name}: ${p.change_direction} ${p.change_magnitude.toFixed(1)}%`],
                });
            });

        if (insights.length === 0) {
            insights.push({
                insight_id: "INS-001",
                title: "Analysis requires manual review",
                description:
                    "Automated insight extraction was inconclusive — manual triage recommended.",
                category: "risk",
                severity: "medium",
                confidence: 0.3,
                supporting_sources: credibilityScores.map((s) => s.source_id),
                requires_resolution: false,
                contradiction_details: null,
                temporal_pattern: null,
                affected_entities: [],
                data_points: [],
            });
        }

        return insights.slice(0, 7);
    }

    private parseLLMJSON<T>(raw: string): T | null {
        const attempts: (string | null)[] = [
            raw,
            (() => { const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/); return m ? m[1] : null; })(),
            (() => { const s = raw.indexOf("{"); const e = raw.lastIndexOf("}"); return s !== -1 && e > s ? raw.slice(s, e + 1) : null; })(),
        ];
        for (const a of attempts) {
            if (!a) continue;
            try { return JSON.parse(a) as T; } catch { continue; }
        }
        return null;
    }
}

export const insightExtractionAgent = new InsightExtractionAgent();
