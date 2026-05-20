/**
 * Thin typed fetch wrapper. Every helper returns either typed JSON or throws
 * a NormalizedHttpError. Phase-route getters use a discriminated `{ ok, ... }`
 * shape so polling loops can keep trying on 404 without throwing on every tick.
 */

import { REQUEST_TIMEOUT_MS, endpoint } from "@/config/api";
import {
    NormalizedHttpError,
    normalizeHttpError,
    normalizeThrown,
    type NormalizedError,
} from "@/lib/errors";
import type {
    ApproveResponse,
    PipelineApprovalRecord,
    PipelineTrace,
    RawSource,
    RejectResponse,
    RunResponse,
} from "@/types/pipeline";
import type {
    ExecutionChainOutput,
    OutcomeReportOutput,
    RecoveryPlanOutput,
    WorkflowAuditOutput,
} from "@/types/execution";

type PhaseResult<T> = { ok: true; data: T } | { ok: false; status: 404 } | { ok: false; status: number; error: NormalizedError };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const method = init?.method ?? "GET";
    console.log(`[api] → ${method} ${url}`);
    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...(init?.headers ?? {}),
            },
        });
        const text = await response.text();
        const body: unknown = text ? safeJson(text) : null;
        console.log(`[api] ← ${response.status} ${method} ${url}`);
        if (!response.ok) {
            throw new NormalizedHttpError(normalizeHttpError(response.status, body));
        }
        return body as T;
    } catch (err: unknown) {
        if (err instanceof NormalizedHttpError) {
            console.log(`[api] ✗ ${method} ${url} — ${err.message}`);
            throw err;
        }
        const normalized = normalizeThrown(err);
        console.log(`[api] ✗ ${method} ${url} — ${normalized.message}`);
        throw new NormalizedHttpError(normalized);
    } finally {
        clearTimeout(timeoutId);
    }
}

function safeJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function tryPhase<T>(url: string): Promise<PhaseResult<T>> {
    try {
        const data = await request<T>(url);
        return { ok: true, data };
    } catch (err: unknown) {
        if (err instanceof NormalizedHttpError) {
            if (err.normalized.kind === "not_found") return { ok: false, status: 404 };
            const status =
                err.normalized.kind === "api" || err.normalized.kind === "conflict"
                    ? err.normalized.status
                    : 0;
            return { ok: false, status, error: err.normalized };
        }
        return { ok: false, status: 0, error: normalizeThrown(err) };
    }
}

/**
 * POST /api/pipeline/run.
 * Pass undefined to trigger the backend's disk-fallback ingestion (Demo Mode).
 */
export async function postPipelineRun(sources: RawSource[] | undefined): Promise<RunResponse> {
    const body = sources ? JSON.stringify({ sources }) : JSON.stringify({});
    return request<RunResponse>(endpoint.pipelineRun(), { method: "POST", body });
}

export async function getPipelineTrace(id: string): Promise<PipelineTrace> {
    return request<PipelineTrace>(endpoint.pipelineTrace(id));
}

export async function getPendingApproval(id: string): Promise<PipelineApprovalRecord> {
    return request<PipelineApprovalRecord>(endpoint.pending(id));
}

export async function postApprove(id: string, approvedBy: string): Promise<ApproveResponse> {
    return request<ApproveResponse>(endpoint.approve(id), {
        method: "POST",
        body: JSON.stringify({ approved_by: approvedBy }),
    });
}

export async function postReject(id: string, rejectedBy: string, reason?: string): Promise<RejectResponse> {
    return request<RejectResponse>(endpoint.reject(id), {
        method: "POST",
        body: JSON.stringify(reason ? { rejected_by: rejectedBy, reason } : { rejected_by: rejectedBy }),
    });
}

export const getChain = (id: string): Promise<PhaseResult<ExecutionChainOutput>> =>
    tryPhase<ExecutionChainOutput>(endpoint.chain(id));
export const getRecovery = (id: string): Promise<PhaseResult<RecoveryPlanOutput>> =>
    tryPhase<RecoveryPlanOutput>(endpoint.recovery(id));
export const getOutcome = (id: string): Promise<PhaseResult<OutcomeReportOutput>> =>
    tryPhase<OutcomeReportOutput>(endpoint.outcome(id));
export const getAudit = (id: string): Promise<PhaseResult<WorkflowAuditOutput>> =>
    tryPhase<WorkflowAuditOutput>(endpoint.audit(id));

export type { PhaseResult };
