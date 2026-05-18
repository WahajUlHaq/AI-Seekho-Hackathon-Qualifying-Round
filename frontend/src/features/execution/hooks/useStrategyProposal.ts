"use client";

import { useEffect, useState } from "react";
import { api, isConflict, type ApiError, type ConflictError } from "@/lib/axios";
import type { components } from "@/types/openapi";

export type PipelineApprovalRecord = components["schemas"]["PipelineApprovalRecord"];
export type ApprovalState = components["schemas"]["ApprovalState"];

export type StrategyProposalStatus =
  | "loading"   // initial poll, no answer yet
  | "pending"   // 200 received, record.state === "PENDING"
  | "gone"      // 409 received, pipeline transitioned past PENDING
  | "missing"   // 404 received persistently (pipeline id unknown)
  | "error";    // non-404/409 transport error

export interface StrategyProposalState {
  record: PipelineApprovalRecord | null;
  status: StrategyProposalStatus;
  currentState: ApprovalState | null;
}

const POLL_INTERVAL_MS = 2_000;

export function useStrategyProposal(
  pipelineId: string | null | undefined,
  refreshTrigger = 0
): StrategyProposalState {
  const [state, setState] = useState<StrategyProposalState>({
    record: null,
    status: pipelineId ? "loading" : "missing",
    currentState: null,
  });

  const [trackedId, setTrackedId] = useState(pipelineId);
  const [trackedRefresh, setTrackedRefresh] = useState(refreshTrigger);

  if (trackedId !== pipelineId || trackedRefresh !== refreshTrigger) {
    setTrackedId(pipelineId);
    setTrackedRefresh(refreshTrigger);
    setState({
      record: null,
      status: pipelineId ? "loading" : "missing",
      currentState: null,
    });
  }

  useEffect(() => {
    if (!pipelineId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await api.get<PipelineApprovalRecord>(
          `/api/execution/${pipelineId}/pending`
        );
        if (cancelled) return;
        setState({
          record: data,
          status: "pending",
          currentState: data.state,
        });
      } catch (err) {
        if (cancelled) return;
        if (isConflict(err)) {
          // Pipeline exists but past PENDING — surface its current state.
          const conflict = err as ConflictError;
          setState({
            record: null,
            status: "gone",
            currentState: (conflict.currentState as ApprovalState | undefined) ?? null,
          });
          return;
        }
        const apiErr = err as ApiError;
        if (apiErr?.kind === "api" && apiErr.status === 404) {
          // 404 may be transient — the M1-M10 worker hasn't reached the HITL
          // submit yet. Keep polling.
          return;
        }
        setState((prev) => ({ ...prev, status: "error" }));
      }
    };

    void poll();
    const interval = setInterval(() => {
      if (cancelled) return;
      setState((prev) => {
        if (prev.status === "pending" || prev.status === "gone") {
          clearInterval(interval);
          return prev;
        }
        void poll();
        return prev;
      });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pipelineId, refreshTrigger]);

  return state;
}
