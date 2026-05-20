import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBadge } from "@/components/StatusBadge";
import { TraceLogList } from "@/components/TraceLogList";
import { PhaseRibbon } from "@/components/PhaseRibbon";
import { HitlApprovalSheet } from "@/components/HitlApprovalSheet";
import { LedgerReceiptBadge } from "@/components/LedgerReceiptBadge";
import type { UseStandalonePipeline } from "@/hooks/useStandalonePipeline";

interface Props {
    pipeline: UseStandalonePipeline;
    operatorHandle: string;
    onBack: () => void;
}

const SSE_LABEL: Record<UseStandalonePipeline["sseStatus"], { color: string; label: string }> = {
    idle: { color: "#6b7280", label: "idle" },
    connecting: { color: "#fbbf24", label: "connecting" },
    open: { color: "#34d399", label: "stream open" },
    reconnecting: { color: "#fb923c", label: "reconnecting" },
    polling: { color: "#60a5fa", label: "polling" },
    ended: { color: "#9ca3af", label: "stream ended" },
    error: { color: "#f87171", label: "error" },
};

export function OperationalMonitorScreen({
    pipeline,
    operatorHandle,
    onBack,
}: Props): React.ReactElement {
    const sse = SSE_LABEL[pipeline.sseStatus];
    const showHitl = pipeline.derivedStatus === "HITL_PENDING" && pipeline.approval !== null;
    const phaseActive =
        pipeline.derivedStatus === "EXECUTING" ||
        pipeline.derivedStatus === "POLLING_COMPLETED";

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <StatusBadge status={pipeline.derivedStatus} />
                    <Text style={styles.pipelineId} numberOfLines={1}>
                        {pipeline.pipelineId ?? "(no pipeline)"}
                    </Text>
                </View>
                <Pressable style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </Pressable>
            </View>

            <View style={styles.sseRow}>
                <View style={[styles.sseDot, { backgroundColor: sse.color }]} />
                <Text style={styles.sseLabel}>{sse.label}</Text>
                {pipeline.events.length > 0 && (
                    <Text style={styles.sseCount}>· {pipeline.events.length} events</Text>
                )}
                {pipeline.lastError ? (
                    <Text style={styles.lastError} numberOfLines={1}>
                        · {pipeline.lastError.message}
                    </Text>
                ) : null}
            </View>

            {pipeline.ledgerReceipt ? (
                <LedgerReceiptBadge receipt={pipeline.ledgerReceipt} />
            ) : null}

            <TraceLogList events={pipeline.events} />

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
        backgroundColor: "#0b0b0f",
        paddingTop: 36,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingBottom: 6,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
    },
    pipelineId: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 11,
        flexShrink: 1,
    },
    backBtn: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: "#1f2937",
        borderRadius: 6,
    },
    backBtnText: {
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontSize: 11,
    },
    sseRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingBottom: 6,
        gap: 6,
    },
    sseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    sseLabel: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 10,
    },
    sseCount: {
        color: "#6b7280",
        fontFamily: "Menlo",
        fontSize: 10,
    },
    lastError: {
        color: "#f87171",
        fontFamily: "Menlo",
        fontSize: 10,
        flexShrink: 1,
    },
});
