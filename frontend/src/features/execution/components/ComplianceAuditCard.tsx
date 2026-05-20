"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePollingResource } from "@/features/execution/hooks/usePollingResource";
import { computeAuditHash } from "@/features/execution/lib/canonical-stringify";
import type { components } from "@/types/openapi";

type WorkflowAudit = components["schemas"]["WorkflowAudit"];

type VerificationState =
  | { kind: "idle" }
  | { kind: "computing" }
  | { kind: "matches"; computed: string }
  | { kind: "mismatch"; computed: string }
  | { kind: "error"; error: string };

const FINALIZED_VARIANT: Record<WorkflowAudit["finalized_status"], "default" | "secondary" | "destructive"> = {
  APPROVED_PASSED: "default",
  APPROVED_PARTIAL: "secondary",
  APPROVED_FAILED: "destructive",
  REJECTED: "destructive",
};

const CANONICAL_EVENT_KEYS = [
  "agent_start",
  "agent_complete",
  "action_start",
  "action_complete",
  "contract_gate",
] as const;

export function ComplianceAuditCard({ pipelineId, enabled }: { pipelineId: string; enabled: boolean }) {
  const endpoint = useCallback((id: string) => `/api/execution/${id}/audit`, []);
  const { data, ready, failed } = usePollingResource<WorkflowAudit>(pipelineId, endpoint, enabled);
  const [verification, setVerification] = useState<VerificationState>({ kind: "idle" });

  // Reset verification state when a new audit lands.
  useEffect(() => {
    setVerification({ kind: "idle" });
  }, [data?.audit_id]);

  const extraEventKeys = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.event_summary).filter(
      (k) => !CANONICAL_EVENT_KEYS.includes(k as (typeof CANONICAL_EVENT_KEYS)[number])
    );
  }, [data]);

  async function handleVerify() {
    if (!data) return;
    setVerification({ kind: "computing" });
    try {
      const computed = await computeAuditHash({
        pipelineId: data.pipelineId,
        audit_id: data.audit_id,
        generated_at: data.generated_at,
        finalized_status: data.finalized_status,
        signature_block: data.signature_block,
        event_summary: data.event_summary,
      });
      setVerification(
        computed === data.verification_hash
          ? { kind: "matches", computed }
          : { kind: "mismatch", computed }
      );
    } catch (err) {
      setVerification({
        kind: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function copyHash() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.verification_hash);
      toast.success("Hash copied to clipboard");
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <span>Compliance Audit (M14)</span>
          {ready && data ? (
            <>
              <Badge variant={FINALIZED_VARIANT[data.finalized_status]}>
                {data.finalized_status}
              </Badge>
              <code className="ml-auto font-mono text-[10px] text-muted-foreground">
                {data.audit_id}
              </code>
            </>
          ) : (
            <Badge variant="outline" className="animate-pulse">
              waiting…
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ready ? (
          <p className="text-sm text-muted-foreground">
            {failed
              ? "Backend is unreachable — retrying."
              : "Waiting for M14 WorkflowAudit to seal the compliance receipt…"}
          </p>
        ) : data ? (
          <>
            <SignatureBlock data={data} />

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  SHA-256 verification hash
                </div>
                <Button variant="ghost" size="sm" onClick={copyHash}>
                  <Copy className="mr-1 size-3.5" aria-hidden />
                  Copy
                </Button>
              </div>
              <code className="mt-1 block break-all rounded bg-background p-2 font-mono text-[11px] leading-relaxed">
                {data.verification_hash}
              </code>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerify}
                  disabled={verification.kind === "computing"}
                >
                  {verification.kind === "computing" ? "Verifying…" : "Verify hash"}
                </Button>
                <VerificationBadge verification={verification} expected={data.verification_hash} />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Event summary
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {CANONICAL_EVENT_KEYS.map((key) => (
                  <CounterTile
                    key={key}
                    label={key}
                    value={data.event_summary[key] ?? 0}
                  />
                ))}
              </div>
              {extraEventKeys.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                    {extraEventKeys.length} more event counter{extraEventKeys.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-2 grid grid-cols-1 gap-1.5">
                    {extraEventKeys.map((key) => (
                      <CounterTile key={key} label={key} value={data.event_summary[key] ?? 0} />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SignatureBlock({ data }: { data: WorkflowAudit }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Stat label="Approver" value={data.signature_block.approver} mono />
      <Stat label="Signed at" value={formatClock(data.signature_block.signed_at)} mono />
      <Stat label="Generated at" value={formatClock(data.generated_at)} mono />
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm", mono && "font-mono text-xs")}>{value}</div>
    </div>
  );
}

function CounterTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-4 py-2.5 w-full"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span className="font-mono text-sm text-zinc-400 tracking-wide">{label}</span>
      <span className="font-mono text-lg font-bold text-white tabular-nums">{value}</span>
    </div>
  );
}

function VerificationBadge({
  verification,
  expected,
}: {
  verification: VerificationState;
  expected: string;
}) {
  if (verification.kind === "idle" || verification.kind === "computing") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ShieldQuestion className="size-3.5" aria-hidden />
        Not yet verified
      </span>
    );
  }
  if (verification.kind === "matches") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-chart-2">
        <ShieldCheck className="size-3.5" aria-hidden />
        Hash matches — receipt intact
      </span>
    );
  }
  if (verification.kind === "mismatch") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium text-destructive"
        title={`computed=${verification.computed} expected=${expected}`}
      >
        <ShieldAlert className="size-3.5" aria-hidden />
        Hash MISMATCH — receipt tampered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-destructive">
      <ShieldAlert className="size-3.5" aria-hidden />
      Verification error: {verification.error}
    </span>
  );
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { hour12: false });
}
