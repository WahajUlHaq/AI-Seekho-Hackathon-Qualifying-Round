import { Router, Request, Response } from "express";
import { pipelineApprovalStore } from "../stores/pipeline-approval.store";

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

    res.json({
        pipeline_id: id,
        state: result.state,
        approved_by: approver,
        approved_at: result.approved_at,
    });
});
