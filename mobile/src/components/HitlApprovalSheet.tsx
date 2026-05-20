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
import type { PipelineApprovalRecord, Priority } from "@/types/pipeline";
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
    bg: string;
    bd: string;
    fg: string;
}

const PRIORITY_CFG: Record<Priority, PriorityConfig> = {
    CRITICAL: { bg: T.crimsonDim, bd: T.crimsonBd, fg: T.crimson },
    HIGH: { bg: T.amberDim, bd: T.amberBd, fg: T.amber },
    MEDIUM: { bg: T.blueDim, bd: T.blueBd, fg: T.blue },
    LOW: { bg: T.slateDim, bd: T.slateBd, fg: T.tx3 },
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

    const overallCfg = PRIORITY_CFG[record.proposal.overall_priority];

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.scrim}>
                <View style={styles.amberTint} />
                <View style={styles.sheet}>
                    <View style={styles.handleBar} />

                    {/* ── Header block ─────────────────────── */}
                    <View style={styles.header}>
                        <View style={styles.headerRow}>
                            <View style={styles.iconBox}>
                                <Text style={styles.iconBoxGlyph}>⏸</Text>
                            </View>
                            <View style={styles.titleCol}>
                                <Text style={styles.title}>HUMAN-IN-THE-LOOP</Text>
                                <Text style={styles.subtitle}>
                                    SECURE AUTHORIZATION REQUIRED
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.prioPill,
                                    { backgroundColor: overallCfg.bg, borderColor: overallCfg.bd },
                                ]}
                            >
                                <Text style={[styles.prioText, { color: overallCfg.fg }]}>
                                    {record.proposal.overall_priority}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.pipelineRow}>
                            <Text style={styles.pipelineId} numberOfLines={1}>
                                {record.pipeline_id}
                            </Text>
                            <Text style={styles.proposedAt} numberOfLines={1}>
                                proposed {formatTime(record.proposed_at)}
                            </Text>
                        </View>
                    </View>

                    {/* ── Scrollable body ─────────────────── */}
                    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
                        <Text style={styles.sectionLabel}>RATIONALE</Text>
                        <View style={styles.rationaleBox}>
                            <Text style={styles.rationaleText}>{record.proposal.rationale}</Text>
                        </View>

                        <Text style={styles.sectionLabel}>
                            PROPOSED ACTIONS · {record.proposal.proposedActions.length}
                        </Text>
                        {record.proposal.proposedActions.map((a, idx) => {
                            const cfg = PRIORITY_CFG[a.priority];
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
                                        <View
                                            style={[
                                                styles.prioPillSm,
                                                { backgroundColor: cfg.bg, borderColor: cfg.bd },
                                            ]}
                                        >
                                            <Text style={[styles.prioTextSm, { color: cfg.fg }]}>
                                                {a.priority}
                                            </Text>
                                        </View>
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
                            placeholderTextColor={T.tx3}
                            style={styles.input}
                            multiline
                            editable={!isActing}
                        />

                        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
                    </ScrollView>

                    {/* ── Footer ──────────────────────────── */}
                    <View style={styles.footer}>
                        <Text style={styles.operator}>
                            <Text style={styles.operatorLabel}>signing as </Text>
                            <Text style={styles.operatorValue}>{operatorHandle}</Text>
                        </Text>
                        <View style={styles.btnRow}>
                            <Pressable
                                style={[styles.btn, styles.btnReject, isActing && styles.btnDisabled]}
                                disabled={isActing}
                                onPress={() => onReject(reason.trim() || undefined)}
                            >
                                <Text style={styles.btnRejectText}>REJECT</Text>
                            </Pressable>
                            <HoldToApprove
                                isActing={isActing}
                                onApprove={onApprove}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ───────────────────────────────────────────────────────
// Hold-to-approve button: 1600 ms hold fills the bar.
// Release before 100 % → reset. Reach 100 % → onApprove.
// ───────────────────────────────────────────────────────
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

    // When the parent finishes acting, reset progress for the next round.
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

    const idle = !isActing && pct === 0;
    const label = isActing
        ? "⋯ Signing…"
        : pct > 0
        ? `Holding… ${pct}%`
        : "⇧ Hold to Sign & Approve";

    return (
        <Pressable
            style={styles.holdBtn}
            onPressIn={startHold}
            onPressOut={cancelHold}
            disabled={isActing}
        >
            <Animated.View style={[styles.holdFill, { width }]} />
            {isActing ? (
                <ActivityIndicator color={T.emerald} />
            ) : (
                <Text
                    style={[
                        styles.holdBtnText,
                        { color: idle ? T.emerald : T.bgBase },
                    ]}
                    numberOfLines={1}
                >
                    {label}
                </Text>
            )}
        </Pressable>
    );
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString();
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    scrim: {
        flex: 1,
        backgroundColor: T.scrimBg,
        justifyContent: "flex-end",
    },
    amberTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: T.scrimAmberTint,
    },
    sheet: {
        backgroundColor: T.bgElevated,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTopWidth: 2,
        borderLeftWidth: 2,
        borderRightWidth: 2,
        borderBottomWidth: 0,
        borderTopColor: T.amberBd,
        borderLeftColor: T.amberBd,
        borderRightColor: T.amberBd,
        maxHeight: "87%",
        shadowColor: T.amber,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 12,
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: T.bdBright,
        alignSelf: "center",
        marginTop: 10,
        marginBottom: 4,
    },

    // ── Header ─────────────────────────────────────────
    header: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: T.bdDim,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: T.amberDim,
        borderWidth: 1,
        borderColor: T.amberBd,
        alignItems: "center",
        justifyContent: "center",
    },
    iconBoxGlyph: {
        fontFamily: T.fontMono,
        fontSize: 18,
        color: T.amber,
    },
    titleCol: {
        flex: 1,
    },
    title: {
        fontFamily: T.fontMono,
        fontSize: 11,
        fontWeight: "700",
        color: T.amber,
        letterSpacing: 0.8,
    },
    subtitle: {
        fontFamily: T.fontMono,
        fontSize: 9,
        color: T.tx3,
        marginTop: 1,
        letterSpacing: 0.4,
    },
    prioPill: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: T.rFull,
        borderWidth: 1,
    },
    prioText: {
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    pipelineRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
        gap: 8,
    },
    pipelineId: {
        color: T.blue,
        fontFamily: T.fontMono,
        fontSize: 10,
        flexShrink: 1,
    },
    proposedAt: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 10,
        flexShrink: 1,
    },

    // ── Scroll body ────────────────────────────────────
    scroll: {
        paddingHorizontal: 16,
        maxHeight: 480,
    },
    sectionLabel: {
        fontFamily: T.fontMono,
        fontSize: 9,
        color: T.tx3,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginTop: 14,
        marginBottom: 6,
    },
    rationaleBox: {
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDim,
        padding: 10,
    },
    rationaleText: {
        fontFamily: T.fontMono,
        fontSize: 11,
        color: T.tx2,
        lineHeight: 18,
    },
    action: {
        backgroundColor: T.bgSurface,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDefault,
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
        backgroundColor: T.bgElevated,
        borderRadius: T.rSm,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    indexBadgeText: {
        color: T.tx3,
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
    prioPillSm: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: T.rFull,
        borderWidth: 1,
    },
    prioTextSm: {
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    actionTitle: {
        color: T.tx1,
        fontFamily: T.fontMono,
        fontSize: 12,
        fontWeight: "600",
        marginTop: 6,
    },
    actionDesc: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 10,
        marginTop: 4,
        lineHeight: 16,
    },
    actionDeps: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        marginTop: 4,
    },
    actionDepsValue: {
        color: T.blue,
    },
    input: {
        backgroundColor: T.bgInput,
        borderWidth: 1,
        borderColor: T.crimsonBd,
        borderRadius: T.rMd,
        color: T.tx1,
        fontFamily: T.fontMono,
        fontSize: 11,
        padding: 10,
        minHeight: 64,
        textAlignVertical: "top",
    },
    error: {
        color: T.crimson,
        fontFamily: T.fontMono,
        fontSize: 11,
        marginTop: 10,
        marginBottom: 4,
    },

    // ── Footer ─────────────────────────────────────────
    footer: {
        borderTopWidth: 1,
        borderTopColor: T.bdDim,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 28,
    },
    operator: {
        fontFamily: T.fontMono,
        fontSize: 9,
        textAlign: "center",
        marginBottom: 8,
    },
    operatorLabel: {
        color: T.tx3,
    },
    operatorValue: {
        color: T.amber,
        fontWeight: "700",
    },
    btnRow: {
        flexDirection: "row",
        gap: 8,
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: T.rMd,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
    },
    btnReject: {
        backgroundColor: T.crimsonDim,
        borderWidth: 1,
        borderColor: T.crimsonBd,
    },
    btnRejectText: {
        color: T.crimson,
        fontFamily: T.fontMono,
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    btnDisabled: {
        opacity: 0.4,
    },

    // Hold-to-approve
    holdBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: T.rMd,
        backgroundColor: T.emeraldDim,
        borderWidth: 2,
        borderColor: T.emeraldBd,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        minHeight: 44,
    },
    holdFill: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: T.emerald,
    },
    holdBtnText: {
        fontFamily: T.fontMono,
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
});
