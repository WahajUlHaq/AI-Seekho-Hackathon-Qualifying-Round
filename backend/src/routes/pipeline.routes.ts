import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { ZodIssue } from "zod";
import { traceCollector } from "../tracing/collector";
import { ParserAgent } from "../agents/parser.agent";
import { ForecasterAgent } from "../agents/forecaster.agent";
import { AuditorAgent } from "../agents/auditor.agent";
import type { ForecastPoint, PipelineAnalytics, RawSource } from "../agents/analytics.types";
import { PipelineAnalyticsSchema } from "../docs/contracts/analytics.contracts";
import { processFullPipelineUpToHITL } from "../services/pipeline-orchestrator";
import { pipelineApprovalStore } from "../stores/pipeline-approval.store";

export const pipelineRoutes = Router();

// -------- Phase 8: multi-agent analytics pool + reflexive AMCE judge --------

const MAX_ATTEMPTS = 2;
const analyticsCache = new Map<string, PipelineAnalytics>();
const parserAgent = new ParserAgent();
const forecasterAgent = new ForecasterAgent();
const auditorAgent = new AuditorAgent();

type AmceVerdict =
    | { isValid: true; errors: []; validatedData: PipelineAnalytics }
    | { isValid: false; errors: string[]; validatedData: null };

function formatZodIssue(issue: ZodIssue): string {
    const path = issue.path.length === 0 ? "(root)" : issue.path.join(".");
    return `${path}: ${issue.message}`;
}

function amceJudge(forecast: unknown, contradictions: unknown): AmceVerdict {
    const result = PipelineAnalyticsSchema.safeParse({
        extrapolation_unreliable: false,
        forecast_data: forecast,
        contradictions,
    });

    if (!result.success) {
        return {
            isValid: false,
            errors: result.error.issues.map(formatZodIssue),
            validatedData: null,
        };
    }

    return {
        isValid: true,
        errors: [],
        validatedData: result.data,
    };
}

function fallbackAnalytics(pipelineId: string): PipelineAnalytics {
    const seed = pipelineId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const now = Date.now();
    const day = 86_400_000;
    const forecast_data: ForecastPoint[] = Array.from({ length: 90 }, (_, i) => ({
        timestamp: new Date(now + (i - 30) * day).toISOString(),
        value: 50 + Math.sin((seed + i) / 7) * 14 + (i >= 30 ? (i - 30) * 0.3 : 0),
        is_extrapolation: i >= 30,
    }));
    return { extrapolation_unreliable: true, forecast_data, contradictions: [] };
}

// Analytics-pool worker runs in parallel with the full M1-M14 flow. It does NOT
// init or finalize the trace; the route handler initializes once, and the
// post-approval worker (or rejection handler) finalizes.
async function processAnalyticsPool(pipelineId: string, sources: RawSource[]): Promise<void> {
    let approvedAnalytics: PipelineAnalytics | null = null;

    try {
        // 1. Parse once — text decoding does not benefit from reflection.
        const parsed = await parserAgent.run({ pipeline_id: pipelineId, sources });
        const sourceIds = sources.map((s, i) => s.source_id ?? `SRC-${i + 1}`);

        let attempt = 0;
        let correctionNotes: string[] = [];

        while (attempt < MAX_ATTEMPTS && !approvedAnalytics) {
            attempt += 1;

            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "thinking",
                agent: "AMCEOrchestrator",
                message:
                    attempt === 1
                        ? `Attempt ${attempt}: dispatching Forecaster + Auditor in parallel.`
                        : `Attempt ${attempt}: retrying with ${correctionNotes.length} correction note(s).`,
                data: correctionNotes.length > 0 ? { correction_notes: correctionNotes } : undefined,
            });

            const [forecast, audit] = await Promise.all([
                forecasterAgent.run({
                    pipeline_id: pipelineId,
                    text: parsed.text,
                    correctionNotes,
                }),
                auditorAgent.run({
                    pipeline_id: pipelineId,
                    text: parsed.text,
                    sourceIds,
                    correctionNotes,
                }),
            ]);

            const verdict = amceJudge(forecast.forecast_data, audit.contradictions);

            if (verdict.isValid) {
                traceCollector.log(pipelineId, {
                    pipeline_id: pipelineId,
                    event_type: "contract_gate",
                    agent: "AMCEJudge",
                    message: `Contract verified on attempt ${attempt}. Approved ${verdict.validatedData.forecast_data.length} forecast points and ${verdict.validatedData.contradictions.length} contradictions.`,
                });
                approvedAnalytics = verdict.validatedData;
                break;
            }

            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "contract_gate",
                agent: "AMCEJudge",
                message: `Validation failed on attempt ${attempt}: ${verdict.errors.join("; ")}`,
                data: { errors: verdict.errors },
            });
            correctionNotes = verdict.errors;
        }

        if (!approvedAnalytics) {
            traceCollector.log(pipelineId, {
                pipeline_id: pipelineId,
                event_type: "failure",
                agent: "AMCEOrchestrator",
                message: `Retries exhausted after ${MAX_ATTEMPTS} attempts. Substituting deterministic fallback.`,
            });
            approvedAnalytics = fallbackAnalytics(pipelineId);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Pipeline ${pipelineId}] Worker crashed:`, message);
        traceCollector.log(pipelineId, {
            pipeline_id: pipelineId,
            event_type: "failure",
            agent: "AMCEOrchestrator",
            message: `Pipeline aborted: ${message}`,
        });
        approvedAnalytics = fallbackAnalytics(pipelineId);
    } finally {
        if (approvedAnalytics) analyticsCache.set(pipelineId, approvedAnalytics);
        // Trace finalization is deferred to the post-approval worker / rejection
        // handler so the SSE stream stays open through the HITL gate.
    }
}

// -------- Routes --------

// POST /api/pipeline/run — hybrid orchestrator
//
// Initializes a single trace, then fires:
//   1. processFullPipelineUpToHITL — M1-M10 + HITL submit (always)
//   2. processAnalyticsPool        — legacy 3-agent forecast/contradiction surface (only if sources provided)
//
// The legacy analytics flow populates the secondary CredibilityGrid/ForecasterChart/
// ContradictionPanel panels on the FE. The M1-M10 flow ingests autonomously from
// disk + feed adapter and produces the StrategyProposal that the HITL gate releases.
pipelineRoutes.post("/run", (req: Request, res: Response) => {
    const pipelineId = `PIPE-${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const { sources } = req.body as { sources?: RawSource[] };

    traceCollector.initPipeline(pipelineId, "hybrid_synthesis", [
        "analytics_pool (M-Parser+M-Forecaster+M-Auditor)",
        "ingestion",
        "credibility",
        "noise-filter",
        "contradiction",
        "resolution+temporal (parallel)",
        "insight-extraction",
        "impact-scoring",
        "predictive-forecasting",
        "strategic-recommendation",
        "hitl-gate",
        "dag-sort",
        "execution-simulator",
        "failure-recovery",
        "outcome-visualizer",
        "workflow-audit",
    ]);

    res.json({ pipeline_id: pipelineId, status: "initialized" });

    const hasSources = sources && Array.isArray(sources) && sources.length > 0;

    if (hasSources) {
        void processAnalyticsPool(pipelineId, sources).catch((err) => {
            console.error(`[Pipeline ${pipelineId}] processAnalyticsPool unhandled rejection:`, err);
        });
    }

    // Coerce optional RawSource fields into the strict shape the ingestion agent
    // expects. Mirrors the SRC-${idx+1} fabrication used by processAnalyticsPool.
    const rawSourcesForIngestion = hasSources
        ? sources.map((s, i) => ({
            source_id: s.source_id ?? `SRC-${i + 1}`,
            source_type: s.source_type ?? "txt",
            content: s.content ?? "",
        }))
        : undefined;

    void processFullPipelineUpToHITL(pipelineId, rawSourcesForIngestion).catch((err) => {
        console.error(`[Pipeline ${pipelineId}] processFullPipelineUpToHITL unhandled rejection:`, err);
    });
});

// GET /api/pipeline
pipelineRoutes.get("/", (req: Request, res: Response) => {
    const traces = traceCollector.getAll();
    const history = traces.map((t) => {
        const approvalRecord = pipelineApprovalStore.get(t.pipeline_id);
        let status = "RUNNING";
        if (approvalRecord) {
            if (approvalRecord.state === "COMPLETED") {
                status = "COMPLETED";
            } else if (approvalRecord.state === "REJECTED") {
                status = "REJECTED";
            } else if (approvalRecord.state === "PENDING") {
                status = "PENDING";
            } else if (approvalRecord.state === "EXECUTING") {
                status = "EXECUTING";
            }
        } else {
            const hasFailure = t.events.some(e => e.event_type === "failure" || e.event_type === "ingestion_error");
            if (hasFailure) {
                status = "FAILED";
            } else if (t.completed_at) {
                status = "COMPLETED";
            }
        }

        return {
            pipeline_id: t.pipeline_id,
            status,
            events: t.events,
            action_execution: t.action_execution || [],
        };
    });

    res.json(history);
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

// GET /api/pipeline/:id/trace
pipelineRoutes.get("/:id/trace", (req: Request, res: Response) => {
    const trace = traceCollector.getTrace(req.params.id as string);
    if (!trace) {
        res.status(404).json({ error: "Pipeline trace not found" });
        return;
    }
    res.json(trace);
});

// GET /api/pipeline/:id/stream
pipelineRoutes.get("/:id/stream", (req: Request, res: Response) => {
    const id = String(req.params.id);
    res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    let cursor = 0;
    const heartbeat = `: ping\n\n`;

    const tick = setInterval(() => {
        const trace = traceCollector.getTrace(id);
        if (!trace) {
            res.write(heartbeat);
            return;
        }
        const fresh = trace.events.slice(cursor);
        for (const ev of fresh) {
            res.write(`data: ${JSON.stringify(ev)}\n\n`);
        }
        cursor = trace.events.length;
        if (trace.completed_at) {
            res.write(`event: end\ndata: {}\n\n`);
            clearInterval(tick);
            res.end();
        }
    }, 1000);

    req.on("close", () => clearInterval(tick));
});

// GET /api/pipeline/:id/analytics
pipelineRoutes.get("/:id/analytics", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const data = analyticsCache.get(id);
    if (!data) {
        res.status(404).json({ error: "Analytics not yet ready", pipeline_id: id });
        return;
    }
    res.json(data);
});
