import * as path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { traceCollector } from "../tracing/collector";
import { InMemoryVectorStore } from "../stores/in-memory-vector.store";
import { MockRealtimeFeedAdapter } from "../adapters/mock-realtime-feed.adapter";
import { MultiSourceIngestionAgent, CustomSourceInput } from "../agents/multi-source-ingestion.agent";
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

export interface PipelineContext {
    ingestion: any;
    credibility: any;
    filtered: any;
    contradictionResult: any;
    resolution: any;
    temporal: any;
    insights: any;
    impact: any;
    forecast: any;
    strategy: any;
}

class PipelineService {
    private contexts = new Map<string, PipelineContext>();

    async runPhaseA(
        pipelineId: string,
        customSources?: CustomSourceInput[],
        constraints?: Record<string, unknown>
    ) {
        console.log(`[PipelineService] Starting Phase A for pipeline: ${pipelineId}`);
        
        traceCollector.initPipeline(pipelineId, "mobile-pipeline-run", [
            "ingestion",
            "credibility",
            "noise-filter",
            "contradiction",
            "resolution+temporal (parallel)",
            "insight-extraction",
            "impact-scoring",
            "predictive-forecasting",
            "strategic-recommendation",
            "hitl-gate"
        ]);

        const vectorStore = new InMemoryVectorStore();
        // Use test realtime-feed.json as backup path
        const feedAdapter = new MockRealtimeFeedAdapter(
            path.resolve(__dirname, "../../test-data/realtime-feed.json")
        );

        // Instantiate Phase A agents
        const ingestionAgent = new MultiSourceIngestionAgent(undefined, feedAdapter);
        const credibilityAgent = new CredibilityScorerAgent();
        const noiseFilterAgent = new NoiseFilterAgent(vectorStore);
        const contradictionAgent = new ContradictionDetectorAgent();
        const conflictAgent = new ConflictResolutionAgent();
        const temporalAgent = new TemporalAnalysisAgent();
        const insightAgent = new InsightExtractionAgent(vectorStore);
        const impactAgent = new ImpactScorerAgent();
        const forecasterAgent = new PredictiveForecasterAgent();
        const recommenderAgent = new StrategicRecommenderAgent();

        // 1. Ingestion
        const ingestion = await ingestionAgent.run({
            pipeline_id: pipelineId,
            customSources: customSources ?? []
        });

        // 2. Credibility Scorer
        const credibility = await credibilityAgent.run({
            pipeline_id: pipelineId,
            sources: ingestion.sources
        });

        // 3. Noise Filter
        const filtered = await noiseFilterAgent.run({
            pipeline_id: pipelineId,
            sources: credibility.sources
        });

        // 4. Contradiction Detector
        const contradictionResult = await contradictionAgent.run({
            pipeline_id: pipelineId,
            sources: filtered.sources
        });

        // 5. Parallel Conflict Resolution & Temporal Analysis
        const [resolution, temporal] = await Promise.all([
            conflictAgent.run({
                pipeline_id: pipelineId,
                contradictions: contradictionResult.contradictions,
                sources: filtered.sources
            }),
            temporalAgent.run({
                pipeline_id: pipelineId,
                sources: filtered.sources
            })
        ]);

        // 6. Insight Extraction (RAG)
        const insights = await insightAgent.run({
            pipeline_id: pipelineId,
            sources: filtered.sources,
            resolutions: resolution.resolutions,
            investigation_paths: resolution.investigation_paths,
            temporal_patterns: temporal.metrics
        });

        // 7. Impact Scoring
        const impact = await impactAgent.run({
            pipeline_id: pipelineId,
            insights
        });

        // 8. Predictive Forecaster
        const forecast = await forecasterAgent.run({
            pipeline_id: pipelineId,
            insights,
            temporal
        });

        // 9. Strategic Recommender
        const strategy = await recommenderAgent.run({
            pipeline_id: pipelineId,
            insights,
            impactAnalysis: impact,
            forecast
        });

        // Save context for Phase B execution
        this.contexts.set(pipelineId, {
            ingestion,
            credibility,
            filtered,
            contradictionResult,
            resolution,
            temporal,
            insights,
            impact,
            forecast,
            strategy
        });

        // 10. Submit proposal to HITL Gate (PENDING state)
        pipelineApprovalStore.submit({
            pipeline_id: pipelineId,
            proposed_at: new Date().toISOString(),
            proposal: strategy.strategyProposal,
            state: "PENDING"
        });

        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "hitl_pending",
            agent: "PipelineOrchestrator",
            message: "Strategy proposal created. Awaiting HITL manual override approval.",
            data: constraints
        });

        console.log(`[PipelineService] Phase A complete. Proposal created for: ${pipelineId} (PENDING)`);

        return {
            pipeline_id: pipelineId,
            status: "PENDING",
            sources_processed: ingestion.sources_processed,
            contradictions_found: contradictionResult.contradictions_found,
            insights: {
                trends: insights.trends,
                risks: insights.risks,
                opportunities: insights.opportunities,
                persistentConflicts: insights.persistentConflicts
            },
            contradictionDetails: contradictionResult.contradictions,
            resolutions: resolution.resolutions,
            proposal: strategy.strategyProposal
        };
    }

    async runPhaseB(pipelineId: string, approvedBy: string) {
        console.log(`[PipelineService] Starting Phase B (execution) for pipeline: ${pipelineId} by: ${approvedBy}`);
        
        const context = this.contexts.get(pipelineId);
        if (!context) {
            throw new Error(`Execution context not found for pipeline: ${pipelineId}. Ensure Phase A is run first.`);
        }

        const record = pipelineApprovalStore.get(pipelineId);
        if (!record) {
            throw new Error(`Pipeline approval record not found for: ${pipelineId}`);
        }

        // Approve and transition state from PENDING to EXECUTING
        const approval = pipelineApprovalStore.approve(pipelineId, approvedBy);
        if (!approval.ok) {
            throw new Error(`Failed to approve pipeline in store: ${approval.error}`);
        }

        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "hitl_approved",
            agent: "PipelineOrchestrator",
            message: `HITL approved by ${approvedBy} at ${approval.approved_at}`
        });

        // Instantiate Phase B agents
        const simulatorAgent = new ExecutionSimulatorAgent();
        const recoveryAgent = new FailureRecoveryAgent();
        const visualizerAgent = new OutcomeVisualizerAgent();
        const auditAgent = new WorkflowAuditAgent();

        // 11. Topological Sorting
        const sortedActions = sortActionsTopologically(
            record.proposal.proposedActions,
            pipelineId
        );

        // 12. Execution Simulation
        const execution = await simulatorAgent.run({
            pipeline_id: pipelineId,
            actions: sortedActions,
            approved_by: approvedBy,
            approval_timestamp: approval.approved_at
        });

        // 13. Failure Recovery
        const recovery = await recoveryAgent.run({
            pipeline_id: pipelineId,
            execution,
            originalActions: sortedActions
        });

        // 14. Outcome Visualizer
        const outcome = await visualizerAgent.run({
            pipeline_id: pipelineId,
            execution,
            recovery,
            impact: context.impact,
            forecast: context.forecast
        });

        // 15. Compliance Audit
        const audit = await auditAgent.run({
            pipeline_id: pipelineId,
            outcome,
            execution,
            approver: approvedBy
        });

        // Write Audit Receipt to disk
        const auditDir = path.resolve(__dirname, "../../audit-logs");
        if (!fs.existsSync(auditDir)) {
            fs.mkdirSync(auditDir, { recursive: true });
        }
        const auditPath = path.join(auditDir, `${pipelineId}.json`);
        fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));

        // Complete approval and traces
        pipelineApprovalStore.transition(pipelineId, "COMPLETED");
        traceCollector.finalizePipeline(pipelineId);

        // Clean context cache to prevent memory leaks
        this.contexts.delete(pipelineId);

        console.log(`[PipelineService] Phase B complete. Audit receipt created at: ${auditPath}`);

        return {
            pipeline_id: pipelineId,
            status: "COMPLETED",
            execution_status: execution.overall_status,
            execution_results: execution.execution_results,
            recovery: {
                recovery_plan: recovery.recovery_plan,
                cascaded_skips: recovery.cascaded_skips
            },
            outcome: {
                total_cost: outcome.total_cost,
                projected_risk_reduction: outcome.projected_risk_reduction,
                simulated_latency_saved: outcome.simulated_latency_saved,
                before_state: outcome.before_state,
                after_state: outcome.after_state
            },
            audit: {
                audit_id: audit.audit_id,
                finalized_status: audit.finalized_status,
                verification_hash: audit.verification_hash,
                receipt_path: auditPath
            }
        };
    }

    getContext(pipelineId: string) {
        return this.contexts.get(pipelineId);
    }
}

export const pipelineService = new PipelineService();
