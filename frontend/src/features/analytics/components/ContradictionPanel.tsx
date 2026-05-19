"use client";

import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { components } from "@/types/openapi";

type PipelineAnalytics = components["schemas"]["PipelineAnalytics"];

type Props = {
  analytics: PipelineAnalytics;
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function ContradictionPanel({ analytics }: Props) {
  const { extrapolation_unreliable, contradictions } = analytics;
  const firstRationale = contradictions[0]?.conflict_rationale;

  if (!extrapolation_unreliable && contradictions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contradiction Audit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No contradictions detected — all assertions clear the baseline gate.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {extrapolation_unreliable ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Extrapolation flagged unreliable</AlertTitle>
          <AlertDescription>
            {firstRationale ??
              "The AMCE judge could not verify projection stability after the configured retry budget."}
          </AlertDescription>
        </Alert>
      ) : null}

      {contradictions.length > 0 ? (
        <ul className="space-y-3">
          {contradictions.map((c, i) => (
            <li key={`${c.source_id}-${i}`}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">{c.source_id}</Badge>
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatTimestamp(c.timestamp)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Raw claim
                      </div>
                      <p className="text-sm">{c.raw_claim}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Baseline
                      </div>
                      <p className="text-sm">{c.baseline_context}</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="text-xs italic text-muted-foreground">
                  {c.conflict_rationale}
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
