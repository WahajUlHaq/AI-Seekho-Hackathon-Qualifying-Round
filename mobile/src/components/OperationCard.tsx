import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TraceEvent, TraceEventType } from "@/types/pipeline";
import { PillBadge } from "./PillBadge";
import { T } from "@/lib/theme";

interface Cfg {
    color: string;
    bg: string;
    bd: string;
}

const COLORS: Record<TraceEventType, Cfg> = {
    agent_start: { color: T.blue, bg: T.blueDim, bd: T.blueBd },
    agent_complete: { color: T.green, bg: T.greenDim, bd: T.greenBd },
    llm_call: { color: T.violet, bg: T.violetDim, bd: T.violetBd },
    contract_gate: { color: T.green, bg: T.greenDim, bd: T.greenBd },
    action_start: { color: T.blue, bg: T.blueDim, bd: T.blueBd },
    action_complete: { color: T.green, bg: T.greenDim, bd: T.greenBd },
    action_execute: { color: T.teal, bg: T.tealDim, bd: T.tealBd },
    decision: { color: T.amber, bg: T.amberDim, bd: T.amberBd },
    hitl_pending: { color: T.amber, bg: T.amberDim, bd: T.amberBd },
    hitl_approved: { color: T.green, bg: T.greenDim, bd: T.greenBd },
    hitl_rejected: { color: T.crimson, bg: T.crimsonDim, bd: T.crimsonBd },
    thinking: { color: T.violet, bg: T.violetDim, bd: T.violetBd },
    failure: { color: T.crimson, bg: T.crimsonDim, bd: T.crimsonBd },
    ingestion_error: { color: T.crimson, bg: T.crimsonDim, bd: T.crimsonBd },
    recovery: { color: T.amber, bg: T.amberDim, bd: T.amberBd },
    graph_cycle_detected: { color: T.crimson, bg: T.crimsonDim, bd: T.crimsonBd },
};

interface Props {
    event: TraceEvent;
    isLatest?: boolean;
}

export function OperationCard({ event, isLatest = false }: Props): React.ReactElement {
    const cfg = COLORS[event.event_type];
    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: isLatest ? T.bgElevatedV2 : T.bgSurfaceV2,
                    borderColor: isLatest ? T.tealBd : T.bdDimV2,
                },
            ]}
        >
            <View style={styles.row}>
                <View
                    style={[
                        styles.playDot,
                        {
                            backgroundColor: isLatest ? T.tealDim : cfg.bg,
                            borderColor: isLatest ? T.teal : cfg.color,
                        },
                    ]}
                >
                    <Text style={[styles.playGlyph, { color: isLatest ? T.teal : cfg.color }]}>▶</Text>
                </View>
                <View style={styles.body}>
                    <View style={styles.headerRow}>
                        <Text style={styles.agent} numberOfLines={1}>
                            {event.agent}
                        </Text>
                        <Text style={styles.timestamp}>{formatTime(event.timestamp)}</Text>
                    </View>

                    <View style={styles.pillRow}>
                        <PillBadge
                            label={event.event_type}
                            color={cfg.color}
                            bg={cfg.bg}
                            border={cfg.bd}
                        />
                        {isLatest ? (
                            <PillBadge label="LIVE" color={T.crimson} dot />
                        ) : null}
                    </View>

                    <Text style={styles.message} numberOfLines={4}>
                        {event.message}
                    </Text>

                    {hasMeta(event) ? <MetaRow event={event} /> : null}
                </View>
            </View>
        </View>
    );
}

function hasMeta(e: TraceEvent): boolean {
    return (
        e.decision !== undefined ||
        e.confidence !== undefined ||
        e.latency_ms !== undefined ||
        e.provider !== undefined
    );
}

function MetaRow({ event }: { event: TraceEvent }): React.ReactElement {
    return (
        <View style={styles.metaRow}>
            {event.decision !== undefined ? <MetaPill label="decision" value={event.decision} /> : null}
            {event.confidence !== undefined ? (
                <MetaPill label="conf" value={event.confidence.toFixed(2)} />
            ) : null}
            {event.latency_ms !== undefined ? (
                <MetaPill label="lat" value={`${event.latency_ms}ms`} />
            ) : null}
            {event.provider !== undefined ? <MetaPill label="provider" value={event.provider} /> : null}
        </View>
    );
}

function MetaPill({ label, value }: { label: string; value: string }): React.ReactElement {
    return (
        <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
                {value}
            </Text>
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
        borderRadius: T.rLg,
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    row: {
        flexDirection: "row",
        gap: 12,
    },
    playDot: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
    },
    playGlyph: {
        fontSize: 11,
        fontWeight: "700",
    },
    body: {
        flex: 1,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 6,
        marginBottom: 6,
    },
    agent: {
        flex: 1,
        color: T.tx1V2,
        fontSize: 14,
        fontWeight: "700",
    },
    timestamp: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 10,
    },
    pillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 6,
    },
    message: {
        color: T.tx2V2,
        fontSize: 12.5,
        lineHeight: 18,
    },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 8,
    },
    metaPill: {
        flexDirection: "row",
        gap: 4,
        backgroundColor: T.bgBaseV2,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        borderRadius: T.rSm,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    metaLabel: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 9,
    },
    metaValue: {
        color: T.tx2V2,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "600",
    },
});
