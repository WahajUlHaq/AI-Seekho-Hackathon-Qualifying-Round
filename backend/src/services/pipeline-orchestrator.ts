import * as path from "path";

import { traceCollector } from "../tracing/collector";
import { InMemoryVectorStore } from "../stores/in-memory-vector.store";
import { MockRealtimeFeedAdapter } from "../adapters/mock-realtime-feed.adapter";
import { MultiSourceIngestionAgent } from "../agents/multi-source-ingestion.agent";
import { CredibilityScorerAgent } from "../agents/credibility-scorer.agent";
import { NoiseFilterAgent } from "../agents/noise-filter.agent";
import { ContradictionDetectorAgent } from "../agents/contradiction-detector.agent";
import { ConflictResolutionAgent } from "../agents/conflict-resolution.agent";
import { TemporalAnalysisAgent } from "../agents/temporal-analysis.agent";
import { InsightExtractionAgent } from "../agents/insight-extraction.agent";
import { ImpactScorerAgent } from "../agents/impact-scorer.agent";
import { PredictiveForecasterAgent } from "../agents/predictive-forecaster.agent";
import { StrategicRecommenderAgent } from "../agents/strategic-recommender.agent";
import { ExecutionSimulatorAgent } from "../agents/execution-simulator.agent";
import { FailureRecoveryAgent } from "../agents/failure-recovery.agent";
import { OutcomeVisualizerAgent } from "../agents/outcome-visualizer.agent";
import { WorkflowAuditAgent } from "../agents/workflow-audit.agent";
import { sortActionsTopologically } from "../utils/dag-sorter";
import { pipelineApprovalStore } from "../stores/pipeline-approval.store";
import { pipelineExecutionStore } from "../stores/pipeline-execution.store";

// Per-pipeline agent instances are unsafe to share across concurrent runs because
// the vector store accumulates embeddings keyed by source ids. So we instantiate
// fresh agents per pipeline; the LLMClient itself is a singleton.

function makeAgents() {
    const vectorStore = new InMemoryVectorStore();
    const feedAdapter = new MockRealtimeFeedAdapter(
        path.resolve(__dirname, "../../test-data/realtime-feed.json")
    );

    return {
        ingestionAgent: new MultiSourceIngestionAgent(undefined, feedAdapter),
        credibilityAgent: new CredibilityScorerAgent(),
        noiseFilterAgent: new NoiseFilterAgent(vectorStore),
        contradictionAgent: new ContradictionDetectorAgent(),
        conflictAgent: new ConflictResolutionAgent(),
        temporalAgent: new TemporalAnalysisAgent(),
        insightAgent: new InsightExtractionAgent(vectorStore),
        impactAgent: new ImpactScorerAgent(),
        forecasterAgent: new PredictiveForecasterAgent(),
        recommenderAgent: new StrategicRecommenderAgent(),
        simulatorAgent: new ExecutionSimulatorAgent(),
        recoveryAgent: new FailureRecoveryAgent(),
        visualizerAgent: new OutcomeVisualizerAgent(),
        auditAgent: new WorkflowAuditAgent(),
    };
}

// Per-pipeline context retained between the M1-M10 phase and the post-approval
// M11-M14 phase. Without this, the post-approval worker would have to re-derive
// impact/forecast from scratch.
interface PendingExecutionContext {
    sortedActions: ReturnType<typeof sortActionsTopologically>;
    impact: Awaited<ReturnType<ImpactScorerAgent["run"]>>;
    forecast: Awaited<ReturnType<PredictiveForecasterAgent["run"]>>;
    simulatorAgent: ExecutionSimulatorAgent;
    recoveryAgent: FailureRecoveryAgent;
    visualizerAgent: OutcomeVisualizerAgent;
    auditAgent: WorkflowAuditAgent;
}

const pendingExecutionContexts = new Map<string, PendingExecutionContext>();

/**
 * M1 -> M10 + HITL submit. Runs as fire-and-forget; the worker handles its own
 * errors. On success, leaves the pipeline in PENDING state in the approval store.
 */
export async function processFullPipelineUpToHITL(pipelineId: string): Promise<void> {
    const agents = makeAgents();

    try {
        const ingestion = await agents.ingestionAgent.run({ pipeline_id: pipelineId });

        const credibility = await agents.credibilityAgent.run({
            pipeline_id: pipelineId,
            sources: ingestion.sources,
        });

        const filtered = await agents.noiseFilterAgent.run({
            pipeline_id: pipelineId,
            sources: credibility.sources,
        });

        const contradictionResult = await agents.contradictionAgent.run({
            pipeline_id: pipelineId,
            sources: filtered.sources,
        });

        const [resolution, temporal] = await Promise.all([
            agents.conflictAgent.run({
                pipeline_id: pipelineId,
                contradictions: contradictionResult.contradictions,
                sources: filtered.sources,
            }),
            agents.temporalAgent.run({
                pipeline_id: pipelineId,
                sources: filtered.sources,
            }),
        ]);

        const insights = await agents.insightAgent.run({
            pipeline_id: pipelineId,
            sources: filtered.sources,
            resolutions: resolution.resolutions,
            investigation_paths: resolution.investigation_paths,
            temporal_patterns: temporal.metrics,
        });

        const impact = await agents.impactAgent.run({ pipeline_id: pipelineId, insights });

        const forecast = await agents.forecasterAgent.run({
            pipeline_id: pipelineId,
            insights,
            temporal,
        });

        const strategy = await agents.recommenderAgent.run({
            pipeline_id: pipelineId,
            insights,
            impactAnalysis: impact,
            forecast,
        });

        const sortedActions = sortActionsTopologically(
            strategy.strategyProposal.proposedActions,
            pipelineId
        );

        // Park the downstream context so the post-approval worker can resume.
        pendingExecutionContexts.set(pipelineId, {
            sortedActions,
            impact,
            forecast,
            simulatorAgent: agents.simulatorAgent,
            recoveryAgent: agents.recoveryAgent,
            visualizerAgent: agents.visualizerAgent,
            auditAgent: agents.auditAgent,
        });

        pipelineApprovalStore.submit({
            pipeline_id: pipelineId,
            proposed_at: new Date().toISOString(),
            proposal: strategy.strategyProposal,
        });

        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "hitl_pending",
            agent: "PipelineOrchestrator",
            message: "Strategy submitted for HITL approval (PENDING)",
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Pipeline ${pipelineId}] M1-M10 worker crashed:`, message);
        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "failure",
            agent: "PipelineOrchestrator",
            message: `M1-M10 aborted: ${message}`,
        });
        pipelineExecutionStore.setError(pipelineId, message);
        try {
            traceCollector.finalizePipeline(pipelineId);
        } catch {
            // already finalized
        }
    }
}

/**
 * M11 -> M14. Triggered by POST /api/execution/:id/approve after the atomic
 * CAS from PENDING to EXECUTING has succeeded. Writes each agent output to
 * pipelineExecutionStore as soon as it completes so the FE can poll progressively.
 */
export async function processPostApprovalExecution(
    pipelineId: string,
    approver: string,
    approvedAt: string
): Promise<void> {
    const ctx = pendingExecutionContexts.get(pipelineId);
    if (!ctx) {
        const msg = `No pending execution context for ${pipelineId}; cannot run M11-M14.`;
        console.error(`[Pipeline ${pipelineId}] ${msg}`);
        pipelineExecutionStore.setError(pipelineId, msg);
        return;
    }

    try {
        const execution = await ctx.simulatorAgent.run({
            pipeline_id: pipelineId,
            actions: ctx.sortedActions,
            approved_by: approver,
            approval_timestamp: approvedAt,
        });
        pipelineExecutionStore.setChain(pipelineId, execution);

        const recovery = await ctx.recoveryAgent.run({
            pipeline_id: pipelineId,
            execution,
            originalActions: ctx.sortedActions,
        });
        pipelineExecutionStore.setRecovery(pipelineId, recovery);

        const outcome = await ctx.visualizerAgent.run({
            pipeline_id: pipelineId,
            execution,
            recovery,
            impact: ctx.impact,
            forecast: ctx.forecast,
        });
        pipelineExecutionStore.setOutcome(pipelineId, outcome);

        const audit = await ctx.auditAgent.run({
            pipeline_id: pipelineId,
            outcome,
            execution,
            approver,
        });
        pipelineExecutionStore.setAudit(pipelineId, audit);

        pipelineApprovalStore.transition(pipelineId, "COMPLETED");
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Pipeline ${pipelineId}] M11-M14 worker crashed:`, message);
        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "failure",
            agent: "PipelineOrchestrator",
            message: `M11-M14 aborted: ${message}`,
        });
        pipelineExecutionStore.setError(pipelineId, message);
    } finally {
        pendingExecutionContexts.delete(pipelineId);
        try {
            traceCollector.finalizePipeline(pipelineId);
        } catch {
            // already finalized
        }
    }
}

/**
 * Cleanup hook called by POST /api/execution/:id/reject. Discards the cached
 * M11-M14 context and finalizes the trace so the SSE stream can close.
 */
export function discardPendingExecutionContext(pipelineId: string): void {
    pendingExecutionContexts.delete(pipelineId);
    try {
        traceCollector.finalizePipeline(pipelineId);
    } catch {
        // already finalized
    }
}
