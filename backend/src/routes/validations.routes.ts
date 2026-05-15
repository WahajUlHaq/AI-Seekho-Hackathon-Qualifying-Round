import { Router, Request, Response } from "express";
import { traceCollector } from "../tracing/collector";

export const validationsRoutes = Router();

// GET /api/validations — return all contract gate decisions across all known pipelines
validationsRoutes.get("/", (_req: Request, res: Response) => {
    // Walk every stored trace and collect contract_gate events
    const all: unknown[] = [];
    // TraceCollector exposes no "list all" method, so we iterate internal state via the
    // publicly accessible getTrace path — use a snapshot list maintained below.
    const pipelineIds = (traceCollector as unknown as { traces: Map<string, unknown> }).traces;
    if (pipelineIds) {
        for (const [pipelineId, trace] of pipelineIds.entries()) {
            const t = trace as { events?: Array<{ event_type: string; [k: string]: unknown }> };
            const gateEvents = (t.events ?? []).filter((e) => e.event_type === "contract_gate");
            gateEvents.forEach((e) => all.push({ pipeline_id: pipelineId, ...e }));
        }
    }
    res.json({ validations: all, total: all.length });
});

// GET /api/validations/:pipelineId — return contract gate decisions for one pipeline
validationsRoutes.get("/:pipelineId", (req: Request, res: Response) => {
    const pipelineId = String(req.params.pipelineId);
    const trace = traceCollector.getTrace(pipelineId);
    if (!trace) {
        res.status(404).json({ error: `No trace found for pipeline: ${pipelineId}` });
        return;
    }
    const gateEvents = trace.events.filter((e) => e.event_type === "contract_gate");
    res.json({
        pipeline_id: pipelineId,
        validations: gateEvents,
        total: gateEvents.length,
    });
});
