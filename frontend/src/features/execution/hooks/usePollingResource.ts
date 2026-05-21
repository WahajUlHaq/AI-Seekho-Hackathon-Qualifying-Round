"use client";

import { useEffect, useState } from "react";
import { api, isConflict, type ApiError } from "@/lib/axios";

const POLL_INTERVAL_MS = 2_000;

export interface PollingResourceState<T> {
  data: T | null;
  ready: boolean;
  failed: boolean;
}

/**
 * Polls a GET endpoint until it returns 200, then stops. 404 is treated as
 * "still computing" (keep polling). Other errors mark the resource as `failed`
 * but keep polling so transient failures don't permanently hang the card.
 */
export function usePollingResource<T>(
  pipelineId: string | null | undefined,
  endpoint: (id: string) => string,
  enabled: boolean = true
): PollingResourceState<T> {
  const [state, setState] = useState<PollingResourceState<T>>({
    data: null,
    ready: false,
    failed: false,
  });

  const [trackedId, setTrackedId] = useState(pipelineId);
  const [trackedEnabled, setTrackedEnabled] = useState(enabled);

  if (trackedId !== pipelineId || trackedEnabled !== enabled) {
    setTrackedId(pipelineId);
    setTrackedEnabled(enabled);
    setState({ data: null, ready: false, failed: false });
  }

  useEffect(() => {
    if (!pipelineId || !enabled) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await api.get<T>(endpoint(pipelineId));
        if (cancelled) return;
        setState({ data, ready: true, failed: false });
      } catch (err) {
        if (cancelled) return;
        if (isConflict(err)) return;
        const apiErr = err as ApiError;
        if (apiErr?.kind === "api" && apiErr.status !== 404) {
          setState((prev) => ({ ...prev, failed: true }));
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
  }, [pipelineId, enabled, endpoint]);

  return state;
}
