/**
 * Execution-phase contracts mirroring backend agents:
 *   - execution-simulator.agent.ts    (ExecutionSimulatorOutput / ActionExecutionResult)
 *   - workflow-audit.agent.ts         (WorkflowAuditOutput / SignatureBlock / FinalizedStatus)
 *
 * Recovery and Outcome are treated as opaque records (BFF pattern). Backend
 * schema changes there do not propagate to the client view.
 */

export type ActionStatus = "SUCCESS" | "FAILED" | "SKIPPED";
export type OverallStatus = "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";

export interface ActionExecutionResult {
    action_id: string;
    status: ActionStatus;
    latency_ms: number;
    error_message?: string;
    output_summary?: string;
}

export interface ExecutionChainOutput {
    pipelineId: string;
    overall_status: OverallStatus;
    approved_by?: string;
    approval_timestamp: string;
    total_execution_ms: number;
    execution_results: ActionExecutionResult[];
}

export type RecoveryPlanOutput = Record<string, unknown>;
export type OutcomeReportOutput = Record<string, unknown>;

export type FinalizedStatus =
    | "APPROVED_PASSED"
    | "APPROVED_PARTIAL"
    | "APPROVED_FAILED"
    | "REJECTED";

export interface SignatureBlock {
    approver: string;
    pipeline_id: string;
    signed_at: string;
}

export interface WorkflowAuditOutput {
    pipelineId: string;
    audit_id: string;
    generated_at: string;
    finalized_status: FinalizedStatus;
    signature_block: SignatureBlock;
    verification_hash: string;
    event_summary: Record<string, number>;
}

/**
 * Locally-committed audit receipt — proof of execution that survives backend
 * in-memory drops. Stored immutably in expo-secure-store.
 */
export interface LedgerReceipt {
    pipeline_id: string;
    audit_id: string;
    verification_hash: string;
    finalized_status: FinalizedStatus;
    approver: string;
    backend_signed_at: string;
    captured_at: string;
}
