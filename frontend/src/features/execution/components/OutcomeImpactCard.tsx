"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePollingResource } from "@/features/execution/hooks/usePollingResource";
import type { components } from "@/types/openapi";

type OutcomeVisualization = components["schemas"]["OutcomeVisualization"];

const ACT_ID_RE = /(ACT-[A-Z0-9]+)/g;

export function OutcomeImpactCard({ pipelineId, enabled }: { pipelineId: string; enabled: boolean }) {
  const endpoint = useCallback((id: string) => `/api/execution/${id}/outcome`, []);
  const { data, ready, failed } = usePollingResource<OutcomeVisualization>(pipelineId, endpoint, enabled);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span>Outcome Impact (M13)</span>
          {!ready ? (
            <Badge variant="outline" className="animate-pulse">
              waiting…
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ready ? (
          <p className="text-sm text-muted-foreground">
            {failed
              ? "Backend is unreachable — retrying."
              : "Waiting for M13 OutcomeVisualizer to compute deltas…"}
          </p>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <BigStat label="Simulated cost" value={formatNumber(data.total_cost)} unit="PKR" />
              <BigStat
                label="Risk reduction"
                value={String(data.projected_risk_reduction)}
                unit="%"
              />
              <BigStat
                label="Latency saved"
                value={formatNumber(data.simulated_latency_saved)}
                unit="ms"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SummaryBlock label="Before" body={data.before_state_summary} />
              <SummaryBlock label="After" body={data.after_state_summary} />
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Qualitative diff
              </div>
              <p className="mt-1 text-sm leading-relaxed">
                {highlightActionIds(data.qualitative_diff)}
              </p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BigStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function SummaryBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <p className="mt-1 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function highlightActionIds(text: string) {
  const parts = text.split(ACT_ID_RE);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <code
        key={idx}
        className="rounded bg-chart-1/15 px-1 py-0.5 font-mono text-[11px] text-chart-1"
      >
        {part}
      </code>
    ) : (
      <span key={idx}>{part}</span>
    )
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}
