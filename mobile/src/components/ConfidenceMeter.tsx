import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { T } from "@/lib/theme";

interface Props {
    value: number;
    label?: string;
}

export function ConfidenceMeter({ value, label = "Confidence Meter" }: Props): React.ReactElement {
    const v = Math.max(0, Math.min(100, value));
    const color = v >= 95 ? T.green : v >= 80 ? T.blue : T.amber;
    return (
        <View>
            <View style={styles.row}>
                <Text style={styles.label}>{label}</Text>
                <Text style={[styles.pct, { color }]}>{v}%</Text>
            </View>
            <View style={styles.track}>
                <View
                    style={[
                        styles.fill,
                        { width: `${v}%`, backgroundColor: color },
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    label: {
        fontSize: 11,
        color: T.tx3V2,
        fontWeight: "600",
        letterSpacing: 0.4,
    },
    pct: {
        fontSize: 13,
        fontWeight: "700",
    },
    track: {
        height: 5,
        borderRadius: 99,
        backgroundColor: "rgba(255,255,255,0.06)",
        overflow: "hidden",
    },
    fill: {
        height: "100%",
        borderRadius: 99,
    },
});
