"use client";

import { useEffect, useState } from "react";
import type { components } from "@/types/openapi";
import { API_BASE_URL } from "@/lib/axios";

export type TraceEvent = components["schemas"]["TraceEvent"];

export type LiveTraceStatus = "idle" | "connecting" | "open" | "ended" | "error";

export interface LiveTraceState {
  events: TraceEvent[];
  status: LiveTraceStatus;
}

const initialFor = (id: string | null | undefined): LiveTraceState => ({
  events: [],
  status: id ? "connecting" : "idle",
});

export function useLiveTrace(pipelineId: string | null | undefined): LiveTraceState {
  const [state, setState] = useState<LiveTraceState>(() => initialFor(pipelineId));
  const [trackedId, setTrackedId] = useState(pipelineId);

  // Reset on prop change — render-time setState pattern (React docs: "Adjusting state when a prop changes").
  if (trackedId !== pipelineId) {
    setTrackedId(pipelineId);
    setState(initialFor(pipelineId));
  }

  useEffect(() => {
    if (!pipelineId) return;

    const url = `${API_BASE_URL}/api/pipeline/${pipelineId}/stream`;
    const source = new EventSource(url);

    source.onopen = () => setState((s) => ({ ...s, status: "open" }));

    source.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as TraceEvent;
        setState((s) => ({ ...s, events: [...s.events, ev] }));
      } catch {
        // Drop malformed frames silently — backend may send heartbeats or comments.
      }
    };

    source.addEventListener("end", () => {
      setState((s) => ({ ...s, status: "ended" }));
      source.close();
    });

    source.onerror = () => {
      setState((s) => (s.status === "ended" ? s : { ...s, status: "error" }));
      source.close();
    };

    // MANDATORY cleanup: neutralizes memory leaks on unmount or pipelineId change.
    return () => source.close();
  }, [pipelineId]);

  return state;
}
