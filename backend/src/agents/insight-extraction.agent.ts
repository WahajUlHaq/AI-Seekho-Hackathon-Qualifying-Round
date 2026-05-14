import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { NormalizedSource } from "./multi-source-ingestion.agent";
import { CredibilityScore } from "./credibility-scorer.agent";
import { Contradiction } from "./contradiction-detector.agent";
import { TemporalPattern } from "./temporal-analysis.agent";
import { VectorEntry, topKSimilar } from "../utils/cosine-similarity";

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
}

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

        // Build in-memory vector store from source chunks
        const vectorStore = await this.buildVectorStore(filtered_sources, pipeline_id);

        // Build RAG query from contradictions + temporal patterns
        const queryText = [
            "inventory shortage stock levels supply chain demand",
            ...contradictions.map((c) => c.topic),
            ...temporal_patterns.map((p) => p.metric_name),
        ].join(" ");

        const queryEmbedding = await this.llmEmbed(pipeline_id, queryText);
        const topChunks = topKSimilar(queryEmbedding, vectorStore, 5);
        const context = topChunks
            .map((c) => `[${c.metadata.source_id}] ${c.metadata.text}`)
            .join("\n\n---\n\n");

        const prompt = this.buildInsightPrompt(
            context,
            contradictions,
            credibility_scores,
            temporal_patterns
        );

        let insights: Insight[] = [];
        try {
            const raw = await this.llmComplete(pipeline_id, prompt, false, "insight_extraction");
            const parsed = this.parseLLMJSON<{ insights: Insight[] }>(raw);
            if (parsed?.insights && parsed.insights.length > 0) {
                insights = parsed.insights.map((ins, i) => ({
                    ...ins,
                    insight_id: ins.insight_id || `INS-${String(i + 1).padStart(3, "0")}`,
                }));
            }
        } catch (err) {
            console.warn("[InsightExtraction] LLM call failed:", err);
        }

        // Ensure we have at least one insight, and always include contradictions as insights
        if (insights.length === 0) {
            insights = this.generateFallbackInsights(contradictions, temporal_patterns, credibility_scores);
        }

        this.logDecision(
            pipeline_id,
            `Extracted ${insights.length} insights from ${topChunks.length} RAG chunks — risks: ${insights.filter(i => i.category === "risk").length}, contradictions: ${insights.filter(i => i.category === "contradiction").length}`,
            "insights_extracted",
            insights.reduce((sum, i) => sum + i.confidence, 0) / (insights.length || 1)
        );

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            insights,
            rag_context_chunks_used: topChunks.length,
        };
    }

    private async buildVectorStore(
        sources: NormalizedSource[],
        pipelineId: string
    ): Promise<VectorEntry[]> {
        const store: VectorEntry[] = [];

        for (const source of sources) {
            const chunks = this.chunkText(source.raw_text, 500, 100);
            for (let i = 0; i < chunks.length; i++) {
                const embedding = await this.llmEmbed(pipelineId, chunks[i]);
                store.push({
                    id: `${source.source_id}-chunk-${i}`,
                    embedding,
                    metadata: {
                        source_id: source.source_id,
                        chunk_index: i,
                        text: chunks[i],
                    },
                });
            }
        }

        return store;
    }

    private chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length === 0) return [];

        const chunks: string[] = [];
        let i = 0;
        while (i < words.length) {
            const end = Math.min(i + chunkSize, words.length);
            chunks.push(words.slice(i, end).join(" "));
            if (end === words.length) break;
            i += chunkSize - overlap;
        }
        return chunks;
    }

    private buildInsightPrompt(
        context: string,
        contradictions: Contradiction[],
        credibilityScores: CredibilityScore[],
        temporalPatterns: TemporalPattern[]
    ): string {
        return `You are an expert analyst. Given multiple content sources (some may contradict each other), extract meaningful insights.

RELEVANT CONTENT CHUNKS (top 5 by relevance):
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

RULES:
1. Extract 3-7 specific, actionable insights
2. For each insight, cite which sources support it (use source_ids)
3. If sources contradict, set requires_resolution: true and explain the conflict in contradiction_details
4. Prioritize insights from high-credibility sources
5. Categories: "trend" | "risk" | "opportunity" | "contradiction"
6. Severities: "critical" | "high" | "medium" | "low"

Respond with ONLY valid JSON, no markdown fences, no preamble:
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
        credibilityScores: CredibilityScore[]
    ): Insight[] {
        const insights: Insight[] = [];

        // One insight per CRITICAL contradiction
        contradictions
            .filter((c) => c.severity === "CRITICAL" || c.severity === "HIGH")
            .forEach((c, i) => {
                insights.push({
                    insight_id: `INS-${String(i + 1).padStart(3, "0")}`,
                    title: `Conflicting information on ${c.topic.replace(/_/g, " ")}`,
                    description: `${c.claim_a} vs ${c.claim_b}`,
                    category: "contradiction",
                    severity: c.severity === "CRITICAL" ? "critical" : "high",
                    confidence: c.confidence,
                    supporting_sources: c.sources_involved,
                    requires_resolution: true,
                    contradiction_details: {
                        type: c.type,
                        claim_a: c.claim_a,
                        claim_b: c.claim_b,
                    },
                    temporal_pattern: null,
                    affected_entities: [],
                    data_points: [c.claim_a, c.claim_b],
                });
            });

        // One insight per spike/decline temporal pattern
        temporalPatterns
            .filter((p) => p.pattern_type === "spike" || p.pattern_type === "decline")
            .forEach((p, i) => {
                insights.push({
                    insight_id: `INS-${String(insights.length + i + 1).padStart(3, "0")}`,
                    title: `${p.pattern_type === "spike" ? "Spike" : "Decline"} detected in ${p.metric_name.replace(/_/g, " ")}`,
                    description: `${p.metric_name} shows a ${p.pattern_type} pattern with ${p.change_magnitude.toFixed(1)}% change (${p.change_direction}) over ${p.time_window}`,
                    category: p.pattern_type === "spike" ? "risk" : "risk",
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
                title: "Analysis requires review",
                description: "Automated insight extraction was incomplete — manual review of sources recommended",
                category: "risk",
                severity: "medium",
                confidence: 0.1,
                supporting_sources: credibilityScores.map((s) => s.source_id),
                requires_resolution: false,
                contradiction_details: null,
                temporal_pattern: null,
                affected_entities: [],
                data_points: [],
            });
        }

        return insights;
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
