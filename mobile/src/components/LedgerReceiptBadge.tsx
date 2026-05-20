import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import type { LedgerReceipt } from "@/types/execution";
import { T } from "@/lib/theme";
import { usePulse } from "@/lib/animations";

interface Props {
    receipt: LedgerReceipt;
}

export function LedgerReceiptBadge({ receipt }: Props): React.ReactElement {
    const pulse = usePulse(true, 2000);
    const dotOpacity = pulse.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.5, 1, 0.5],
    });

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.pulseDot, { opacity: dotOpacity }]} />
            <View style={styles.textCol}>
                <Text style={styles.title} numberOfLines={1}>
                    LEDGER VERIFIED · {receipt.finalized_status}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                    {receipt.audit_id} · {receipt.verification_hash.slice(0, 24)}…
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: T.emeraldDim,
        borderWidth: 1,
        borderColor: T.emeraldBd,
        borderRadius: T.rMd,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginHorizontal: 12,
        marginBottom: 6,
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: T.emerald,
    },
    textCol: {
        flex: 1,
    },
    title: {
        color: T.emerald,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    sub: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        marginTop: 2,
    },
});
