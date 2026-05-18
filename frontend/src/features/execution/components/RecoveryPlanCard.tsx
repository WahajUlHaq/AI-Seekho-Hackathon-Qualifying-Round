"use client";

import { useCallback } from "react";
import { CheckCircle2, TriangleAlert, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePollingResource } from "@/features/execution/hooks/usePollingResource";
import type { components } from "@/types/openapi";

type FailureRecovery = components["schemas"]["FailureRecovery"];
type RecoveryEntry = components["schemas"]["RecoveryPlanEntry"];

const STRATEGY_CLASS: Record<RecoveryEntry["applied_strategy"], string> = {
  RETRY: "bg-chart-1/15 text-chart-1 border-chart-1/40",
  FALLBACK: "bg-chart-2/15 text-chart-2 border-chart-2/40",
  SKIP: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<RecoveryEntry["mitigation_status"], { icon: typeof CheckCircle2; tone: string }> = {
  RESOLVED: { icon: CheckCircle2, tone: "text-chart-2" },
  BLOCKED: { icon: TriangleAlert, tone: "text-destructive" },
  PROPOSED: { icon: Clock, tone: "text-chart-1" },
};

export function RecoveryPlanCard({ pipelineId, enabled }: { pipelineId: string; enabled: boolean }) {
  const endpoint = useCallback((id: string) => `/api/execution/${id}/recovery`, []);
  const { data, ready, failed } = usePollingResource<FailureRecovery>(pipelineId, endpoint, enabled);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <span>Failure Recovery (M12)</span>
          {ready && data ? (
            <>
              <Badge variant="outline">
                {data.recovery_plan.length} plan entr{data.recovery_plan.length === 1 ? "y" : "ies"}
              </Badge>
              <Badge variant={data.cascaded_skips.length > 0 ? "destructive" : "secondary"}>
                {data.cascaded_skips.length} cascaded skip{data.cascaded_skips.length === 1 ? "" : "s"}
              </Badge>
            </>
          ) : (
            <Badge variant="outline" className="animate-pulse">
              waiting…
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!ready ? (
          <p className="text-sm text-muted-foreground">
            {failed
              ? "Backend is unreachable — retrying."
              : "Waiting for M12 FailureRecovery to compile mitigation plan…"}
          </p>
        ) : data ? (
          <>
            {data.cascaded_skips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/20 p-2 text-xs">
                <span className="text-muted-foreground">Cascade-tainted downstream:</span>
                {data.cascaded_skips.map((id) => (
                  <code
                    key={id}
                    className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px]"
                    title="Skipped due to upstream failure"
                  >
                    {id}
                  </code>
                ))}
              </div>
            ) : null}

            {data.recovery_plan.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failures intercepted; no recovery plan needed.</p>
            ) : (
              <ul className="space-y-2">
                {data.recovery_plan.map((entry, idx) => {
                  const StatusIcon = STATUS_LABEL[entry.mitigation_status].icon;
                  const statusTone = STATUS_LABEL[entry.mitigation_status].tone;
                  return (
                    <li
                      key={`${entry.intercepted_action_id}-${idx}`}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                          {entry.intercepted_action_id}
                        </code>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            STRATEGY_CLASS[entry.applied_strategy]
                          )}
                        >
                          {entry.applied_strategy}
                        </span>
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", statusTone)}>
                          <StatusIcon className="size-3.5" aria-hidden />
                          {entry.mitigation_status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{entry.rationale}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
