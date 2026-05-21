import React from "react";
import { FlatList, StyleSheet, Text, View, type ListRenderItem } from "react-native";
import { OperationCard } from "./OperationCard";
import type { TraceEvent } from "@/types/pipeline";
import { T } from "@/lib/theme";

interface Props {
    events: readonly TraceEvent[];
}

export function OperationFeed({ events }: Props): React.ReactElement {
    const lastIndex = events.length - 1;

    const renderItem: ListRenderItem<TraceEvent> = ({ item, index }) => (
        <OperationCard event={item} isLatest={index === lastIndex} />
    );

    if (events.length === 0) {
        return (
            <View style={styles.emptyWrapper}>
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Waiting for operations…</Text>
                </View>
            </View>
        );
    }

    return (
        <FlatList
            data={events as TraceEvent[]}
            keyExtractor={(e) => e.event_id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            removeClippedSubviews
            windowSize={10}
            initialNumToRender={15}
        />
    );
}

const styles = StyleSheet.create({
    list: {
        flex: 1,
        backgroundColor: T.bgBaseV2,
    },
    listContent: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    emptyWrapper: {
        flex: 1,
        backgroundColor: T.bgBaseV2,
    },
    emptyBox: {
        margin: 12,
        backgroundColor: T.bgSurfaceV2,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        padding: 16,
    },
    emptyText: {
        color: T.tx3V2,
        fontSize: 11,
        textAlign: "center",
    },
});
