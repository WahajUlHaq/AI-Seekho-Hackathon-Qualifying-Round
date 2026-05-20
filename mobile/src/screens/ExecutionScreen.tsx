import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { usePipelineContext } from "@/context/PipelineContext";
import { StatusBadge } from "@/components/StatusBadge";
import { OperationFeed } from "@/components/OperationFeed";
import { PhaseRibbon } from "@/components/PhaseRibbon";
import { HitlApprovalSheet } from "@/components/HitlApprovalSheet";
import { LedgerReceiptBadge } from "@/components/LedgerReceiptBadge";
import type { RootTabParamList } from "@/navigation/types";
import type { UseStandalonePipeline } from "@/hooks/useStandalonePipeline";
import { T } from "@/lib/theme";
import { usePulse } from "@/lib/animations";

interface Props {
    operatorHandle: string;
}

type Sse = UseStandalonePipeline["sseStatus"];

interface SseCfg {
    color: string;
    label: string;
    pulseMs: number | null;
}

const SSE_CFG: Record<Sse, SseCfg> = {
    idle: { color: T.tx3, label: "idle", pulseMs: null },
    connecting: { color: T.amber, label: "connecting", pulseMs: 1200 },
    open: { color: T.emerald, label: "stream open", pulseMs: 1800 },
    reconnecting: { color: T.orange, label: "reconnecting", pulseMs: 900 },
    polling: { color: T.blue, label: "polling", pulseMs: 1600 },
    ended: { color: T.tx3, label: "stream ended", pulseMs: null },
    error: { color: T.crimson, label: "error", pulseMs: 700 },
};

function SsePulseDot({ status }: { status: Sse }): React.ReactElement {
    const cfg = SSE_CFG[status];
    const anim = usePulse(cfg.pulseMs !== null, cfg.pulseMs ?? 1200);
    const opacity =
        cfg.pulseMs === null
            ? 1
            : anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] });
    return (
        <Animated.View
            style={[styles.sseDot, { backgroundColor: cfg.color, opacity }]}
        />
    );
}

export function ExecutionScreen({ operatorHandle }: Props): React.ReactElement {
    const pipeline = usePipelineContext();
    const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
    const sseCfg = SSE_CFG[pipeline.sseStatus];
    const showHitl = pipeline.derivedStatus === "HITL_PENDING" && pipeline.approval !== null;
    const phaseActive =
        pipeline.derivedStatus === "EXECUTING" || pipeline.derivedStatus === "POLLING_COMPLETED";

    if (!pipeline.pipelineId) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyIcon}>◯</Text>
                <Text style={styles.emptyTitle}>NO ACTIVE PIPELINE</Text>
                <Text style={styles.emptyBody}>
                    Launch one from the Dashboard tab to see real-time operations and the HITL gate.
                </Text>
                <Pressable
                    style={styles.emptyBtn}
                    onPress={() => navigation.navigate("Dashboard")}
                >
                    <Text style={styles.emptyBtnText}>GO TO DASHBOARD</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            {/* ── Header ──────────────────────── */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <StatusBadge status={pipeline.derivedStatus} />
                    <Text style={styles.pipelineId} numberOfLines={1}>
                        {pipeline.pipelineId}
                    </Text>
                </View>
                <Pressable style={styles.resetBtn} onPress={pipeline.reset}>
                    <Text style={styles.resetBtnText}>RESET</Text>
                </Pressable>
            </View>

            {/* ── SSE row ─────────────────────── */}
            <View style={styles.sseRow}>
                <SsePulseDot status={pipeline.sseStatus} />
                <Text style={styles.sseLabel}>{sseCfg.label}</Text>
                {pipeline.events.length > 0 ? (
                    <Text style={styles.sseCount}>· {pipeline.events.length} ops</Text>
                ) : null}
                {pipeline.lastError ? (
                    <Text style={styles.sseError} numberOfLines={1}>
                        · {pipeline.lastError.message}
                    </Text>
                ) : null}
            </View>

            {pipeline.ledgerReceipt ? (
                <LedgerReceiptBadge receipt={pipeline.ledgerReceipt} />
            ) : null}

            <OperationFeed events={pipeline.events} />

            <PhaseRibbon
                chain={pipeline.chain}
                recovery={pipeline.recovery}
                outcome={pipeline.outcome}
                audit={pipeline.audit}
                active={phaseActive}
            />

            <HitlApprovalSheet
                visible={showHitl}
                record={pipeline.approval}
                operatorHandle={operatorHandle}
                isActing={pipeline.isActing}
                errorMessage={pipeline.lastError?.message}
                onApprove={() => void pipeline.approve(operatorHandle)}
                onReject={(reason) => void pipeline.reject(operatorHandle, reason)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: T.bgBase,
    },

    // ── Header ──
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: T.bgSurface,
        borderBottomWidth: 1,
        borderBottomColor: T.bdDim,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 6,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
    },
    pipelineId: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 10,
        flexShrink: 1,
    },
    resetBtn: {
        backgroundColor: T.bgElevated,
        borderWidth: 1,
        borderColor: T.bdBright,
        borderRadius: T.rSm,
        paddingHorizontal: 12,
        paddingVertical: 5,
        minHeight: 28,
        justifyContent: "center",
        alignItems: "center",
    },
    resetBtnText: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
    },

    // ── SSE row ──
    sseRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: T.bgSurface,
        borderBottomWidth: 1,
        borderBottomColor: T.bdDim,
        paddingHorizontal: 14,
        paddingVertical: 6,
        gap: 8,
    },
    sseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    sseLabel: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 10,
    },
    sseCount: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 10,
    },
    sseError: {
        flex: 1,
        textAlign: "right",
        color: T.crimson,
        fontFamily: T.fontMono,
        fontSize: 10,
        flexShrink: 1,
    },

    // ── Empty state ──
    empty: {
        flex: 1,
        backgroundColor: T.bgBase,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    emptyIcon: {
        color: T.tx3,
        fontSize: 32,
        marginBottom: 12,
    },
    emptyTitle: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1.0,
        marginBottom: 8,
    },
    emptyBody: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 11,
        textAlign: "center",
        lineHeight: 18,
        marginBottom: 18,
        maxWidth: 320,
    },
    emptyBtn: {
        backgroundColor: T.emerald,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: T.rMd,
        minHeight: 44,
        justifyContent: "center",
    },
    emptyBtnText: {
        color: T.bgBase,
        fontFamily: T.fontMono,
        fontWeight: "700",
        fontSize: 12,
        letterSpacing: 0.8,
    },
});
