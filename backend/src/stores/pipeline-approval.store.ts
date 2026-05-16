import { StrategyProposal } from "../agents/strategic-recommender.agent";

export type ApprovalState = "PENDING" | "EXECUTING" | "REJECTED" | "COMPLETED";

export interface PipelineApprovalRecord {
    pipeline_id: string;
    state: ApprovalState;
    proposed_at: string;
    approved_at?: string;
    approved_by?: string;
    proposal: StrategyProposal;
}

export type ApproveResult =
    | { ok: true; state: ApprovalState; approved_at: string }
    | { ok: false; code: 404 | 409; error: string };

export interface SubmitInput {
    pipeline_id: string;
    proposed_at: string;
    proposal: StrategyProposal;
    state?: ApprovalState;
}

class PipelineApprovalStore {
    private records = new Map<string, PipelineApprovalRecord>();

    submit(input: SubmitInput): void {
        this.records.set(input.pipeline_id, {
            pipeline_id: input.pipeline_id,
            state: input.state ?? "PENDING",
            proposed_at: input.proposed_at,
            proposal: input.proposal,
        });
    }

    get(id: string): PipelineApprovalRecord | undefined {
        return this.records.get(id);
    }

    /**
     * Atomic check-and-set: only transitions PENDING -> EXECUTING.
     * 404 if record missing, 409 if state is anything other than PENDING.
     */
    approve(id: string, approver: string): ApproveResult {
        const record = this.records.get(id);
        if (!record) {
            return { ok: false, code: 404, error: `Pipeline ${id} not found` };
        }
        if (record.state !== "PENDING") {
            return {
                ok: false,
                code: 409,
                error: `Pipeline ${id} is ${record.state}, not PENDING`,
            };
        }
        const approved_at = new Date().toISOString();
        record.state = "EXECUTING";
        record.approved_at = approved_at;
        record.approved_by = approver;
        return { ok: true, state: record.state, approved_at };
    }

    transition(id: string, newState: ApprovalState): void {
        const record = this.records.get(id);
        if (!record) return;
        record.state = newState;
    }

    list(): PipelineApprovalRecord[] {
        return Array.from(this.records.values());
    }
}

export const pipelineApprovalStore = new PipelineApprovalStore();
