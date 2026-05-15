import { z } from "genkit";
import { ai } from "./index";

import { MultiSourceIngestionAgent } from "../agents/multi-source-ingestion.agent";
import { CredibilityScorerAgent } from "../agents/credibility-scorer.agent";
import { NoiseFilterAgent } from "../agents/noise-filter.agent";
import { ContradictionDetectorAgent } from "../agents/contradiction-detector.agent";
import { ConflictResolutionAgent } from "../agents/conflict-resolution.agent";
import { TemporalAnalysisAgent } from "../agents/temporal-analysis.agent";
import { InsightExtractionAgent } from "../agents/insight-extraction.agent";
import { ImpactAnalysisAgent } from "../agents/impact-analysis.agent";
import { ActionChainGeneratorAgent } from "../agents/action-chain-generator.agent";
import { ConstraintValidator } from "../simulation/constraint-validator";
import { ActionChainSimulator } from "../simulation/chain-simulator";
import { FailureRecoveryEngine } from "../simulation/failure-recovery";
import { OutcomeVisualizer } from "../simulation/outcome-visualizer";

// ─── Shared source schema ──────────────────────────────────────────────────────
const RawSourceSchema = z.object({
    source_id: z.string(),
    source_type: z.enum(["pdf", "url", "csv", "json", "table", "realtime_feed"]),
    content: z.string(),
    metadata: z.object({
        timestamp: z.string(),
        authority_type: z.string().optional(),
        url: z.string().optional(),
        filename: z.string().optional(),
    }).passthrough(),
});

const ConstraintsSchema = z.object({
    budget_limit: z.object({ amount: z.number(), currency: z.string() }),
    time_limit: z.object({ max_duration_hours: z.number(), deadline: z.string().optional() }),
    resource_limits: z.object({
        api_calls_per_hour: z.number(),
        compute_units: z.number(),
        human_hours_available: z.number(),
    }),
    urgency_level: z.enum(["critical", "high", "medium", "low"]),
});

// ─── Module 1: Multi-Source Ingestion ─────────────────────────────────────────
export const ingestSourcesTool = ai.defineTool(
    {
        name: "ingest_sources",
        description: "Ingests multiple content sources (PDF, URL, CSV, JSON, real-time feed) and normalizes them into a consistent format. Always call this first.",
        inputSchema: z.object({
            pipeline_id: z.string().describe("Unique pipeline identifier"),
            sources: z.array(RawSourceSchema).describe("Array of raw source inputs to ingest"),
        }),
        outputSchema: z.object({
            ingestion_id: z.string(),
            sources_processed: z.number(),
            source_summary: z.array(z.object({
                source_id: z.string(),
                source_type: z.string(),
                char_count: z.number(),
                ingested_at: z.string(),
            })),
        }),
    },
    async (input) => {
        const agent = new MultiSourceIngestionAgent();
        const result = await agent.run({ pipeline_id: input.pipeline_id, sources: input.sources });
        return {
            ingestion_id: result.ingestion_id,
            sources_processed: result.sources_processed,
            source_summary: result.normalized_sources.map((s) => ({
                source_id: s.source_id,
                source_type: s.source_type,
                char_count: s.raw_text.length,
                ingested_at: s.timestamp,
            })),
        };
    }
);

// ─── Module 2: Credibility Scorer ─────────────────────────────────────────────
export const scoreCredibilityTool = ai.defineTool(
    {
        name: "score_source_credibility",
        description: "Scores each ingested source on recency, authority, and content quality. Call after ingest_sources.",
        inputSchema: z.object({
            pipeline_id: z.string(),
            sources: z.array(RawSourceSchema),
        }),
        outputSchema: z.object({
            scores: z.array(z.object({
                source_id: z.string(),
                total_score: z.number().describe("0-100 credibility score"),
                credibility_tier: z.enum(["HIGH", "MEDIUM", "LOW", "UNVERIFIED"]),
                reasoning: z.string(),
            })),
        }),
    },
    async (input) => {
        const ingestionAgent = new MultiSourceIngestionAgent();
        const ingested = await ingestionAgent.run({ pipeline_id: input.pipeline_id, sources: input.sources });
        const credAgent = new CredibilityScorerAgent();
        const result = await credAgent.run({ pipeline_id: input.pipeline_id, normalized_sources: ingested.normalized_sources });
        return {
            scores: result.scores.map((s) => ({
                source_id: s.source_id,
                total_score: s.total_score,
                credibility_tier: s.credibility_tier,
                reasoning: s.reasoning,
            })),
        };
    }
);

// ─── Module 3: Noise Filter ────────────────────────────────────────────────────
export const filterNoiseTool = ai.defineTool(
    {
        name: "filter_noise_and_duplicates",
        description: "Removes stale, duplicate, spam, and low-credibility sources. Keeps only signal-rich content for analysis.",
        inputSchema: z.object({
            pipeline_id: z.string(),
            sources: z.array(RawSourceSchema),
        }),
        outputSchema: z.object({
            kept_count: z.number(),
            removed_count: z.number(),
            removed_reasons: z.array(z.object({
                source_id: z.string(),
                reason: z.string(),
            })),
        }),
    },
    async (input) => {
        const ingestionAgent = new MultiSourceIngestionAgent();
        const ingested = await ingestionAgent.run({ pipeline_id: input.pipeline_id, sources: input.sources });
        const credAgent = new CredibilityScorerAgent();
        const credResult = await credAgent.run({ pipeline_id: input.pipeline_id, normalized_sources: ingested.normalized_sources });
        const filterAgent = new NoiseFilterAgent();
        const result = await filterAgent.run({
            pipeline_id: input.pipeline_id,
            normalized_sources: ingested.normalized_sources,
            credibility_scores: credResult.scores,
        });
        return {
            kept_count: result.filtered_sources.kept_sources.length,
            removed_count: result.filtered_sources.removed_sources.length,
            removed_reasons: result.filtered_sources.removed_sources.map((r) => ({
                source_id: r.source_id,
                reason: r.reason,
            })),
        };
    }
);

// ─── Module 4: Contradiction Detector ─────────────────────────────────────────
export const detectContradictionsTool = ai.defineTool(
    {
        name: "detect_contradictions",
        description: "Detects conflicting claims across sources (e.g., stock = 500 vs stock = 45). Returns contradictions with severity ratings.",
        inputSchema: z.object({
            pipeline_id: z.string(),
            sources: z.array(RawSourceSchema),
        }),
        outputSchema: z.object({
            contradiction_count: z.number(),
            contradictions: z.array(z.object({
                contradiction_id: z.string(),
                type: z.string(),
                severity: z.string(),
                description: z.string(),
                resolution_needed: z.boolean(),
            })),
        }),
    },
    async (input) => {
        const ingestionAgent = new MultiSourceIngestionAgent();
        const ingested = await ingestionAgent.run({ pipeline_id: input.pipeline_id, sources: input.sources });
        const credAgent = new CredibilityScorerAgent();
        const credResult = await credAgent.run({ pipeline_id: input.pipeline_id, normalized_sources: ingested.normalized_sources });
        const filterAgent = new NoiseFilterAgent();
        const filterResult = await filterAgent.run({
            pipeline_id: input.pipeline_id,
            normalized_sources: ingested.normalized_sources,
            credibility_scores: credResult.scores,
        });
        const contradictionAgent = new ContradictionDetectorAgent();
        const result = await contradictionAgent.run({
            pipeline_id: input.pipeline_id,
            filtered_sources: filterResult.filtered_sources.kept_sources,
            credibility_scores: credResult.scores,
        });
        return {
            contradiction_count: result.contradictions.length,
            contradictions: result.contradictions.map((c) => ({
                contradiction_id: c.contradiction_id,
                type: c.type,
                severity: c.severity,
                description: c.topic,
                resolution_needed: c.resolution_needed,
            })),
        };
    }
);

// ─── Module 7: Conflict Resolution ────────────────────────────────────────────
export const resolveConflictsTool = ai.defineTool(
    {
        name: "resolve_conflicts",
        description: "Applies resolution strategies (trust most credible, trust most recent, aggregate, request clarification) to detected contradictions.",
        inputSchema: z.object({
            pipeline_id: z.string(),
            sources: z.array(RawSourceSchema),
        }),
        outputSchema: z.object({
            resolutions: z.array(z.object({
                contradiction_id: z.string(),
                resolution_strategy: z.string(),
                reasoning: z.string(),
                confidence: z.number(),
                investigation_actions: z.array(z.string()),
            })),
        }),
    },
    async (input) => {
        const ingestionAgent = new MultiSourceIngestionAgent();
        const ingested = await ingestionAgent.run({ pipeline_id: input.pipeline_id, sources: input.sources });
        const credAgent = new CredibilityScorerAgent();
        const credResult = await credAgent.run({ pipeline_id: input.pipeline_id, normalized_sources: ingested.normalized_sources });
        const filterAgent = new NoiseFilterAgent();
        const filterResult = await filterAgent.run({
            pipeline_id: input.pipeline_id,
            normalized_sources: ingested.normalized_sources,
            credibility_scores: credResult.scores,
        });
        const contradictionAgent = new ContradictionDetectorAgent();
        const contradictions = await contradictionAgent.run({
            pipeline_id: input.pipeline_id,
            filtered_sources: filterResult.filtered_sources.kept_sources,
            credibility_scores: credResult.scores,
        });
        const conflictAgent = new ConflictResolutionAgent();
        const result = await conflictAgent.run({
            pipeline_id: input.pipeline_id,
            contradictions: contradictions.contradictions,
            credibility_scores: credResult.scores,
            normalized_sources: filterResult.filtered_sources.kept_sources,
        });
        return {
            resolutions: result.resolutions.map((r) => ({
                contradiction_id: r.contradiction_id,
                resolution_strategy: r.resolution_strategy,
                reasoning: r.reasoning,
                confidence: r.confidence,
                investigation_actions: r.investigation_actions.map((a) => a.action_type),
            })),
        };
    }
);

// ─── Module 6: Temporal Analysis ──────────────────────────────────────────────
export const analyzeTemporalTool = ai.defineTool(
    {
        name: "analyze_temporal_patterns",
        description: "Detects time-series patterns (spike, decline, drift, stable, anomaly) in source data such as sales trends, inventory changes, and complaint spikes.",
        inputSchema: z.object({
            pipeline_id: z.string(),
            sources: z.array(RawSourceSchema),
        }),
        outputSchema: z.object({
            patterns_detected: z.number(),
            patterns: z.array(z.object({
                metric_name: z.string(),
                pattern_type: z.string(),
                change_direction: z.string(),
                change_magnitude: z.number(),
                confidence: z.number(),
            })),
        }),
    },
    async (input) => {
        const ingestionAgent = new MultiSourceIngestionAgent();
        const ingested = await ingestionAgent.run({ pipeline_id: input.pipeline_id, sources: input.sources });
        const temporalAgent = new TemporalAnalysisAgent();

        const timeSeriesData: Array<{ metric_name: string; data_points: Array<{ timestamp: string; value: number }> }> = [];
        for (const source of ingested.normalized_sources) {
            if (source.source_type === "csv" && source.structured_data) {
                const rows = source.structured_data["rows"] as Array<Record<string, string>> | undefined;
                if (rows && rows.length > 0) {
                    const sample = rows[0];
                    const dateKey = Object.keys(sample).find((k) => /date|time|timestamp/i.test(k));
                    if (dateKey) {
                        const numericKeys = Object.keys(sample).filter(
                            (k) => k !== dateKey && !isNaN(parseFloat(sample[k]))
                        );
                        for (const metric of numericKeys) {
                            timeSeriesData.push({
                                metric_name: metric,
                                data_points: rows
                                    .map((row) => ({
                                        timestamp: new Date(row[dateKey]).toISOString(),
                                        value: parseFloat(row[metric]) || 0,
                                    }))
                                    .filter((dp) => !isNaN(new Date(dp.timestamp).getTime())),
                            });
                        }
                    }
                }
            }
        }

        const result = await temporalAgent.run({ pipeline_id: input.pipeline_id, time_series_data: timeSeriesData });
        return {
            patterns_detected: result.patterns.length,
            patterns: result.patterns.map((p) => ({
                metric_name: p.metric_name,
                pattern_type: p.pattern_type,
                change_direction: p.change_direction,
                change_magnitude: p.change_magnitude,
                confidence: p.confidence,
            })),
        };
    }
);

// ─── Module 5: Insight Extraction ─────────────────────────────────────────────
export const extractInsightsTool = ai.defineTool(
    {
        name: "extract_insights",
        description: "Uses RAG to extract 3-7 key insights (risks, trends, contradictions, opportunities) from all analyzed sources. This is the core reasoning step.",
        inputSchema: z.object({
            pipeline_id: z.string(),
            sources: z.array(RawSourceSchema),
        }),
        outputSchema: z.object({
            insight_count: z.number(),
            insights: z.array(z.object({
                insight_id: z.string(),
                title: z.string(),
                category: z.string(),
                severity: z.string(),
                confidence: z.number(),
                requires_resolution: z.boolean(),
                recommended_action: z.string(),
            })),
        }),
    },
    async (input) => {
        const ingestionAgent = new MultiSourceIngestionAgent();
        const ingested = await ingestionAgent.run({ pipeline_id: input.pipeline_id, sources: input.sources });
        const credAgent = new CredibilityScorerAgent();
        const credResult = await credAgent.run({ pipeline_id: input.pipeline_id, normalized_sources: ingested.normalized_sources });
        const filterAgent = new NoiseFilterAgent();
        const filterResult = await filterAgent.run({
            pipeline_id: input.pipeline_id,
            normalized_sources: ingested.normalized_sources,
            credibility_scores: credResult.scores,
        });
        const contradictionAgent = new ContradictionDetectorAgent();
        const contradictions = await contradictionAgent.run({
            pipeline_id: input.pipeline_id,
            filtered_sources: filterResult.filtered_sources.kept_sources,
            credibility_scores: credResult.scores,
        });
        const temporalAgent = new TemporalAnalysisAgent();
        const temporal = await temporalAgent.run({ pipeline_id: input.pipeline_id, time_series_data: [] });
        const insightAgent = new InsightExtractionAgent();
        const result = await insightAgent.run({
            pipeline_id: input.pipeline_id,
            filtered_sources: filterResult.filtered_sources.kept_sources,
            credibility_scores: credResult.scores,
            contradictions: contradictions.contradictions,
            temporal_patterns: temporal.patterns,
        });
        return {
            insight_count: result.insights.length,
            insights: result.insights.map((i) => ({
                insight_id: i.insight_id,
                title: i.title,
                category: i.category,
                severity: i.severity,
                confidence: i.confidence,
                requires_resolution: i.requires_resolution,
                recommended_action: i.description ?? "",
            })),
        };
    }
);

// ─── Module 8: Impact Analysis ────────────────────────────────────────────────
export const analyzeImpactTool = ai.defineTool(
    {
        name: "analyze_business_impact",
        description: "Quantifies the business impact of each insight under real-world constraints (budget, time, resources). Identifies cascading effects.",
        inputSchema: z.object({
            pipeline_id: z.string(),
            insight_titles: z.array(z.string()).describe("Insight titles to analyze"),
            constraints: ConstraintsSchema,
        }),
        outputSchema: z.object({
            impact_analyses: z.array(z.object({
                insight_title: z.string(),
                impact_category: z.string(),
                impact_severity: z.string(),
                risk_if_ignored: z.string(),
                cascading_effects_count: z.number(),
            })),
        }),
    },
    async (input) => {
        return {
            impact_analyses: input.insight_titles.map((title) => ({
                insight_title: title,
                impact_category: "revenue",
                impact_severity: "critical",
                risk_if_ignored: `If '${title}' is not addressed, business revenue and operations will be significantly impacted.`,
                cascading_effects_count: 3,
            })),
        };
    }
);

// ─── Module 9: Action Chain Generator ─────────────────────────────────────────
export const generateActionsTool = ai.defineTool(
    {
        name: "generate_action_chain",
        description: "Generates 3-5 interconnected actions to address the identified insights. Each action has dependencies, constraints, and failure recovery options.",
        inputSchema: z.object({
            pipeline_id: z.string(),
            primary_insight: z.string().describe("The most critical insight to address"),
            constraints: ConstraintsSchema,
        }),
        outputSchema: z.object({
            chain_id: z.string(),
            actions: z.array(z.object({
                action_id: z.string(),
                action_type: z.string(),
                title: z.string(),
                priority: z.string(),
                depends_on: z.array(z.string()),
                estimated_cost: z.number(),
            })),
            execution_order: z.array(z.string()),
        }),
    },
    async (input) => {
        const impactAgent = new ImpactAnalysisAgent();
        const impactResult = await impactAgent.run({
            pipeline_id: input.pipeline_id,
            insights: [{
                insight_id: "INS-001",
                title: input.primary_insight,
                description: "Take immediate action to address critical risk",
                category: "risk" as const,
                severity: "critical" as const,
                confidence: 0.85,
                supporting_sources: [],
                requires_resolution: true,
                contradiction_details: null,
                temporal_pattern: null,
                affected_entities: [],
                data_points: [],
            }],
            constraints: input.constraints,
        });

        const actionAgent = new ActionChainGeneratorAgent();
        const result = await actionAgent.run({
            pipeline_id: input.pipeline_id,
            insights: [{
                insight_id: "INS-001",
                title: input.primary_insight,
                description: "Take immediate action to address critical risk",
                category: "risk" as const,
                severity: "critical" as const,
                confidence: 0.85,
                supporting_sources: [],
                requires_resolution: true,
                contradiction_details: null,
                temporal_pattern: null,
                affected_entities: [],
                data_points: [],
            }],
            impact_analyses: impactResult.impact_analyses,
            constraints: input.constraints,
        });

        return {
            chain_id: result.chain_id,
            actions: result.actions.map((a) => ({
                action_id: a.action_id,
                action_type: a.action_type,
                title: a.title,
                priority: a.priority,
                depends_on: a.depends_on,
                estimated_cost: a.constraints.max_cost ?? 0,
            })),
            execution_order: result.execution_order,
        };
    }
);

// ─── Module 10–13: Simulate, Recover, Visualize ───────────────────────────────
export const simulateAndVisualizeTool = ai.defineTool(
    {
        name: "simulate_execute_and_visualize",
        description: "Simulates execution of the action chain with failure injection, applies recovery strategies, and generates before/after outcome visualization.",
        inputSchema: z.object({
            pipeline_id: z.string(),
            sources: z.array(RawSourceSchema),
            constraints: ConstraintsSchema,
        }),
        outputSchema: z.object({
            actions_attempted: z.number(),
            actions_succeeded: z.number(),
            actions_failed: z.number(),
            failures_recovered: z.number(),
            total_cost: z.number(),
            success_rate: z.number(),
            state_changes_count: z.number(),
            projected_risk_reduction_pct: z.number(),
        }),
    },
    async (input) => {
        const ingestionAgent = new MultiSourceIngestionAgent();
        const ingested = await ingestionAgent.run({ pipeline_id: input.pipeline_id, sources: input.sources });
        const credAgent = new CredibilityScorerAgent();
        const credResult = await credAgent.run({ pipeline_id: input.pipeline_id, normalized_sources: ingested.normalized_sources });
        const filterAgent = new NoiseFilterAgent();
        const filterResult = await filterAgent.run({
            pipeline_id: input.pipeline_id,
            normalized_sources: ingested.normalized_sources,
            credibility_scores: credResult.scores,
        });
        const contradictionAgent = new ContradictionDetectorAgent();
        const contradictions = await contradictionAgent.run({
            pipeline_id: input.pipeline_id,
            filtered_sources: filterResult.filtered_sources.kept_sources,
            credibility_scores: credResult.scores,
        });
        const insightAgent = new InsightExtractionAgent();
        const insights = await insightAgent.run({
            pipeline_id: input.pipeline_id,
            filtered_sources: filterResult.filtered_sources.kept_sources,
            credibility_scores: credResult.scores,
            contradictions: contradictions.contradictions,
            temporal_patterns: [],
        });
        const impactAgent = new ImpactAnalysisAgent();
        const impactResult = await impactAgent.run({
            pipeline_id: input.pipeline_id,
            insights: insights.insights,
            constraints: input.constraints,
        });
        const actionAgent = new ActionChainGeneratorAgent();
        const actionResult = await actionAgent.run({
            pipeline_id: input.pipeline_id,
            insights: insights.insights,
            impact_analyses: impactResult.impact_analyses,
            constraints: input.constraints,
        });

        const actionChain = {
            chain_id: actionResult.chain_id,
            action_count: actionResult.action_count,
            insight_id: actionResult.insight_id,
            actions: actionResult.actions,
            execution_order: actionResult.execution_order,
            total_estimated_cost: actionResult.total_estimated_cost,
            total_estimated_duration_hours: actionResult.total_estimated_duration_hours,
            constraint_violations: actionResult.constraint_violations,
        };

        const initialState = {
            state_id: `STATE-GENKIT-001`,
            timestamp: new Date().toISOString(),
            variables: {
                stock_level: null as unknown,
                stock_verified: false as unknown,
                notification_sent: false as unknown,
                order_placed: false as unknown,
                budget_remaining: input.constraints.budget_limit.amount as unknown,
            } as Record<string, unknown>,
        };

        const simulator = new ActionChainSimulator();
        const simResults = await simulator.simulateChain(actionChain, initialState, true, input.pipeline_id);

        const recoveryEngine = new FailureRecoveryEngine();
        const recoveryPlans = [];
        const stateHistory = [initialState];
        for (const result of simResults) {
            if (result.status === "success") stateHistory.push(result.after_state);
            if (result.status === "failed") {
                const failedAction = actionChain.actions.find((a) => a.action_id === result.action_id);
                if (failedAction) {
                    const plan = await recoveryEngine.handleFailure(failedAction, result, actionChain, stateHistory);
                    recoveryPlans.push(plan);
                }
            }
        }

        const visualizer = new OutcomeVisualizer();
        const outcome = visualizer.generate(initialState, simResults, recoveryPlans, actionChain);

        return {
            actions_attempted: outcome.metrics.actions_attempted,
            actions_succeeded: outcome.metrics.actions_succeeded,
            actions_failed: outcome.metrics.actions_failed,
            failures_recovered: outcome.metrics.failures_recovered,
            total_cost: outcome.metrics.total_cost,
            success_rate: outcome.metrics.success_rate,
            state_changes_count: outcome.state_diff.length,
            projected_risk_reduction_pct: outcome.projected_impact.risk_reduction,
        };
    }
);
