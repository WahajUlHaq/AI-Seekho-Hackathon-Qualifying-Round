import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentInput, AgentOutput, RetryContext } from "./base.agent";
import { traceCollector } from "../tracing/collector";
import { OutcomeVisualizerOutput } from "./outcome-visualizer.agent";
import {
    ExecutionSimulatorOutput,
    OverallStatus,
} from "./execution-simulator.agent";

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

export interface WorkflowAuditInput extends AgentInput {
    outcome: OutcomeVisualizerOutput;
    execution: ExecutionSimulatorOutput;
    approver: string;
}

export interface WorkflowAuditOutput extends AgentOutput {
    pipelineId: string;
    audit_id: string;
    generated_at: string;
    finalized_status: FinalizedStatus;
    signature_block: SignatureBlock;
    verification_hash: string;          // SHA-256 hex (64 lowercase chars)
    event_summary: Record<string, number>;
}

const STATUS_MAP: Record<OverallStatus, FinalizedStatus> = {
    SUCCESS: "APPROVED_PASSED",
    PARTIAL_SUCCESS: "APPROVED_PARTIAL",
    FAILED: "APPROVED_FAILED",
};

// Counters the contract's semantic_check requires
const REQUIRED_COUNTER_KEYS = [
    "agent_start",
    "agent_complete",
    "action_start",
    "action_complete",
    "contract_gate",
];

function makeId(prefix: string, len = 8): string {
    return `${prefix}-${uuidv4().replace(/-/g, "").toUpperCase().slice(0, len)}`;
}

/**
 * Deterministic JSON stringification with sorted top-level keys.
 * Recursively sorts nested object keys too, so the hash is stable.
 */
function canonicalStringify(value: unknown): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) {
        return "[" + value.map(canonicalStringify).join(",") + "]";
    }
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const parts = keys.map(k => JSON.stringify(k) + ":" + canonicalStringify((value as Record<string, unknown>)[k]));
    return "{" + parts.join(",") + "}";
}

export class WorkflowAuditAgent extends BaseAgent<WorkflowAuditInput, WorkflowAuditOutput> {
    constructor() {
        super("WorkflowAuditAgent", "workflow_audit_v1");
    }

    protected async execute(
        input: WorkflowAuditInput,
        _retryContext?: RetryContext
    ): Promise<WorkflowAuditOutput> {
        const { pipeline_id, execution, approver } = input;

        const trace = traceCollector.getTrace(pipeline_id);
        if (!trace) {
            throw new Error(`WorkflowAuditAgent: trace not found for ${pipeline_id}`);
        }

        // Build event_summary with required counters defaulted to 0
        const event_summary: Record<string, number> = {};
        for (const key of REQUIRED_COUNTER_KEYS) {
            event_summary[key] = 0;
        }
        for (const e of trace.events) {
            event_summary[e.event_type] = (event_summary[e.event_type] ?? 0) + 1;
        }

        const finalized_status: FinalizedStatus = STATUS_MAP[execution.overall_status];
        const audit_id = makeId("AUD");
        const generated_at = new Date().toISOString();

        const signature_block: SignatureBlock = {
            approver,
            pipeline_id,
            signed_at: generated_at,
        };

        // Canonical payload for hashing — excludes verification_hash itself (chicken/egg).
        const payloadForHash = {
            pipelineId: pipeline_id,
            audit_id,
            generated_at,
            finalized_status,
            signature_block,
            event_summary,
        };
        const canonical = canonicalStringify(payloadForHash);
        const verification_hash = crypto.createHash("sha256").update(canonical).digest("hex");

        this.logDecision(
            pipeline_id,
            `Audit ${audit_id} finalized as ${finalized_status}; hash=${verification_hash.slice(0, 16)}...`,
            "audit_finalized",
            1.0
        );

        return {
            pipeline_id,
            agent_name: this.agentName,
            completed_at: new Date().toISOString(),
            pipelineId: pipeline_id,
            audit_id,
            generated_at,
            finalized_status,
            signature_block,
            verification_hash,
            event_summary,
        };
    }
}
