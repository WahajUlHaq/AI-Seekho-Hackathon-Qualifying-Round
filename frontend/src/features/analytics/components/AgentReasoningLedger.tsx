"use client";

import { useEffect, useRef } from "react";
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
    <Card
      className="lg:sticky lg:top-4 lg:flex lg:flex-col lg:max-h-[calc(100vh-9rem)]"
      style={{
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          {/* Terminal dot cluster */}
          <div className="flex items-center gap-1 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="text-zinc-300 font-mono">agent.trace</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                status === "open" ? "bg-emerald-400 animate-pulse" :
                status === "connecting" ? "bg-amber-400 animate-pulse" :
                status === "error" ? "bg-red-400 animate-pulse" :
                "bg-zinc-600"
              )}
              style={
                status === "open"
                  ? { boxShadow: "0 0 6px rgba(52,211,153,0.8)" }
                  : undefined
              }
            />
            <span className="text-[10px] font-mono text-zinc-500">
              {STATUS_LABEL[status]}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden font-mono text-xs"
        style={{ colorScheme: "dark" }}
      >
        {events.length === 0 ? (
          <div className="flex items-center gap-2 text-zinc-600 py-2">
            <span className="w-1.5 h-3 bg-zinc-600 rounded-sm"
              style={{ animation: "typing-blink 1s step-end infinite" }}
            />
            <span>Awaiting first agent signal…</span>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {events.map((event) => {
              const gate = extractGateDetail(event);
              return (
                <li
                  key={event.event_id}
                  className={cn("leading-relaxed animate-blur-in min-w-0", rowAccent(event))}
                >
                  <div className="break-words min-w-0">
                    <span className="text-zinc-600">
                      [{formatClock(event.timestamp)}]
                    </span>{" "}
                    <span className="font-semibold text-violet-300">{event.agent}</span>{" "}
                    <span className="text-sky-400">{event.event_type}</span>
                    <span className="text-zinc-700"> · </span>
                    <span className="text-zinc-300">{event.message}</span>
                  </div>
                  {gate ? (
                    <div className="mt-1 ml-4 space-y-1 text-[11px]">
                      {gate.errors.length > 0 ? (
                        <DetailGroup label="Errors" tone="text-red-400" items={gate.errors} />
                      ) : null}
                      {gate.warnings.length > 0 ? (
                        <DetailGroup label="Warnings" tone="text-amber-400" items={gate.warnings} />
                      ) : null}
                      {gate.semanticIssues.length > 0 ? (
                        <DetailGroup label="Semantic issues" tone="text-sky-400" items={gate.semanticIssues} />
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
      <ul className="ml-3 list-disc space-y-0.5 text-zinc-500">
        {items.map((item, i) => (
          <li key={i} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
