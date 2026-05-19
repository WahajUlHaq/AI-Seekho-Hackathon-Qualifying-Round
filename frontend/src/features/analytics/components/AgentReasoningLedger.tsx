"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  LiveTraceStatus,
  TraceEvent,
} from "@/features/execution/hooks/useLiveTrace";

type Props = {
  events: TraceEvent[];
  status: LiveTraceStatus;
};

const STATUS_LABEL: Record<LiveTraceStatus, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  open: "Streaming",
  ended: "Ended",
  error: "Stream error",
};

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour12: false });
}

function rowAccent(event: TraceEvent): string {
  if (event.event_type === "failure") return "text-destructive";
  if (event.event_type === "thinking") return "italic opacity-70";
  if (event.event_type === "recovery") return "italic opacity-80 text-chart-3";
  if (event.event_type === "hitl_pending") {
    return "border-l-2 border-chart-1 pl-2";
  }
  if (event.event_type === "hitl_approved") {
    return "border-l-2 border-chart-2 pl-2 font-medium";
  }
  if (event.event_type === "hitl_rejected") {
    return "border-l-2 border-destructive pl-2 font-medium text-destructive";
  }
  if (event.event_type === "graph_cycle_detected") {
    return "border-l-2 border-destructive pl-2 text-destructive";
  }
  if (event.event_type === "action_start" || event.event_type === "action_complete") {
    const data = event.data as { status?: unknown } | undefined;
    const status = typeof data?.status === "string" ? data.status : undefined;
    if (status === "FAILED") return "border-l-2 border-destructive pl-2";
    if (status === "SKIPPED") return "border-l-2 border-muted-foreground pl-2 opacity-70";
    if (status === "SUCCESS") return "border-l-2 border-chart-2 pl-2";
    return "border-l-2 border-chart-1 pl-2";
  }
  if (event.event_type === "contract_gate") {
    const failed =
      typeof event.message === "string" &&
      event.message.toLowerCase().includes("validation failed");
    return failed
      ? "border-l-2 border-chart-3 pl-2"
      : "border-l-2 border-chart-2 pl-2";
  }
  return "";
}

interface GateDetail {
  errors: string[];
  warnings: string[];
  semanticIssues: string[];
}

function extractGateDetail(event: TraceEvent): GateDetail | null {
  if (event.event_type !== "contract_gate") return null;
  const data = event.data as
    | { errors?: unknown; warnings?: unknown; semantic_issues?: unknown }
    | undefined;
  if (!data) return null;
  const errors = Array.isArray(data.errors)
    ? data.errors.filter((e): e is string => typeof e === "string")
    : [];
  const warnings = Array.isArray(data.warnings)
    ? data.warnings.filter((e): e is string => typeof e === "string")
    : [];
  const semanticIssues = Array.isArray(data.semantic_issues)
    ? data.semantic_issues.filter((e): e is string => typeof e === "string")
    : [];
  if (errors.length === 0 && warnings.length === 0 && semanticIssues.length === 0) {
    return null;
  }
  return { errors, warnings, semanticIssues };
}

export function AgentReasoningLedger({ events, status }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <Card className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span>Agent Reasoning Ledger</span>
          <Badge variant={status === "error" ? "destructive" : "secondary"}>
            {STATUS_LABEL[status]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent
        ref={scrollRef}
        className="max-h-[640px] overflow-y-auto font-mono text-xs"
      >
        {events.length === 0 ? (
          <p className="text-muted-foreground">Awaiting first agent signal…</p>
        ) : (
          <ol className="space-y-1.5">
            {events.map((event) => {
              const gate = extractGateDetail(event);
              return (
                <li
                  key={event.event_id}
                  className={cn("leading-relaxed", rowAccent(event))}
                >
                  <div>
                    <span className="text-muted-foreground">
                      [{formatClock(event.timestamp)}]
                    </span>{" "}
                    <span className="font-semibold text-foreground">{event.agent}</span>{" "}
                    <span className="text-chart-1">{event.event_type}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span>{event.message}</span>
                  </div>
                  {gate ? (
                    <div className="mt-1 ml-4 space-y-1 text-[11px]">
                      {gate.errors.length > 0 ? (
                        <DetailGroup label="Errors" tone="text-destructive" items={gate.errors} />
                      ) : null}
                      {gate.warnings.length > 0 ? (
                        <DetailGroup label="Warnings" tone="text-chart-3" items={gate.warnings} />
                      ) : null}
                      {gate.semanticIssues.length > 0 ? (
                        <DetailGroup label="Semantic issues" tone="text-chart-1" items={gate.semanticIssues} />
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function DetailGroup({
  label,
  tone,
  items,
}: {
  label: string;
  tone: string;
  items: string[];
}) {
  return (
    <div>
      <div className={cn("text-[10px] font-semibold uppercase tracking-wider", tone)}>{label}</div>
      <ul className="ml-3 list-disc space-y-0.5 text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
