import { Router, Request, Response } from "express";
import { pipelineApprovalStore } from "../stores/pipeline-approval.store";
import { pipelineExecutionStore } from "../stores/pipeline-execution.store";
import { traceCollector } from "../tracing/collector";
import {
    processPostApprovalExecution,
    discardPendingExecutionContext,
} from "../services/pipeline-orchestrator";

export const executionRoutes = Router();

executionRoutes.get("/:id/pending", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const record = pipelineApprovalStore.get(id);
    if (!record) {
        res.status(404).json({ error: "Pipeline not found" });
        return;
    }
    if (record.state !== "PENDING") {
        res.status(409).json({
            error: `Pipeline is ${record.state}, not PENDING`,
            pipeline_id: id,
            current_state: record.state,
        });
        return;
    }
    res.json(record);
});

executionRoutes.post("/:id/approve", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const approver = (req.body?.approved_by as string | undefined)?.trim();
    if (!approver) {
        res.status(400).json({ error: "approved_by (non-empty string) required in body" });
        return;
    }

    const result = pipelineApprovalStore.approve(id, approver);
    if (!result.ok) {
        res.status(result.code).json({ error: result.error, pipeline_id: id });
        return;
    }

    traceCollector.log(id, {
        pipeline_id: id,
        event_type: "hitl_approved",
        agent: "PipelineOrchestrator",
        message: `HITL approved by ${approver} at ${result.approved_at}`,
    });

    // Fire-and-forget the M11-M14 worker. The worker writes to pipelineExecutionStore
    // and finalizes the trace when it completes (or crashes).
    void processPostApprovalExecution(id, approver, result.approved_at).catch((err) => {
        console.error(`[Pipeline ${id}] processPostApprovalExecution unhandled rejection:`, err);
    });

    res.json({
        pipeline_id: id,
        state: result.state,
        approved_by: approver,
        approved_at: result.approved_at,
    });
});

executionRoutes.post("/:id/reject", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const rejector = (req.body?.rejected_by as string | undefined)?.trim();
    const reason = (req.body?.reason as string | undefined)?.trim() || undefined;
    if (!rejector) {
        res.status(400).json({ error: "rejected_by (non-empty string) required in body" });
        return;
    }

    const result = pipelineApprovalStore.reject(id, rejector, reason);
    if (!result.ok) {
        res.status(result.code).json({ error: result.error, pipeline_id: id });
        return;
    }

    traceCollector.log(id, {
        pipeline_id: id,
        event_type: "hitl_rejected",
        agent: "PipelineOrchestrator",
        message: reason
            ? `HITL rejected by ${rejector} at ${result.rejected_at}: ${reason}`
            : `HITL rejected by ${rejector} at ${result.rejected_at}`,
        data: reason ? { reason } : undefined,
    });

    discardPendingExecutionContext(id);

    res.json({
        pipeline_id: id,
        state: result.state,
        rejected_by: rejector,
        rejected_at: result.rejected_at,
        rejection_reason: reason ?? null,
    });
});

executionRoutes.get("/:id/chain", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const record = pipelineExecutionStore.get(id);
    if (!record?.chain) {
        res.status(404).json({ error: "Action chain not yet available", pipeline_id: id });
        return;
    }
    res.json(record.chain);
});

executionRoutes.get("/:id/recovery", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const record = pipelineExecutionStore.get(id);
    if (!record?.recovery) {
        res.status(404).json({ error: "Recovery plan not yet available", pipeline_id: id });
        return;
    }
    res.json(record.recovery);
});

executionRoutes.get("/:id/outcome", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const record = pipelineExecutionStore.get(id);
    if (!record?.outcome) {
        res.status(404).json({ error: "Outcome visualization not yet available", pipeline_id: id });
        return;
    }
    res.json(record.outcome);
});

executionRoutes.get("/:id/audit", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const record = pipelineExecutionStore.get(id);
    if (!record?.audit) {
        res.status(404).json({ error: "Workflow audit not yet available", pipeline_id: id });
        return;
    }
    res.json(record.audit);
});
