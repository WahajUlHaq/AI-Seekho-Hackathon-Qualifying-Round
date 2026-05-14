import { v4 as uuidv4 } from "uuid";
import { traceCollector, PipelineTrace } from "../tracing/collector";

import { MultiSourceIngestionAgent, RawSourceInput, NormalizedSource } from "./multi-source-ingestion.agent";
import { CredibilityScorerAgent, CredibilityScore } from "./credibility-scorer.agent";
import { NoiseFilterAgent, FilteredSources } from "./noise-filter.agent";
import { ContradictionDetectorAgent, Contradiction } from "./contradiction-detector.agent";
import { ConflictResolutionAgent, ConflictResolution } from "./conflict-resolution.agent";
import { TemporalAnalysisAgent, TemporalPattern, DataPoint } from "./temporal-analysis.agent";
import { InsightExtractionAgent, Insight } from "./insight-extraction.agent";
import { ImpactAnalysisAgent, ImpactAnalysis } from "./impact-analysis.agent";
import { ActionChainGeneratorAgent, ActionChainGeneratorOutput } from "./action-chain-generator.agent";

import { ConstraintValidator } from "../simulation/constraint-validator";
import { ActionChainSimulator } from "../simulation/chain-simulator";
import { FailureRecoveryEngine } from "../simulation/failure-recovery";
import { OutcomeVisualizer } from "../simulation/outcome-visualizer";

import {
    Constraints,
    ActionChain,
    ConstraintValidationResult,
    ActionExecutionResult,
    RecoveryPlan,
    OutcomeVisualization,
    SimulationState,
} from "../types/simulation.types";

export interface PipelineRequest {
    sources: RawSourceInput[];
    constraints?: Partial<Constraints>;
}

export interface PipelineResult {
    pipeline_id: string;
    status: "completed" | "partial" | "failed";
    ingestion: { ingestion_id: string; sources_processed: number; normalized_sources: NormalizedSource[] };
    credibility_scores: CredibilityScore[];
    filtered_sources: FilteredSources;
    contradictions: Contradiction[];
    resolutions: ConflictResolution[];
    temporal_patterns: TemporalPattern[];
    insights: Insight[];
    impact_analyses: ImpactAnalysis[];
    action_chain: ActionChain;
    constraint_validations: ConstraintValidationResult[];
    simulation_results: ActionExecutionResult[];
    recovery_plans: RecoveryPlan[];
    outcome: OutcomeVisualization;
    trace: PipelineTrace;
}

const WORKPLAN = "Ingest 5+ sources → Score credibility → Filter noise → Detect contradictions → Resolve conflicts → Analyze trends → Extract insights → Assess impact → Generate action chain → Validate constraints → Simulate execution → Recover failures → Visualize outcomes";

const TASK_PLAN = [
    "Task 1: Ingest all input sources in parallel (Module 1)",
    "Task 2: Score source credibility — recency, authority, quality (Module 2)",
    "Task 3: Filter noise, duplicates, and stale sources (Module 3)",
    "Task 4: Detect contradictions across sources (Module 4)",
    "Task 5: Resolve conflicts using credibility and recency strategies (Module 7)",
    "Task 6: Analyze temporal patterns in time-series data (Module 6)",
    "Task 7: Extract RAG-powered insights with contradiction flagging (Module 5)",
    "Task 8: Analyze impact under budget/time/resource constraints (Module 8)",
    "Task 9: Generate 3-5 interconnected action chain (Module 9)",
    "Task 10: Validate action chain against constraints (Module 10)",
    "Task 11: Simulate action execution with failure injection (Module 11)",
    "Task 12: Handle failures with retry/fallback/rollback (Module 12)",
    "Task 13: Visualize before/after state and metrics (Module 13)",
];

export class PipelineOrchestrator {
    private ingestionAgent = new MultiSourceIngestionAgent();
    private credibilityAgent = new CredibilityScorerAgent();
    private noiseFilterAgent = new NoiseFilterAgent();
    private contradictionAgent = new ContradictionDetectorAgent();
    private conflictAgent = new ConflictResolutionAgent();
    private temporalAgent = new TemporalAnalysisAgent();
    private insightAgent = new InsightExtractionAgent();
    private impactAgent = new ImpactAnalysisAgent();
    private actionChainAgent = new ActionChainGeneratorAgent();
    private constraintValidator = new ConstraintValidator();
    private simulator = new ActionChainSimulator();
    private recoveryEngine = new FailureRecoveryEngine();
    private visualizer = new OutcomeVisualizer();

    async run(request: PipelineRequest, pipelineId: string): Promise<PipelineResult> {
        // Normalize constraints with sensible defaults
        const constraints: Constraints = {
            budget_limit: {
                amount: Number(request.constraints?.budget_limit?.amount ?? 500000),
                currency: String(request.constraints?.budget_limit?.currency ?? "PKR"),
            },
            time_limit: {
                deadline: request.constraints?.time_limit?.deadline,
                max_duration_hours: Number(request.constraints?.time_limit?.max_duration_hours ?? 24),
            },
            resource_limits: {
                api_calls_per_hour: Number(request.constraints?.resource_limits?.api_calls_per_hour ?? 100),
                compute_units: Number(request.constraints?.resource_limits?.compute_units ?? 10),
                human_hours_available: Number(request.constraints?.resource_limits?.human_hours_available ?? 8),
            },
            urgency_level: (request.constraints?.urgency_level ?? "high") as Constraints["urgency_level"],
        };

        traceCollector.initPipeline(pipelineId, WORKPLAN, TASK_PLAN);

        try {
            // ── Module 1: Multi-Source Ingestion ───────────────────────────────────
            const ingestionOut = await this.ingestionAgent.run({
                pipeline_id: pipelineId,
                sources: request.sources,
            });

            // ── Module 2: Credibility Scoring ──────────────────────────────────────
            const credibilityOut = await this.credibilityAgent.run({
                pipeline_id: pipelineId,
                normalized_sources: ingestionOut.normalized_sources,
            });

            // ── Module 3: Noise Filter ─────────────────────────────────────────────
            const noiseOut = await this.noiseFilterAgent.run({
                pipeline_id: pipelineId,
                normalized_sources: ingestionOut.normalized_sources,
                credibility_scores: credibilityOut.scores,
            });

            const keptSources = noiseOut.filtered_sources.kept_sources;

            // ── Module 4: Contradiction Detection ─────────────────────────────────
            const contradictionOut = await this.contradictionAgent.run({
                pipeline_id: pipelineId,
                filtered_sources: keptSources,
                credibility_scores: credibilityOut.scores,
            });

            // ── Module 7: Conflict Resolution ─────────────────────────────────────
            const conflictOut = await this.conflictAgent.run({
                pipeline_id: pipelineId,
                contradictions: contradictionOut.contradictions,
                credibility_scores: credibilityOut.scores,
                normalized_sources: keptSources,
            });

            // ── Module 6: Temporal Analysis ────────────────────────────────────────
            const timeSeriesData = this.extractTimeSeries(ingestionOut.normalized_sources);
            const temporalOut = await this.temporalAgent.run({
                pipeline_id: pipelineId,
                time_series_data: timeSeriesData,
            });

            // ── Module 5: Insight Extraction ───────────────────────────────────────
            const insightOut = await this.insightAgent.run({
                pipeline_id: pipelineId,
                filtered_sources: keptSources,
                credibility_scores: credibilityOut.scores,
                contradictions: contradictionOut.contradictions,
                temporal_patterns: temporalOut.patterns,
            });

            // ── Module 8: Impact Analysis ──────────────────────────────────────────
            const impactOut = await this.impactAgent.run({
                pipeline_id: pipelineId,
                insights: insightOut.insights,
                constraints,
            });

            // ── Module 9: Action Chain Generator ──────────────────────────────────
            const actionOut = await this.actionChainAgent.run({
                pipeline_id: pipelineId,
                insights: insightOut.insights,
                impact_analyses: impactOut.impact_analyses,
                constraints,
            });

            const actionChain: ActionChain = {
                chain_id: actionOut.chain_id,
                action_count: actionOut.action_count,
                insight_id: actionOut.insight_id,
                actions: actionOut.actions,
                execution_order: actionOut.execution_order,
                total_estimated_cost: actionOut.total_estimated_cost,
                total_estimated_duration_hours: actionOut.total_estimated_duration_hours,
                constraint_violations: actionOut.constraint_violations,
            };

            // ── Module 10: Constraint Validation ──────────────────────────────────
            const validations = this.constraintValidator.validateActionChain(actionChain, constraints);

            validations.forEach((v) => {
                if (!v.is_feasible) {
                    traceCollector.log(pipelineId, {
                        pipeline_id: pipelineId,
                        event_type: "decision",
                        agent: "ConstraintValidator",
                        message: `Action ${v.action_id} is infeasible: ${v.violations.map(vl => vl.constraint_type).join(", ")} violation`,
                        decision: "CONSTRAINT_REJECT",
                        confidence: 1.0,
                        data: { violations: v.violations, recommendation: v.recommended_modification },
                    });
                }
            });

            // ── Module 11: Action Chain Simulation ────────────────────────────────
            const initialState: SimulationState = {
                state_id: `STATE-${uuidv4().slice(0, 8).toUpperCase()}`,
                timestamp: new Date().toISOString(),
                variables: {
                    stock_level: null,
                    stock_verified: false,
                    notification_sent: false,
                    order_placed: false,
                    order_id: null,
                    dashboard_updated: false,
                    monitoring_active: false,
                    budget_remaining: constraints.budget_limit.amount,
                },
            };

            const simulationResults = await this.simulator.simulateChain(
                actionChain,
                initialState,
                true,  // simulateFailures: true — demonstrates robustness
                pipelineId
            );

            // ── Module 12: Failure Recovery ────────────────────────────────────────
            const recoveryPlans: RecoveryPlan[] = [];
            const stateHistory = [initialState];

            for (const result of simulationResults) {
                if (result.status === "success") {
                    stateHistory.push(result.after_state);
                }
                if (result.status === "failed") {
                    const failedAction = actionChain.actions.find(
                        (a) => a.action_id === result.action_id
                    );
                    if (failedAction) {
                        const plan = await this.recoveryEngine.handleFailure(
                            failedAction,
                            result,
                            actionChain,
                            stateHistory
                        );
                        recoveryPlans.push(plan);
                        traceCollector.log(pipelineId, {
                            pipeline_id: pipelineId,
                            event_type: "recovery",
                            agent: "FailureRecoveryEngine",
                            message: `Recovery for ${result.action_id}: strategy=${plan.recovery_strategy}`,
                            decision: plan.recovery_strategy,
                            data: { log: plan.recovery_execution_log },
                        });
                    }
                }
            }

            // ── Module 13: Outcome Visualization ──────────────────────────────────
            const outcome = this.visualizer.generate(
                initialState,
                simulationResults,
                recoveryPlans,
                actionChain
            );

            const trace = traceCollector.finalizePipeline(pipelineId);

            return {
                pipeline_id: pipelineId,
                status: "completed",
                ingestion: {
                    ingestion_id: ingestionOut.ingestion_id,
                    sources_processed: ingestionOut.sources_processed,
                    normalized_sources: ingestionOut.normalized_sources,
                },
                credibility_scores: credibilityOut.scores,
                filtered_sources: noiseOut.filtered_sources,
                contradictions: contradictionOut.contradictions,
                resolutions: conflictOut.resolutions,
                temporal_patterns: temporalOut.patterns,
                insights: insightOut.insights,
                impact_analyses: impactOut.impact_analyses,
                action_chain: actionChain,
                constraint_validations: validations,
                simulation_results: simulationResults,
                recovery_plans: recoveryPlans,
                outcome,
                trace,
            };
        } catch (err) {
            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "failure",
                agent: "PipelineOrchestrator",
                message: `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
            });
            const trace = traceCollector.finalizePipeline(pipelineId);
            throw Object.assign(err instanceof Error ? err : new Error(String(err)), { trace });
        }
    }

    private extractTimeSeries(
        sources: NormalizedSource[]
    ): Array<{ metric_name: string; data_points: DataPoint[] }> {
        const series: Array<{ metric_name: string; data_points: DataPoint[] }> = [];

        for (const source of sources) {
            if (source.source_type !== "csv" || !source.structured_data) continue;

            const rows = source.structured_data["rows"] as Array<Record<string, string>> | undefined;
            if (!rows || rows.length === 0) continue;

            // Detect numeric columns and date columns
            const sample = rows[0];
            const dateKey = Object.keys(sample).find((k) => /date|time|timestamp/i.test(k));
            const numericKeys = Object.keys(sample).filter(
                (k) => k !== dateKey && !isNaN(parseFloat(sample[k]))
            );

            if (!dateKey) continue;

            for (const metric of numericKeys) {
                const dataPoints: DataPoint[] = rows
                    .map((row) => ({
                        timestamp: new Date(row[dateKey]).toISOString(),
                        value: parseFloat(row[metric]) || 0,
                    }))
                    .filter((dp) => !isNaN(new Date(dp.timestamp).getTime()));

                if (dataPoints.length >= 2) {
                    series.push({ metric_name: metric, data_points: dataPoints });
                }
            }
        }

        return series;
    }
}

export const pipelineOrchestrator = new PipelineOrchestrator();
