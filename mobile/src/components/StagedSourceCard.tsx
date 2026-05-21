import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StagedSource } from "@/services/IngestionService";
import { T } from "@/lib/theme";

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
            <Pressable onPress={onRemove} style={styles.remove} hitSlop={8}>
                <Text style={styles.removeText}>REMOVE</Text>
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
        alignItems: "center",
        gap: 10,
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDefault,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 6,
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
        color: T.blue,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
    },
    size: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 10,
    },
    name: {
        color: T.tx1,
        fontFamily: T.fontMono,
        fontSize: 11,
        fontWeight: "600",
    },
    id: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        marginTop: 2,
    },
    remove: {
        backgroundColor: T.crimsonDim,
        borderWidth: 1,
        borderColor: T.crimsonBd,
        borderRadius: T.rSm,
        paddingHorizontal: 8,
        paddingVertical: 3,
        minHeight: 44,
        justifyContent: "center",
        alignItems: "center",
    },
    removeText: {
        color: T.crimson,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
});
