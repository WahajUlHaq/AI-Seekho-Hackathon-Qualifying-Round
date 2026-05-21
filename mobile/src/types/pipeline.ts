/**
 * Type contracts mirroring the backend (autonomous-content-to-action-agent/backend).
 * Source of truth:
 *   - backend/src/interfaces/source-document.interface.ts  (SourceType lowercase)
 *   - backend/src/tracing/collector.ts                     (TraceEvent / PipelineTrace)
 *   - backend/src/stores/pipeline-approval.store.ts        (ApprovalState)
 *   - backend/src/agents/strategic-recommender.agent.ts    (ProposedAction / StrategyProposal)
 */

export type SourceType = "pdf" | "url" | "csv" | "txt" | "json" | "realtime_feed";

export type CredibilityTier = "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";

export interface RawSource {
    source_id?: string;
    source_type?: SourceType;
    content?: string;
    ingested_at?: string;
    credibility_tier?: CredibilityTier;
}

export type TraceEventType =
    | "agent_start"
    | "agent_complete"
    | "llm_call"
    | "contract_gate"
    | "action_execute"
    | "failure"
    | "ingestion_error"
    | "recovery"
    | "decision"
    | "action_start"
    | "action_complete"
    | "graph_cycle_detected"
    | "hitl_pending"
    | "hitl_approved"
    | "hitl_rejected"
    | "thinking";

export interface TraceEvent {
    event_id: string;
    pipeline_id: string;
    timestamp: string;
    event_type: TraceEventType;
    agent: string;
    message: string;
    data?: Record<string, unknown>;
    decision?: string;
    confidence?: number;
    provider?: string;
    latency_ms?: number;
}

export interface PipelineTrace {
    pipeline_id: string;
    environment: string;
    ai_provider_used: string;
    started_at: string;
    completed_at?: string;
    workplan: string;
    task_plan: string[];
    reasoning_steps: Array<{
        step: number;
        agent: string;
        reasoning: string;
        decision: string;
        confidence: number;
    }>;
    tool_calls: Array<{
        tool: string;
        provider: string;
        input_summary: string;
        output_summary: string;
        latency_ms: number;
    }>;
    action_execution: TraceEvent[];
    recovery_steps: string[];
    events: TraceEvent[];
}

export type ApprovalState = "PENDING" | "EXECUTING" | "REJECTED" | "COMPLETED";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface ProposedAction {
    action_id: string;
    title: string;
    description: string;
    priority: Priority;
    depends_on: string[];
}

export interface StrategyProposal {
    proposedActions: ProposedAction[];
    rationale: string;
    overall_priority: Priority;
}

export interface PipelineApprovalRecord {
    pipeline_id: string;
    state: ApprovalState;
    proposed_at: string;
    approved_at?: string;
    approved_by?: string;
    rejected_at?: string;
    rejected_by?: string;
    rejection_reason?: string;
    proposal: StrategyProposal;
}

export interface RunResponse {
    pipeline_id: string;
    status: string;
}

export interface ApproveResponse {
    pipeline_id: string;
    state: ApprovalState;
    approved_by: string;
    approved_at: string;
}

export interface RejectResponse {
    pipeline_id: string;
    state: ApprovalState;
    rejected_by: string;
    rejected_at: string;
    rejection_reason: string | null;
}

/**
 * Client-side state synthesis. The backend has no single `status` field;
 * three orthogonal surfaces (TraceEvent stream, ApprovalState from /pending,
 * presence of /outcome and /audit) collapse here into a single UI state.
 *
 * Precedence (high → low): FAILED, REJECTED, HITL_PENDING, EXECUTING,
 * POLLING_COMPLETED, PROCESSING, INITIALIZED.
 */
export type ClientPipelineStatus =
    | "INITIALIZED"
    | "PROCESSING"
    | "HITL_PENDING"
    | "EXECUTING"
    | "POLLING_COMPLETED"
    | "REJECTED"
    | "FAILED";
