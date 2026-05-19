"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, isConflict, type ApiError, type ConflictError } from "@/lib/axios";
import { getOperatorHandle, setOperatorHandle } from "@/lib/operator";
import type { components } from "@/types/openapi";
import type {
  PipelineApprovalRecord,
} from "@/features/execution/hooks/useStrategyProposal";
import { DagNodeGraph } from "./DagNodeGraph";

type ApproveResponse = components["schemas"]["ApproveResponse"];

interface RejectResponse {
  pipeline_id: string;
  state: components["schemas"]["ApprovalState"];
  rejected_by: string;
  rejected_at: string;
  rejection_reason: string | null;
}

const PRIORITY_VARIANT: Record<
  components["schemas"]["Priority"],
  "default" | "destructive" | "secondary" | "outline"
> = {
  CRITICAL: "destructive",
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

interface StrategyDraftReviewProps {
  record: PipelineApprovalRecord;
  onApproved: () => void;
  onRejected: () => void;
}

export function StrategyDraftReview({
  record,
  onApproved,
  onRejected,
}: StrategyDraftReviewProps) {
  const [handle, setHandle] = useState<string>(() => getOperatorHandle());
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState<"none" | "approve" | "reject">("none");

  function handleChange(next: string) {
    setHandle(next);
    setOperatorHandle(next);
  }

  async function handleApprove() {
    const trimmed = handle.trim();
    if (trimmed.length === 0) {
      toast.error("Operator handle required", {
        description: "Enter a non-empty signature name before approving.",
      });
      return;
    }
    setBusy("approve");
    try {
      const { data } = await api.post<ApproveResponse>(
        `/api/execution/${record.pipeline_id}/approve`,
        { approved_by: trimmed }
      );
      toast.success("Pipeline approved", {
        description: `${data.pipeline_id} → ${data.state}`,
      });
      onApproved();
    } catch (err) {
      surfaceError(err, "approval");
    } finally {
      setBusy("none");
    }
  }

  async function handleReject() {
    const trimmed = handle.trim();
    if (trimmed.length === 0) {
      toast.error("Operator handle required", {
        description: "Enter a non-empty signature name before rejecting.",
      });
      return;
    }
    setBusy("reject");
    try {
      const { data } = await api.post<RejectResponse>(
        `/api/execution/${record.pipeline_id}/reject`,
        {
          rejected_by: trimmed,
          reason: reason.trim().length > 0 ? reason.trim() : undefined,
        }
      );
      toast.success("Pipeline rejected", {
        description: `${data.pipeline_id} → ${data.state}`,
      });
      onRejected();
    } catch (err) {
      surfaceError(err, "rejection");
    } finally {
      setBusy("none");
    }
  }

  const proposal = record.proposal;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span>Strategy Draft Awaiting Approval</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              PENDING
            </Badge>
            <Badge variant={PRIORITY_VARIANT[proposal.overall_priority]}>
              {proposal.overall_priority}
            </Badge>
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Proposed {formatClock(record.proposed_at)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Rationale
            </span>
            <p className="mt-1 whitespace-pre-wrap">{proposal.rationale}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Dependency Graph ({proposal.proposedActions.length} action{proposal.proposedActions.length === 1 ? "" : "s"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DagNodeGraph actions={proposal.proposedActions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">HITL Transaction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="operator-handle" className="text-xs uppercase tracking-wider text-muted-foreground">
              Operator handle (signature)
            </Label>
            <Input
              id="operator-handle"
              value={handle}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="e.g. alex.chen"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reject-reason" className="text-xs uppercase tracking-wider text-muted-foreground">
              Rejection reason (optional)
            </Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly justify a rejection — surfaces on the trace and audit signature."
              className="min-h-[72px]"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={handleApprove}
              disabled={busy !== "none"}
              aria-busy={busy === "approve" || undefined}
            >
              {busy === "approve" ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="mr-1.5 size-4" aria-hidden />
              )}
              Approve & Execute
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={busy !== "none"}
              aria-busy={busy === "reject" || undefined}
            >
              {busy === "reject" ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
              ) : (
                <X className="mr-1.5 size-4" aria-hidden />
              )}
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function surfaceError(err: unknown, action: string) {
  if (isConflict(err)) {
    const conflict = err as ConflictError;
    toast.error(`HITL ${action} blocked`, {
      description: `${conflict.message}${conflict.currentState ? ` (state=${conflict.currentState})` : ""}`,
    });
    return;
  }
  const apiErr = err as ApiError;
  toast.error(`HITL ${action} failed`, {
    description: apiErr?.message ?? "Unknown error",
  });
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour12: false });
}
