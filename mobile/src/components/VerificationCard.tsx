import React, { useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { FinalizedStatus, LedgerReceipt } from "@/types/execution";
import { T } from "@/lib/theme";
import { usePulse } from "@/lib/animations";

interface StatusColor {
    bd: string;
    pillBg: string;
    pillFg: string;
    glow: string;
}

const STATUS_COLOR: Record<FinalizedStatus, StatusColor> = {
    APPROVED_PASSED: { bd: T.emeraldBd, pillBg: T.emeraldDim, pillFg: T.emerald, glow: T.emerald },
    APPROVED_PARTIAL: { bd: T.amberBd, pillBg: T.amberDim, pillFg: T.amber, glow: T.amber },
    APPROVED_FAILED: { bd: T.crimsonBd, pillBg: T.crimsonDim, pillFg: T.crimson, glow: T.crimson },
    REJECTED: { bd: T.violetBd, pillBg: T.violetDim, pillFg: T.violet, glow: T.violet },
};

interface Props {
    receipt: LedgerReceipt;
}

export function VerificationCard({ receipt }: Props): React.ReactElement {
    const [copied, setCopied] = useState(false);
    const cfg = STATUS_COLOR[receipt.finalized_status];
    const pulse = usePulse(true, 1800);
    const dotOpacity = pulse.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.5, 1, 0.5],
    });

    const copy = async (): Promise<void> => {
        try {
            await Clipboard.setStringAsync(receipt.verification_hash);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // clipboard rarely fails; swallow
        }
    };

    return (
        <View
            style={[
                styles.card,
                {
                    borderColor: cfg.bd,
                    shadowColor: cfg.glow,
                },
            ]}
        >
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <Animated.View style={[styles.verifiedDot, { opacity: dotOpacity }]} />
                    <Text style={styles.heading}>LEDGER VERIFIED</Text>
                </View>
                <View
                    style={[
                        styles.statusPill,
                        { backgroundColor: cfg.pillBg, borderColor: cfg.bd },
                    ]}
                >
                    <Text style={[styles.statusText, { color: cfg.pillFg }]}>
                        {receipt.finalized_status.replace(/_/g, " ")}
                    </Text>
                </View>
            </View>

            <Text style={styles.pipelineId} numberOfLines={1}>
                {receipt.pipeline_id}
            </Text>
            <Text style={styles.auditId} numberOfLines={1}>
                {receipt.audit_id}
            </Text>

            <Text style={styles.hashLabel}>SHA-256 VERIFICATION HASH</Text>
            <View style={styles.hashBox}>
                <Text style={styles.hashText} selectable>
                    {receipt.verification_hash}
                </Text>
            </View>

            <View style={styles.footerRow}>
                <View style={styles.metaCol}>
                    <MetaLine label="approver" value={receipt.approver} />
                    <MetaLine label="signed" value={formatTime(receipt.backend_signed_at)} />
                    <MetaLine label="captured" value={formatTime(receipt.captured_at)} />
                </View>
                <Pressable
                    style={[styles.copyBtn, copied && styles.copyBtnDone]}
                    onPress={copy}
                    hitSlop={6}
                >
                    <Text
                        style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}
                    >
                        {copied ? "✓ COPIED" : "COPY HASH"}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

function MetaLine({ label, value }: { label: string; value: string }): React.ReactElement {
    return (
        <Text style={styles.metaLine} numberOfLines={1}>
            <Text style={styles.metaLabel}>{label} · </Text>
            <Text style={styles.metaValue}>{value}</Text>
        </Text>
    );
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: T.bgSurface,
        borderRadius: T.rLg,
        borderWidth: 1,
        padding: 14,
        marginBottom: 10,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 4,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexShrink: 1,
    },
    verifiedDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: T.emerald,
    },
    heading: {
        color: T.emerald,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: T.rFull,
        borderWidth: 1,
    },
    statusText: {
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    pipelineId: {
        color: T.blue,
        fontFamily: T.fontMono,
        fontSize: 13,
        fontWeight: "700",
        marginTop: 10,
    },
    auditId: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        marginTop: 2,
    },
    hashLabel: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginTop: 12,
        marginBottom: 4,
    },
    hashBox: {
        backgroundColor: T.bgBase,
        borderRadius: T.rSm,
        borderWidth: 1,
        borderColor: T.bdDim,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    hashText: {
        color: T.emerald,
        fontFamily: T.fontMono,
        fontSize: 9,
        lineHeight: 16,
    },
    footerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginTop: 12,
        gap: 10,
    },
    metaCol: {
        flex: 1,
    },
    metaLine: {
        fontFamily: T.fontMono,
        fontSize: 9,
        marginTop: 2,
    },
    metaLabel: {
        color: T.tx3,
    },
    metaValue: {
        color: T.tx2,
    },
    copyBtn: {
        backgroundColor: T.bgElevated,
        borderWidth: 1,
        borderColor: T.bdBright,
        borderRadius: T.rSm,
        paddingHorizontal: 12,
        paddingVertical: 6,
        minHeight: 32,
        justifyContent: "center",
        alignItems: "center",
    },
    copyBtnDone: {
        backgroundColor: T.emerald,
        borderColor: T.emeraldBd,
    },
    copyBtnText: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    copyBtnTextDone: {
        color: T.bgBase,
    },
});
