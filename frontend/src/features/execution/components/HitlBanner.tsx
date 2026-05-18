"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HitlState } from "@/features/execution/hooks/useDerivedExecutionState";

interface HitlBannerProps {
  state: HitlState;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
}

export function HitlBanner({
  state,
  approvedBy,
  approvedAt,
  rejectedBy,
  rejectedAt,
  rejectionReason,
}: HitlBannerProps) {
  if (state === null) return null;

  let icon = Clock;
  let tone = "border-chart-1/40 bg-chart-1/10 text-chart-1";
  let title = "Awaiting HITL approval";
  let detail = "Pipeline is paused at the human-in-the-loop gate.";

  if (state === "APPROVED" || state === "EXECUTING_DONE") {
    icon = CheckCircle2;
    tone = "border-chart-2/40 bg-chart-2/10 text-chart-2";
    title = state === "EXECUTING_DONE" ? "Execution complete" : "Approved — executing";
    if (approvedBy && approvedAt) {
      detail = `Approved by ${approvedBy} at ${new Date(approvedAt).toLocaleString(undefined, { hour12: false })}`;
    } else {
      detail = "HITL gate cleared — M11-M14 in progress.";
    }
  } else if (state === "REJECTED") {
    icon = XCircle;
    tone = "border-destructive/40 bg-destructive/10 text-destructive";
    title = "Rejected at HITL gate";
    if (rejectedBy && rejectedAt) {
      detail = `Rejected by ${rejectedBy} at ${new Date(rejectedAt).toLocaleString(undefined, { hour12: false })}`;
      if (rejectionReason) detail += ` — ${rejectionReason}`;
    } else if (rejectionReason) {
      detail = rejectionReason;
    }
  }

  const Icon = icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3", tone)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5 text-xs opacity-90">{detail}</div>
      </div>
    </div>
  );
}
