import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { usePipelineContext } from "@/context/PipelineContext";
import { PillBadge } from "@/components/PillBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { GradientBorderCard } from "@/components/GradientBorderCard";
import type { RootTabParamList } from "@/navigation/types";
import type { TraceEvent } from "@/types/pipeline";
import type { ActionExecutionResult } from "@/types/execution";
import { T } from "@/lib/theme";

interface Props {
    operatorHandle: string;
}

export function ChainFlowScreen({ operatorHandle: _ }: Props): React.ReactElement {
    const pipeline = usePipelineContext();
    const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
    const lastSix = (pipeline.pipelineId ?? "").slice(-6).toUpperCase();

    const onStartNew = (): void => {
        pipeline.reset();
        navigation.navigate("Dashboard");
    };

    const onRetry = (): void => {
        pipeline.reset();
        navigation.navigate("Dashboard");
    };

    if (pipeline.derivedStatus === "POLLING_COMPLETED") {
        return (
            <RunResults
                lastSix={lastSix}
                results={pipeline.chain?.execution_results ?? []}
                totalMs={pipeline.chain?.total_execution_ms ?? 0}
                onStartNew={onStartNew}
            />
        );
    }

    if (pipeline.derivedStatus === "REJECTED") {
        return (
            <RunCanceled
                lastSix={lastSix}
                events={pipeline.events}
                onRetry={onRetry}
                onGoToAudit={() => navigation.navigate("Audit")}
            />
        );
    }

    return (
        <SafeAreaView edges={["top"]} style={styles.safe}>
            <View style={styles.placeholder}>
                <Text style={styles.placeholderIcon}>⟳</Text>
                <Text style={styles.placeholderTitle}>RUN IN PROGRESS</Text>
                <Text style={styles.placeholderBody}>
                    Results appear here after the pipeline completes or is canceled. Switch to the
                    Execution tab to watch live progress.
                </Text>
                <Pressable
                    style={styles.placeholderBtn}
                    onPress={() => navigation.navigate("Execution")}
                >
                    <Text style={styles.placeholderBtnText}>GO TO EXECUTION</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

// ──────────────────────────────────────────────────────────
// Run Results
// ──────────────────────────────────────────────────────────
function RunResults({
    lastSix,
    results,
    totalMs,
    onStartNew,
}: {
    lastSix: string;
    results: readonly ActionExecutionResult[];
    totalMs: number;
    onStartNew: () => void;
}): React.ReactElement {
    const passedCount = results.filter((r) => r.status === "SUCCESS").length;
    const secsText = (totalMs / 1000).toFixed(2);

    return (
        <SafeAreaView edges={["top"]} style={styles.safe}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* ── Status badge centered ──── */}
                <View style={styles.centerRow}>
                    <PillBadge label="✓ Completed" color={T.teal} dot />
                </View>

                <Text style={styles.heroTitle}>Pipeline {lastSix || "—"}</Text>
                <Text style={styles.heroSub}>
                    Executed in {secsText}s · {passedCount}/{results.length} agents passed
                </Text>

                {/* ── Extraction feed ──── */}
                <View style={styles.sectionRow}>
                    <Text style={styles.sectionEyebrow}>EXTRACTION FEED</Text>
                    <PillBadge
                        label={`${results.length} Result${results.length === 1 ? "" : "s"}`}
                        color={T.tx2V2}
                    />
                </View>

                {results.length === 0 ? (
                    <View style={styles.resultEmpty}>
                        <Text style={styles.resultEmptyText}>
                            No execution results recorded.
                        </Text>
                    </View>
                ) : (
                    results.map((r, idx) => (
                        <ResultCard key={r.action_id} result={r} index={idx} />
                    ))
                )}

                {/* ── Advanced insights teaser ──── */}
                {/* <GradientBorderCard
                    colors={T.gradBlue}
                    radius={T.rLg}
                    thickness={1}
                    style={{ marginTop: 14, marginBottom: 14 }}
                    innerStyle={styles.insightsInner}
                >
                    <View style={styles.insightsRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.insightsTitle}>Advanced Insights</Text>
                            <Text style={styles.insightsBody}>
                                Cross-source correlations, anomaly scores, and provenance graphs.
                            </Text>
                        </View>
                        <Text style={styles.insightsArrow}>→</Text>
                    </View>
                </GradientBorderCard> */}

                {/* ── CTAs ──── */}
                <Pressable onPress={onStartNew} style={styles.launchOuter}>
                    <LinearGradient
                        colors={T.gradCta as readonly [string, string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.launchInner}
                    >
                        <Text style={styles.launchText}>⊕ Start New Prompt</Text>
                    </LinearGradient>
                </Pressable>

                {/* <Pressable
                    style={styles.outlineBtn}
                    onPress={() => {
                    }}
                >
                    <Text style={styles.outlineBtnText}>↓ Download All Artifacts</Text>
                </Pressable> */}
            </ScrollView>
        </SafeAreaView>
    );
}

function ResultCard({
    result,
    index,
}: {
    result: ActionExecutionResult;
    index: number;
}): React.ReactElement {
    const success = result.status === "SUCCESS";
    const confidence = success ? Math.max(85, 100 - index * 3) : 50;
    return (
        <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
                <View style={styles.resultIconBox}>
                    <Text style={styles.resultIcon}>{success ? "✓" : "✗"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                        {result.action_id}
                    </Text>
                    <Text style={styles.resultSource}>STATUS: {result.status}</Text>
                </View>
                <Text style={styles.resultMore}>⋮</Text>
            </View>

            <Text style={styles.resultSummary} numberOfLines={3}>
                {result.output_summary || result.error_message || "No summary recorded."}
            </Text>

            <ConfidenceMeter value={confidence} />

            <View style={styles.resultFooter}>
                <View style={styles.resultFooterIcons}>
                    <View style={styles.resultIconChip}>
                        <Text style={styles.resultIconChipText}>↓</Text>
                    </View>
                    <View style={styles.resultIconChip}>
                        <Text style={styles.resultIconChipText}>↗</Text>
                    </View>
                </View>
                <Text style={styles.resultLatency}>{result.latency_ms} ms</Text>
            </View>
        </View>
    );
}

// ──────────────────────────────────────────────────────────
// Run Canceled
// ──────────────────────────────────────────────────────────
function RunCanceled({
    lastSix,
    events,
    onRetry,
    onGoToAudit,
}: {
    lastSix: string;
    events: readonly TraceEvent[];
    onRetry: () => void;
    onGoToAudit: () => void;
}): React.ReactElement {
    const trace = useMemo(() => buildTrace(events), [events]);

    return (
        <SafeAreaView edges={["top"]} style={styles.safe}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* ── Canceled hero card ──── */}
                <View style={styles.canceledCard}>
                    <View style={styles.canceledCircle}>
                        <Feather name="x" size={26} color={T.crimson} />
                    </View>
                    <Text style={styles.canceledTitle}>Run Canceled</Text>
                    <Text style={styles.canceledBody}>
                        The pipeline execution for PIPE-{lastSix || "—"} was terminated by operator
                        signal. No execution side effects were committed.
                    </Text>

                    <Pressable onPress={onRetry} style={styles.retryOuter}>
                        <LinearGradient
                            colors={T.gradReject as readonly [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.retryInner}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Feather name="refresh-cw" size={14} color="#fff" />
                                <Text style={styles.retryText}>Retry Execution</Text>
                            </View>
                        </LinearGradient>
                    </Pressable>

                    <Pressable
                        onPress={onRetry}
                        style={{ alignSelf: "stretch", width: "100%", marginTop: 10, borderRadius: 14, overflow: "hidden" }}
                    >
                        <LinearGradient
                            colors={["#171f30ff", "#232e42"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.retryInner}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Feather name="edit-2" size={14} color="#fff" />
                                <Text style={styles.retryText}>Edit Pipeline Input</Text>
                            </View>
                        </LinearGradient>
                    </Pressable>

                    <Pressable onPress={onGoToAudit} style={styles.canceledAuditLink}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Feather name="search" size={12} color={T.blue} />
                            <Text style={styles.canceledAuditLinkText}>
                                View audit ledger for this run
                            </Text>
                            <Feather name="arrow-right" size={12} color={T.blue} />
                        </View>
                    </Pressable>
                </View>

                {/* ── Execution trace ──── */}
                <View style={styles.sectionRow}>
                    <Text style={styles.sectionEyebrow}>EXECUTION TRACE</Text>
                    <PillBadge label="PIPELINE HALTED" color={T.crimson} />
                </View>

                {trace.length === 0 ? (
                    <View style={styles.resultEmpty}>
                        <Text style={styles.resultEmptyText}>No events recorded.</Text>
                    </View>
                ) : (
                    trace.map((e) => (
                        <View key={e.event_id} style={styles.traceRow}>
                            <Text style={[styles.traceGlyph, { color: traceColor(e) }]}>
                                {traceGlyph(e)}
                            </Text>
                            <View style={{ flex: 1 }}>
                                <View style={styles.traceHeader}>
                                    <Text style={styles.traceAgent}>{e.agent}</Text>
                                    <Text style={styles.traceTime}>
                                        {formatTime(e.timestamp)}
                                    </Text>
                                </View>
                                <Text style={styles.traceMessage} numberOfLines={2}>
                                    {e.message}
                                </Text>
                            </View>
                        </View>
                    ))
                )}

                {/* ── Audit summary teaser ──── */}
                <View style={styles.auditTeaser}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.auditTeaserTitle}>Audit Summary</Text>
                        <Text style={styles.auditTeaserBody}>
                            A signed ledger receipt is committed even for rejected runs.
                        </Text>
                    </View>
                    <Pressable onPress={onGoToAudit} style={styles.auditTeaserBtn}>
                        <Text style={styles.auditTeaserBtnText}>Go to Audit <Feather name="arrow-right" size={12} color={T.blue} /></Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function buildTrace(events: readonly TraceEvent[]): TraceEvent[] {
    const wanted = new Set<TraceEvent["event_type"]>([
        "hitl_rejected",
        "hitl_approved",
        "agent_complete",
        "agent_start",
        "decision",
        "failure",
    ]);
    return [...events].filter((e) => wanted.has(e.event_type)).reverse().slice(0, 8);
}

function traceGlyph(e: TraceEvent): string {
    switch (e.event_type) {
        case "hitl_rejected":
            return "▲";
        case "hitl_approved":
            return "✓";
        case "agent_complete":
            return "✓";
        case "agent_start":
            return "▶";
        case "decision":
            return "◆";
        case "failure":
            return "✗";
        default:
            return "•";
    }
}

function traceColor(e: TraceEvent): string {
    switch (e.event_type) {
        case "hitl_rejected":
        case "failure":
            return T.crimson;
        case "hitl_approved":
        case "agent_complete":
            return T.green;
        case "agent_start":
            return T.blue;
        case "decision":
            return T.amber;
        default:
            return T.tx2V2;
    }
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString();
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: T.bgBaseV2 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 40 },

    centerRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 14,
    },
    heroTitle: {
        color: T.tx1V2,
        fontSize: 26,
        fontWeight: "800",
        textAlign: "center",
        letterSpacing: -0.4,
    },
    heroSub: {
        color: T.tx2V2,
        fontSize: 12.5,
        textAlign: "center",
        marginTop: 6,
        marginBottom: 24,
    },

    // ── Sections ──
    sectionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
        marginTop: 10,
    },
    sectionEyebrow: {
        color: T.tx3V2,
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.2,
        textTransform: "uppercase",
    },

    // ── Result card ──
    resultCard: {
        backgroundColor: T.bgSurfaceV2,
        borderRadius: T.rLg,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        padding: 14,
        marginBottom: 10,
    },
    resultHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
    },
    resultIconBox: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: T.tealDim,
        borderWidth: 1,
        borderColor: T.tealBd,
        alignItems: "center",
        justifyContent: "center",
    },
    resultIcon: {
        color: T.teal,
        fontSize: 16,
        fontWeight: "700",
    },
    resultName: {
        color: T.tx1V2,
        fontSize: 13,
        fontWeight: "700",
    },
    resultSource: {
        color: T.tx3V2,
        fontSize: 9.5,
        fontWeight: "700",
        letterSpacing: 0.6,
        marginTop: 2,
    },
    resultMore: {
        color: T.tx3V2,
        fontSize: 18,
        fontWeight: "700",
    },
    resultSummary: {
        color: T.tx2V2,
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 10,
    },
    resultFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 10,
    },
    resultFooterIcons: {
        flexDirection: "row",
        gap: 6,
    },
    resultIconChip: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: T.bgBaseV2,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        alignItems: "center",
        justifyContent: "center",
    },
    resultIconChipText: {
        color: T.tx2V2,
        fontSize: 12,
        fontWeight: "700",
    },
    resultLatency: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 10,
    },
    resultEmpty: {
        backgroundColor: T.bgSurfaceV2,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        padding: 16,
    },
    resultEmptyText: {
        color: T.tx3V2,
        fontSize: 12,
        textAlign: "center",
    },

    // ── Insights teaser ──
    insightsInner: {
        backgroundColor: T.bgSurfaceV2,
        padding: 14,
    },
    insightsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    insightsTitle: {
        color: T.tx1V2,
        fontSize: 14,
        fontWeight: "800",
    },
    insightsBody: {
        color: T.tx2V2,
        fontSize: 11.5,
        marginTop: 4,
        lineHeight: 16,
    },
    insightsArrow: {
        color: T.blue,
        fontSize: 22,
        fontWeight: "800",
    },

    // ── CTAs ──
    launchOuter: {
        borderRadius: T.rLg,
        overflow: "hidden",
        marginTop: 8,
    },
    launchInner: {
        paddingVertical: 15,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 50,
    },
    launchText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
        letterSpacing: 0.4,
    },
    outlineBtn: {
        marginTop: 10,
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: T.bdBrightV2,
        borderRadius: T.rLg,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
    },
    outlineBtnText: {
        color: T.tx1V2,
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 0.3,
    },
    outlineBtnInline: {
        marginTop: 10,
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: T.bdBrightV2,
        borderRadius: T.rLg,
        paddingVertical: 12,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
    },

    // ── Canceled card ──
    canceledCard: {
        backgroundColor: T.bgSurfaceV2,
        borderRadius: T.rLg,
        borderWidth: 1.5,
        borderColor: T.crimsonBd,
        paddingHorizontal: 18,
        paddingVertical: 22,
        alignItems: "center",
    },
    canceledCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: T.crimsonDim,
        borderWidth: 1.5,
        borderColor: T.crimsonBd,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
    },
    canceledX: {
        color: T.crimson,
        fontSize: 24,
        fontWeight: "800",
    },
    canceledTitle: {
        color: T.tx1V2,
        fontSize: 22,
        fontWeight: "800",
        marginBottom: 6,
    },
    canceledBody: {
        color: T.tx2V2,
        fontSize: 12.5,
        lineHeight: 18,
        textAlign: "center",
        marginBottom: 16,
    },
    retryOuter: {
        alignSelf: "stretch",
        borderRadius: T.rLg,
        overflow: "hidden",
    },
    retryInner: {
        paddingVertical: 13,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 46,
    },
    retryText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "800",
        letterSpacing: 0.4,
    },
    canceledAuditLink: {
        marginTop: 12,
    },
    canceledAuditLinkText: {
        color: T.blue,
        fontSize: 12,
        textDecorationLine: "underline",
    },

    // ── Trace rows ──
    traceRow: {
        flexDirection: "row",
        gap: 10,
        backgroundColor: T.bgSurfaceV2,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 6,
    },
    traceGlyph: {
        fontSize: 16,
        fontWeight: "700",
        width: 16,
        textAlign: "center",
        marginTop: 1,
    },
    traceHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 3,
    },
    traceAgent: {
        color: T.tx1V2,
        fontSize: 12,
        fontWeight: "700",
    },
    traceTime: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 10,
    },
    traceMessage: {
        color: T.tx2V2,
        fontSize: 11,
        lineHeight: 15,
    },

    // ── Audit teaser ──
    auditTeaser: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: T.bgSurfaceV2,
        borderRadius: T.rLg,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginTop: 14,
    },
    auditTeaserTitle: {
        color: T.tx1V2,
        fontSize: 14,
        fontWeight: "800",
    },
    auditTeaserBody: {
        color: T.tx2V2,
        fontSize: 11.5,
        marginTop: 3,
        lineHeight: 15,
    },
    auditTeaserBtn: {
        backgroundColor: T.bgBaseV2,
        borderWidth: 1,
        borderColor: T.bdBrightV2,
        borderRadius: T.rSm,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    auditTeaserBtnText: {
        color: T.blue,
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.4,
    },

    // ── Placeholder (other statuses) ──
    placeholder: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    placeholderIcon: {
        color: T.tx3V2,
        fontSize: 30,
        marginBottom: 12,
    },
    placeholderTitle: {
        color: T.tx2V2,
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 1.0,
        marginBottom: 10,
    },
    placeholderBody: {
        color: T.tx3V2,
        fontSize: 12,
        textAlign: "center",
        lineHeight: 18,
        marginBottom: 20,
        maxWidth: 320,
    },
    placeholderBtn: {
        backgroundColor: T.teal,
        paddingHorizontal: 22,
        paddingVertical: 12,
        borderRadius: T.rLg,
        minHeight: 46,
        justifyContent: "center",
    },
    placeholderBtnText: {
        color: T.bgBaseV2,
        fontWeight: "800",
        fontSize: 12,
        letterSpacing: 0.8,
    },
});
