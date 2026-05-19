import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { Contradiction } from "./contradiction-detector.agent";
import { CredibilityScore } from "./credibility-scorer.agent";
import { NormalizedSource } from "./multi-source-ingestion.agent";
import { pipelineState, ResolvedFact } from "./pipeline-state";
import { antigravityFileLogger } from "../tracing/file-logger";
import {
    ConflictResolutionOutputSchema,
    evaluateWithZod,
} from "../contracts/zod-schemas";

export interface ConflictResolution {
    contradiction_id: string;
    resolution_strategy:
        | "trust_credible"
        | "trust_recent"
        | "request_clarification"
        | "aggregate"
        | "human_review";
    recommended_value: unknown;
    confidence: number;
    reasoning: string;
    investigation_actions: Array<{
        action_type: string;
        description: string;
        priority: "critical" | "high" | "medium";
    }>;
}

export interface ConflictResolutionInput extends AgentInput {
    contradictions: Contradiction[];
    credibility_scores: CredibilityScore[];
    normalized_sources: NormalizedSource[];
}

export interface ConflictResolutionOutput extends AgentOutput {
    resolutions: ConflictResolution[];
    resolved_facts_topics: string[];
    cascading_conflicts: string[];
}

export class ConflictResolutionAgent extends BaseAgent<
    ConflictResolutionInput,
    ConflictResolutionOutput
> {
    constructor() {
        super("ConflictResolutionAgent", "");
    }

    protected async execute(
        input: ConflictResolutionInput
    ): Promise<ConflictResolutionOutput> {
        const { pipeline_id, contradictions, credibility_scores, normalized_sources } = input;
        const startTime = Date.now();

        // Ensure the per-pipeline state container exists.
        pipelineState.init(pipeline_id);

        const resolutions = await Promise.all(
            contradictions.map((c) =>
                this.resolveOne(c, credibility_scores, normalized_sources, pipeline_id)
            )
        );

        // V2: deterministically mutate PipelineState.resolvedFacts so that
        // every downstream module (M5 onward) reads a single source of truth
        // instead of replaying contradictions.
        for (let i = 0; i < resolutions.length; i++) {
            const resolution = resolutions[i];
            const contradiction = contradictions[i];
            if (resolution.recommended_value === null || resolution.recommended_value === undefined) continue;

            const fact: ResolvedFact = {
                topic: contradiction.topic,
                value: resolution.recommended_value,
                sources_involved: contradiction.sources_involved,
                resolution_strategy: resolution.resolution_strategy,
                confidence: resolution.confidence,
                resolved_at: new Date().toISOString(),
            };
            pipelineState.setResolvedFact(pipeline_id, fact, this.agentName);
        }

        const stateSnapshot = pipelineState.get(pipeline_id);
        const resolvedTopics = Object.keys(stateSnapshot.resolvedFacts);
        const cascading = stateSnapshot.cascading_conflicts;

        if (cascading.length > 0) {
            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: "M7_CascadingConflictDetected",
                tool_called: this.agentName,
                reasoning: `Resolution caused ${cascading.length} cascading conflicts: ${cascading.join("; ")}`,
                status: "ROLLED_BACK",
                rollback_action: "Topics flagged for re-resolution; downstream insights must read latest resolvedFact",
                latency_ms: Date.now() - startTime,
                cost: 0,
                rubric_category: "failure_recovery",
            });
        }

        this.logDecision(
            pipeline_id,
            `Resolved ${resolutions.length} contradictions — strategies: ${resolutions.map(r => r.resolution_strategy).join(", ")}. Mutated ${resolvedTopics.length} resolvedFacts topics. Cascading: ${cascading.length}.`,
            "resolution_complete",
            resolutions.reduce((sum, r) => sum + r.confidence, 0) / (resolutions.length || 1)
        );

        const output: ConflictResolutionOutput = {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            resolutions,
            resolved_facts_topics: resolvedTopics,
            cascading_conflicts: cascading,
        };

        const amce = evaluateWithZod(
            output,
            ConflictResolutionOutputSchema,
            "conflict_resolution_v1",
            "ALERT_ONLY"
        );
        antigravityFileLogger.append({
            timestamp: new Date().toISOString(),
            step: "AMCE_M7_StructuralValidation",
            tool_called: "ZodValidator",
            reasoning: amce.passed
                ? `M7 output passed Zod structural validation (ALERT_ONLY). resolvedFacts topics: ${resolvedTopics.length}`
                : `M7 output Zod errors: ${amce.errors.join("; ")}`,
            status: amce.passed ? "SUCCESS" : "FAILED",
            rollback_action: amce.passed ? "none" : "Log warning; continue (ALERT_ONLY)",
            latency_ms: Date.now() - startTime,
            cost: 0,
            rubric_category: "constraint_evaluation",
        });

        return output;
    }

    private async resolveOne(
        contradiction: Contradiction,
        scores: CredibilityScore[],
        sources: NormalizedSource[],
        pipelineId: string
    ): Promise<ConflictResolution> {
        const involvedScores = contradiction.sources_involved
            .map((id) => scores.find((s) => s.source_id === id))
            .filter((s): s is CredibilityScore => s !== undefined);

        if (involvedScores.length === 0) {
            return this.requestClarification(contradiction, pipelineId);
        }

        const maxScore = Math.max(...involvedScores.map((s) => s.total_score));
        const minScore = Math.min(...involvedScores.map((s) => s.total_score));

        // Strategy 1: Trust most credible if gap > 30 points
        if (maxScore - minScore > 30) {
            const bestScore = involvedScores.find((s) => s.total_score === maxScore)!;
            const bestContrib = contradiction.conflicting_sources.find(
                (cs) => cs.source_id === bestScore.source_id
            )!;

            this.logDecision(
                pipelineId,
                `Credibility gap ${maxScore - minScore} pts — trusting source ${bestScore.source_id} (score: ${maxScore})`,
                "trust_credible",
                0.8
            );

            return {
                contradiction_id: contradiction.contradiction_id,
                resolution_strategy: "trust_credible",
                recommended_value: bestContrib.claim,
                confidence: 0.8,
                reasoning: `Source ${bestScore.source_id} has significantly higher credibility (${maxScore} vs ${minScore})`,
                investigation_actions: [
                    {
                        action_type: "verify_data",
                        description: `Confirm claim from ${bestScore.source_id}: "${bestContrib.claim}"`,
                        priority: "medium",
                    },
                ],
            };
        }

        // Strategy 2: Trust most recent if time gap > 24h
        const involvedSources = contradiction.sources_involved
            .map((id) => sources.find((s) => s.source_id === id))
            .filter((s): s is NormalizedSource => s !== undefined);

        if (involvedSources.length >= 2) {
            const timestamps = involvedSources.map((s) => new Date(s.timestamp).getTime());
            const maxTime = Math.max(...timestamps);
            const minTime = Math.min(...timestamps);
            const hoursDiff = (maxTime - minTime) / 3_600_000;

            if (hoursDiff > 24) {
                const newestSource = involvedSources.find(
                    (s) => new Date(s.timestamp).getTime() === maxTime
                )!;
                const newestClaim = contradiction.conflicting_sources.find(
                    (cs) => cs.source_id === newestSource.source_id
                )!;

                this.logDecision(
                    pipelineId,
                    `Time gap ${hoursDiff.toFixed(1)}h — trusting newest source ${newestSource.source_id}`,
                    "trust_recent",
                    0.75
                );

                return {
                    contradiction_id: contradiction.contradiction_id,
                    resolution_strategy: "trust_recent",
                    recommended_value: newestClaim?.claim ?? null,
                    confidence: 0.75,
                    reasoning: `Source ${newestSource.source_id} is ${hoursDiff.toFixed(1)} hours more recent`,
                    investigation_actions: [
                        {
                            action_type: "verify_recency",
                            description: `Confirm ${newestSource.source_id} data reflects current state`,
                            priority: "high",
                        },
                    ],
                };
            }
        }

        // Strategy 3: Aggregate for numeric contradictions with similar credibility
        if (contradiction.type === "numeric") {
            const values = contradiction.conflicting_sources
                .map((cs) => {
                    const m = cs.claim.match(/[\d,]+(?:\.\d+)?/);
                    return m ? parseFloat(m[0].replace(/,/g, "")) : null;
                })
                .filter((v): v is number => v !== null);

            if (values.length >= 2) {
                const totalScore = involvedScores.reduce((sum, s) => sum + s.total_score, 0);
                const weightedAvg = involvedScores.reduce((sum, s, i) => {
                    const v = values[i] ?? values[0];
                    return sum + v * (s.total_score / totalScore);
                }, 0);

                this.logDecision(
                    pipelineId,
                    `Similar credibility — computing weighted average: ${weightedAvg.toFixed(2)}`,
                    "aggregate",
                    0.6
                );

                return {
                    contradiction_id: contradiction.contradiction_id,
                    resolution_strategy: "aggregate",
                    recommended_value: parseFloat(weightedAvg.toFixed(2)),
                    confidence: 0.6,
                    reasoning: `Weighted average of [${values.join(", ")}] by credibility scores`,
                    investigation_actions: [
                        {
                            action_type: "cross_reference",
                            description: "Obtain ground-truth from primary database to validate",
                            priority: "high",
                        },
                    ],
                };
            }
        }

        // Strategy 4/5: Clarification or human review
        return this.requestClarification(contradiction, pipelineId);
    }

    private requestClarification(
        contradiction: Contradiction,
        pipelineId: string
    ): ConflictResolution {
        const strategy: ConflictResolution["resolution_strategy"] =
            contradiction.severity === "CRITICAL" ? "human_review" : "request_clarification";

        this.logDecision(
            pipelineId,
            `Equal credibility and recency on topic '${contradiction.topic}' — escalating to ${strategy}`,
            strategy,
            0.5
        );

        return {
            contradiction_id: contradiction.contradiction_id,
            resolution_strategy: strategy,
            recommended_value: null,
            confidence: 0.5,
            reasoning:
                "Conflicting sources have similar credibility and recency. Manual verification required.",
            investigation_actions: [
                {
                    action_type: "verify_primary_source",
                    description: `Query primary data source to resolve '${contradiction.topic}' conflict`,
                    priority: "critical",
                },
                {
                    action_type: "cross_reference",
                    description: "Find additional independent sources to corroborate one claim",
                    priority: "high",
                },
            ],
        };
    }
}

export const conflictResolutionAgent = new ConflictResolutionAgent();
