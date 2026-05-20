import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LedgerReceipt } from "@/types/execution";

interface Props {
    receipt: LedgerReceipt;
}

export function LedgerReceiptBadge({ receipt }: Props): React.ReactElement {
    return (
        <View style={styles.box}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>LEDGER VERIFIED</Text>
                <Text style={styles.status}>{receipt.finalized_status}</Text>
            </View>
            <Text style={styles.hash}>sha256: {receipt.verification_hash}</Text>
            <Text style={styles.meta}>
                {receipt.audit_id} · approver {receipt.approver}
            </Text>
            <Text style={styles.meta}>captured {receipt.captured_at}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    box: {
        backgroundColor: "#064e3b",
        borderRadius: 8,
        padding: 10,
        marginHorizontal: 8,
        marginTop: 6,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    title: {
        color: "#a7f3d0",
        fontFamily: "Menlo",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    status: {
        color: "#6ee7b7",
        fontFamily: "Menlo",
        fontSize: 10,
    },
    hash: {
        color: "#d1fae5",
        fontFamily: "Menlo",
        fontSize: 9,
    },
    meta: {
        color: "#6ee7b7",
        fontFamily: "Menlo",
        fontSize: 9,
        marginTop: 2,
    },
});
