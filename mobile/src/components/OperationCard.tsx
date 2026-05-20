import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TraceEvent, TraceEventType } from "@/types/pipeline";
import { T } from "@/lib/theme";

const ICONS: Record<TraceEventType, string> = {
    agent_start: "▶",
    agent_complete: "✓",
    llm_call: "◈",
    contract_gate: "⬡",
    action_execute: "→",
    failure: "✗",
    ingestion_error: "✗",
    recovery: "↺",
    decision: "◆",
    action_start: "▷",
    action_complete: "✔",
    graph_cycle_detected: "⊙",
    hitl_pending: "⏸",
    hitl_approved: "✓",
    hitl_rejected: "✕",
    thinking: "⋯",
};

interface EventCfg {
    color: string;
    bg: string;
}

const COLORS: Record<TraceEventType, EventCfg> = {
    agent_start: { color: T.blue, bg: T.blueDim },
    agent_complete: { color: T.emerald, bg: T.emeraldDim },
    llm_call: { color: T.violet, bg: T.violetDim },
    contract_gate: { color: T.blue, bg: T.blueDim },
    action_execute: { color: T.amber, bg: T.amberDim },
    failure: { color: T.crimson, bg: T.crimsonDim },
    ingestion_error: { color: T.crimson, bg: T.crimsonDim },
    recovery: { color: T.orange, bg: T.orangeDim },
    decision: { color: T.amber, bg: T.amberDim },
    action_start: { color: T.amber, bg: T.amberDim },
    action_complete: { color: T.emerald, bg: T.emeraldDim },
    graph_cycle_detected: { color: T.orange, bg: T.orangeDim },
    hitl_pending: { color: T.amber, bg: T.amberDim },
    hitl_approved: { color: T.emerald, bg: T.emeraldDim },
    hitl_rejected: { color: T.violet, bg: T.violetDim },
    thinking: { color: T.tx3, bg: T.slateDim },
};

interface Props {
    event: TraceEvent;
}

export function OperationCard({ event }: Props): React.ReactElement {
    const cfg = COLORS[event.event_type];
    const icon = ICONS[event.event_type];

    const hasMeta =
        event.decision !== undefined ||
        event.confidence !== undefined ||
        event.latency_ms !== undefined ||
        event.provider !== undefined;

    return (
        <View style={styles.card}>
            <View style={[styles.stripe, { backgroundColor: cfg.color }]} />
            <View style={styles.iconCol}>
                <View
                    style={[
                        styles.iconCircle,
                        { backgroundColor: cfg.bg, borderColor: cfg.color },
                    ]}
                >
                    <Text style={[styles.iconText, { color: cfg.color }]}>{icon}</Text>
                </View>
            </View>
            <View style={styles.body}>
                <View style={styles.headerRow}>
                    <Text style={styles.agent} numberOfLines={1}>
                        {event.agent}
                    </Text>
                    <Text style={styles.timestamp}>{formatTime(event.timestamp)}</Text>
                </View>
                <View
                    style={[
                        styles.typeTag,
                        { backgroundColor: cfg.bg, borderColor: cfg.color },
                    ]}
                >
                    <Text style={[styles.typeTagText, { color: cfg.color }]}>
                        {event.event_type}
                    </Text>
                </View>
                <Text style={styles.message} numberOfLines={4}>
                    {event.message}
                </Text>
                {hasMeta ? (
                    <View style={styles.metaRow}>
                        {event.decision !== undefined ? (
                            <MetaPill label="decision" value={event.decision} />
                        ) : null}
                        {event.confidence !== undefined ? (
                            <MetaPill label="conf" value={event.confidence.toFixed(2)} />
                        ) : null}
                        {event.latency_ms !== undefined ? (
                            <MetaPill label="latency" value={`${event.latency_ms} ms`} />
                        ) : null}
                        {event.provider !== undefined ? (
                            <MetaPill label="provider" value={event.provider} />
                        ) : null}
                    </View>
                ) : null}
            </View>
        </View>
    );
}

function MetaPill({ label, value }: { label: string; value: string }): React.ReactElement {
    return (
        <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={styles.metaValue}>{value}</Text>
        </View>
    );
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString();
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    card: {
        flexDirection: "row",
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDim,
        marginBottom: 8,
        overflow: "hidden",
        ...T.shadowCard,
    },
    stripe: {
        width: 4,
    },
    iconCol: {
        width: 36,
        alignItems: "center",
        paddingTop: 11,
    },
    iconCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    iconText: {
        fontFamily: T.fontMono,
        fontSize: 12,
        lineHeight: 14,
    },
    body: {
        flex: 1,
        paddingTop: 10,
        paddingRight: 10,
        paddingBottom: 10,
        paddingLeft: 4,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 6,
    },
    agent: {
        flex: 1,
        color: T.tx1,
        fontFamily: T.fontMono,
        fontSize: 12,
        fontWeight: "700",
    },
    timestamp: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
    },
    typeTag: {
        alignSelf: "flex-start",
        borderWidth: 1,
        borderRadius: T.rSm,
        paddingHorizontal: 7,
        paddingVertical: 1,
        marginTop: 3,
        marginBottom: 6,
    },
    typeTagText: {
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    message: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 11,
        lineHeight: 17,
    },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 6,
    },
    metaPill: {
        flexDirection: "row",
        gap: 4,
        backgroundColor: T.bgElevated,
        borderWidth: 1,
        borderColor: T.bdDim,
        borderRadius: T.rSm,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    metaLabel: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
    },
    metaValue: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "600",
    },
});
