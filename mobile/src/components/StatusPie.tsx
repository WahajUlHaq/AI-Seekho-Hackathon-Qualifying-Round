import React, { useMemo } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { PieChart } from "react-native-chart-kit";
import type { FinalizedStatus, LedgerReceipt } from "@/types/execution";
import { T } from "@/lib/theme";

interface Props {
    receipts: readonly LedgerReceipt[];
}

const SLICE_COLOR: Record<FinalizedStatus, string> = {
    APPROVED_PASSED: T.emerald,
    APPROVED_PARTIAL: T.amber,
    APPROVED_FAILED: T.crimson,
    REJECTED: T.violet,
};

const STATUS_LABEL: Record<FinalizedStatus, string> = {
    APPROVED_PASSED: "Passed",
    APPROVED_PARTIAL: "Partial",
    APPROVED_FAILED: "Failed",
    REJECTED: "Rejected",
};

interface Slice {
    name: string;
    count: number;
    color: string;
    legendFontColor: string;
    legendFontSize: number;
}

const chartConfig = {
    backgroundColor: T.bgSurface,
    backgroundGradientFrom: T.bgSurface,
    backgroundGradientTo: T.bgSurface,
    color: (opacity = 1): string => `rgba(${T.blueRgb},${opacity})`,
    labelColor: (): string => T.tx1,
};

export function StatusPie({ receipts }: Props): React.ReactElement {
    const slices = useMemo(() => buildSlices(receipts), [receipts]);
    const screenWidth = Dimensions.get("window").width;

    if (slices.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyTitle}>FINALIZATION DISTRIBUTION</Text>
                <Text style={styles.emptyText}>No verified receipts yet.</Text>
            </View>
        );
    }

    return (
        <View style={styles.box}>
            <Text style={styles.title}>FINALIZATION DISTRIBUTION</Text>
            <PieChart
                data={slices}
                width={screenWidth - 32}
                height={200}
                chartConfig={chartConfig}
                accessor="count"
                backgroundColor="transparent"
                paddingLeft="12"
                absolute
            />
        </View>
    );
}

function buildSlices(receipts: readonly LedgerReceipt[]): Slice[] {
    const counts: Record<FinalizedStatus, number> = {
        APPROVED_PASSED: 0,
        APPROVED_PARTIAL: 0,
        APPROVED_FAILED: 0,
        REJECTED: 0,
    };
    for (const r of receipts) counts[r.finalized_status] += 1;
    const statuses: FinalizedStatus[] = [
        "APPROVED_PASSED",
        "APPROVED_PARTIAL",
        "APPROVED_FAILED",
        "REJECTED",
    ];
    return statuses
        .filter((s) => counts[s] > 0)
        .map((s) => ({
            name: STATUS_LABEL[s],
            count: counts[s],
            color: SLICE_COLOR[s],
            legendFontColor: T.tx1,
            legendFontSize: 11,
        }));
}

const styles = StyleSheet.create({
    box: {
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDim,
        padding: 10,
        marginHorizontal: 12,
        marginTop: 12,
    },
    title: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        letterSpacing: 0.8,
        marginBottom: 4,
        paddingLeft: 4,
    },
    empty: {
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDim,
        padding: 16,
        marginHorizontal: 12,
        marginTop: 12,
    },
    emptyTitle: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    emptyText: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 11,
        textAlign: "center",
    },
});
