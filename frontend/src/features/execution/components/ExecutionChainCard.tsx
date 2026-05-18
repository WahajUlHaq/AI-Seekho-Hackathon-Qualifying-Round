"use client";

import { useCallback } from "react";
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

type ActionChain = components["schemas"]["ActionChain"];

const STATUS_LABEL: Record<ActionChain["overall_status"], string> = {
  SUCCESS: "All actions succeeded",
  PARTIAL_SUCCESS: "Partial success",
  FAILED: "Execution failed",
};

const STATUS_VARIANT: Record<ActionChain["overall_status"], "default" | "destructive" | "secondary"> = {
  SUCCESS: "default",
  PARTIAL_SUCCESS: "secondary",
  FAILED: "destructive",
};

const RESULT_CLASS: Record<components["schemas"]["ExecutionResult"]["status"], string> = {
  SUCCESS: "text-chart-2",
  FAILED: "text-destructive",
  SKIPPED: "text-muted-foreground",
};

export function ExecutionChainCard({ pipelineId, enabled }: { pipelineId: string; enabled: boolean }) {
  const endpoint = useCallback((id: string) => `/api/execution/${id}/chain`, []);
  const { data, ready, failed } = usePollingResource<ActionChain>(pipelineId, endpoint, enabled);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <span>Execution Chain (M11)</span>
          {ready && data ? (
            <Badge variant={STATUS_VARIANT[data.overall_status]}>
              {STATUS_LABEL[data.overall_status]}
            </Badge>
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
              : "Waiting for M11 ExecutionSimulator to finalize the action chain…"}
          </p>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Approved by" value={data.approved_by ?? "—"} mono />
              <Stat label="Approved at" value={formatClock(data.approval_timestamp)} mono />
              <Stat label="Actions" value={String(data.execution_results.length)} />
              <Stat label="Total runtime" value={`${data.total_execution_ms} ms`} />
            </div>
            <div className="rounded-lg border">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Latency</th>
                    <th className="px-3 py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.execution_results.map((r) => (
                    <tr key={r.action_id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-[11px]">{r.action_id}</td>
                      <td className={cn("px-3 py-2 font-semibold", RESULT_CLASS[r.status])}>{r.status}</td>
                      <td className="px-3 py-2">{r.latency_ms} ms</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.error_message ?? r.output_summary ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
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

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour12: false });
}
