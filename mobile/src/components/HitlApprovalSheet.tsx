import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { PipelineApprovalRecord, Priority, StrategyProposal } from "@/types/pipeline";
import { PillBadge } from "./PillBadge";
import { T } from "@/lib/theme";

interface Props {
    visible: boolean;
    record: PipelineApprovalRecord | null;
    operatorHandle: string;
    isActing: boolean;
    errorMessage?: string | null;
    onApprove: () => void;
    onReject: (reason?: string) => void;
}

interface PriorityConfig {
    color: string;
    bg: string;
    bd: string;
}

const PRIORITY_CFG: Record<Priority, PriorityConfig> = {
    CRITICAL: { color: T.crimson, bg: T.crimsonDim, bd: T.crimsonBd },
    HIGH: { color: T.amber, bg: T.amberDim, bd: T.amberBd },
    MEDIUM: { color: T.blue, bg: T.blueDim, bd: T.blueBd },
    LOW: { color: T.tx3V2, bg: "rgba(143,164,191,0.10)", bd: "rgba(143,164,191,0.30)" },
};

const HOLD_DURATION_MS = 1600;

export function HitlApprovalSheet({
    visible,
    record,
    operatorHandle,
    isActing,
    errorMessage,
    onApprove,
    onReject,
}: Props): React.ReactElement {
    const [reason, setReason] = useState("");

    if (!record) {
        return (
            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.scrim} />
            </Modal>
        );
    }

    const overall = PRIORITY_CFG[record.proposal.overall_priority];
    const lastSix = record.pipeline_id.slice(-6).toUpperCase();
    const agentName = inferAgentName(record);
    const impact = mapImpact(record.proposal.overall_priority);
    const position = `1 / ${record.proposal.proposedActions.length}`;
    const verificationHash = stubHash(record);

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.scrim}>
                <View style={styles.sheet}>
                    <View style={styles.handleBar} />

                    {/* ── Header ──────────────────────────────── */}
                    <View style={styles.header}>
                        <View style={styles.headerTopRow}>
                            <View style={styles.iconBox}>
                                <Text style={styles.iconGlyph}>⏸</Text>
                            </View>
                            <View style={styles.headerTitleCol}>
                                <Text style={styles.title}>Human Approval Required</Text>
                                <View style={styles.criticalRow}>
                                    <PillBadge label="⚠ CRITICAL ACTION" color={T.crimson} />
                                </View>
                            </View>
                        </View>

                        <Text style={styles.subtitle}>
                            The agent <Text style={styles.subtitleAgent}>{agentName}</Text> detected
                            a high-value impact action. Automated execution paused.
                        </Text>

                        <View style={styles.metaGrid}>
                            <MetaCard label="# PIPELINE ID" value={`PIPE-${lastSix}`} color={T.blue} />
                            <MetaCard label="⚡ AGENT NAME" value={agentName} color={T.teal} />
                            <MetaCard label="⊛ IMPACT" value={impact} color={overall.color} />
                            <MetaCard label="◎ POSITION" value={position} color={T.tx2V2} />
                        </View>
                    </View>

                    {/* ── Scrollable body ─────────────────────── */}
                    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
                        <View style={styles.rationaleBox}>
                            <Text style={styles.rationaleText}>{record.proposal.rationale}</Text>
                        </View>

                        <Text style={styles.sectionLabel}>SHA-256 VERIFICATION HASH</Text>
                        <View style={styles.hashBox}>
                            <Text style={styles.hashText} selectable>
                                {verificationHash}
                            </Text>
                        </View>

                        <Text style={styles.sectionLabel}>
                            PROPOSED ACTIONS · {record.proposal.proposedActions.length}
                        </Text>
                        {record.proposal.proposedActions.map((a, idx) => {
                            const pc = PRIORITY_CFG[a.priority];
                            return (
                                <View key={a.action_id} style={styles.action}>
                                    <View style={styles.actionHeader}>
                                        <View style={styles.actionHeaderLeft}>
                                            <View style={styles.indexBadge}>
                                                <Text style={styles.indexBadgeText}>
                                                    {String(idx + 1).padStart(2, "0")}
                                                </Text>
                                            </View>
                                            <Text style={styles.actionId} numberOfLines={1}>
                                                {a.action_id}
                                            </Text>
                                        </View>
                                        <PillBadge
                                            label={a.priority}
                                            color={pc.color}
                                            bg={pc.bg}
                                            border={pc.bd}
                                        />
                                    </View>
                                    <Text style={styles.actionTitle}>{a.title}</Text>
                                    <Text style={styles.actionDesc}>{a.description}</Text>
                                    {a.depends_on.length > 0 ? (
                                        <Text style={styles.actionDeps}>
                                            depends_on:{" "}
                                            <Text style={styles.actionDepsValue}>
                                                {a.depends_on.join(", ")}
                                            </Text>
                                        </Text>
                                    ) : null}
                                </View>
                            );
                        })}

                        <Text style={styles.sectionLabel}>REJECTION REASON · OPTIONAL</Text>
                        <TextInput
                            value={reason}
                            onChangeText={setReason}
                            placeholder="Why are you rejecting?"
                            placeholderTextColor={T.tx3V2}
                            style={styles.input}
                            multiline
                            editable={!isActing}
                        />

                        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
                    </ScrollView>

                    {/* ── Footer ──────────────────────────────── */}
                    <View style={styles.footer}>
                        <Text style={styles.operator}>
                            <Text style={styles.operatorLabel}>signing as </Text>
                            <Text style={styles.operatorValue}>{operatorHandle}</Text>
                        </Text>
                        <View style={styles.btnRow}>
                            <Pressable
                                style={[styles.btnReject, isActing && styles.btnDisabled]}
                                disabled={isActing}
                                onPress={() => onReject(reason.trim() || undefined)}
                            >
                                <Text style={styles.btnRejectIcon}>✕</Text>
                                <Text style={styles.btnRejectText}>REJECT & CANCEL</Text>
                            </Pressable>
                            <HoldToApprove isActing={isActing} onApprove={onApprove} />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ──────────────────────────────────────────────────────────
// Hold-to-approve — 1600ms gradient fill. Release early
// reverses; reach 100% calls onApprove().
// ──────────────────────────────────────────────────────────
function HoldToApprove({
    isActing,
    onApprove,
}: {
    isActing: boolean;
    onApprove: () => void;
}): React.ReactElement {
    const progress = useRef(new Animated.Value(0)).current;
    const animRef = useRef<Animated.CompositeAnimation | null>(null);
    const [pct, setPct] = useState(0);
    const completedRef = useRef(false);

    useEffect(() => {
        const id = progress.addListener(({ value }) => {
            setPct(Math.round(value * 100));
        });
        return () => progress.removeListener(id);
    }, [progress]);

    useEffect(() => {
        if (!isActing) {
            progress.setValue(0);
            setPct(0);
            completedRef.current = false;
        }
    }, [isActing, progress]);

    const startHold = (): void => {
        if (isActing || completedRef.current) return;
        if (animRef.current) animRef.current.stop();
        animRef.current = Animated.timing(progress, {
            toValue: 1,
            duration: HOLD_DURATION_MS,
            useNativeDriver: false,
        });
        animRef.current.start(({ finished }) => {
            if (finished && !completedRef.current) {
                completedRef.current = true;
                onApprove();
            }
        });
    };

    const cancelHold = (): void => {
        if (isActing || completedRef.current) return;
        if (animRef.current) {
            animRef.current.stop();
            animRef.current = null;
        }
        Animated.timing(progress, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    };

    const width = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
    });

    const label = isActing ? "⋯ Signing…" : pct > 0 ? `Holding… ${pct}%` : "✓ ACCEPT & EXECUTE";

    return (
        <Pressable
            style={styles.holdBtn}
            onPressIn={startHold}
            onPressOut={cancelHold}
            disabled={isActing}
        >
            <Animated.View style={[styles.holdFillWrap, { width }]}>
                <LinearGradient
                    colors={T.gradAccept as readonly [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
            {isActing ? (
                <ActivityIndicator color={T.green} />
            ) : (
                <Text
                    style={[
                        styles.holdBtnText,
                        { color: pct === 0 ? T.green : "#ffffff" },
                    ]}
                    numberOfLines={1}
                >
                    {label}
                </Text>
            )}
        </Pressable>
    );
}

// ──────────────────────────────────────────────────────────
// Derived field helpers
// ──────────────────────────────────────────────────────────
function inferAgentName(record: PipelineApprovalRecord): string {
    const proposal = record.proposal as StrategyProposal & { agent_name?: string };
    if (typeof proposal.agent_name === "string" && proposal.agent_name.length > 0) {
        return proposal.agent_name;
    }
    return "StrategicRecommender";
}

function mapImpact(p: Priority): string {
    switch (p) {
        case "CRITICAL":
            return "CRITICAL";
        case "HIGH":
            return "HIGH RISK";
        case "MEDIUM":
            return "MEDIUM";
        case "LOW":
            return "LOW";
    }
}

function stubHash(record: PipelineApprovalRecord): string {
    const proposal = record.proposal as StrategyProposal & { proposal_hash?: string };
    if (typeof proposal.proposal_hash === "string" && proposal.proposal_hash.length >= 32) {
        return proposal.proposal_hash;
    }
    const seed = `${record.pipeline_id}-${record.proposed_at}`;
    let h = 0;
    for (let i = 0; i < seed.length; i += 1) {
        h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return Array.from({ length: 8 }, (_, i) =>
        ((h * (i + 7)) >>> 0).toString(16).padStart(8, "0"),
    )
        .join("")
        .slice(0, 64);
}

function MetaCard({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color: string;
}): React.ReactElement {
    return (
        <View style={styles.metaCard}>
            <Text style={styles.metaCardLabel}>{label}</Text>
            <Text style={[styles.metaCardValue, { color }]} numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    scrim: {
        flex: 1,
        backgroundColor: "rgba(6,10,18,0.88)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: T.bgElevatedV2,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTopWidth: 1.5,
        borderLeftWidth: 1.5,
        borderRightWidth: 1.5,
        borderTopColor: T.amberBd,
        borderLeftColor: T.amberBd,
        borderRightColor: T.amberBd,
        maxHeight: "92%",
        shadowColor: T.amber,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.18,
        shadowRadius: 22,
        elevation: 14,
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: T.bdBrightV2,
        alignSelf: "center",
        marginTop: 10,
        marginBottom: 6,
    },

    // ── Header ─────────────────────────────────────────
    header: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: T.bdDimV2,
    },
    headerTopRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 8,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: T.amberDim,
        borderWidth: 1,
        borderColor: T.amberBd,
        alignItems: "center",
        justifyContent: "center",
    },
    iconGlyph: {
        fontSize: 20,
        color: T.amber,
    },
    headerTitleCol: {
        flex: 1,
    },
    title: {
        color: T.tx1V2,
        fontSize: 18,
        fontWeight: "800",
        letterSpacing: -0.2,
    },
    criticalRow: {
        flexDirection: "row",
        marginTop: 6,
    },
    subtitle: {
        color: T.tx2V2,
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 10,
    },
    subtitleAgent: {
        color: T.tx1V2,
        fontWeight: "700",
    },

    // ── Meta grid (2×2) ────────────────────────────────
    metaGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    metaCard: {
        flexBasis: "48.5%",
        backgroundColor: T.bgBaseV2,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        borderRadius: T.rMd,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    metaCardLabel: {
        color: T.tx3V2,
        fontSize: 9,
        fontWeight: "700",
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    metaCardValue: {
        fontSize: 12,
        fontWeight: "700",
        fontFamily: T.fontMono,
    },

    // ── Body ───────────────────────────────────────────
    scroll: {
        paddingHorizontal: 16,
    },
    rationaleBox: {
        backgroundColor: T.blueDim,
        borderWidth: 1,
        borderColor: T.blueBd,
        borderRadius: T.rMd,
        padding: 12,
        marginTop: 14,
    },
    rationaleText: {
        color: T.tx1V2,
        fontSize: 12,
        lineHeight: 18,
    },
    sectionLabel: {
        color: T.tx3V2,
        fontSize: 10,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1.0,
        marginTop: 16,
        marginBottom: 6,
    },
    hashBox: {
        backgroundColor: T.bgInput,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        borderRadius: T.rSm,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    hashText: {
        color: T.teal,
        fontFamily: T.fontMono,
        fontSize: 10,
        lineHeight: 16,
    },
    action: {
        backgroundColor: T.bgBaseV2,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDefaultV2,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
    },
    actionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    actionHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexShrink: 1,
    },
    indexBadge: {
        backgroundColor: T.bgElevatedV2,
        borderRadius: T.rSm,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    indexBadgeText: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
    },
    actionId: {
        color: T.blue,
        fontFamily: T.fontMono,
        fontSize: 11,
        fontWeight: "700",
        flexShrink: 1,
    },
    actionTitle: {
        color: T.tx1V2,
        fontSize: 13,
        fontWeight: "700",
        marginTop: 8,
    },
    actionDesc: {
        color: T.tx2V2,
        fontSize: 11,
        marginTop: 4,
        lineHeight: 16,
    },
    actionDeps: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 9,
        marginTop: 6,
    },
    actionDepsValue: {
        color: T.blue,
    },
    input: {
        backgroundColor: T.bgInput,
        borderWidth: 1,
        borderColor: T.crimsonBd,
        borderRadius: T.rMd,
        color: T.tx1V2,
        fontSize: 12,
        padding: 10,
        minHeight: 64,
        textAlignVertical: "top",
    },
    error: {
        color: T.crimson,
        fontSize: 11,
        marginTop: 10,
        marginBottom: 4,
    },

    // ── Footer ─────────────────────────────────────────
    footer: {
        borderTopWidth: 1,
        borderTopColor: T.bdDimV2,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 28,
    },
    operator: {
        fontSize: 10,
        textAlign: "center",
        marginBottom: 10,
    },
    operatorLabel: {
        color: T.tx3V2,
    },
    operatorValue: {
        color: T.amber,
        fontWeight: "700",
    },
    btnRow: {
        flexDirection: "row",
        gap: 10,
    },
    btnReject: {
        flex: 1,
        flexDirection: "row",
        gap: 6,
        backgroundColor: T.crimsonDim,
        borderWidth: 1,
        borderColor: T.crimsonBd,
        paddingVertical: 13,
        borderRadius: T.rLg,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
    },
    btnRejectIcon: {
        color: T.crimson,
        fontSize: 13,
        fontWeight: "700",
    },
    btnRejectText: {
        color: T.crimson,
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 0.6,
    },
    btnDisabled: {
        opacity: 0.4,
    },

    // Hold-to-approve
    holdBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: T.rLg,
        backgroundColor: T.greenDim,
        borderWidth: 1.5,
        borderColor: T.greenBd,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        minHeight: 48,
    },
    holdFillWrap: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
    },
    holdBtnText: {
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 0.6,
    },
});
