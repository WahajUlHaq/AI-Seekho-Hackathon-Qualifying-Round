import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ConfigError } from "@/config/api";
import { T } from "@/lib/theme";

interface Props {
    errors: readonly ConfigError[];
}

export function CriticalConfigScreen({ errors }: Props): React.ReactElement {
    return (
        <View style={styles.root}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.bannerRow}>
                    <Text style={styles.bannerIcon}>⚠</Text>
                    <Text style={styles.eyebrow}>CRITICAL CONFIGURATION ERROR</Text>
                </View>
                <Text style={styles.title}>App cannot start</Text>
                <Text style={styles.subtitle}>
                    The following required configuration values are missing or invalid. Fix{" "}
                    <Text style={styles.code}>mobile/.env</Text> and restart with{" "}
                    <Text style={styles.code}>npx expo start -c</Text>.
                </Text>
                {errors.map((e) => (
                    <View key={e.field} style={styles.card}>
                        <Text style={styles.field}>{e.field}</Text>
                        <Text style={styles.label}>EXPECTED</Text>
                        <Text style={styles.value}>{e.expected}</Text>
                        <Text style={styles.label}>HINT</Text>
                        <Text style={styles.value}>{e.hint}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bgBase },
    content: {
        padding: 20,
        paddingTop: 60,
    },
    bannerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    bannerIcon: {
        color: T.crimson,
        fontSize: 18,
        fontWeight: "700",
    },
    eyebrow: {
        color: T.crimson,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1.0,
    },
    title: {
        color: T.tx1,
        fontSize: 24,
        fontWeight: "700",
        marginTop: 6,
        marginBottom: 12,
    },
    subtitle: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 11,
        lineHeight: 17,
        marginBottom: 20,
    },
    code: {
        color: T.amber,
    },
    card: {
        backgroundColor: T.crimsonDim,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.crimsonBd,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    field: {
        color: T.crimson,
        fontFamily: T.fontMono,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.4,
        marginBottom: 8,
    },
    label: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginTop: 6,
    },
    value: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 10,
        lineHeight: 15,
        marginTop: 2,
    },
});
