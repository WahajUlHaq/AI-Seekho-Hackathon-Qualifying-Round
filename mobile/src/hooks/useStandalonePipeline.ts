/**
 * The pipeline state synchronizer.
 *
 *   - Primary channel: SSE via react-native-sse against /pipeline/:id/stream.
 *   - Reconnect: exponential backoff per SSE_BACKOFF_MS. After SSE_MAX_ATTEMPTS
 *     failures we permanently switch to polling /api/pipeline/:id every
 *     POLL_TRACE_MS and reconstitute the events array from the trace snapshot.
 *   - HITL: a parallel poller against /execution/:id/pending serves the
 *     StrategyProposal once the backend writes it; 404 → still pending,
 *     200 → record, 409 → state has moved past PENDING (stop polling).
 *   - Post-approval phases: four parallel one-shot pollers (chain, recovery,
 *     outcome, audit). Each fires every POLL_PHASE_MS while EXECUTING and
 *     stops on its first 200.
 *   - Terminal SUCCESS: when /audit returns 200 the receipt is committed to
 *     the immutable on-device ledger (proof-of-execution).
 *
 * derivedStatus is a pure projection over (events, approval, phase slices) —
 * see deriveClientStatus below.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { AppState } from "react-native";
import EventSource from "react-native-sse";

type SseCustomEvent = "end";

import {
    POLL_PENDING_MS,
    POLL_PHASE_MS,
    POLL_TRACE_MS,
    SSE_BACKOFF_MS,
    SSE_MAX_ATTEMPTS,
    endpoint,
} from "@/config/api";
import {
    getAudit,
    getChain,
    getOutcome,
    getPendingApproval,
    getPipelineTrace,
    getRecovery,
    postApprove,
    postPipelineRun,
    postReject,
    type PhaseResult,
} from "@/api/client";
import {
    NormalizedHttpError,
    type NormalizedError,
    isConflict,
    isNetwork,
    isNotFound,
} from "@/lib/errors";
import { signApproval } from "@/services/BiometricSecurityService";
import { commitReceipt, listReceipts } from "@/services/AuditLedgerService";
import type {
    ClientPipelineStatus,
    PipelineApprovalRecord,
    RawSource,
    TraceEvent,
} from "@/types/pipeline";
import type {
    ExecutionChainOutput,
    LedgerReceipt,
    OutcomeReportOutput,
    RecoveryPlanOutput,
    WorkflowAuditOutput,
} from "@/types/execution";

// ---- State + reducer -----------------------------------------------------

export type SseStatus = "idle" | "connecting" | "open" | "reconnecting" | "polling" | "ended" | "error";

interface State {
    pipelineId: string | null;
    events: TraceEvent[];
    eventIds: Set<string>;
    sseStatus: SseStatus;
    approval: PipelineApprovalRecord | null;
    approvalForcedState: "EXECUTING" | "REJECTED" | "COMPLETED" | null;
    chain: ExecutionChainOutput | null;
    recovery: RecoveryPlanOutput | null;
    outcome: OutcomeReportOutput | null;
    audit: WorkflowAuditOutput | null;
    ledgerReceipt: LedgerReceipt | null;
    ledgerReceipts: LedgerReceipt[];
    lastError: NormalizedError | null;
    isStarting: boolean;
    isActing: boolean;
}

const initialState: State = {
    pipelineId: null,
    events: [],
    eventIds: new Set(),
    sseStatus: "idle",
    approval: null,
    approvalForcedState: null,
    chain: null,
    recovery: null,
    outcome: null,
    audit: null,
    ledgerReceipt: null,
    ledgerReceipts: [],
    lastError: null,
    isStarting: false,
    isActing: false,
};

type Action =
    | { type: "RESET" }
    | { type: "STARTING" }
    | { type: "STARTED"; pipelineId: string }
    | { type: "START_FAILED"; error: NormalizedError }
    | { type: "SSE_STATUS"; status: SseStatus }
    | { type: "INGEST_EVENTS"; events: TraceEvent[] }
    | { type: "APPROVAL"; record: PipelineApprovalRecord }
    | { type: "APPROVAL_FORCED"; state: "EXECUTING" | "REJECTED" | "COMPLETED" }
    | { type: "PHASE_CHAIN"; data: ExecutionChainOutput }
    | { type: "PHASE_RECOVERY"; data: RecoveryPlanOutput }
    | { type: "PHASE_OUTCOME"; data: OutcomeReportOutput }
    | { type: "PHASE_AUDIT"; data: WorkflowAuditOutput }
    | { type: "LEDGER_COMMITTED"; receipt: LedgerReceipt }
    | { type: "LEDGER_LIST"; receipts: LedgerReceipt[] }
    | { type: "ERROR"; error: NormalizedError }
    | { type: "ACTING"; value: boolean };

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case "RESET":
            return { ...initialState, ledgerReceipts: state.ledgerReceipts };
        case "STARTING":
            return { ...state, isStarting: true, lastError: null };
        case "STARTED":
            return {
                ...initialState,
                ledgerReceipts: state.ledgerReceipts,
                pipelineId: action.pipelineId,
                sseStatus: "connecting",
            };
        case "START_FAILED":
            return { ...state, isStarting: false, lastError: action.error };
        case "SSE_STATUS":
            return { ...state, sseStatus: action.status };
        case "INGEST_EVENTS": {
            const fresh = action.events.filter((e) => !state.eventIds.has(e.event_id));
            if (fresh.length === 0) return state;
            const nextIds = new Set(state.eventIds);
            fresh.forEach((e) => nextIds.add(e.event_id));
            return { ...state, events: [...state.events, ...fresh], eventIds: nextIds };
        }
        case "APPROVAL":
            return { ...state, approval: action.record };
        case "APPROVAL_FORCED":
            return { ...state, approvalForcedState: action.state };
        case "PHASE_CHAIN":
            return { ...state, chain: action.data };
        case "PHASE_RECOVERY":
            return { ...state, recovery: action.data };
        case "PHASE_OUTCOME":
            return { ...state, outcome: action.data };
        case "PHASE_AUDIT":
            return { ...state, audit: action.data };
        case "LEDGER_COMMITTED": {
            const without = state.ledgerReceipts.filter((r) => r.pipeline_id !== action.receipt.pipeline_id);
            return {
                ...state,
                ledgerReceipt: action.receipt,
                ledgerReceipts: [action.receipt, ...without],
            };
        }
        case "LEDGER_LIST":
            return { ...state, ledgerReceipts: action.receipts };
        case "ERROR":
            return { ...state, lastError: action.error };
        case "ACTING":
            return { ...state, isActing: action.value };
        default:
            return state;
    }
}

// ---- Derived status ------------------------------------------------------

export function deriveClientStatus(state: State): ClientPipelineStatus {
    if (state.events.some((e) => e.event_type === "failure")) return "FAILED";

    const approvalState = state.approvalForcedState ?? state.approval?.state ?? null;
    if (approvalState === "REJECTED" || state.events.some((e) => e.event_type === "hitl_rejected")) {
        return "REJECTED";
    }

    if (state.outcome) return "POLLING_COMPLETED";

    if (
        approvalState === "EXECUTING" ||
        approvalState === "COMPLETED" ||
        state.events.some((e) => e.event_type === "hitl_approved")
    ) {
        return "EXECUTING";
    }

    if (
        approvalState === "PENDING" ||
        state.events.some((e) => e.event_type === "hitl_pending")
    ) {
        return "HITL_PENDING";
    }

    if (state.events.length > 0) return "PROCESSING";
    if (state.pipelineId) return "INITIALIZED";
    return "INITIALIZED";
}

// ---- Hook ----------------------------------------------------------------

export interface UseStandalonePipeline {
    pipelineId: string | null;
    derivedStatus: ClientPipelineStatus;
    events: TraceEvent[];
    approval: PipelineApprovalRecord | null;
    chain: ExecutionChainOutput | null;
    recovery: RecoveryPlanOutput | null;
    outcome: OutcomeReportOutput | null;
    audit: WorkflowAuditOutput | null;
    ledgerReceipt: LedgerReceipt | null;
    ledgerReceipts: LedgerReceipt[];
    sseStatus: SseStatus;
    lastError: NormalizedError | null;
    isStarting: boolean;
    isActing: boolean;
    start: (sources: RawSource[]) => Promise<string | null>;
    startDemo: () => Promise<string | null>;
    approve: (operatorHandle: string) => Promise<void>;
    reject: (operatorHandle: string, reason?: string) => Promise<void>;
    reset: () => void;
    refreshLedger: () => Promise<void>;
}

export function useStandalonePipeline(): UseStandalonePipeline {
    const [state, dispatch] = useReducer(reducer, initialState);
    const sseRef = useRef<EventSource<SseCustomEvent> | null>(null);
    const sseAttemptsRef = useRef(0);
    const sseReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tracePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pendingPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const phasePollersRef = useRef<Record<string, ReturnType<typeof setInterval> | null>>({
        chain: null,
        recovery: null,
        outcome: null,
        audit: null,
    });
    const auditCommittedRef = useRef(false);
    const stateRef = useRef(state);
    stateRef.current = state;

    const clearSse = useCallback(() => {
        if (sseReconnectTimerRef.current) {
            clearTimeout(sseReconnectTimerRef.current);
            sseReconnectTimerRef.current = null;
        }
        if (sseRef.current) {
            try {
                sseRef.current.close();
            } catch {
                // ignore
            }
            sseRef.current = null;
        }
    }, []);

    const stopAllPollers = useCallback(() => {
        if (tracePollerRef.current) {
            clearInterval(tracePollerRef.current);
            tracePollerRef.current = null;
        }
        if (pendingPollerRef.current) {
            clearInterval(pendingPollerRef.current);
            pendingPollerRef.current = null;
        }
        for (const k of Object.keys(phasePollersRef.current)) {
            const t = phasePollersRef.current[k];
            if (t) {
                clearInterval(t);
                phasePollersRef.current[k] = null;
            }
        }
    }, []);

    const startTracePolling = useCallback((pipelineId: string) => {
        if (tracePollerRef.current) return;
        dispatch({ type: "SSE_STATUS", status: "polling" });
        const tick = async () => {
            try {
                const trace = await getPipelineTrace(pipelineId);
                dispatch({ type: "INGEST_EVENTS", events: trace.events });
                if (trace.completed_at && tracePollerRef.current) {
                    clearInterval(tracePollerRef.current);
                    tracePollerRef.current = null;
                    dispatch({ type: "SSE_STATUS", status: "ended" });
                }
            } catch (err: unknown) {
                if (err instanceof NormalizedHttpError) {
                    dispatch({ type: "ERROR", error: err.normalized });
                }
            }
        };
        void tick();
        tracePollerRef.current = setInterval(tick, POLL_TRACE_MS);
    }, []);

    const openSse = useCallback(
        (pipelineId: string) => {
            clearSse();
            dispatch({ type: "SSE_STATUS", status: "connecting" });
            const url = endpoint.pipelineStream(pipelineId);
            console.log(`[sse] connect → ${url}`);
            const es = new EventSource<SseCustomEvent>(url, { pollingInterval: 0 });
            sseRef.current = es;
            es.addEventListener("open", () => {
                console.log(`[sse] open`);
                sseAttemptsRef.current = 0;
                dispatch({ type: "SSE_STATUS", status: "open" });
            });
            es.addEventListener("message", (event) => {
                const data = (event as { data?: string }).data;
                if (!data) return;
                try {
                    const parsed = JSON.parse(data) as TraceEvent;
                    if (parsed && typeof parsed.event_id === "string") {
                        dispatch({ type: "INGEST_EVENTS", events: [parsed] });
                    }
                } catch {
                    // skip malformed frames
                }
            });
            es.addEventListener("end", () => {
                console.log(`[sse] end`);
                dispatch({ type: "SSE_STATUS", status: "ended" });
                clearSse();
            });
            es.addEventListener("close", () => {
                console.log(`[sse] close`);
            });
            es.addEventListener("error", (event) => {
                console.log(`[sse] error (attempt ${sseAttemptsRef.current + 1}/${SSE_MAX_ATTEMPTS})`, JSON.stringify(event));
                if (sseAttemptsRef.current >= SSE_MAX_ATTEMPTS) {
                    clearSse();
                    startTracePolling(pipelineId);
                    return;
                }
                const attemptIdx = sseAttemptsRef.current;
                sseAttemptsRef.current += 1;
                const wait = SSE_BACKOFF_MS[attemptIdx] ?? SSE_BACKOFF_MS[SSE_BACKOFF_MS.length - 1] ?? 16_000;
                dispatch({ type: "SSE_STATUS", status: "reconnecting" });
                clearSse();
                sseReconnectTimerRef.current = setTimeout(() => openSse(pipelineId), wait);
            });
        },
        [clearSse, startTracePolling],
    );

    const startPendingPolling = useCallback((pipelineId: string) => {
        if (pendingPollerRef.current) return;
        const tick = async () => {
            try {
                const record = await getPendingApproval(pipelineId);
                dispatch({ type: "APPROVAL", record });
                if (record.state !== "PENDING" && pendingPollerRef.current) {
                    clearInterval(pendingPollerRef.current);
                    pendingPollerRef.current = null;
                }
            } catch (err: unknown) {
                if (err instanceof NormalizedHttpError) {
                    const n = err.normalized;
                    if (isNotFound(n)) return; // not posted yet
                    if (isConflict(n)) {
                        const body = n.body as { current_state?: string } | null;
                        const forced = body?.current_state;
                        if (forced === "EXECUTING" || forced === "REJECTED" || forced === "COMPLETED") {
                            dispatch({ type: "APPROVAL_FORCED", state: forced });
                        }
                        if (pendingPollerRef.current) {
                            clearInterval(pendingPollerRef.current);
                            pendingPollerRef.current = null;
                        }
                        return;
                    }
                    if (isNetwork(n)) return;
                    dispatch({ type: "ERROR", error: n });
                }
            }
        };
        void tick();
        pendingPollerRef.current = setInterval(tick, POLL_PENDING_MS);
    }, []);

    const startPhasePoller = useCallback(
        <T,>(
            key: "chain" | "recovery" | "outcome" | "audit",
            fetcher: (id: string) => Promise<PhaseResult<T>>,
            onSuccess: (data: T) => void,
        ) =>
            (pipelineId: string): void => {
                if (phasePollersRef.current[key]) return;
                const tick = async () => {
                    const result = await fetcher(pipelineId);
                    if (result.ok) {
                        onSuccess(result.data);
                        const t = phasePollersRef.current[key];
                        if (t) {
                            clearInterval(t);
                            phasePollersRef.current[key] = null;
                        }
                    }
                };
                void tick();
                phasePollersRef.current[key] = setInterval(tick, POLL_PHASE_MS);
            },
        [],
    );

    const startChainPoller = startPhasePoller<ExecutionChainOutput>("chain", getChain, (data) =>
        dispatch({ type: "PHASE_CHAIN", data }),
    );
    const startRecoveryPoller = startPhasePoller<RecoveryPlanOutput>("recovery", getRecovery, (data) =>
        dispatch({ type: "PHASE_RECOVERY", data }),
    );
    const startOutcomePoller = startPhasePoller<OutcomeReportOutput>("outcome", getOutcome, (data) =>
        dispatch({ type: "PHASE_OUTCOME", data }),
    );
    const startAuditPoller = startPhasePoller<WorkflowAuditOutput>("audit", getAudit, (data) =>
        dispatch({ type: "PHASE_AUDIT", data }),
    );

    // Phase pollers activate when derivedStatus first hits EXECUTING.
    useEffect(() => {
        if (!state.pipelineId) return;
        const status = deriveClientStatus(state);
        if (status === "EXECUTING") {
            startChainPoller(state.pipelineId);
            startRecoveryPoller(state.pipelineId);
            startOutcomePoller(state.pipelineId);
            startAuditPoller(state.pipelineId);
        }
    }, [
        state,
        startChainPoller,
        startRecoveryPoller,
        startOutcomePoller,
        startAuditPoller,
    ]);

    // Commit audit receipt exactly once.
    useEffect(() => {
        if (!state.audit || auditCommittedRef.current) return;
        auditCommittedRef.current = true;
        void commitReceipt(state.audit)
            .then((receipt) => dispatch({ type: "LEDGER_COMMITTED", receipt }))
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                dispatch({
                    type: "ERROR",
                    error: { kind: "api", message: `Ledger commit failed: ${msg}`, status: 0, body: null },
                });
            });
    }, [state.audit]);

    // Foreground/background — pause SSE when backgrounded, restart on resume.
    useEffect(() => {
        const sub = AppState.addEventListener("change", (next) => {
            const id = stateRef.current.pipelineId;
            if (!id) return;
            const s = stateRef.current.sseStatus;
            if (next === "background") {
                if (s === "open" || s === "connecting" || s === "reconnecting") clearSse();
            } else if (next === "active") {
                if (s === "ended" || s === "polling") return;
                openSse(id);
            }
        });
        return () => sub.remove();
    }, [clearSse, openSse]);

    useEffect(
        () => () => {
            clearSse();
            stopAllPollers();
        },
        [clearSse, stopAllPollers],
    );

    const start = useCallback(
        async (sources: RawSource[]): Promise<string | null> => {
            dispatch({ type: "STARTING" });
            try {
                const { pipeline_id } = await postPipelineRun(sources);
                auditCommittedRef.current = false;
                stopAllPollers();
                clearSse();
                dispatch({ type: "STARTED", pipelineId: pipeline_id });
                openSse(pipeline_id);
                startPendingPolling(pipeline_id);
                return pipeline_id;
            } catch (err: unknown) {
                if (err instanceof NormalizedHttpError) {
                    dispatch({ type: "START_FAILED", error: err.normalized });
                }
                return null;
            }
        },
        [clearSse, openSse, startPendingPolling, stopAllPollers],
    );

    const startDemo = useCallback(async (): Promise<string | null> => {
        dispatch({ type: "STARTING" });
        try {
            const { pipeline_id } = await postPipelineRun(undefined);
            auditCommittedRef.current = false;
            stopAllPollers();
            clearSse();
            dispatch({ type: "STARTED", pipelineId: pipeline_id });
            openSse(pipeline_id);
            startPendingPolling(pipeline_id);
            return pipeline_id;
        } catch (err: unknown) {
            if (err instanceof NormalizedHttpError) {
                dispatch({ type: "START_FAILED", error: err.normalized });
            }
            return null;
        }
    }, [clearSse, openSse, startPendingPolling, stopAllPollers]);

    const approve = useCallback(
        async (operatorHandle: string): Promise<void> => {
            const id = stateRef.current.pipelineId;
            const proposal = stateRef.current.approval?.proposal;
            if (!id || !proposal) {
                dispatch({
                    type: "ERROR",
                    error: { kind: "api", message: "No pipeline or proposal available to approve.", status: 0, body: null },
                });
                return;
            }
            dispatch({ type: "ACTING", value: true });
            try {
                const approvedBy = await signApproval(operatorHandle, id, proposal.rationale);
                const res = await postApprove(id, approvedBy);
                dispatch({ type: "APPROVAL_FORCED", state: res.state === "PENDING" ? "EXECUTING" : res.state });
            } catch (err: unknown) {
                if (err instanceof NormalizedHttpError) {
                    if (isConflict(err.normalized)) {
                        const body = err.normalized.body as { current_state?: string } | null;
                        const forced = body?.current_state;
                        if (forced === "EXECUTING" || forced === "REJECTED" || forced === "COMPLETED") {
                            dispatch({ type: "APPROVAL_FORCED", state: forced });
                        }
                    } else {
                        dispatch({ type: "ERROR", error: err.normalized });
                    }
                } else {
                    const message = err instanceof Error ? err.message : String(err);
                    dispatch({ type: "ERROR", error: { kind: "api", message, status: 0, body: null } });
                }
            } finally {
                dispatch({ type: "ACTING", value: false });
            }
        },
        [],
    );

    const reject = useCallback(
        async (operatorHandle: string, reason?: string): Promise<void> => {
            const id = stateRef.current.pipelineId;
            if (!id) return;
            dispatch({ type: "ACTING", value: true });
            try {
                await postReject(id, operatorHandle, reason);
                dispatch({ type: "APPROVAL_FORCED", state: "REJECTED" });
            } catch (err: unknown) {
                if (err instanceof NormalizedHttpError) {
                    if (isConflict(err.normalized)) {
                        const body = err.normalized.body as { current_state?: string } | null;
                        const forced = body?.current_state;
                        if (forced === "EXECUTING" || forced === "REJECTED" || forced === "COMPLETED") {
                            dispatch({ type: "APPROVAL_FORCED", state: forced });
                        }
                    } else {
                        dispatch({ type: "ERROR", error: err.normalized });
                    }
                }
            } finally {
                dispatch({ type: "ACTING", value: false });
            }
        },
        [],
    );

    const reset = useCallback(() => {
        clearSse();
        stopAllPollers();
        auditCommittedRef.current = false;
        sseAttemptsRef.current = 0;
        dispatch({ type: "RESET" });
    }, [clearSse, stopAllPollers]);

    const refreshLedger = useCallback(async (): Promise<void> => {
        try {
            const receipts = await listReceipts();
            dispatch({ type: "LEDGER_LIST", receipts });
        } catch {
            // ledger read failure is non-fatal — UI just sees stale data
        }
    }, []);

    // Initial ledger hydration on mount.
    useEffect(() => {
        void refreshLedger();
    }, [refreshLedger]);

    const derivedStatus = useMemo(() => deriveClientStatus(state), [state]);

    return {
        pipelineId: state.pipelineId,
        derivedStatus,
        events: state.events,
        approval: state.approval,
        chain: state.chain,
        recovery: state.recovery,
        outcome: state.outcome,
        audit: state.audit,
        ledgerReceipt: state.ledgerReceipt,
        ledgerReceipts: state.ledgerReceipts,
        sseStatus: state.sseStatus,
        lastError: state.lastError,
        isStarting: state.isStarting,
        isActing: state.isActing,
        start,
        startDemo,
        approve,
        reject,
        reset,
        refreshLedger,
    };
}
