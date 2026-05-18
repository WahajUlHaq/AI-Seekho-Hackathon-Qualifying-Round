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

function extractErrorList(event: TraceEvent): string[] | null {
  if (event.event_type !== "contract_gate") return null;
  const data = event.data as { errors?: unknown } | undefined;
  if (!data || !Array.isArray(data.errors)) return null;
  const strings = data.errors.filter((e): e is string => typeof e === "string");
  return strings.length > 0 ? strings : null;
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
              const errors = extractErrorList(event);
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
                  {errors ? (
                    <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[11px] text-muted-foreground">
                      {errors.map((e, i) => (
                        <li key={i} className="break-words">
                          {e}
                        </li>
                      ))}
                    </ul>
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
