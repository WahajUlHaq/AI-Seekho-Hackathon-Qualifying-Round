import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    type ListRenderItem,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { usePipelineContext } from "@/context/PipelineContext";
import { OperationFeed } from "@/components/OperationFeed";
import { GradientBorderCard } from "@/components/GradientBorderCard";
import { PillBadge } from "@/components/PillBadge";
import { HitlApprovalSheet } from "@/components/HitlApprovalSheet";
import type { RootTabParamList } from "@/navigation/types";
import type { UseStandalonePipeline } from "@/hooks/useStandalonePipeline";
import type { TraceEvent } from "@/types/pipeline";
import { T } from "@/lib/theme";
import { usePulse } from "@/lib/animations";

interface Props {
    operatorHandle: string;
}

type Sse = UseStandalonePipeline["sseStatus"];

const SSE_CFG: Record<Sse, { color: string; label: string; pulse: boolean }> = {
    idle: { color: T.tx3V2, label: "idle", pulse: false },
    connecting: { color: T.amber, label: "connecting", pulse: true },
    open: { color: T.green, label: "stream open", pulse: true },
    reconnecting: { color: T.amber, label: "reconnecting", pulse: true },
    polling: { color: T.blue, label: "polling", pulse: true },
    ended: { color: T.tx3V2, label: "stream ended", pulse: false },
    error: { color: T.crimson, label: "error", pulse: true },
};

export function ExecutionScreen({ operatorHandle }: Props): React.ReactElement {
    const pipeline = usePipelineContext();
    const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
    const [logOpen, setLogOpen] = useState(false);
    const [injectDraft, setInjectDraft] = useState("");
    const elapsed = useElapsedSeconds(pipeline.events);

    const showHitl = pipeline.derivedStatus === "HITL_PENDING" && pipeline.approval !== null;

    const thinkingEvent = useMemo(() => {
        for (let i = pipeline.events.length - 1; i >= 0; i -= 1) {
            const e = pipeline.events[i];
            if (!e) continue;
            if (e.event_type === "thinking" || e.event_type === "llm_call") return e;
        }
        return null;
    }, [pipeline.events]);

    if (!pipeline.pipelineId) {
        return (
            <SafeAreaView edges={["top"]} style={styles.safe}>
                <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>◯</Text>
                    <Text style={styles.emptyTitle}>NO ACTIVE PIPELINE</Text>
                    <Text style={styles.emptyBody}>
                        Launch one from the Dashboard tab to see real-time operations and the HITL
                        gate.
                    </Text>
                    <Pressable
                        style={styles.emptyBtn}
                        onPress={() => navigation.navigate("Dashboard")}
                    >
                        <Text style={styles.emptyBtnText}>GO TO DASHBOARD</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const sse = SSE_CFG[pipeline.sseStatus];

    return (
        <SafeAreaView edges={["top"]} style={styles.safe}>
            {/* ── Header ──────────────────────────────── */}
            <View style={styles.header}>
                <Pressable
                    style={styles.backBtn}
                    hitSlop={8}
                    onPress={() => navigation.navigate("Dashboard")}
                >
                    <Text style={styles.backGlyph}>‹</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Processing…</Text>
                <Pressable style={styles.resetBtn} onPress={pipeline.reset}>
                    <Text style={styles.resetBtnText}>RESET</Text>
                </Pressable>
            </View>

            {/* ── Status strip ────────────────────────── */}
            <View style={styles.statusStrip}>
                <PillBadge
                    label={pipeline.derivedStatus}
                    color={statusColor(pipeline.derivedStatus)}
                    dot
                />
                <Text style={styles.pipelineId} numberOfLines={1}>
                    {pipeline.pipelineId}
                </Text>
                <View style={styles.clockBox}>
                    <Text style={styles.clockGlyph}>🕐</Text>
                    <Text style={styles.clockText}>{formatElapsed(elapsed)}</Text>
                </View>
            </View>

            {/* ── Stream indicator row ────────────────── */}
            <View style={styles.streamRow}>
                <StreamDot status={pipeline.sseStatus} />
                <Text style={styles.streamLabel}>{sse.label}</Text>
                {pipeline.events.length > 0 ? (
                    <Text style={styles.streamCount}>· {pipeline.events.length} ops</Text>
                ) : null}
                <View style={{ flex: 1 }} />
                <Pressable style={styles.logBtn} onPress={() => setLogOpen(true)}>
                    <Text style={styles.logBtnText}>LOG</Text>
                </Pressable>
            </View>

            {/* ── Feed ────────────────────────────────── */}
            <OperationFeed events={pipeline.events} />

            {/* ── Thinking card ───────────────────────── */}
            {thinkingEvent ? (
                <ThinkingCard event={thinkingEvent} onExpand={() => setLogOpen(true)} />
            ) : null}

            {/* ── Inject instruction bar ──────────────── */}
            <View style={styles.injectBar}>
                <Pressable style={styles.injectIconBtn} hitSlop={6}>
                    <Text style={styles.injectIcon}>🎙</Text>
                </Pressable>
                <TextInput
                    style={styles.injectInput}
                    value={injectDraft}
                    onChangeText={setInjectDraft}
                    placeholder="Inject instruction…"
                    placeholderTextColor={T.tx3V2}
                />
                <Pressable
                    style={styles.injectSendOuter}
                    onPress={() => {
                        Alert.alert(
                            "Inject instruction",
                            "Backend endpoint not yet available. Note recorded locally only.",
                        );
                        setInjectDraft("");
                    }}
                >
                    <LinearGradient
                        colors={[T.teal, "#0095a8"] as readonly [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.injectSendInner}
                    >
                        <Text style={styles.injectSendGlyph}>↑</Text>
                    </LinearGradient>
                </Pressable>
            </View>

            {/* ── Log drill-down modal ────────────────── */}
            <LogModal
                visible={logOpen}
                events={pipeline.events}
                onClose={() => setLogOpen(false)}
            />

            {/* ── HITL sheet ──────────────────────────── */}
            <HitlApprovalSheet
                visible={showHitl}
                record={pipeline.approval}
                operatorHandle={operatorHandle}
                isActing={pipeline.isActing}
                errorMessage={pipeline.lastError?.message}
                onApprove={() => void pipeline.approve(operatorHandle)}
                onReject={(reason) => void pipeline.reject(operatorHandle, reason)}
            />
        </SafeAreaView>
    );
}

// ──────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────

function StreamDot({ status }: { status: Sse }): React.ReactElement {
    const cfg = SSE_CFG[status];
    const anim = usePulse(cfg.pulse, 1600);
    const opacity = cfg.pulse
        ? anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] })
        : 1;
    return (
        <Animated.View style={[styles.streamDot, { backgroundColor: cfg.color, opacity }]} />
    );
}

function ThinkingCard({
    event,
    onExpand,
}: {
    event: TraceEvent;
    onExpand: () => void;
}): React.ReactElement {
    const barAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(barAnim, {
                    toValue: 1,
                    duration: 1800,
                    useNativeDriver: false,
                }),
                Animated.timing(barAnim, {
                    toValue: 0,
                    duration: 1800,
                    useNativeDriver: false,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [barAnim]);

    const barWidth = barAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["30%", "75%"],
    });

    return (
        <View style={styles.thinkingWrap}>
            <GradientBorderCard
                colors={T.gradBlue}
                radius={T.rLg}
                thickness={1.5}
                innerStyle={styles.thinkingInner}
            >
                <View style={styles.thinkingHeaderRow}>
                    <Text style={styles.thinkingChip}>◈</Text>
                    <Text style={styles.thinkingTitle}>Thinking…</Text>
                    <Pressable onPress={onExpand} hitSlop={6} style={styles.thinkingExpand}>
                        <Text style={styles.thinkingExpandGlyph}>↗</Text>
                    </Pressable>
                </View>

                <View style={styles.thinkingTrack}>
                    <Animated.View style={[styles.thinkingFill, { width: barWidth }]} />
                </View>

                <Text style={styles.thinkingMsg} numberOfLines={3}>
                    {event.message}
                </Text>

                <View style={styles.thinkingPillRow}>
                    <PillBadge label="LLM Inference" color={T.violet} dot />
                    <PillBadge label={event.agent} color={T.teal} dot />
                </View>
            </GradientBorderCard>
        </View>
    );
}

function LogModal({
    visible,
    events,
    onClose,
}: {
    visible: boolean;
    events: readonly TraceEvent[];
    onClose: () => void;
}): React.ReactElement {
    const reversed = useMemo(() => [...events].reverse(), [events]);

    const renderItem: ListRenderItem<TraceEvent> = ({ item }) => (
        <View style={styles.logRow}>
            <View style={styles.logRowHeader}>
                <PillBadge label={item.agent} color={T.teal} />
                <Text style={styles.logTimestamp}>{formatTime(item.timestamp)}</Text>
            </View>
            <PillBadge label={item.event_type} color={T.blue} style={styles.logTypePill} />
            <Text style={styles.logMessage}>{item.message}</Text>
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.logScrim}>
                <View style={styles.logSheet}>
                    <View style={styles.logHeader}>
                        <Text style={styles.logHeaderTitle}>Pipeline Trace</Text>
                        <Pressable onPress={onClose} hitSlop={8} style={styles.logClose}>
                            <Text style={styles.logCloseGlyph}>✕</Text>
                        </Pressable>
                    </View>
                    {events.length === 0 ? (
                        <Text style={styles.logEmpty}>No events yet.</Text>
                    ) : (
                        <FlatList
                            data={reversed}
                            keyExtractor={(e) => e.event_id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.logListContent}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function useElapsedSeconds(events: readonly TraceEvent[]): number {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);
    if (events.length === 0) return 0;
    const first = events[0];
    if (!first) return tick;
    try {
        const start = new Date(first.timestamp).getTime();
        return Math.max(0, Math.floor((Date.now() - start) / 1000));
    } catch {
        return tick;
    }
}

function formatElapsed(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString();
    } catch {
        return iso;
    }
}

function statusColor(s: string): string {
    switch (s) {
        case "EXECUTING":
            return T.teal;
        case "POLLING_COMPLETED":
            return T.green;
        case "HITL_PENDING":
            return T.amber;
        case "REJECTED":
            return T.violet;
        case "FAILED":
            return T.crimson;
        case "PROCESSING":
            return T.blue;
        default:
            return T.tx2V2;
    }
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: T.bgBaseV2 },

    // ── Header ──
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: T.bdDimV2,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: T.bgSurfaceV2,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        alignItems: "center",
        justifyContent: "center",
    },
    backGlyph: {
        color: T.tx2V2,
        fontSize: 20,
        fontWeight: "700",
        marginTop: -2,
    },
    headerTitle: {
        color: T.tx1V2,
        fontSize: 17,
        fontWeight: "800",
    },
    resetBtn: {
        backgroundColor: T.bgSurfaceV2,
        borderWidth: 1,
        borderColor: T.bdBrightV2,
        borderRadius: T.rSm,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 36,
        justifyContent: "center",
    },
    resetBtnText: {
        color: T.tx2V2,
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.6,
    },

    // ── Status strip ──
    statusStrip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: T.bgSurfaceV2,
        borderBottomWidth: 1,
        borderBottomColor: T.bdDimV2,
    },
    pipelineId: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 10,
        flex: 1,
    },
    clockBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: T.bgBaseV2,
        borderRadius: T.rSm,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    clockGlyph: {
        fontSize: 11,
    },
    clockText: {
        color: T.tx2V2,
        fontFamily: T.fontMono,
        fontSize: 11,
        fontWeight: "700",
    },

    // ── Stream row ──
    streamRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: T.bgSurfaceV2,
        borderBottomWidth: 1,
        borderBottomColor: T.bdDimV2,
    },
    streamDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    streamLabel: {
        color: T.tx2V2,
        fontSize: 11,
        fontWeight: "600",
    },
    streamCount: {
        color: T.teal,
        fontSize: 11,
        fontWeight: "700",
    },
    logBtn: {
        backgroundColor: T.bgElevatedV2,
        borderWidth: 1,
        borderColor: T.bdBrightV2,
        borderRadius: T.rSm,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    logBtnText: {
        color: T.tx2V2,
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.8,
    },

    // ── Thinking card ──
    thinkingWrap: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    thinkingInner: {
        backgroundColor: T.bgSurfaceV2,
        padding: 14,
    },
    thinkingHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
    },
    thinkingChip: {
        color: T.blue,
        fontSize: 16,
    },
    thinkingTitle: {
        flex: 1,
        color: T.tx1V2,
        fontSize: 14,
        fontWeight: "800",
    },
    thinkingExpand: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: T.bgBaseV2,
        alignItems: "center",
        justifyContent: "center",
    },
    thinkingExpandGlyph: {
        color: T.tx2V2,
        fontSize: 14,
        fontWeight: "700",
    },
    thinkingTrack: {
        height: 4,
        borderRadius: 99,
        backgroundColor: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        marginBottom: 10,
    },
    thinkingFill: {
        height: "100%",
        backgroundColor: T.blue,
        borderRadius: 99,
    },
    thinkingMsg: {
        color: T.tx2V2,
        fontSize: 12,
        fontStyle: "italic",
        lineHeight: 17,
        marginBottom: 10,
    },
    thinkingPillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },

    // ── Inject bar ──
    injectBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: T.bgSurfaceV2,
        borderTopWidth: 1,
        borderTopColor: T.bdDimV2,
    },
    injectIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: T.bgBaseV2,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        alignItems: "center",
        justifyContent: "center",
    },
    injectIcon: {
        fontSize: 14,
    },
    injectInput: {
        flex: 1,
        backgroundColor: T.bgInput,
        borderWidth: 1,
        borderColor: T.bdDefaultV2,
        borderRadius: 22,
        color: T.tx1V2,
        fontSize: 13,
        paddingHorizontal: 14,
        paddingVertical: 10,
        minHeight: 40,
    },
    injectSendOuter: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: "hidden",
    },
    injectSendInner: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    injectSendGlyph: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
    },

    // ── Empty state ──
    empty: {
        flex: 1,
        backgroundColor: T.bgBaseV2,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    emptyIcon: {
        color: T.tx3V2,
        fontSize: 32,
        marginBottom: 12,
    },
    emptyTitle: {
        color: T.tx2V2,
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 1.0,
        marginBottom: 10,
    },
    emptyBody: {
        color: T.tx3V2,
        fontSize: 12,
        textAlign: "center",
        lineHeight: 18,
        marginBottom: 20,
        maxWidth: 320,
    },
    emptyBtn: {
        backgroundColor: T.teal,
        paddingHorizontal: 24,
        paddingVertical: 13,
        borderRadius: T.rLg,
        minHeight: 48,
        justifyContent: "center",
    },
    emptyBtnText: {
        color: T.bgBaseV2,
        fontWeight: "800",
        fontSize: 12,
        letterSpacing: 0.8,
    },

    // ── Log modal ──
    logScrim: {
        flex: 1,
        backgroundColor: "rgba(6,10,18,0.92)",
        justifyContent: "flex-end",
    },
    logSheet: {
        backgroundColor: T.bgElevatedV2,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTopWidth: 1.5,
        borderTopColor: T.bdBrightV2,
        height: "85%",
    },
    logHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: T.bdDimV2,
    },
    logHeaderTitle: {
        color: T.tx1V2,
        fontSize: 16,
        fontWeight: "800",
    },
    logClose: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: T.bgBaseV2,
        alignItems: "center",
        justifyContent: "center",
    },
    logCloseGlyph: {
        color: T.tx2V2,
        fontSize: 14,
        fontWeight: "700",
    },
    logListContent: {
        padding: 14,
        paddingBottom: 32,
    },
    logRow: {
        backgroundColor: T.bgSurfaceV2,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        padding: 10,
        marginBottom: 8,
    },
    logRowHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
        gap: 8,
    },
    logTimestamp: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 10,
    },
    logTypePill: {
        marginBottom: 6,
    },
    logMessage: {
        color: T.tx2V2,
        fontSize: 12,
        lineHeight: 17,
    },
    logEmpty: {
        color: T.tx3V2,
        fontSize: 12,
        textAlign: "center",
        marginTop: 30,
    },
});
