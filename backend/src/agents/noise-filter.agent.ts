import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { NormalizedSource } from "./multi-source-ingestion.agent";
import { CredibilityScore } from "./credibility-scorer.agent";
import { cosineSimilarity } from "../utils/cosine-similarity";

export interface RemovedSource {
    source_id: string;
    reason: "duplicate" | "spam" | "stale" | "irrelevant";
    details: string;
}

export interface FilteredSources {
    kept_sources: NormalizedSource[];
    removed_sources: RemovedSource[];
}

export interface NoiseFilterInput extends AgentInput {
    normalized_sources: NormalizedSource[];
    credibility_scores: CredibilityScore[];
}

export interface NoiseFilterOutput extends AgentOutput {
    filtered_sources: FilteredSources;
}

const SPAM_PATTERNS = [
    /[!]{3,}/,
    /\b(FREE|SALE|DISCOUNT|PROMO|OFFER|CLICK HERE|BUY NOW)\b/,
    /[A-Z]{15,}/,
    /(\b\w+\b)(\s+\1){4,}/i,  // word repeated 5+ times
];

export class NoiseFilterAgent extends BaseAgent<NoiseFilterInput, NoiseFilterOutput> {
    constructor() {
        super("NoiseFilterAgent", "");
    }

    protected async execute(input: NoiseFilterInput): Promise<NoiseFilterOutput> {
        const { pipeline_id, normalized_sources, credibility_scores } = input;

        // Step 1: Remove stale sources
        const { kept: afterStale, removed: removedStale } = this.filterStale(
            normalized_sources,
            credibility_scores
        );

        // Step 2: Deduplicate by embedding similarity
        const { kept: afterDedup, removed: removedDedup } = await this.filterDuplicates(
            afterStale,
            credibility_scores,
            pipeline_id
        );

        // Step 3: Spam detection
        const { kept: afterSpam, removed: removedSpam } = this.filterSpam(afterDedup);

        const allRemoved = [...removedStale, ...removedDedup, ...removedSpam];

        this.logDecision(
            pipeline_id,
            `Filtering complete: kept ${afterSpam.length}/${normalized_sources.length} sources, removed ${allRemoved.length} (stale:${removedStale.length}, dupe:${removedDedup.length}, spam:${removedSpam.length})`,
            "filtering_complete",
            afterSpam.length / normalized_sources.length
        );

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            filtered_sources: {
                kept_sources: afterSpam,
                removed_sources: allRemoved,
            },
        };
    }

    private filterStale(
        sources: NormalizedSource[],
        scores: CredibilityScore[]
    ): { kept: NormalizedSource[]; removed: RemovedSource[] } {
        const kept: NormalizedSource[] = [];
        const removed: RemovedSource[] = [];

        for (const source of sources) {
            const score = scores.find((s) => s.source_id === source.source_id);
            if (score && score.recency_score === 0) {
                removed.push({
                    source_id: source.source_id,
                    reason: "stale",
                    details: "Content timestamp older than 1 month",
                });
            } else {
                kept.push(source);
            }
        }

        return { kept, removed };
    }

    private async filterDuplicates(
        sources: NormalizedSource[],
        scores: CredibilityScore[],
        pipelineId: string
    ): Promise<{ kept: NormalizedSource[]; removed: RemovedSource[] }> {
        if (sources.length < 2) return { kept: sources, removed: [] };

        // Generate embeddings using first 1000 chars — sufficient for dedup
        const embeddings: number[][] = [];
        for (const source of sources) {
            const embedding = await this.llmEmbed(pipelineId, source.raw_text.slice(0, 1000));
            embeddings.push(embedding);
            // Small delay to avoid rate limits when many sources
            if (sources.length > 8) {
                await new Promise((r) => setTimeout(r, 200));
            }
        }

        const kept: NormalizedSource[] = [];
        const removed: RemovedSource[] = [];
        const eliminatedIndices = new Set<number>();

        for (let i = 0; i < sources.length; i++) {
            if (eliminatedIndices.has(i)) continue;

            const duplicateIndices: number[] = [];
            for (let j = i + 1; j < sources.length; j++) {
                if (eliminatedIndices.has(j)) continue;
                const sim = cosineSimilarity(embeddings[i], embeddings[j]);
                if (sim > 0.85) {
                    duplicateIndices.push(j);
                    this.logDecision(
                        pipelineId,
                        `Sources ${sources[i].source_id} and ${sources[j].source_id} have ${(sim * 100).toFixed(1)}% similarity — removing lower credibility`,
                        "duplicate_detected",
                        sim
                    );
                }
            }

            if (duplicateIndices.length > 0) {
                const allIndices = [i, ...duplicateIndices];
                const scoreOf = (idx: number) =>
                    scores.find((s) => s.source_id === sources[idx].source_id)?.total_score ?? 0;

                const bestIndex = allIndices.reduce((best, idx) =>
                    scoreOf(idx) > scoreOf(best) ? idx : best
                );

                for (const idx of allIndices) {
                    eliminatedIndices.add(idx);
                    if (idx === bestIndex) {
                        kept.push(sources[idx]);
                    } else {
                        removed.push({
                            source_id: sources[idx].source_id,
                            reason: "duplicate",
                            details: `>85% similar to ${sources[bestIndex].source_id} (higher credibility kept)`,
                        });
                    }
                }
            } else {
                kept.push(sources[i]);
                eliminatedIndices.add(i);
            }
        }

        return { kept, removed };
    }

    private filterSpam(
        sources: NormalizedSource[]
    ): { kept: NormalizedSource[]; removed: RemovedSource[] } {
        const kept: NormalizedSource[] = [];
        const removed: RemovedSource[] = [];

        for (const source of sources) {
            const isSpam = SPAM_PATTERNS.some((p) => p.test(source.raw_text));
            if (isSpam) {
                removed.push({
                    source_id: source.source_id,
                    reason: "spam",
                    details: "Content matched spam patterns (excessive caps, promotional language, or keyword repetition)",
                });
            } else {
                kept.push(source);
            }
        }

        return { kept, removed };
    }
}

export const noiseFilterAgent = new NoiseFilterAgent();
