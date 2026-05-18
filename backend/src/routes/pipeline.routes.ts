import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { traceCollector } from "../tracing/collector";

export const pipelineRoutes = Router();

import { pipelineService } from "../services/pipeline.service";

// POST /api/pipeline/run
pipelineRoutes.post("/run", async (req: Request, res: Response) => {
    const pipelineId = `PIPE-${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    try {
        const { sources, constraints } = req.body as {
            sources?: any[];
            constraints?: Record<string, unknown>;
        };

        if (!sources || !Array.isArray(sources) || sources.length === 0) {
            res.status(400).json({
                error: "sources array is required and must not be empty",
            });
            return;
        }

        const result = await pipelineService.runPhaseA(pipelineId, sources, constraints);
        res.json(result);
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

// GET /api/pipeline/:id/trace/stream — Server-Sent Events (SSE) real-time stream
pipelineRoutes.get("/:id/trace/stream", (req: Request, res: Response) => {
    const pipelineId = req.params.id as string;
    
    // Set headers for Server-Sent Events (SSE)
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
    });

    res.write("retry: 5000\n\n");

    // Immediately push existing logs for instant hydration
    const existingTrace = traceCollector.getTrace(pipelineId);
    if (existingTrace && existingTrace.events) {
        existingTrace.events.forEach((event) => {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        });
    }

    // Event listener for subsequent dynamic trace additions
    const listener = (event: any) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    traceCollector.on(`trace:${pipelineId}`, listener);

    // Keep-alive heartbeat interval to avoid proxy connection timeouts
    const heartbeat = setInterval(() => {
        res.write(": keep-alive\n\n");
    }, 15000);

    // Unsubscribe when client connection closes
    req.on("close", () => {
        traceCollector.off(`trace:${pipelineId}`, listener);
        clearInterval(heartbeat);
        res.end();
    });
});

// GET /api/pipeline (list all pipelines)
pipelineRoutes.get("/", (req: Request, res: Response) => {
    res.json(traceCollector.getAll());
});
