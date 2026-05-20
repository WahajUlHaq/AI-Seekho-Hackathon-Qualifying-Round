import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StagedSource } from "@/services/IngestionService";

interface Props {
    source: StagedSource;
    onRemove: () => void;
}

export function StagedSourceCard({ source, onRemove }: Props): React.ReactElement {
    return (
        <View style={styles.card}>
            <View style={styles.body}>
                <View style={styles.headerRow}>
                    <Text style={styles.type}>{source.sourceType.toUpperCase()}</Text>
                    <Text style={styles.size}>{formatBytes(source.sizeBytes)}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                    {source.displayName}
                </Text>
                <Text style={styles.id}>{source.id}</Text>
            </View>
            <Pressable onPress={onRemove} style={styles.remove}>
                <Text style={styles.removeText}>×</Text>
            </Pressable>
        </View>
    );
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const styles = StyleSheet.create({
    card: {
        flexDirection: "row",
        backgroundColor: "#1f2937",
        borderRadius: 8,
        padding: 10,
        marginBottom: 6,
        alignItems: "center",
    },
    body: {
        flex: 1,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 2,
    },
    type: {
        color: "#60a5fa",
        fontFamily: "Menlo",
        fontSize: 10,
        fontWeight: "700",
    },
    size: {
        color: "#6b7280",
        fontFamily: "Menlo",
        fontSize: 10,
    },
    name: {
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontSize: 12,
    },
    id: {
        color: "#6b7280",
        fontFamily: "Menlo",
        fontSize: 10,
        marginTop: 2,
    },
    remove: {
        marginLeft: 8,
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16,
        backgroundColor: "#374151",
    },
    removeText: {
        color: "#e5e7eb",
        fontSize: 18,
        fontWeight: "700",
    },
});
