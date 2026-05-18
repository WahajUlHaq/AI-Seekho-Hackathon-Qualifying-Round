"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RechartsTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: unknown }>;
};
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { components } from "@/types/openapi";

type ForecastPoint = components["schemas"]["ForecastPoint"];

type Props = {
  data: ForecastPoint[];
};

type ChartRow = {
  timestamp: string;
  historicalValue: number | null;
  predictedValue: number | null;
  is_extrapolation: boolean;
  rawValue: number;
};

function shortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload }: RechartsTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="text-xs text-muted-foreground">{shortDate(row.timestamp)}</div>
      <div className="text-sm font-semibold tabular-nums">{row.rawValue.toFixed(2)}</div>
      {row.is_extrapolation ? (
        <Badge variant="outline" className="mt-1 text-[10px]">
          Predicted
        </Badge>
      ) : null}
    </div>
  );
}

export function ForecasterChart({ data }: Props) {
  const rows: ChartRow[] = useMemo(
    () =>
      data.map((point) => ({
        timestamp: point.timestamp,
        rawValue: point.value,
        is_extrapolation: point.is_extrapolation,
        historicalValue: point.is_extrapolation ? null : point.value,
        predictedValue: point.is_extrapolation ? point.value : null,
      })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Forecast Horizon — 30 day history / 60 day projection</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2 sm:px-4">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={rows} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={shortDate}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="historicalValue"
              stroke="var(--color-chart-1)"
              fill="var(--color-chart-1)"
              fillOpacity={0.25}
              strokeWidth={2}
              connectNulls
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="predictedValue"
              stroke="var(--color-chart-1)"
              fill="var(--color-chart-1)"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
              connectNulls
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
