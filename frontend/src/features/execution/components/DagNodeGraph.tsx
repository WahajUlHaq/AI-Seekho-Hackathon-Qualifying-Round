"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { components } from "@/types/openapi";
import { layoutDag } from "../lib/layout-dag";

type ProposedAction = components["schemas"]["ProposedAction"];
type ExecutionStatus = components["schemas"]["ExecutionResult"]["status"];

export type NodeVisualStatus =
  | "PENDING"   // not started
  | "RUNNING"   // action_start seen, no action_complete yet
  | ExecutionStatus; // SUCCESS | FAILED | SKIPPED

export interface DagNodeGraphProps {
  actions: ProposedAction[];
  statuses?: Map<string, NodeVisualStatus>;
  taintedSet?: Set<string>;
  className?: string;
}

const STATUS_LABEL: Record<NodeVisualStatus, string> = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
};

const STATUS_NODE_CLASS: Record<NodeVisualStatus, string> = {
  PENDING: "border-border bg-muted/30 text-muted-foreground",
  RUNNING: "border-chart-1 bg-chart-1/10 text-foreground animate-pulse",
  SUCCESS: "border-chart-2 bg-chart-2/10 text-foreground",
  FAILED: "border-destructive ring-1 ring-destructive bg-destructive/10 text-destructive",
  SKIPPED: "border-dashed border-muted-foreground bg-muted/20 text-muted-foreground opacity-60",
};

const PRIORITY_VARIANT: Record<ProposedAction["priority"], "default" | "destructive" | "secondary" | "outline"> = {
  CRITICAL: "destructive",
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

export function DagNodeGraph({
  actions,
  statuses,
  taintedSet,
  className,
}: DagNodeGraphProps) {
  const layout = useMemo(() => layoutDag(actions), [actions]);

  if (actions.length === 0) {
    return (
      <div className={cn("rounded-xl border border-dashed p-6 text-sm text-muted-foreground", className)}>
        No proposed actions to render.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {layout.cycleDetected ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Cycle detected in dependency graph — falling back to priority-desc order.
        </div>
      ) : null}

      <div className="space-y-4 overflow-x-auto pb-2">
        {layout.layers.map((layer, layerIdx) => (
          <div key={layerIdx} className="space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Layer {layerIdx}
            </div>
            <div className="flex flex-wrap gap-3">
              {layer.map((node) => {
                const status = statuses?.get(node.action.action_id) ?? "PENDING";
                const tainted = taintedSet?.has(node.action.action_id) ?? false;
                return (
                  <div
                    key={node.action.action_id}
                    className={cn(
                      "min-w-[200px] max-w-[260px] rounded-lg border-2 p-3 transition-colors",
                      STATUS_NODE_CLASS[status]
                    )}
                    title={
                      tainted && status === "SKIPPED"
                        ? "Upstream dependency failed or was skipped"
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] font-mono">{node.action.action_id}</code>
                      <Badge variant={PRIORITY_VARIANT[node.action.priority]}>
                        {node.action.priority}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs font-medium leading-snug">
                      {node.action.title}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider">
                      <span>{STATUS_LABEL[status]}</span>
                      {node.action.depends_on.length > 0 ? (
                        <span className="text-muted-foreground">
                          ← {node.action.depends_on.length} dep{node.action.depends_on.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
