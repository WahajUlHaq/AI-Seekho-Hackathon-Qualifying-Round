import React, { useMemo } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { BarChart } from "react-native-chart-kit";
import type { LedgerReceipt } from "@/types/execution";
import { T } from "@/lib/theme";

interface Props {
    receipts: readonly LedgerReceipt[];
}

interface Bucket {
    label: string;
    count: number;
}

const chartConfig = {
    backgroundColor: T.bgSurface,
    backgroundGradientFrom: T.bgSurface,
    backgroundGradientTo: T.bgBase,
    decimalPlaces: 0,
    color: (opacity = 1): string => `rgba(${T.blueRgb},${opacity})`,
    labelColor: (): string => T.tx3,
    propsForBackgroundLines: {
        stroke: T.bdDim,
    },
    propsForLabels: {
        fontFamily: T.fontMono,
    },
};

export function DashboardMetrics({ receipts }: Props): React.ReactElement {
    const stats = useMemo(() => computeStats(receipts), [receipts]);
    const screenWidth = Dimensions.get("window").width;

    return (
        <View style={styles.root}>
            <Text style={styles.heading}>EXECUTIVE SUMMARY</Text>
            <View style={styles.cardsRow}>
                <SummaryCard label="Total Runs" value={String(stats.total)} accent={T.blue} />
                <SummaryCard label="Verified" value={String(stats.verified)} accent={T.emerald} />
                <SummaryCard label="Rejected" value={String(stats.rejected)} accent={T.violet} />
            </View>
            <View style={styles.cardsRow}>
                <SummaryCard
                    label="Success Rate"
                    value={stats.total === 0 ? "—" : `${stats.successRate}%`}
                    accent={T.emerald}
                />
                <SummaryCard
                    label="Last Run"
                    value={stats.lastRun ?? "—"}
                    accent={T.amber}
                />
            </View>

            {stats.weekly.length > 0 ? (
                <View style={styles.chartBox}>
                    <Text style={styles.chartTitle}>RUNS THIS WEEK</Text>
                    <BarChart
                        data={{
                            labels: stats.weekly.map((b) => b.label),
                            datasets: [{ data: stats.weekly.map((b) => b.count) }],
                        }}
                        width={screenWidth - 32}
                        height={180}
                        yAxisLabel=""
                        yAxisSuffix=""
                        chartConfig={chartConfig}
                        fromZero
                        showValuesOnTopOfBars
                        style={styles.chart}
                    />
                </View>
            ) : (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>
                        Launch your first pipeline below to populate the dashboard.
                    </Text>
                </View>
            )}
        </View>
    );
}

interface SummaryCardProps {
    label: string;
    value: string;
    accent: string;
}

function SummaryCard({ label, value, accent }: SummaryCardProps): React.ReactElement {
    return (
        <View style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: accent }]} />
            <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>{label}</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                    {value}
                </Text>
            </View>
        </View>
    );
}

interface ComputedStats {
    total: number;
    verified: number;
    rejected: number;
    successRate: number;
    lastRun: string | null;
    weekly: Bucket[];
}

function computeStats(receipts: readonly LedgerReceipt[]): ComputedStats {
    const total = receipts.length;
    const verified = receipts.filter(
        (r) => r.finalized_status === "APPROVED_PASSED" || r.finalized_status === "APPROVED_PARTIAL",
    ).length;
    const rejected = receipts.filter(
        (r) => r.finalized_status === "REJECTED" || r.finalized_status === "APPROVED_FAILED",
    ).length;
    const successRate = total === 0 ? 0 : Math.round((verified / total) * 100);

    let lastRun: string | null = null;
    if (receipts.length > 0) {
        const latest = receipts.reduce((acc, r) => (r.captured_at > acc.captured_at ? r : acc));
        try {
            lastRun = new Date(latest.captured_at).toLocaleString();
        } catch {
            lastRun = latest.captured_at;
        }
    }

    const weekly = bucketByDay(receipts, 7);

    return { total, verified, rejected, successRate, lastRun, weekly };
}

function bucketByDay(receipts: readonly LedgerReceipt[], days: number): Bucket[] {
    if (receipts.length === 0) return [];
    const buckets: Bucket[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
        buckets.push({ label, count: 0 });
    }
    const oldestMs = new Date(now).setDate(now.getDate() - (days - 1));
    for (const r of receipts) {
        const t = new Date(r.captured_at).getTime();
        if (Number.isNaN(t) || t < oldestMs) continue;
        const daysAgo = Math.floor((now.getTime() - t) / 86_400_000);
        const idx = days - 1 - Math.min(days - 1, Math.max(0, daysAgo));
        const bucket = buckets[idx];
        if (bucket) bucket.count += 1;
    }
    return buckets;
}

const styles = StyleSheet.create({
    root: {
        paddingTop: T.sp1,
        paddingHorizontal: T.sp3,
        paddingBottom: T.sp3,
    },
    heading: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 8,
    },
    cardsRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 8,
    },
    card: {
        flex: 1,
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDim,
        overflow: "hidden",
    },
    cardAccent: {
        height: 3,
        width: "100%",
    },
    cardBody: {
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    cardLabel: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginBottom: 3,
    },
    cardValue: {
        color: T.tx1,
        fontFamily: T.fontMono,
        fontSize: 20,
        fontWeight: "700",
        lineHeight: 22,
    },
    chartBox: {
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDim,
        paddingHorizontal: 8,
        paddingVertical: 10,
        marginTop: 4,
    },
    chartTitle: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        letterSpacing: 0.8,
        marginBottom: 4,
        paddingLeft: 4,
    },
    chart: {
        borderRadius: T.rSm,
    },
    emptyBox: {
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDim,
        padding: 16,
        alignItems: "center",
        marginTop: 4,
    },
    emptyText: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 11,
        textAlign: "center",
    },
});
