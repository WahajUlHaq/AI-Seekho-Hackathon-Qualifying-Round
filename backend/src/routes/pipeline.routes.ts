import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { traceCollector } from "../tracing/collector";

export const pipelineRoutes = Router();

// POST /api/pipeline/run
pipelineRoutes.post("/run", async (req: Request, res: Response) => {
    const pipelineId = `PIPE-${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    try {
        const { sources, constraints } = req.body as {
            sources?: unknown[];
            constraints?: Record<string, unknown>;
        };

        if (!sources || !Array.isArray(sources) || sources.length === 0) {
            res.status(400).json({
                error: "sources array is required and must not be empty",
            });
            return;
        }

        // Orchestrator wired in Phase 4 — stub response for now
        res.json({
            pipeline_id: pipelineId,
            status: "received",
            message: "Orchestrator not yet implemented — Phase 4",
            sources_received: sources.length,
            constraints_received: constraints ?? {},
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Pipeline] Run failed for ${pipelineId}:`, message);
        res.status(500).json({ error: message, pipeline_id: pipelineId });
    }
});

// GET /api/pipeline/:id
pipelineRoutes.get("/:id", (req: Request, res: Response) => {
    const trace = traceCollector.getTrace(req.params.id as string);
    if (!trace) {
        res.status(404).json({ error: "Pipeline not found" });
        return;
    }
    res.json(trace);
});

// GET /api/pipeline/:id/trace  (Antigravity trace export for judges)
pipelineRoutes.get("/:id/trace", (req: Request, res: Response) => {
    const trace = traceCollector.getTrace(req.params.id as string);
    if (!trace) {
        res.status(404).json({ error: "Pipeline trace not found" });
        return;
    }
    res.json(trace);
});
