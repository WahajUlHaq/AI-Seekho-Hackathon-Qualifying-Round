import React, { useMemo } from "react";
import {
    Animated,
    FlatList,
    StyleSheet,
    Text,
    View,
    type ListRenderItem,
} from "react-native";
import { OperationCard } from "./OperationCard";
import type { TraceEvent } from "@/types/pipeline";
import { T } from "@/lib/theme";
import { useSlideIn } from "@/lib/animations";

interface Props {
    events: readonly TraceEvent[];
}

export function OperationFeed({ events }: Props): React.ReactElement {
    const reversed = useMemo(() => [...events].reverse(), [events]);

    const renderItem: ListRenderItem<TraceEvent> = ({ item, index }) =>
        index === 0 ? <NewestCard event={item} /> : <OperationCard event={item} />;

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
            data={reversed}
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

function NewestCard({ event }: { event: TraceEvent }): React.ReactElement {
    const { translateY, opacity } = useSlideIn(true);
    return (
        <Animated.View style={{ transform: [{ translateY }], opacity }}>
            <OperationCard event={event} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    list: {
        flex: 1,
        backgroundColor: T.bgBase,
    },
    listContent: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    emptyWrapper: {
        flex: 1,
        backgroundColor: T.bgBase,
    },
    emptyBox: {
        margin: 12,
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDim,
        padding: 16,
    },
    emptyText: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 11,
        textAlign: "center",
    },
});
