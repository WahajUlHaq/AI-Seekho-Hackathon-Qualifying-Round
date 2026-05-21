import React, { useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { FinalizedStatus, LedgerReceipt } from "@/types/execution";
import { PillBadge } from "./PillBadge";
import { GradientBorderCard } from "./GradientBorderCard";
import { T } from "@/lib/theme";
import { usePulse } from "@/lib/animations";

interface StatusColor {
    pillColor: string;
    pillBg: string;
    pillBd: string;
    gradient: readonly [string, string];
}

const STATUS_COLOR: Record<FinalizedStatus, StatusColor> = {
    APPROVED_PASSED: {
        pillColor: T.green,
        pillBg: T.greenDim,
        pillBd: T.greenBd,
        gradient: ["#18c864", "#0ea855"] as const,
    },
    APPROVED_PARTIAL: {
        pillColor: T.amber,
        pillBg: T.amberDim,
        pillBd: T.amberBd,
        gradient: ["#f0a020", "#a06010"] as const,
    },
    APPROVED_FAILED: {
        pillColor: T.crimson,
        pillBg: T.crimsonDim,
        pillBd: T.crimsonBd,
        gradient: ["#e83040", "#b02030"] as const,
    },
    REJECTED: {
        pillColor: T.violet,
        pillBg: T.violetDim,
        pillBd: T.violetBd,
        gradient: ["#9060f0", "#5030a0"] as const,
    },
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
        <GradientBorderCard
            colors={cfg.gradient}
            radius={T.rLg}
            thickness={1}
            style={styles.outer}
            innerStyle={styles.inner}
        >
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <Animated.View style={[styles.verifiedDot, { opacity: dotOpacity }]} />
                    <Text style={styles.heading}>LEDGER VERIFIED</Text>
                </View>
                <PillBadge
                    label={receipt.finalized_status.replace(/_/g, " ")}
                    color={cfg.pillColor}
                    bg={cfg.pillBg}
                    border={cfg.pillBd}
                />
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
                    <Text style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}>
                        {copied ? "✓ COPIED" : "COPY HASH"}
                    </Text>
                </Pressable>
            </View>
        </GradientBorderCard>
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
    outer: {
        marginBottom: 10,
    },
    inner: {
        backgroundColor: T.bgSurfaceV2,
        padding: 14,
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
        backgroundColor: T.teal,
    },
    heading: {
        color: T.teal,
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.6,
    },
    pipelineId: {
        color: T.tx1V2,
        fontSize: 16,
        fontWeight: "800",
        marginTop: 12,
    },
    auditId: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 10,
        marginTop: 2,
    },
    hashLabel: {
        color: T.tx3V2,
        fontSize: 10,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginTop: 12,
        marginBottom: 4,
    },
    hashBox: {
        backgroundColor: T.bgInput,
        borderRadius: T.rSm,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    hashText: {
        color: T.teal,
        fontFamily: T.fontMono,
        fontSize: 10,
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
        color: T.tx3V2,
    },
    metaValue: {
        color: T.tx2V2,
    },
    copyBtn: {
        backgroundColor: T.bgElevatedV2,
        borderWidth: 1,
        borderColor: T.bdBrightV2,
        borderRadius: T.rSm,
        paddingHorizontal: 12,
        paddingVertical: 6,
        minHeight: 32,
        justifyContent: "center",
        alignItems: "center",
    },
    copyBtnDone: {
        backgroundColor: T.teal,
        borderColor: T.tealBd,
    },
    copyBtnText: {
        color: T.tx2V2,
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.6,
    },
    copyBtnTextDone: {
        color: T.bgBaseV2,
    },
});
