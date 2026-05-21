"use client";

import { useEffect, useState } from "react";
import { api, isConflict, type ApiError } from "@/lib/axios";
import type { components } from "@/types/openapi";

export type PipelineAnalytics = components["schemas"]["PipelineAnalytics"];

const POLL_INTERVAL_MS = 2_000;

export interface PipelineAnalyticsState {
  data: PipelineAnalytics | null;
  ready: boolean;
}

export function usePipelineAnalytics(
  pipelineId: string | null | undefined
): PipelineAnalyticsState {
  const [state, setState] = useState<PipelineAnalyticsState>({ data: null, ready: false });
  const [trackedId, setTrackedId] = useState(pipelineId);

  // Reset state when the id changes (render-time setState pattern).
  if (trackedId !== pipelineId) {
    setTrackedId(pipelineId);
    setState({ data: null, ready: false });
  }

  useEffect(() => {
    if (!pipelineId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await api.get<PipelineAnalytics>(`/api/pipeline/${pipelineId}/analytics`);
        if (cancelled) return;
        setState({ data, ready: true });
      } catch (err) {
        // 404 = still compiling, just keep polling.
        if (isConflict(err)) return;
        const apiErr = err as ApiError;
        if (apiErr?.kind === "api" && apiErr.status !== 404) {
          // Real error — log but keep polling so a transient failure doesn't hang the UI.
          console.warn(`[usePipelineAnalytics] non-404 error:`, apiErr);
        }
      }
    };

    void poll();
    const interval = setInterval(() => {
      if (cancelled) return;
      setState((prev) => {
        if (prev.ready) {
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
  }, [pipelineId]);

  return state;
}
