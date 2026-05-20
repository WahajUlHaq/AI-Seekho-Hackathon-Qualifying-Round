import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ClientPipelineStatus } from "@/types/pipeline";

const COLORS: Record<ClientPipelineStatus, { bg: string; fg: string; label: string }> = {
    INITIALIZED: { bg: "#1f2937", fg: "#9ca3af", label: "INITIALIZED" },
    PROCESSING: { bg: "#1e3a8a", fg: "#bfdbfe", label: "PROCESSING" },
    HITL_PENDING: { bg: "#78350f", fg: "#fde68a", label: "HITL PENDING" },
    EXECUTING: { bg: "#065f46", fg: "#a7f3d0", label: "EXECUTING" },
    POLLING_COMPLETED: { bg: "#064e3b", fg: "#6ee7b7", label: "COMPLETED" },
    REJECTED: { bg: "#4c1d95", fg: "#ddd6fe", label: "REJECTED" },
    FAILED: { bg: "#7f1d1d", fg: "#fecaca", label: "FAILED" },
};

interface Props {
    status: ClientPipelineStatus;
}

export function StatusBadge({ status }: Props): React.ReactElement {
    const c = COLORS[status];
    return (
        <View style={[styles.pill, { backgroundColor: c.bg }]}>
            <Text style={[styles.text, { color: c.fg }]}>{c.label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        alignSelf: "flex-start",
    },
    text: {
        fontFamily: "Menlo",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
});
