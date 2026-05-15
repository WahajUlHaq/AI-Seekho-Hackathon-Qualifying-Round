import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { SourceDocument } from "../interfaces/source-document.interface";
import { VectorStore, VectorChunk } from "../interfaces/vector-store.interface";
import { InMemoryVectorStore } from "../stores/in-memory-vector.store";
import { Resolution, InvestigationPath } from "./conflict-resolution.agent";
import { MetricAnalysis } from "./temporal-analysis.agent";

interface InsightExtractionConfig {
    chunkSizeTokens: number;
    chunkOverlapTokens: number;
    topK: number;
    embeddingBatchSize: number;
}

export interface TrendItem {
    title: string;
    description: string;
    confidence: number;
}

export interface RiskItem {
    title: string;
    description: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface OpportunityItem {
    title: string;
    description: string;
}

export interface ConflictSummary {
    topic: string;
    summary: string;
}

export interface InsightExtractionInput extends AgentInput {
    sources: SourceDocument[];
    resolutions?: Resolution[];
    investigation_paths?: InvestigationPath[];
    temporal_patterns?: MetricAnalysis[];
}

export interface InsightExtractionOutput extends AgentOutput {
    extraction_id: string;
    extracted_at: string;
    chunks_indexed: number;
    sources_used: number;
    trends: TrendItem[];
    risks: RiskItem[];
    opportunities: OpportunityItem[];
    persistent_conflicts: ConflictSummary[];
}

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

export class InsightExtractionAgent extends BaseAgent<
    InsightExtractionInput,
    InsightExtractionOutput
> {
    private readonly cfg: InsightExtractionConfig;
    private readonly vectorStore: VectorStore;

    constructor(vectorStore?: VectorStore) {
        super("InsightExtractionAgent", "insight_extraction");

        const thresholdsPath = path.resolve(__dirname, "../../config/agentThresholds.config.json");
        const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, "utf-8"));
        this.cfg = thresholds.insightExtraction as InsightExtractionConfig;

        this.vectorStore = vectorStore ?? new InMemoryVectorStore();
    }

    protected async execute(input: InsightExtractionInput): Promise<InsightExtractionOutput> {
        const {
            pipeline_id,
            sources,
            resolutions = [],
            investigation_paths = [],
            temporal_patterns = [],
        } = input;

        await this.vectorStore.clear();

        // Step A: chunk all documents
        const allChunks: VectorChunk[] = [];
        for (const doc of sources) {
            const chunks = this.chunkText(doc);
            allChunks.push(...chunks);
        }

        // Step B: embed and index in batches
        const { embeddingBatchSize } = this.cfg;
        for (let i = 0; i < allChunks.length; i += embeddingBatchSize) {
            const batch = allChunks.slice(i, i + embeddingBatchSize);
            const embeddings = await Promise.all(
                batch.map(chunk => this.llmEmbed(pipeline_id, chunk.text).catch(() => [] as number[]))
            );
            for (let j = 0; j < batch.length; j++) {
                if (embeddings[j].length > 0) {
                    batch[j].embedding = embeddings[j];
                    await this.vectorStore.upsert(batch[j]);
                }
            }
        }

        // Step C: build queries from resolutions, investigation paths, and static queries
        const queries: string[] = [
            "main risks and threats",
            "opportunities and improvements",
            "trends and patterns over time",
        ];

        for (const res of resolutions) {
            queries.push(`resolved conflict: ${res.reasoning}`);
        }
        for (const inv of investigation_paths) {
            queries.push(`unresolved investigation: ${inv.topic}`);
        }
        for (const pat of temporal_patterns) {
            queries.push(`temporal pattern ${pat.classification} for metric ${pat.metric}`);
        }

        // Retrieve top-K chunks for each query and build context
        const retrievedTexts: string[] = [];
        for (const query of queries) {
            try {
                const queryEmb = await this.llmEmbed(pipeline_id, query);
                const chunks   = await this.vectorStore.search(queryEmb, this.cfg.topK);
                chunks.forEach(c => retrievedTexts.push(c.text));
            } catch {
                // skip failed retrieval
            }
        }

        const context = [...new Set(retrievedTexts)].join("\n\n---\n\n").slice(0, 8000);

        // Step D: synthesize insights
        const insights = await this.synthesize(pipeline_id, context, investigation_paths);

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            extraction_id: makeId("INS"),
            extracted_at: new Date().toISOString(),
            chunks_indexed: this.vectorStore.count(),
            sources_used: sources.length,
            ...insights,
        };
    }

    private chunkText(doc: SourceDocument): VectorChunk[] {
        const charsPerToken = 4;
        const chunkSizeChars  = this.cfg.chunkSizeTokens * charsPerToken;
        const overlapChars    = this.cfg.chunkOverlapTokens * charsPerToken;
        const step = chunkSizeChars - overlapChars;

        const chunks: VectorChunk[] = [];
        let start = 0;
        let idx   = 0;

        while (start < doc.content.length) {
            const text = doc.content.slice(start, start + chunkSizeChars);
            chunks.push({
                id: `CHUNK-${doc.source_id}-${idx}`,
                source_id: doc.source_id,
                text,
                embedding: [],   // filled during embed step
                metadata: { source_type: doc.source_type, chunk_index: idx },
            });
            start += step;
            idx++;
            if (text.length < chunkSizeChars) break;
        }

        return chunks;
    }

    private async synthesize(
        pipelineId: string,
        context: string,
        investigationPaths: InvestigationPath[]
    ): Promise<{
        trends: TrendItem[];
        risks: RiskItem[];
        opportunities: OpportunityItem[];
        persistent_conflicts: ConflictSummary[];
    }> {
        const unresolvedTopics = investigationPaths.map(p => p.topic).join(", ") || "none";

        const prompt = `You are an expert analyst. Based on the retrieved context below, extract structured insights.

Context:
${context}

Unresolved conflict topics: ${unresolvedTopics}

Reply with ONLY valid JSON matching this exact shape:
{
  "trends": [{"title": "string", "description": "string", "confidence": 0.0}],
  "risks": [{"title": "string", "description": "string", "severity": "LOW|MEDIUM|HIGH|CRITICAL"}],
  "opportunities": [{"title": "string", "description": "string"}],
  "persistent_conflicts": [{"topic": "string", "summary": "string"}]
}

Requirements:
- At least 1 entry in each array
- Risk severity must be exactly one of: LOW, MEDIUM, HIGH, CRITICAL
- Confidence must be a number between 0 and 1`;

        try {
            const response = await this.llmComplete(pipelineId, prompt, false, "insight_synthesis");
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    trends:              Array.isArray(parsed.trends)              ? parsed.trends              : [{ title: "Analysis complete", description: "See context", confidence: 0.5 }],
                    risks:               Array.isArray(parsed.risks)               ? parsed.risks               : [{ title: "Unknown risk", description: "Manual review recommended", severity: "MEDIUM" }],
                    opportunities:       Array.isArray(parsed.opportunities)       ? parsed.opportunities       : [{ title: "Review opportunities", description: "Further analysis required" }],
                    persistent_conflicts: Array.isArray(parsed.persistent_conflicts) ? parsed.persistent_conflicts : [],
                };
            }
        } catch {
            // fallback below
        }

        return {
            trends:              [{ title: "Synthesis error", description: "LLM synthesis failed — manual review required", confidence: 0 }],
            risks:               [{ title: "Synthesis unavailable", description: "Could not extract risks automatically", severity: "MEDIUM" }],
            opportunities:       [{ title: "Synthesis unavailable", description: "Could not extract opportunities automatically" }],
            persistent_conflicts: investigationPaths.map(p => ({ topic: p.topic, summary: p.recommended_steps.join("; ") })),
        };
    }
}
