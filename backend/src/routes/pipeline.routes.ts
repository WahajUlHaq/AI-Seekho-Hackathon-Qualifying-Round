import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { traceCollector } from "../tracing/collector";
import { contractRegistry } from "../contracts/registry";
import { pipelineOrchestrator } from "../agents/orchestrator";
import { exportTrace } from "../tracing/exporter";
import { RawSourceInput } from "../agents/multi-source-ingestion.agent";
import { Constraints } from "../types/simulation.types";
import { checkDomain } from "../utils/domain-validator";

export const pipelineRoutes = Router();

// POST /api/pipeline/run
pipelineRoutes.post("/run", async (req: Request, res: Response) => {
    const pipelineId = `PIPE-${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    try {
        const { sources, constraints } = req.body as {
            sources?: RawSourceInput[];
            constraints?: Partial<Constraints>;
        };

        if (!sources || !Array.isArray(sources) || sources.length === 0) {
            res.status(400).json({
                error: "sources array is required and must not be empty",
            });
            return;
        }

        // Domain validation — reject out-of-domain inputs
        const domain = checkDomain(sources.map((s) => (s as { content?: string }).content ?? ""));
        if (!domain.passed) {
            res.status(422).json({
                error: "DOMAIN_REJECTION",
                message: domain.reason,
                domain_score: domain.score,
                domain_level: domain.level,
                hint: "This agent specialises in Supply Chain & Operations: inventory, procurement, logistics, warehousing, demand forecasting, risk management.",
            });
            return;
        }
        if (domain.level === "borderline") {
            console.warn(`[Pipeline] Borderline domain score ${domain.score}/100 for ${pipelineId}`);
        }

        const result = await pipelineOrchestrator.run({ sources, constraints }, pipelineId);
        res.json({ ...result, domain_score: domain.score, domain_level: domain.level });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Pipeline] Run failed for ${pipelineId}:`, message);
        const trace = traceCollector.getTrace(pipelineId);
        res.status(500).json({ error: message, pipeline_id: pipelineId, trace: trace ?? null });
    }
});

// GET /api/pipeline/:id
pipelineRoutes.get("/:id", (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const trace = traceCollector.getTrace(id);
    if (!trace) {
        res.status(404).json({ error: "Pipeline not found" });
        return;
    }
    res.json(trace);
});

// GET /api/pipeline/:id/trace  (Antigravity trace export for judges)
pipelineRoutes.get("/:id/trace", (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const trace = traceCollector.getTrace(id);
    if (!trace) {
        res.status(404).json({ error: "Pipeline trace not found" });
        return;
    }
    res.json(exportTrace(trace));
});

// GET /api/pipeline/contracts/list
pipelineRoutes.get("/contracts/list", (_req: Request, res: Response) => {
    res.json({ contracts: contractRegistry.list() });
});
