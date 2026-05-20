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
import { DAGExecutor, ForcedFailuresConfig } from "../simulation/dag-executor";
import { FailureRecoveryEngine } from "../simulation/failure-recovery";
import { OutcomeVisualizer } from "../simulation/outcome-visualizer";
import { SagaConstraintLedger } from "../simulation/saga-ledger";
import { AMCEBlockError } from "../contracts/base-model-benchmark";
import { antigravityFileLogger } from "../tracing/file-logger";

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
    /**
     * V2 Phase 3 — reproducible failure injection so the M12 selective
     * rollback path can be exercised deterministically in demos and tests.
     */
    forcedFailures?: ForcedFailuresConfig;
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
    private simulator = new ActionChainSimulator();    // V1 legacy adapter (kept for back-compat)
    private dagExecutor = new DAGExecutor();           // V2 Phase 3 M11
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
            // Antigravity explicitly routes Phase C output through the
            // AMCE BLOCK + BASE MODEL gate (Gemini 1.5 Pro). The gate
            // executes INSIDE the agent against `llmClient` with
            // `useBaseModel=true`; this orchestrator emits the routing
            // intent so the trace shows Antigravity hitting the gate.
            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "decision",
                agent: "AntigravityOrchestrator",
                message:
                    "Phase C routing → M5 output MUST clear AMCE BLOCK + BASE MODEL gate (Gemini 1.5 Pro via llmClient). On BLOCK, Antigravity re-prompts once with the judge's critique; second BLOCK halts Phase C.",
                decision: "ROUTE_M5_TO_BASE_MODEL_GATE",
                confidence: 1.0,
                data: { schema: "insight_extraction_v1", mode: "BLOCK+BASE_MODEL" },
            });

            const insightOut = await this.insightAgent.run({
                pipeline_id: pipelineId,
                filtered_sources: keptSources,
                credibility_scores: credibilityOut.scores,
                contradictions: contradictionOut.contradictions,
                temporal_patterns: temporalOut.patterns,
            });

            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "contract_gate",
                agent: "AntigravityOrchestrator",
                message: `AMCE BLOCK + BASE MODEL gate on M5: base_model_score=${insightOut.base_model_score.toFixed(2)}, block_events=${insightOut.base_model_block_count}. ${insightOut.base_model_block_count > 0 ? "BLOCKED then RECOVERED via re-prompt." : "PASS on first judgement."}`,
                decision: insightOut.base_model_block_count > 0 ? "BLOCK_RECOVERED" : "PASS",
                confidence: insightOut.base_model_score,
                data: { tool_called: "BaseModelValidator", schema: "insight_extraction_v1" },
            });

            // ── Module 8: Impact Analysis ──────────────────────────────────────────
            const impactOut = await this.impactAgent.run({
                pipeline_id: pipelineId,
                insights: insightOut.insights,
                constraints,
            });

            // ── Module 9: Action Chain Generator ──────────────────────────────────
            // Antigravity routes Phase D through the AMCE BLOCK + BASE MODEL
            // gate. M9 also enforces a Kahn's-algorithm topological sort that
            // re-prompts the LLM on cycles/orphans BEFORE the base-model judge
            // runs. A terminal BLOCK from the judge throws AMCEBlockError —
            // there is no silent fallback substitution.
            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "decision",
                agent: "AntigravityOrchestrator",
                message:
                    "Phase D routing → M9 output MUST clear AMCE BLOCK + BASE MODEL gate (Gemini 1.5 Pro via llmClient) AFTER topological sort. A BLOCK on the base-model judge HALTS the pipeline before the saga ledger.",
                decision: "ROUTE_M9_TO_BASE_MODEL_GATE",
                confidence: 1.0,
                data: { schema: "action_chain_v1", mode: "BLOCK+BASE_MODEL" },
            });

            const actionOut = await this.actionChainAgent.run({
                pipeline_id: pipelineId,
                insights: insightOut.insights,
                impact_analyses: impactOut.impact_analyses,
                constraints,
            });

            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "contract_gate",
                agent: "AntigravityOrchestrator",
                message: `AMCE BLOCK + BASE MODEL gate on M9: base_model_score=${actionOut.base_model_score.toFixed(2)}, block_events=${actionOut.base_model_block_count}, topology_passed=${actionOut.topology_validation.passed}, used_topology_fallback=${actionOut.topology_validation.used_fallback}.`,
                decision: actionOut.base_model_block_count > 0 ? "BLOCK_RECOVERED" : "PASS",
                confidence: actionOut.base_model_score,
                data: { tool_called: "BaseModelValidator", schema: "action_chain_v1" },
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

            // ── Phase E (V2): Antigravity initializes the shared SagaConstraintLedger.
            // Same instance is used by M10 (reserve), M11 (commit), M12 (refund-first).
            const sagaLedger = new SagaConstraintLedger(pipelineId, constraints.budget_limit.amount);
            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: "M10_SagaLedgerInit",
                tool_called: "SagaConstraintLedger",
                reasoning: `Antigravity initialized the saga ledger with budget PKR ${constraints.budget_limit.amount}. The ledger is shared across M10/M11/M12 for cumulative reserve→commit/refund tracking.`,
                status: "SUCCESS",
                rollback_action: "none",
                latency_ms: 0,
                cost: 0,
                rubric_category: "constraint_evaluation",
                data_lineage: {
                    from: "AntigravityOrchestrator",
                    to: "SagaConstraintLedger",
                    data_type: "LedgerInit",
                    key_change: `budget_limit_pkr=${constraints.budget_limit.amount}`,
                },
            });

            // ── Module 10: Constraint Validation (Saga reserve, cumulative) ──────
            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "decision",
                agent: "AntigravityOrchestrator",
                message: "Phase E routing → M10 (Saga Constraint Validator). Cumulative reserve via the shared SagaConstraintLedger; relaxation suggestions on infeasibility.",
                decision: "ROUTE_M10_SAGA_LEDGER",
                confidence: 1.0,
                data: { schema: "constraint_validation_v1", mode: "ALERT_ONLY" },
            });
            const m10 = this.constraintValidator.validateWithLedger({
                pipeline_id: pipelineId,
                chain: actionChain,
                constraints,
                ledger: sagaLedger,
            });
            const validations = m10.results;

            validations.forEach((v) => {
                if (!v.is_feasible) {
                    traceCollector.log(pipelineId, {
                        pipeline_id: pipelineId,
                        event_type: "decision",
                        agent: "ConstraintValidator",
                        message: `Action ${v.action_id} is infeasible: ${v.violations.map(vl => vl.constraint_type).join(", ")} violation. ${v.recommended_modification ?? ""}`,
                        decision: "CONSTRAINT_REJECT",
                        confidence: 1.0,
                        data: { violations: v.violations, recommendation: v.recommended_modification },
                    });
                }
            });

            // ── Module 11: Level-Parallel DAG Executor ──────────────────────────
            const initialState: SimulationState = {
                state_id: `STATE-${uuidv4().slice(0, 8).toUpperCase()}`,
                timestamp: new Date().toISOString(),
                variables: {
                    stock_level: 50,
                    stock_verified: false,
                    notification_sent: false,
                    order_placed: false,
                    order_id: null,
                    dashboard_updated: false,
                    monitoring_active: false,
                    budget_remaining: constraints.budget_limit.amount,
                },
            };

            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "decision",
                agent: "AntigravityOrchestrator",
                message: `Phase E routing → M11 (Level-Parallel DAG Executor). State mutations strictly BETWEEN dependency levels; Promise.allSettled inside each level. forcedFailures.fail count = ${request.forcedFailures?.fail.length ?? 0}.`,
                decision: "ROUTE_M11_DAG_EXECUTOR",
                confidence: 1.0,
                data: { simulate_random_failures: !request.forcedFailures, forced: request.forcedFailures?.fail ?? [] },
            });

            const dagOut = await this.dagExecutor.execute({
                pipeline_id: pipelineId,
                chain: actionChain,
                initialState,
                ledger: sagaLedger,
                forcedFailures: request.forcedFailures,
                // If forcedFailures was specified, suppress stochastic noise so the
                // demo is reproducible. Otherwise leave random failures enabled to
                // exercise the recovery path.
                simulateRandomFailures: !request.forcedFailures,
            });
            const simulationResults = dagOut.results;

            // ── Module 12: Failure Recovery (refund-first) ──────────────────────
            const recoveryPlans: RecoveryPlan[] = [];
            const stateHistory: SimulationState[] = dagOut.state_history.slice();

            for (const result of simulationResults) {
                if (result.status !== "failed") continue;
                const failedAction = actionChain.actions.find((a) => a.action_id === result.action_id);
                if (!failedAction) continue;

                traceCollector.log(pipelineId, {
                    pipeline_id: pipelineId,
                    event_type: "decision",
                    agent: "AntigravityOrchestrator",
                    message: `Phase E routing → M12 for failed action ${result.action_id}. Antigravity contract requires ledger.refund() FIRST before retry/fallback.`,
                    decision: "ROUTE_M12_RECOVERY",
                    confidence: 1.0,
                    data: { failed_action_id: result.action_id, failure_reason: result.failure_reason },
                });

                const plan = await this.recoveryEngine.handle({
                    pipeline_id: pipelineId,
                    failedAction,
                    failureResult: result,
                    chain: actionChain,
                    stateHistory,
                    ledger: sagaLedger,
                });
                recoveryPlans.push(plan);

                traceCollector.log(pipelineId, {
                    pipeline_id: pipelineId,
                    event_type: "recovery",
                    agent: "FailureRecoveryEngine",
                    message: `Recovery for ${result.action_id}: strategy=${plan.recovery_strategy}, refund_invoked=${plan.refund_invoked}, refund_amount_pkr=${plan.refund_amount_pkr}, recovery_cost_pkr=${plan.recovery_cost_pkr}`,
                    decision: plan.recovery_strategy,
                    data: {
                        log: plan.recovery_execution_log,
                        refund_status: plan.refund_status,
                    },
                });
            }

            // ── Module 13: Outcome Visualization (5 mandatory outputs) ──────────
            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "decision",
                agent: "AntigravityOrchestrator",
                message: "Phase F routing → M13 (Outcome Visualizer). Synthesizes state diff + timeline + residual risk + agentic-vs-heuristic baseline + cost/scalability.",
                decision: "ROUTE_M13_VISUALIZER",
                confidence: 1.0,
                data: { schema: "outcome_visualization_v1", mode: "ALERT_ONLY" },
            });
            const outcome = this.visualizer.build({
                pipeline_id: pipelineId,
                initialState,
                executionResults: simulationResults,
                recoveryPlans,
                actionChain,
                ledgerSnapshot: sagaLedger.snapshot(),
                dagLevels: dagOut.levels,
            });

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
            // Strict V2 AMCE BLOCK handling — distinguish a base-model BLOCK
            // halt from any other failure so the auditor's parser can tell
            // the two apart.
            if (err instanceof AMCEBlockError) {
                antigravityFileLogger.append({
                    timestamp: new Date().toISOString(),
                    step: `AMCE_BLOCK_FINAL_${err.module}`,
                    tool_called: "BaseModelValidator",
                    reasoning: `AntigravityOrchestrator halted pipeline on terminal AMCE BLOCK from base-model judge on ${err.module} (score=${err.score.toFixed(2)}): ${err.reasoning}. Issues: ${err.issues.join("; ")}`,
                    status: "FAILED",
                    rollback_action: "Pipeline halted — no downstream module receives unverified output. Operator must inspect base-model critique and re-run with corrected inputs.",
                    latency_ms: 0,
                    cost: 0,
                    rubric_category: "failure_recovery",
                });
                traceCollector.log(pipelineId, {
                    pipeline_id: pipelineId,
                    event_type: "failure",
                    agent: "AntigravityOrchestrator",
                    message: `AMCE BLOCK FINAL on ${err.module} (schema=${err.schema}, score=${err.score.toFixed(2)}). Pipeline halted by Antigravity. Critique: ${err.reasoning}`,
                    decision: "AMCE_BLOCK_FINAL",
                    confidence: err.score,
                    data: {
                        module: err.module,
                        schema: err.schema,
                        issues: err.issues,
                        tool_called: "BaseModelValidator",
                        rollback_action: "halt_pipeline_no_substitution",
                    },
                });
            } else {
                // V2 Phase 4 — Global Panic Handler. Any non-AMCE failure is
                // funnelled through this branch so the auditor can distinguish
                // an unrecoverable orchestrator exception from a base-model
                // BLOCK halt. The file-logger uses synchronous appendFileSync,
                // so every event written prior to this point is already on
                // disk; the explicit PIPELINE_HALT marker below signals that
                // the captured trace up to the point of failure has been
                // safely flushed before exit.
                traceCollector.log(pipelineId, {
                    pipeline_id: pipelineId,
                    event_type: "failure",
                    agent: "PipelineOrchestrator",
                    message: `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
                });
                antigravityFileLogger.append({
                    timestamp: new Date().toISOString(),
                    step: "PIPELINE_HALT_PANIC",
                    tool_called: "AntigravityOrchestrator",
                    reasoning: `Global panic handler engaged for pipeline ${pipelineId}. Captured trace flushed to disk before graceful halt. Reason: ${err instanceof Error ? err.message : String(err)}`,
                    status: "FAILED",
                    rollback_action: "halt_pipeline_flush_trace",
                    latency_ms: 0,
                    cost: 0,
                    rubric_category: "failure_recovery",
                    data_lineage: {
                        from: "PipelineOrchestrator",
                        to: "AntigravityFileLogger",
                        data_type: "PanicFlush",
                        key_change: `pipeline_status=failed`,
                    },
                });
            }
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
