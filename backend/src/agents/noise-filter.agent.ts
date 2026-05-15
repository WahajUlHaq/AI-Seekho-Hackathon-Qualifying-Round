import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { SourceDocument } from "../interfaces/source-document.interface";
import { VectorStore } from "../interfaces/vector-store.interface";
import { InMemoryVectorStore, cosineSimilarity } from "../stores/in-memory-vector.store";
import { traceCollector } from "../tracing/collector";

interface NoiseFilterConfig {
    cosineSimilarityThreshold: number;
    spamBatchSize: number;
}

export interface NoiseFilterInput extends AgentInput {
    sources: SourceDocument[];
}

export interface NoiseFilterOutput extends AgentOutput {
    filter_id: string;
    filtered_at: string;
    input_count: number;
    output_count: number;
    removed_count: number;
    sources: SourceDocument[];
}

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

export class NoiseFilterAgent extends BaseAgent<NoiseFilterInput, NoiseFilterOutput> {
    private readonly cfg: NoiseFilterConfig;
    private readonly vectorStore: VectorStore;

    constructor(vectorStore?: VectorStore) {
        super("NoiseFilterAgent", "noise_filter");

        const thresholdsPath = path.resolve(__dirname, "../../config/agentThresholds.config.json");
        const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, "utf-8"));
        this.cfg = thresholds.noiseFilter as NoiseFilterConfig;

        this.vectorStore = vectorStore ?? new InMemoryVectorStore();
    }

    protected async execute(input: NoiseFilterInput): Promise<NoiseFilterOutput> {
        const { pipeline_id, sources } = input;
        const inputCount = sources.length;

        // Filter 1: stale removal
        const afterStale = this.filterStale(pipeline_id, sources);

        // Filter 2: LLM spam detection
        const afterSpam = await this.filterSpam(pipeline_id, afterStale);

        // Filter 3: cosine deduplication
        const afterDedup = await this.filterDuplicates(pipeline_id, afterSpam);

        const removedCount = inputCount - afterDedup.length;

        traceCollector.log(pipeline_id, {
            pipeline_id,
            event_type: "decision",
            agent: this.agentName,
            message: `Noise filter complete: ${inputCount} → ${afterDedup.length} (removed ${removedCount})`,
            decision: "filter_complete",
            confidence: 1.0,
        });

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            filter_id: makeId("FLT"),
            filtered_at: new Date().toISOString(),
            input_count: inputCount,
            output_count: afterDedup.length,
            removed_count: removedCount,
            sources: afterDedup,
        };
    }

    private filterStale(pipelineId: string, sources: SourceDocument[]): SourceDocument[] {
        const kept: SourceDocument[] = [];
        const removed: string[] = [];

        for (const doc of sources) {
            if ((doc.credibility_score?.recency ?? 1) === 0) {
                removed.push(doc.source_id);
            } else {
                kept.push(doc);
            }
        }

        if (removed.length > 0) {
            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "decision",
                agent: this.agentName,
                message: `Stale filter removed ${removed.length} docs: [${removed.join(", ")}]`,
                decision: "stale_removed",
                confidence: 1.0,
            });
        }

        return kept;
    }

    private async filterSpam(pipelineId: string, sources: SourceDocument[]): Promise<SourceDocument[]> {
        if (sources.length === 0) return sources;

        const spamIds = new Set<string>();

        for (let i = 0; i < sources.length; i += this.cfg.spamBatchSize) {
            const batch = sources.slice(i, i + this.cfg.spamBatchSize);
            const summaries = batch.map(d =>
                `ID: ${d.source_id}\nContent (first 200 chars): ${d.content.slice(0, 200)}`
            ).join("\n\n---\n\n");

            const prompt = `You are a content quality filter. Review the following documents and identify any that are spam, irrelevant noise, or clearly unreliable.

Documents:
${summaries}

Reply with ONLY a JSON array of source_ids to remove (empty array if none):
["SRC-ID1", "SRC-ID2", ...]`;

            try {
                const response = await this.llmComplete(pipelineId, prompt, false, "spam_detection");
                const jsonMatch = response.match(/\[[\s\S]*?\]/);
                if (jsonMatch) {
                    const ids = JSON.parse(jsonMatch[0]) as string[];
                    ids.forEach(id => spamIds.add(id));
                }
            } catch {
                // fail-open: keep all docs in this batch on parse/LLM error
            }
        }

        const kept = sources.filter(d => !spamIds.has(d.source_id));

        if (spamIds.size > 0) {
            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "decision",
                agent: this.agentName,
                message: `Spam filter removed ${spamIds.size} docs: [${[...spamIds].join(", ")}]`,
                decision: "spam_removed",
                confidence: 0.85,
            });
        }

        return kept;
    }

    private async filterDuplicates(pipelineId: string, sources: SourceDocument[]): Promise<SourceDocument[]> {
        if (sources.length <= 1) return sources;

        await this.vectorStore.clear();

        // Embed all docs
        const embeddings: Map<string, number[]> = new Map();
        for (const doc of sources) {
            try {
                const emb = await this.llmEmbed(pipelineId, doc.content.slice(0, 1000));
                embeddings.set(doc.source_id, emb);
                await this.vectorStore.upsert({
                    id: doc.source_id,
                    source_id: doc.source_id,
                    text: doc.content.slice(0, 1000),
                    embedding: emb,
                    metadata: { credibility_total: doc.credibility_score?.total ?? 0 },
                });
            } catch {
                // skip embedding failure — keep doc
            }
        }

        const toRemove = new Set<string>();

        for (const doc of sources) {
            if (toRemove.has(doc.source_id)) continue;
            const emb = embeddings.get(doc.source_id);
            if (!emb) continue;

            const neighbours = await this.vectorStore.search(emb, 2);
            const near = neighbours.find(n => n.source_id !== doc.source_id);

            if (near) {
                const nearEmb = embeddings.get(near.source_id);
                if (nearEmb) {
                    const sim = cosineSimilarity(emb, nearEmb);
                    if (sim > this.cfg.cosineSimilarityThreshold) {
                        const docTotal  = doc.credibility_score?.total ?? 0;
                        const nearTotal = (near.metadata.credibility_total as number) ?? 0;
                        const victim    = docTotal >= nearTotal ? near.source_id : doc.source_id;
                        toRemove.add(victim);

                        traceCollector.log(pipelineId, {
                            pipeline_id: pipelineId,
                            event_type: "decision",
                            agent: this.agentName,
                            message: `Dedup: ${doc.source_id} ↔ ${near.source_id} similarity=${sim.toFixed(3)}, discarding ${victim}`,
                            decision: "duplicate_removed",
                            confidence: sim,
                        });
                    }
                }
            }
        }

        return sources.filter(d => !toRemove.has(d.source_id));
    }
}
