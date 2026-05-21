import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import type { ClientPipelineStatus } from "@/types/pipeline";
import { T } from "@/lib/theme";
import { usePulse } from "@/lib/animations";

interface StatusConfig {
    color: string;
    dim: string;
    bd: string;
    icon: string;
    label: string;
    pulse?: boolean;
}

const STATUS_CFG: Record<ClientPipelineStatus, StatusConfig> = {
    INITIALIZED: { color: T.slate, dim: T.slateDim, bd: T.slateBd, icon: "○", label: "INITIALIZED" },
    PROCESSING: { color: T.blue, dim: T.blueDim, bd: T.blueBd, icon: "◉", label: "PROCESSING", pulse: true },
    HITL_PENDING: { color: T.amber, dim: T.amberDim, bd: T.amberBd, icon: "⏸", label: "HITL PENDING", pulse: true },
    EXECUTING: { color: T.emerald, dim: T.emeraldDim, bd: T.emeraldBd, icon: "▶", label: "EXECUTING", pulse: true },
    POLLING_COMPLETED: { color: T.emerald, dim: T.emeraldDim, bd: T.emeraldBd, icon: "✓", label: "COMPLETED" },
    REJECTED: { color: T.violet, dim: T.violetDim, bd: T.violetBd, icon: "✕", label: "REJECTED" },
    FAILED: { color: T.crimson, dim: T.crimsonDim, bd: T.crimsonBd, icon: "✗", label: "FAILED" },
};

interface Props {
    status: ClientPipelineStatus;
}

export function StatusBadge({ status }: Props): React.ReactElement {
    const cfg = STATUS_CFG[status];
    const pulseAnim = usePulse(Boolean(cfg.pulse), 1400);
    const opacity = cfg.pulse
        ? pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.6, 1] })
        : 1;

    return (
        <Animated.View
            style={[
                styles.pill,
                { backgroundColor: cfg.dim, borderColor: cfg.bd, opacity },
            ]}
        >
            <Text style={[styles.icon, { color: cfg.color }]}>{cfg.icon}</Text>
            <Text style={[styles.text, { color: cfg.color }]}>{cfg.label}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: T.rFull,
        borderWidth: 1,
        alignSelf: "flex-start",
    },
    icon: {
        fontFamily: T.fontMono,
        fontSize: 10,
    },
    text: {
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
});
