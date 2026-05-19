"use client";

import { Activity, ShieldCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { components } from "@/types/openapi";

type PipelineAnalytics = components["schemas"]["PipelineAnalytics"];

type Props = {
  analytics: PipelineAnalytics;
};

type Tier = "HIGH" | "MEDIUM" | "LOW";

function deriveTier(analytics: PipelineAnalytics): Tier {
  if (analytics.extrapolation_unreliable) return "LOW";
  if (analytics.contradictions.length > 0) return "MEDIUM";
  return "HIGH";
}

const TIER_STYLES: Record<Tier, string> = {
  HIGH: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  MEDIUM: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  LOW: "bg-chart-4/15 text-chart-4 border-chart-4/30",
};

export function CredibilityGrid({ analytics }: Props) {
  const volume = analytics.forecast_data.length;
  const contradictionCount = analytics.contradictions.length;
  const volatility = contradictionCount / Math.max(volume, 1);
  const volatilityHigh = volatility > 0.3;
  const tier = deriveTier(analytics);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="size-4" />
            Data Volume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">{volume}</div>
          <p className="text-xs text-muted-foreground">
            {contradictionCount} contradiction{contradictionCount === 1 ? "" : "s"} detected
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" />
            Credibility Tier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Badge
            variant="outline"
            className={cn("px-3 py-1 text-sm font-semibold", TIER_STYLES[tier])}
          >
            {tier}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {tier === "HIGH"
              ? "All baseline checks passed."
              : tier === "MEDIUM"
                ? "Contradictions present — review the panel below."
                : "Extrapolation flagged unreliable by AMCE."}
          </p>
        </CardContent>
      </Card>

      <Card className={cn(volatilityHigh && "ring-2 ring-destructive/40")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="size-4" />
            Volatility Index
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {volatility.toFixed(3)}
            </span>
            {volatilityHigh ? (
              <Badge variant="destructive" className="animate-pulse">
                HIGH RISK
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Ratio of contradictions to forecast horizon (threshold 0.3).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
