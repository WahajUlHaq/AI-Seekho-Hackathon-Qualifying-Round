import React, { useCallback, useMemo, useState } from "react";
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
    type ListRenderItem,
} from "react-native";
import { usePipelineContext } from "@/context/PipelineContext";
import { VerificationCard } from "@/components/VerificationCard";
import type { FinalizedStatus, LedgerReceipt } from "@/types/execution";
import { T } from "@/lib/theme";

interface DistributionCfg {
    key: FinalizedStatus;
    label: string;
    color: string;
}

const DISTRIBUTION: DistributionCfg[] = [
    { key: "APPROVED_PASSED", label: "PASSED", color: T.emerald },
    { key: "APPROVED_PARTIAL", label: "PARTIAL", color: T.amber },
    { key: "APPROVED_FAILED", label: "FAILED", color: T.crimson },
    { key: "REJECTED", label: "REJECTED", color: T.violet },
];

export function AuditInsightsScreen(): React.ReactElement {
    const pipeline = usePipelineContext();
    const [refreshing, setRefreshing] = useState(false);

    const counts = useMemo(() => {
        const c: Record<FinalizedStatus, number> = {
            APPROVED_PASSED: 0,
            APPROVED_PARTIAL: 0,
            APPROVED_FAILED: 0,
            REJECTED: 0,
        };
        for (const r of pipeline.ledgerReceipts) c[r.finalized_status] += 1;
        return c;
    }, [pipeline.ledgerReceipts]);

    const onRefresh = useCallback(async (): Promise<void> => {
        setRefreshing(true);
        try {
            await pipeline.refreshLedger();
        } finally {
            setRefreshing(false);
        }
    }, [pipeline]);

    const renderItem: ListRenderItem<LedgerReceipt> = ({ item }) => (
        <VerificationCard receipt={item} />
    );

    const header = (
        <View>
            <View style={styles.header}>
                <Text style={styles.eyebrow}>VERIFICATION CENTER</Text>
                <Text style={styles.title}>Audit & Insights</Text>
                <Text style={styles.subtitle}>
                    Immutable, on-device ledger of every finalized pipeline. Receipts persist
                    even if the backend in-memory store drops.
                </Text>
            </View>

            <View style={styles.distributionWrap}>
                <Text style={styles.distributionHeading}>
                    FINALIZATION DISTRIBUTION
                </Text>
                <View style={styles.distributionRow}>
                    {DISTRIBUTION.map((d) => (
                        <View key={d.key} style={styles.statCard}>
                            <Text style={[styles.statValue, { color: d.color }]}>
                                {counts[d.key]}
                            </Text>
                            <Text style={styles.statLabel}>{d.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <Text style={styles.listHeading}>
                LEDGER · {pipeline.ledgerReceipts.length} RECEIPT
                {pipeline.ledgerReceipts.length === 1 ? "" : "S"}
            </Text>
        </View>
    );

    return (
        <View style={styles.root}>
            <FlatList
                data={pipeline.ledgerReceipts}
                keyExtractor={(r) => r.pipeline_id}
                ListHeaderComponent={header}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>
                            No receipts yet. Approve a pipeline through the Execution tab to
                            commit one here.
                        </Text>
                    </View>
                }
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={T.emerald}
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bgBase },
    listContent: { paddingBottom: 24, paddingHorizontal: 12 },

    // ── Header ──
    header: {
        backgroundColor: T.bgSurface,
        borderBottomWidth: 1,
        borderBottomColor: T.bdDim,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 12,
        marginHorizontal: -12,
        marginBottom: 12,
    },
    eyebrow: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    title: {
        color: T.tx1,
        fontSize: 22,
        fontWeight: "700",
        marginTop: 2,
    },
    subtitle: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 10,
        lineHeight: 16,
        marginTop: 6,
    },

    // ── Distribution ──
    distributionWrap: {
        marginBottom: 6,
    },
    distributionHeading: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        letterSpacing: 1.0,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    distributionRow: {
        flexDirection: "row",
        gap: 6,
    },
    statCard: {
        flex: 1,
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDim,
        paddingHorizontal: 6,
        paddingVertical: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    statValue: {
        fontFamily: T.fontMono,
        fontSize: 16,
        fontWeight: "700",
        lineHeight: 18,
    },
    statLabel: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 8,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginTop: 2,
    },

    // ── List ──
    listHeading: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1.0,
        textTransform: "uppercase",
        marginTop: 18,
        marginBottom: 8,
    },
    emptyBox: {
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDim,
        padding: 16,
        marginTop: 4,
    },
    emptyText: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 11,
        textAlign: "center",
        lineHeight: 16,
    },
});
