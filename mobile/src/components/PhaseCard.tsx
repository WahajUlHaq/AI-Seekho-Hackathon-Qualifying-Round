import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type PhaseState = "loading" | "filled" | "empty";

interface Props {
    title: string;
    state: PhaseState;
    summary?: string;
    raw?: unknown;
}

export function PhaseCard({ title, state, summary, raw }: Props): React.ReactElement {
    const [expanded, setExpanded] = useState(false);
    const color =
        state === "filled" ? "#34d399" : state === "loading" ? "#fbbf24" : "#6b7280";
    const label =
        state === "filled" ? "READY" : state === "loading" ? "WAITING" : "—";

    return (
        <Pressable
            style={styles.card}
            onPress={() => state === "filled" && setExpanded((v) => !v)}
        >
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <View style={[styles.dot, { backgroundColor: color }]} />
            </View>
            <Text style={[styles.status, { color }]}>{label}</Text>
            {summary ? (
                <Text style={styles.summary} numberOfLines={expanded ? undefined : 2}>
                    {summary}
                </Text>
            ) : null}
            {expanded && raw ? (
                <ScrollView style={styles.rawBox} nestedScrollEnabled>
                    <Text style={styles.raw}>{JSON.stringify(raw, null, 2)}</Text>
                </ScrollView>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#111827",
        borderRadius: 8,
        padding: 10,
        flex: 1,
        minWidth: 0,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 2,
    },
    title: {
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    status: {
        fontFamily: "Menlo",
        fontSize: 10,
        marginBottom: 4,
    },
    summary: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 10,
        lineHeight: 14,
    },
    rawBox: {
        marginTop: 6,
        maxHeight: 160,
        backgroundColor: "#0b0b0f",
        borderRadius: 4,
        padding: 6,
    },
    raw: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 9,
    },
});
