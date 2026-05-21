import React, { useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { T } from "@/lib/theme";
import { useShimmer } from "@/lib/animations";

type PhaseState = "loading" | "filled" | "empty";

interface Props {
    title: string;
    state: PhaseState;
    summary?: string;
    raw?: unknown;
    /** Optional status value used to choose the filled-state accent color. */
    statusKey?: string;
}

const PHASE_ICON: Record<string, string> = {
    Chain: "⛓",
    Recovery: "↺",
    Outcome: "◈",
    Audit: "⬡",
};

function statusColor(statusKey: string | undefined): string {
    switch (statusKey) {
        case "SUCCESS":
        case "APPROVED_PASSED":
            return T.emerald;
        case "PARTIAL_SUCCESS":
        case "APPROVED_PARTIAL":
            return T.amber;
        case "FAILED":
        case "APPROVED_FAILED":
            return T.crimson;
        case "REJECTED":
            return T.violet;
        default:
            return T.emerald;
    }
}

export function PhaseCard({ title, state, summary, raw, statusKey }: Props): React.ReactElement {
    const [expanded, setExpanded] = useState(false);
    const fillColor = statusColor(statusKey);
    const cfgColor =
        state === "filled" ? fillColor : state === "loading" ? T.amber : T.tx3;
    const label = state === "filled" ? "READY" : state === "loading" ? "WAIT" : "—";
    const icon = PHASE_ICON[title] ?? "";

    const borderColor =
        state === "filled" ? `${fillColor}55` : T.bdDim;

    return (
        <Pressable
            style={[styles.card, { borderColor }]}
            onPress={() => state === "filled" && setExpanded((v) => !v)}
        >
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Text style={[styles.phaseIcon, { color: cfgColor }]}>{icon}</Text>
                    <Text
                        style={[
                            styles.title,
                            { color: state === "filled" ? cfgColor : T.tx3 },
                        ]}
                    >
                        {title}
                    </Text>
                </View>
                {state === "loading" ? null : (
                    <View style={[styles.dot, { backgroundColor: cfgColor }]} />
                )}
            </View>

            {state === "loading" ? (
                <View style={styles.shimmerCol}>
                    <ShimmerBar />
                    <ShimmerBar narrow />
                </View>
            ) : null}

            {state === "loading" ? (
                <BlinkLabel color={T.amber} text={label} />
            ) : (
                <Text style={[styles.status, { color: cfgColor }]}>{label}</Text>
            )}

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

function ShimmerBar({ narrow }: { narrow?: boolean }): React.ReactElement {
    const anim = useShimmer(1400);
    const opacity = anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.25, 0.65, 0.25],
    });
    return (
        <Animated.View
            style={[
                styles.shimmerBar,
                narrow && styles.shimmerBarNarrow,
                { opacity },
            ]}
        />
    );
}

function BlinkLabel({ color, text }: { color: string; text: string }): React.ReactElement {
    const anim = useShimmer(900);
    const opacity = anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.45, 1, 0.45],
    });
    return (
        <Animated.Text style={[styles.status, { color, opacity }]}>{text}</Animated.Text>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        padding: 8,
        flex: 1,
        minWidth: 0,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        flexShrink: 1,
    },
    phaseIcon: {
        fontFamily: T.fontMono,
        fontSize: 10,
    },
    title: {
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.6,
        flexShrink: 1,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    shimmerCol: {
        gap: 4,
        marginVertical: 4,
    },
    shimmerBar: {
        height: 6,
        borderRadius: 3,
        backgroundColor: T.bgElevated,
    },
    shimmerBarNarrow: {
        width: "60%",
    },
    status: {
        fontFamily: T.fontMono,
        fontSize: 9,
        marginBottom: 4,
    },
    summary: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 9,
        lineHeight: 14,
    },
    rawBox: {
        marginTop: 6,
        maxHeight: 160,
        backgroundColor: T.bgBase,
        borderRadius: T.rSm,
        padding: 6,
    },
    raw: {
        color: T.emerald,
        fontFamily: T.fontMono,
        fontSize: 9,
    },
});
