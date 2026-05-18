"use client";

import { useMemo } from "react";
import type { TraceEvent } from "@/features/execution/hooks/useLiveTrace";
import type { NodeVisualStatus } from "@/features/execution/components/DagNodeGraph";

export type HitlState = "AWAITING" | "APPROVED" | "REJECTED" | "EXECUTING_DONE" | null;

export interface DerivedExecutionState {
  actionStatuses: Map<string, NodeVisualStatus>;
  taintedSet: Set<string>;
  hitlState: HitlState;
  hitlReason: string | null;
  cycleDetected: boolean;
}

function hasActionId(data: unknown): data is { action_id: string; status?: string; will_skip?: boolean; reason?: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "action_id" in data &&
    typeof (data as { action_id: unknown }).action_id === "string"
  );
}

// Replays the TraceEvent stream from useLiveTrace and derives per-action status
// + cascade taint + HITL state. Mirrors backend execution-simulator semantics:
// `will_skip: true` on action_start means the action was tainted by upstream
// failure and immediately enters SKIPPED.
export function useDerivedExecutionState(events: TraceEvent[]): DerivedExecutionState {
  return useMemo(() => {
    const actionStatuses = new Map<string, NodeVisualStatus>();
    const taintedSet = new Set<string>();
    let hitlState: HitlState = null;
    let hitlReason: string | null = null;
    let cycleDetected = false;

    for (const event of events) {
      switch (event.event_type) {
        case "hitl_pending":
          hitlState = "AWAITING";
          break;
        case "hitl_approved":
          hitlState = "APPROVED";
          break;
        case "hitl_rejected": {
          hitlState = "REJECTED";
          const data = event.data as { reason?: unknown } | undefined;
          if (data && typeof data.reason === "string") hitlReason = data.reason;
          break;
        }
        case "graph_cycle_detected":
          cycleDetected = true;
          break;
        case "action_start":
          if (hasActionId(event.data)) {
            if (event.data.will_skip === true) {
              actionStatuses.set(event.data.action_id, "SKIPPED");
              taintedSet.add(event.data.action_id);
            } else {
              actionStatuses.set(event.data.action_id, "RUNNING");
            }
          }
          break;
        case "action_complete":
          if (hasActionId(event.data)) {
            const status = event.data.status;
            if (status === "SUCCESS" || status === "FAILED" || status === "SKIPPED") {
              actionStatuses.set(event.data.action_id, status);
              if (status === "FAILED" || status === "SKIPPED") {
                taintedSet.add(event.data.action_id);
              }
            }
          }
          break;
        default:
          break;
      }
    }

    // If the trace stream has ended and we saw any action_complete, mark
    // execution done.
    if (hitlState === "APPROVED" && actionStatuses.size > 0) {
      const allTerminal = Array.from(actionStatuses.values()).every(
        (s) => s === "SUCCESS" || s === "FAILED" || s === "SKIPPED"
      );
      if (allTerminal) hitlState = "EXECUTING_DONE";
    }

    return { actionStatuses, taintedSet, hitlState, hitlReason, cycleDetected };
  }, [events]);
}
