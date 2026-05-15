import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

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

export const agentsRoutes = Router();

// Helper: generate pipeline_id if not provided in body
function pid(body: Record<string, unknown>): string {
    return (body.pipeline_id as string) ?? `PIPE-${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

// Helper: wrap agent handler
function handle(fn: (body: Record<string, unknown>, id: string) => Promise<unknown>) {
    return async (req: Request, res: Response) => {
        const body = req.body as Record<string, unknown>;
        const id = pid(body);
        try {
            const result = await fn(body, id);
            res.json({ pipeline_id: id, ...result as object });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: msg, pipeline_id: id });
        }
    };
}

// ─── Module 1: Multi-Source Ingestion ─────────────────────────────────────────
// POST /api/agents/ingest
// Body: { pipeline_id?, sources: RawSourceInput[] }
agentsRoutes.post("/ingest", handle(async (body, id) => {
    const agent = new MultiSourceIngestionAgent();
    return await agent.run({ pipeline_id: id, sources: body.sources as never });
}));

// ─── Module 2: Credibility Scorer ─────────────────────────────────────────────
// POST /api/agents/score
// Body: { pipeline_id?, normalized_sources: NormalizedSource[] }
agentsRoutes.post("/score", handle(async (body, id) => {
    const agent = new CredibilityScorerAgent();
    return await agent.run({ pipeline_id: id, normalized_sources: body.normalized_sources as never });
}));

// ─── Module 3: Noise Filter ────────────────────────────────────────────────────
// POST /api/agents/filter
// Body: { pipeline_id?, normalized_sources, credibility_scores }
agentsRoutes.post("/filter", handle(async (body, id) => {
    const agent = new NoiseFilterAgent();
    return await agent.run({
        pipeline_id: id,
        normalized_sources: body.normalized_sources as never,
        credibility_scores: body.credibility_scores as never,
    });
}));

// ─── Module 4: Contradiction Detector ─────────────────────────────────────────
// POST /api/agents/detect
// Body: { pipeline_id?, filtered_sources, credibility_scores }
agentsRoutes.post("/detect", handle(async (body, id) => {
    const agent = new ContradictionDetectorAgent();
    return await agent.run({
        pipeline_id: id,
        filtered_sources: body.filtered_sources as never,
        credibility_scores: body.credibility_scores as never,
    });
}));

// ─── Module 7: Conflict Resolution ────────────────────────────────────────────
// POST /api/agents/resolve
// Body: { pipeline_id?, contradictions, credibility_scores, normalized_sources }
agentsRoutes.post("/resolve", handle(async (body, id) => {
    const agent = new ConflictResolutionAgent();
    return await agent.run({
        pipeline_id: id,
        contradictions: body.contradictions as never,
        credibility_scores: body.credibility_scores as never,
        normalized_sources: body.normalized_sources as never,
    });
}));

// ─── Module 6: Temporal Analysis ──────────────────────────────────────────────
// POST /api/agents/temporal
// Body: { pipeline_id?, time_series_data: [{metric_name, data_points}] }
agentsRoutes.post("/temporal", handle(async (body, id) => {
    const agent = new TemporalAnalysisAgent();
    return await agent.run({ pipeline_id: id, time_series_data: body.time_series_data as never });
}));

// ─── Module 5: Insight Extraction ─────────────────────────────────────────────
// POST /api/agents/insights
// Body: { pipeline_id?, filtered_sources, credibility_scores, contradictions, temporal_patterns }
agentsRoutes.post("/insights", handle(async (body, id) => {
    const agent = new InsightExtractionAgent();
    return await agent.run({
        pipeline_id: id,
        filtered_sources: body.filtered_sources as never,
        credibility_scores: body.credibility_scores as never,
        contradictions: body.contradictions as never,
        temporal_patterns: body.temporal_patterns as never,
    });
}));

// ─── Module 8: Impact Analysis ────────────────────────────────────────────────
// POST /api/agents/impact
// Body: { pipeline_id?, insights, constraints }
agentsRoutes.post("/impact", handle(async (body, id) => {
    const agent = new ImpactAnalysisAgent();
    return await agent.run({
        pipeline_id: id,
        insights: body.insights as never,
        constraints: body.constraints as never,
    });
}));

// ─── Module 9: Action Chain Generator ─────────────────────────────────────────
// POST /api/agents/actions
// Body: { pipeline_id?, insights, impact_analyses, constraints }
agentsRoutes.post("/actions", handle(async (body, id) => {
    const agent = new ActionChainGeneratorAgent();
    return await agent.run({
        pipeline_id: id,
        insights: body.insights as never,
        impact_analyses: body.impact_analyses as never,
        constraints: body.constraints as never,
    });
}));

// ─── Module 10: Constraint Validator ──────────────────────────────────────────
// POST /api/agents/validate
// Body: { action_chain, constraints }
agentsRoutes.post("/validate", (req: Request, res: Response) => {
    try {
        const { action_chain, constraints } = req.body as { action_chain: never; constraints: never };
        const validator = new ConstraintValidator();
        const result = validator.validateActionChain(action_chain, constraints);
        res.json({ validations: result });
    } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});

// ─── Module 11: Chain Simulator ───────────────────────────────────────────────
// POST /api/agents/simulate
// Body: { pipeline_id?, action_chain, initial_state, simulate_failures? }
agentsRoutes.post("/simulate", handle(async (body, id) => {
    const simulator = new ActionChainSimulator();
    const results = await simulator.simulateChain(
        body.action_chain as never,
        body.initial_state as never,
        body.simulate_failures !== false,
        id
    );
    return { simulation_results: results };
}));

// ─── Module 12: Failure Recovery ──────────────────────────────────────────────
// POST /api/agents/recover
// Body: { pipeline_id?, failed_action, execution_result, action_chain, state_history }
agentsRoutes.post("/recover", handle(async (body, _id) => {
    const engine = new FailureRecoveryEngine();
    const plan = await engine.handleFailure(
        body.failed_action as never,
        body.execution_result as never,
        body.action_chain as never,
        body.state_history as never
    );
    return { recovery_plan: plan };
}));

// ─── Module 13: Outcome Visualizer ────────────────────────────────────────────
// POST /api/agents/visualize
// Body: { initial_state, simulation_results, recovery_plans, action_chain }
agentsRoutes.post("/visualize", (req: Request, res: Response) => {
    try {
        const { initial_state, simulation_results, recovery_plans, action_chain } = req.body;
        const visualizer = new OutcomeVisualizer();
        const outcome = visualizer.generate(initial_state, simulation_results, recovery_plans, action_chain);
        res.json({ outcome });
    } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});

// ─── Tool manifest (for Antigravity tool registration) ────────────────────────
// GET /api/agents/tools
agentsRoutes.get("/tools", (_req: Request, res: Response) => {
    res.json({
        agent_framework: "Firebase Genkit (Google Antigravity)",
        pipeline_name: "autonomous_content_to_action_pipeline",
        tools: [
            { name: "ingest_sources",              method: "POST", path: "/api/agents/ingest",    module: 1, description: "Ingest & normalize multi-source content (PDF, URL, CSV, JSON, realtime)" },
            { name: "score_source_credibility",    method: "POST", path: "/api/agents/score",     module: 2, description: "Score source credibility (recency, authority, quality)" },
            { name: "filter_noise_and_duplicates", method: "POST", path: "/api/agents/filter",    module: 3, description: "Remove stale, duplicate, spam, and low-quality sources" },
            { name: "detect_contradictions",       method: "POST", path: "/api/agents/detect",    module: 4, description: "Detect conflicting claims across sources with severity" },
            { name: "resolve_conflicts",           method: "POST", path: "/api/agents/resolve",   module: 7, description: "Apply resolution strategies: trust-credible, trust-recent, aggregate" },
            { name: "analyze_temporal_patterns",   method: "POST", path: "/api/agents/temporal",  module: 6, description: "Detect time-series patterns: spike, decline, drift, stable, anomaly" },
            { name: "extract_insights",            method: "POST", path: "/api/agents/insights",  module: 5, description: "RAG-powered insight extraction: risks, trends, opportunities, contradictions" },
            { name: "analyze_business_impact",     method: "POST", path: "/api/agents/impact",    module: 8, description: "Quantify business impact with cascading effects under constraints" },
            { name: "generate_action_chain",       method: "POST", path: "/api/agents/actions",   module: 9, description: "Generate 3-5 interconnected actions with dependencies and failure recovery" },
            { name: "validate_constraints",        method: "POST", path: "/api/agents/validate",  module: 10, description: "Validate actions against budget, time, resource constraints" },
            { name: "simulate_chain",              method: "POST", path: "/api/agents/simulate",  module: 11, description: "Simulate action execution with failure injection" },
            { name: "handle_failures",             method: "POST", path: "/api/agents/recover",   module: 12, description: "Apply retry/fallback/rollback/skip recovery strategies" },
            { name: "visualize_outcome",           method: "POST", path: "/api/agents/visualize", module: 13, description: "Generate before/after state visualization with cost/latency metrics" },
        ],
    });
});
