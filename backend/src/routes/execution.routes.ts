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

import { pipelineService } from "../services/pipeline.service";

executionRoutes.post("/:id/approve", async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const approver = (req.body?.approved_by as string | undefined)?.trim();
    if (!approver) {
        res.status(400).json({ error: "approved_by (non-empty string) required in body" });
        return;
    }

    try {
        const result = await pipelineService.runPhaseB(id, approver);
        res.json(result);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Execution] Approval/Execution failed for ${id}:`, message);
        res.status(500).json({ error: message, pipeline_id: id });
    }
});
