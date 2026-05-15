import { Router, Request, Response } from "express";
import { traceCollector } from "../tracing/collector";

export const validationsRoutes = Router();

// GET /api/validations — contract_gate events across all pipeline traces
validationsRoutes.get("/", (_req: Request, res: Response) => {
    const validations = traceCollector.getAll().map((t) => ({
        pipeline_id: t.pipeline_id,
        events: t.events.filter((e) => e.event_type === "contract_gate"),
    }));
    res.json({ validations });
});
