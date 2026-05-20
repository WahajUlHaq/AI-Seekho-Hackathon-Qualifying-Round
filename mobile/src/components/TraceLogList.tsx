import React, { useMemo } from "react";
import { FlatList, StyleSheet, Text, View, type ListRenderItem } from "react-native";
import type { TraceEvent, TraceEventType } from "@/types/pipeline";

const ICONS: Record<TraceEventType, string> = {
    agent_start: "▶",
    agent_complete: "✓",
    llm_call: "✦",
    contract_gate: "▣",
    action_execute: "→",
    failure: "✗",
    ingestion_error: "✗",
    recovery: "↺",
    decision: "?",
    action_start: "▷",
    action_complete: "✔",
    graph_cycle_detected: "◌",
    hitl_pending: "⏸",
    hitl_approved: "✓",
    hitl_rejected: "✗",
    thinking: "…",
};

const COLORS: Record<TraceEventType, string> = {
    agent_start: "#60a5fa",
    agent_complete: "#34d399",
    llm_call: "#c084fc",
    contract_gate: "#a78bfa",
    action_execute: "#fbbf24",
    failure: "#f87171",
    ingestion_error: "#f87171",
    recovery: "#fb923c",
    decision: "#e5e7eb",
    action_start: "#fbbf24",
    action_complete: "#34d399",
    graph_cycle_detected: "#fb923c",
    hitl_pending: "#facc15",
    hitl_approved: "#34d399",
    hitl_rejected: "#a78bfa",
    thinking: "#9ca3af",
};

interface Props {
    events: readonly TraceEvent[];
}

export function TraceLogList({ events }: Props): React.ReactElement {
    const reversed = useMemo(() => [...events].reverse(), [events]);

    const renderItem: ListRenderItem<TraceEvent> = ({ item }) => (
        <View style={styles.row}>
            <Text style={[styles.icon, { color: COLORS[item.event_type] }]}>{ICONS[item.event_type]}</Text>
            <View style={styles.body}>
                <Text style={styles.metaLine}>
                    <Text style={[styles.eventType, { color: COLORS[item.event_type] }]}>{item.event_type}</Text>
                    <Text style={styles.meta}>  ·  {item.agent}  ·  {formatTime(item.timestamp)}</Text>
                </Text>
                <Text style={styles.message} numberOfLines={3}>
                    {item.message}
                </Text>
            </View>
        </View>
    );

    if (events.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>Waiting for trace events…</Text>
            </View>
        );
    }

    return (
        <FlatList
            data={reversed}
            keyExtractor={(e) => e.event_id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            removeClippedSubviews
            windowSize={10}
            initialNumToRender={20}
        />
    );
}

function formatTime(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString();
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    list: {
        flex: 1,
        backgroundColor: "#0b0b0f",
    },
    listContent: {
        padding: 12,
    },
    row: {
        flexDirection: "row",
        marginBottom: 10,
        gap: 10,
    },
    icon: {
        width: 18,
        fontFamily: "Menlo",
        fontSize: 14,
        marginTop: 2,
    },
    body: {
        flex: 1,
    },
    metaLine: {
        fontFamily: "Menlo",
        fontSize: 11,
        marginBottom: 2,
    },
    eventType: {
        fontWeight: "700",
    },
    meta: {
        color: "#6b7280",
    },
    message: {
        fontFamily: "Menlo",
        fontSize: 12,
        color: "#e5e7eb",
        lineHeight: 17,
    },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0b0b0f",
    },
    emptyText: {
        color: "#6b7280",
        fontFamily: "Menlo",
        fontSize: 12,
    },
});
