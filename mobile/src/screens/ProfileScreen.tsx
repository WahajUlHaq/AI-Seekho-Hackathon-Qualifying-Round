import React, { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePipelineContext } from "@/context/PipelineContext";
import { T } from "@/lib/theme";

interface Props {
    operatorHandle: string;
}

interface SettingsRow {
    label: string;
    icon: string;
    danger?: boolean;
    onPress: () => void;
}

export function ProfileScreen({ operatorHandle }: Props): React.ReactElement {
    const pipeline = usePipelineContext();

    const stats = useMemo(() => {
        const total = pipeline.ledgerReceipts.length;
        let approved = 0;
        let rejected = 0;
        for (const r of pipeline.ledgerReceipts) {
            if (r.finalized_status.startsWith("APPROVED")) approved += 1;
            else if (r.finalized_status === "REJECTED") rejected += 1;
        }
        return { total, approved, rejected };
    }, [pipeline.ledgerReceipts]);

    const initial = (operatorHandle || "?").charAt(0).toUpperCase();

    const comingSoon = (label: string) => () =>
        Alert.alert(label, "This setting will be available in a future build.");

    const rows: SettingsRow[] = [
        { label: "Notification Preferences", icon: "🔔", onPress: comingSoon("Notifications") },
        { label: "Security & Biometrics", icon: "🛡", onPress: comingSoon("Security") },
        { label: "API Configuration", icon: "⚙", onPress: comingSoon("API") },
        { label: "Export Data", icon: "↓", onPress: comingSoon("Export") },
        {
            label: "Sign Out",
            icon: "⎋",
            danger: true,
            onPress: () => {
                Alert.alert(
                    "Sign out?",
                    "This clears the active pipeline. Operator credentials remain provisioned.",
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Sign Out",
                            style: "destructive",
                            onPress: () => pipeline.reset(),
                        },
                    ],
                );
            },
        },
    ];

    return (
        <SafeAreaView edges={["top"]} style={styles.safe}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* ── Identity header ──── */}
                <View style={styles.identity}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initial}</Text>
                    </View>
                    <Text style={styles.name}>Operator</Text>
                    <Text style={styles.handle} numberOfLines={1}>
                        {operatorHandle}
                    </Text>
                </View>

                {/* ── Stats ──── */}
                <View style={styles.statsRow}>
                    <StatCol value={stats.total} label="Pipelines" color={T.teal} />
                    <View style={styles.statDivider} />
                    <StatCol value={stats.approved} label="Approved" color={T.green} />
                    <View style={styles.statDivider} />
                    <StatCol value={stats.rejected} label="Rejected" color={T.crimson} />
                </View>

                {/* ── Settings list ──── */}
                <Text style={styles.sectionEyebrow}>SETTINGS</Text>
                <View style={styles.settingsCard}>
                    {rows.map((row, idx) => (
                        <Pressable
                            key={row.label}
                            onPress={row.onPress}
                            style={[
                                styles.settingRow,
                                idx < rows.length - 1 && styles.settingRowDivider,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.settingIcon,
                                    row.danger && { color: T.crimson },
                                ]}
                            >
                                {row.icon}
                            </Text>
                            <Text
                                style={[
                                    styles.settingLabel,
                                    row.danger && { color: T.crimson },
                                ]}
                            >
                                {row.label}
                            </Text>
                            <Text
                                style={[
                                    styles.settingArrow,
                                    row.danger && { color: T.crimson },
                                ]}
                            >
                                ›
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.footerText}>ChainFlow · build 2026.05</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

function StatCol({
    value,
    label,
    color,
}: {
    value: number;
    label: string;
    color: string;
}): React.ReactElement {
    return (
        <View style={styles.statCol}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: T.bgBaseV2 },
    scrollContent: { paddingHorizontal: 18, paddingBottom: 36 },

    // ── Identity ──
    identity: {
        alignItems: "center",
        paddingTop: 24,
        paddingBottom: 14,
    },
    avatar: {
        width: 78,
        height: 78,
        borderRadius: 39,
        backgroundColor: T.tealDim,
        borderWidth: 1.5,
        borderColor: T.tealBd,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    avatarText: {
        color: T.teal,
        fontSize: 32,
        fontWeight: "800",
    },
    name: {
        color: T.tx1V2,
        fontSize: 18,
        fontWeight: "800",
    },
    handle: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 12,
        marginTop: 4,
    },

    // ── Stats ──
    statsRow: {
        flexDirection: "row",
        backgroundColor: T.bgSurfaceV2,
        borderRadius: T.rLg,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        paddingVertical: 16,
        marginBottom: 22,
    },
    statCol: {
        flex: 1,
        alignItems: "center",
    },
    statDivider: {
        width: 1,
        backgroundColor: T.bdDimV2,
    },
    statValue: {
        fontSize: 22,
        fontWeight: "800",
    },
    statLabel: {
        color: T.tx3V2,
        fontSize: 10.5,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginTop: 4,
    },

    // ── Settings ──
    sectionEyebrow: {
        color: T.tx3V2,
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 10,
    },
    settingsCard: {
        backgroundColor: T.bgSurfaceV2,
        borderRadius: T.rLg,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        overflow: "hidden",
    },
    settingRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 52,
    },
    settingRowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: T.bdDimV2,
    },
    settingIcon: {
        fontSize: 16,
        color: T.tx2V2,
        marginRight: 12,
        width: 22,
        textAlign: "center",
    },
    settingLabel: {
        flex: 1,
        color: T.tx1V2,
        fontSize: 13,
        fontWeight: "600",
    },
    settingArrow: {
        color: T.tx3V2,
        fontSize: 18,
        fontWeight: "700",
    },

    footerText: {
        color: T.tx3V2,
        fontSize: 10,
        textAlign: "center",
        marginTop: 18,
    },
});
