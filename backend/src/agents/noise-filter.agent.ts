import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { NormalizedSource } from "./multi-source-ingestion.agent";
import { CredibilityScore } from "./credibility-scorer.agent";
import { cosineSimilarity } from "../utils/cosine-similarity";
import { antigravityFileLogger } from "../tracing/file-logger";
import { NoiseFilterOutputSchema, evaluateWithZod } from "../contracts/zod-schemas";

export interface RemovedSource {
    source_id: string;
    reason: "duplicate" | "spam" | "stale" | "irrelevant" | "corroborating_redundant";
    details: string;
}

export interface CorroboratingGroup {
    group_id: string;
    source_ids: string[];
    similarity_band: "0.60-0.85";
}

export interface FilteredSources {
    kept_sources: NormalizedSource[];
    removed_sources: RemovedSource[];
    corroborating_groups?: CorroboratingGroup[];
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

// V2 thresholds for the 3-tier semantic similarity check
const DUPLICATE_THRESHOLD = 0.85;
const CORROBORATING_LOWER = 0.60;
const MIN_SOURCES_AFTER_FILTER = 2;

export class NoiseFilterAgent extends BaseAgent<NoiseFilterInput, NoiseFilterOutput> {
    constructor() {
        super("NoiseFilterAgent", "");
    }

    protected async execute(input: NoiseFilterInput): Promise<NoiseFilterOutput> {
        const { pipeline_id, normalized_sources, credibility_scores } = input;
        const startTime = Date.now();

        // Step 1: Remove stale sources
        const { kept: afterStale, removed: removedStale } = this.filterStale(
            normalized_sources,
            credibility_scores
        );

        // Step 2: 3-tier semantic similarity check
        const {
            kept: afterDedup,
            removed: removedDedup,
            corroboratingGroups,
        } = await this.runSemanticTieredCheck(afterStale, credibility_scores, pipeline_id);

        // Step 3: Spam detection
        const { kept: afterSpam, removed: removedSpam } = this.filterSpam(afterDedup);

        let allRemoved = [...removedStale, ...removedDedup, ...removedSpam];
        let finalKept = afterSpam;

        // V2 minimum-sources guard: if filtering drops us below 2, restore the
        // most-credible stale source(s) rather than letting downstream starve.
        if (finalKept.length < MIN_SOURCES_AFTER_FILTER && removedStale.length > 0) {
            const staleSourceIds = new Set(removedStale.map((r) => r.source_id));
            const restoreCandidates = normalized_sources
                .filter((s) => staleSourceIds.has(s.source_id))
                .sort((a, b) => {
                    const sa = credibility_scores.find((c) => c.source_id === a.source_id)?.total_score ?? 0;
                    const sb = credibility_scores.find((c) => c.source_id === b.source_id)?.total_score ?? 0;
                    return sb - sa;
                });

            const need = MIN_SOURCES_AFTER_FILTER - finalKept.length;
            const restored = restoreCandidates.slice(0, need);
            for (const r of restored) {
                finalKept = [...finalKept, r];
                allRemoved = allRemoved.filter((x) => x.source_id !== r.source_id);
                this.logDecision(
                    pipeline_id,
                    `Min-sources guard restored stale source ${r.source_id} (post-filter count would be < ${MIN_SOURCES_AFTER_FILTER})`,
                    "min_sources_guard_restore",
                    0.6
                );
            }

            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: "M3_MinSourcesGuard",
                tool_called: this.agentName,
                reasoning: `Restored ${restored.length} stale sources to satisfy min-sources floor (${MIN_SOURCES_AFTER_FILTER})`,
                status: "ROLLED_BACK",
                rollback_action: "Reinstated stale sources from removedStale pool",
                latency_ms: Date.now() - startTime,
                cost: 0,
                rubric_category: "failure_recovery",
            });
        }

        this.logDecision(
            pipeline_id,
            `Filtering complete: kept ${finalKept.length}/${normalized_sources.length} sources, removed ${allRemoved.length} (stale:${removedStale.length}, dupe:${removedDedup.length}, spam:${removedSpam.length}), corroborating groups: ${corroboratingGroups.length}`,
            "filtering_complete",
            finalKept.length / Math.max(normalized_sources.length, 1)
        );

        const output: NoiseFilterOutput = {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            filtered_sources: {
                kept_sources: finalKept,
                removed_sources: allRemoved,
                corroborating_groups: corroboratingGroups,
            },
        };

        const amce = evaluateWithZod(output, NoiseFilterOutputSchema, "noise_filter_v1", "ALERT_ONLY");
        antigravityFileLogger.append({
            timestamp: new Date().toISOString(),
            step: "AMCE_M3_StructuralValidation",
            tool_called: "ZodValidator",
            reasoning: amce.passed
                ? "M3 output passed Zod structural validation (ALERT_ONLY mode)"
                : `M3 output Zod errors: ${amce.errors.join("; ")}`,
            status: amce.passed ? "SUCCESS" : "FAILED",
            rollback_action: amce.passed ? "none" : "Log warning; continue (ALERT_ONLY)",
            latency_ms: Date.now() - startTime,
            cost: 0,
            rubric_category: "constraint_evaluation",
        });

        return output;
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

    private async runSemanticTieredCheck(
        sources: NormalizedSource[],
        scores: CredibilityScore[],
        pipelineId: string
    ): Promise<{
        kept: NormalizedSource[];
        removed: RemovedSource[];
        corroboratingGroups: CorroboratingGroup[];
    }> {
        if (sources.length < 2) {
            return { kept: sources, removed: [], corroboratingGroups: [] };
        }

        // Use the serialized natural-language form when available — that is the
        // form downstream RAG also embeds, so dedup must match the same surface.
        const embeddings: number[][] = [];
        for (const source of sources) {
            const textForEmbed = (source.serialized_text ?? source.raw_text).slice(0, 1000);
            embeddings.push(await this.llmEmbed(pipelineId, textForEmbed));
            if (sources.length > 8) await new Promise((r) => setTimeout(r, 200));
        }

        const kept: NormalizedSource[] = [];
        const removed: RemovedSource[] = [];
        const eliminated = new Set<number>();
        const corroboratingGroups: CorroboratingGroup[] = [];

        const scoreOf = (idx: number) =>
            scores.find((s) => s.source_id === sources[idx].source_id)?.total_score ?? 0;

        for (let i = 0; i < sources.length; i++) {
            if (eliminated.has(i)) continue;

            const duplicates: number[] = [];
            const corroborating: number[] = [];

            for (let j = i + 1; j < sources.length; j++) {
                if (eliminated.has(j)) continue;
                const sim = cosineSimilarity(embeddings[i], embeddings[j]);
                if (sim > DUPLICATE_THRESHOLD) {
                    duplicates.push(j);
                    this.logDecision(
                        pipelineId,
                        `DUPLICATE: ${sources[i].source_id} ↔ ${sources[j].source_id} sim=${(sim * 100).toFixed(1)}%`,
                        "duplicate_detected",
                        sim
                    );
                } else if (sim >= CORROBORATING_LOWER) {
                    corroborating.push(j);
                    this.logDecision(
                        pipelineId,
                        `CORROBORATING: ${sources[i].source_id} ↔ ${sources[j].source_id} sim=${(sim * 100).toFixed(1)}% — keep both, mark group`,
                        "corroborating_detected",
                        sim
                    );
                }
                // sim < CORROBORATING_LOWER → INDEPENDENT, no action
            }

            // DUPLICATES → keep the most credible, drop the rest.
            if (duplicates.length > 0) {
                const indices = [i, ...duplicates];
                const bestIndex = indices.reduce((best, idx) =>
                    scoreOf(idx) > scoreOf(best) ? idx : best
                );
                for (const idx of indices) {
                    eliminated.add(idx);
                    if (idx === bestIndex) {
                        kept.push(sources[idx]);
                    } else {
                        removed.push({
                            source_id: sources[idx].source_id,
                            reason: "duplicate",
                            details: `>${(DUPLICATE_THRESHOLD * 100).toFixed(0)}% similar to ${sources[bestIndex].source_id} (higher credibility kept)`,
                        });
                    }
                }
            } else {
                kept.push(sources[i]);
                eliminated.add(i);
            }

            // CORROBORATING → keep all in the group but record the cluster.
            if (corroborating.length > 0) {
                const groupSourceIds = [sources[i].source_id, ...corroborating.map((idx) => sources[idx].source_id)];
                corroboratingGroups.push({
                    group_id: `CORROB-${corroboratingGroups.length + 1}`,
                    source_ids: groupSourceIds,
                    similarity_band: "0.60-0.85",
                });
            }
        }

        return { kept, removed, corroboratingGroups };
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
