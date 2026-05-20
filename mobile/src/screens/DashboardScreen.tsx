import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { usePipelineContext } from "@/context/PipelineContext";
import { GradientBorderCard } from "@/components/GradientBorderCard";
import { PillBadge } from "@/components/PillBadge";
import {
    IngestionError,
    addTextSnippet,
    addUrl,
    pickAndStage,
    toRawSources,
    type StagedSource,
} from "@/services/IngestionService";
import type { RootTabParamList } from "@/navigation/types";
import { T } from "@/lib/theme";

type Tab = "FILE" | "URL" | "TEXT";

interface Props {
    operatorHandle: string;
}

export function DashboardScreen({ operatorHandle }: Props): React.ReactElement {
    const pipeline = usePipelineContext();
    const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

    const [tab, setTab] = useState<Tab>("FILE");
    const [queue, setQueue] = useState<StagedSource[]>([]);
    const [urlDraft, setUrlDraft] = useState("");
    const [textDraft, setTextDraft] = useState("");
    const [promptDraft, setPromptDraft] = useState("");
    const [demoMode, setDemoMode] = useState(false);
    const [dismissedMsg, setDismissedMsg] = useState<string | null>(null);

    const visibleError =
        pipeline.lastError && pipeline.lastError.message !== dismissedMsg
            ? pipeline.lastError
            : null;

    const addFile = async (): Promise<void> => {
        try {
            const staged = await pickAndStage();
            if (staged) setQueue((q) => [...q, staged]);
        } catch (err: unknown) {
            Alert.alert("Picker error", err instanceof IngestionError ? err.message : String(err));
        }
    };

    const addUrlEntry = (): void => {
        try {
            setQueue((q) => [...q, addUrl(urlDraft)]);
            setUrlDraft("");
        } catch (err: unknown) {
            Alert.alert("Invalid URL", err instanceof IngestionError ? err.message : String(err));
        }
    };

    const addTextEntry = (): void => {
        try {
            setQueue((q) => [...q, addTextSnippet(textDraft)]);
            setTextDraft("");
        } catch (err: unknown) {
            Alert.alert(
                "Invalid snippet",
                err instanceof IngestionError ? err.message : String(err),
            );
        }
    };

    const remove = (id: string): void => setQueue((q) => q.filter((s) => s.id !== id));

    const launch = async (): Promise<void> => {
        if (demoMode) {
            const id = await pipeline.startDemo();
            if (id) navigation.navigate("Execution");
            return;
        }
        if (queue.length === 0) return;
        const id = await pipeline.start(toRawSources(queue));
        if (id) {
            setQueue([]);
            setPromptDraft("");
            navigation.navigate("Execution");
        }
    };

    const launchDisabled =
        pipeline.isStarting || (!demoMode && queue.length === 0);

    const headerInitial = (operatorHandle || "?").charAt(0).toUpperCase();

    return (
        <SafeAreaView edges={["top"]} style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.root}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ── App header row ─────────────────────── */}
                    <View style={styles.appHeader}>
                        <Pressable style={styles.headerIconBtn} hitSlop={8}>
                            <Text style={styles.headerIconGlyph}>≡</Text>
                        </Pressable>
                        <View style={styles.headerLogoRow}>
                            <Text style={styles.headerLogoBolt}>⚡</Text>
                            <Text style={styles.headerLogo}>ChainFlow</Text>
                        </View>
                        <View style={styles.headerRight}>
                            <Pressable style={styles.headerIconBtn} hitSlop={8}>
                                <Text style={styles.headerIconGlyph}>🕐</Text>
                            </Pressable>
                            <View style={styles.headerAvatar}>
                                <Text style={styles.headerAvatarText}>{headerInitial}</Text>
                            </View>
                        </View>
                    </View>

                    {/* ── Greeting ───────────────────────────── */}
                    <View style={styles.greetingBlock}>
                        <Text style={styles.greeting}>Hello, {operatorHandle}</Text>
                        <Text style={styles.greetingSub}>
                            What workflow shall we orchestrate today?
                        </Text>
                    </View>

                    {/* ── Active pipeline pill ───────────────── */}
                    {pipeline.pipelineId ? (
                        <View style={styles.activePipelineRow}>
                            <PillBadge
                                label={pipeline.derivedStatus}
                                color={statusColor(pipeline.derivedStatus)}
                                dot
                            />
                            <Text style={styles.activePipelineId} numberOfLines={1}>
                                {pipeline.pipelineId}
                            </Text>
                        </View>
                    ) : null}

                    {/* ── Error banner ───────────────────────── */}
                    {visibleError ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorIcon}>⚠</Text>
                            <View style={styles.errorTextCol}>
                                <Text style={styles.errorTitle}>LAUNCH FAILED</Text>
                                <Text style={styles.errorBody}>{visibleError.message}</Text>
                            </View>
                            <Pressable
                                onPress={() => setDismissedMsg(visibleError.message)}
                                style={styles.errorDismiss}
                                hitSlop={8}
                            >
                                <Text style={styles.errorDismissText}>✕</Text>
                            </Pressable>
                        </View>
                    ) : null}

                    {/* ── Pipeline Configuration section ─────── */}
                    <Text style={styles.sectionEyebrow}>PIPELINE CONFIGURATION</Text>

                    <View style={styles.tabRow}>
                        {(["FILE", "URL", "TEXT"] as Tab[]).map((t) => {
                            const active = tab === t;
                            return (
                                <Pressable
                                    key={t}
                                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                                    onPress={() => setTab(t)}
                                >
                                    <Text
                                        style={[styles.tabText, active && styles.tabTextActive]}
                                    >
                                        {t}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* ── Tab body ───────────────────────────── */}
                    <View style={styles.tabBody}>
                        {tab === "FILE" ? (
                            <Pressable style={styles.dropZone} onPress={addFile}>
                                <Text style={styles.dropArrow}>⬆</Text>
                                <Text style={styles.dropTitle}>Pick a file</Text>
                                <Text style={styles.dropSubtitle}>PDF / CSV / TXT / JSON</Text>
                            </Pressable>
                        ) : tab === "URL" ? (
                            <View style={styles.row}>
                                <TextInput
                                    style={styles.input}
                                    value={urlDraft}
                                    onChangeText={setUrlDraft}
                                    placeholder="https://…"
                                    placeholderTextColor={T.tx3V2}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <Pressable style={styles.addBtn} onPress={addUrlEntry}>
                                    <Text style={styles.addBtnText}>ADD</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <View style={styles.col}>
                                <TextInput
                                    style={[styles.input, styles.inputMulti]}
                                    value={textDraft}
                                    onChangeText={setTextDraft}
                                    placeholder="Paste a text snippet…"
                                    placeholderTextColor={T.tx3V2}
                                    multiline
                                />
                                <Pressable style={styles.addBtn} onPress={addTextEntry}>
                                    <Text style={styles.addBtnText}>ADD SNIPPET</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>

                    {/* ── Demo toggle ────────────────────────── */}
                    <View style={styles.demoRow}>
                        <View style={styles.demoTextCol}>
                            <Text style={styles.demoTitle}>Diagnostic / Demo Mode</Text>
                            <Text style={styles.demoBody}>
                                Skip ingestion — backend uses disk-fallback payload.
                            </Text>
                        </View>
                        <Switch
                            value={demoMode}
                            onValueChange={setDemoMode}
                            disabled={pipeline.isStarting}
                            trackColor={{ true: T.teal, false: T.bdBrightV2 }}
                            thumbColor={T.bgBaseV2}
                        />
                    </View>

                    {/* ── Staged queue ───────────────────────── */}
                    {!demoMode ? (
                        <>
                            <Text style={styles.queueLabel}>
                                STAGED SOURCES · {queue.length}
                            </Text>
                            {queue.length === 0 ? (
                                <Text style={styles.queueEmpty}>No sources staged yet.</Text>
                            ) : (
                                <View>
                                    {queue.map((s) => (
                                        <QueueItem
                                            key={s.id}
                                            source={s}
                                            onRemove={() => remove(s.id)}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    ) : null}

                    {/* ── Prompt input bar with gradient border ─ */}
                    <View style={styles.promptWrap}>
                        <GradientBorderCard
                            colors={T.gradBlue}
                            radius={28}
                            thickness={1.5}
                            innerStyle={styles.promptInner}
                        >
                            <View style={styles.promptRow}>
                                <View style={styles.promptBadge}>
                                    <Text style={styles.promptBadgeText}>
                                        {demoMode ? "DEMO" : tab}
                                    </Text>
                                </View>
                                <TextInput
                                    style={styles.promptInput}
                                    value={promptDraft}
                                    onChangeText={setPromptDraft}
                                    placeholder="Describe your workflow intent…"
                                    placeholderTextColor={T.tx3V2}
                                />
                                <Pressable style={styles.promptIconBtn} hitSlop={6}>
                                    <Text style={styles.promptIconGlyph}>🎙</Text>
                                </Pressable>
                                <Pressable style={styles.promptIconBtn} hitSlop={6}>
                                    <Text style={styles.promptIconGlyph}>＋</Text>
                                </Pressable>
                            </View>
                        </GradientBorderCard>
                    </View>

                    {/* ── Launch Pipeline CTA ────────────────── */}
                    <Pressable
                        onPress={launch}
                        disabled={launchDisabled}
                        style={[styles.launchOuter, launchDisabled && styles.launchDisabled]}
                    >
                        <LinearGradient
                            colors={T.gradCta as readonly [string, string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.launchInner}
                        >
                            {pipeline.isStarting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.launchText}>Launch Pipeline ⚡</Text>
                            )}
                        </LinearGradient>
                    </Pressable>

                    <Text style={styles.statusItalic}>
                        Awaiting active payload for full diagnostic ingestion…
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ──────────────────────────────────────────────────────────
// Queue item — inline so it picks up v2 theme
// ──────────────────────────────────────────────────────────
function QueueItem({
    source,
    onRemove,
}: {
    source: StagedSource;
    onRemove: () => void;
}): React.ReactElement {
    return (
        <View style={styles.queueCard}>
            <View style={styles.queueBody}>
                <View style={styles.queueHeaderRow}>
                    <View style={styles.queueTypePill}>
                        <Text style={styles.queueTypeText}>
                            {source.sourceType.toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.queueSize}>{formatBytes(source.sizeBytes)}</Text>
                </View>
                <Text style={styles.queueName} numberOfLines={1}>
                    {source.displayName}
                </Text>
                <Text style={styles.queueId}>{source.id}</Text>
            </View>
            <Pressable onPress={onRemove} style={styles.queueRemove} hitSlop={8}>
                <Text style={styles.queueRemoveText}>✕</Text>
            </Pressable>
        </View>
    );
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
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
    root: { flex: 1, backgroundColor: T.bgBaseV2 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 18, paddingBottom: 40 },

    // ── App header ──
    appHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 6,
        paddingBottom: 14,
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: T.bgSurfaceV2,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        alignItems: "center",
        justifyContent: "center",
    },
    headerIconGlyph: {
        color: T.tx2V2,
        fontSize: 16,
    },
    headerLogoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    headerLogoBolt: {
        color: T.teal,
        fontSize: 16,
    },
    headerLogo: {
        color: T.tx1V2,
        fontSize: 16,
        fontWeight: "800",
        letterSpacing: -0.3,
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    headerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: T.tealDim,
        borderWidth: 1,
        borderColor: T.tealBd,
        alignItems: "center",
        justifyContent: "center",
    },
    headerAvatarText: {
        color: T.teal,
        fontSize: 14,
        fontWeight: "800",
    },

    // ── Greeting ──
    greetingBlock: {
        marginBottom: 18,
    },
    greeting: {
        color: T.tx1V2,
        fontSize: 30,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    greetingSub: {
        color: T.tx2V2,
        fontSize: 13,
        marginTop: 6,
        lineHeight: 18,
    },

    // ── Active pipeline ──
    activePipelineRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
    },
    activePipelineId: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 11,
        flexShrink: 1,
    },

    // ── Error ──
    errorBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: T.crimsonDim,
        borderWidth: 1,
        borderColor: T.crimsonBd,
        borderRadius: T.rMd,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
    },
    errorIcon: {
        color: T.crimson,
        fontSize: 16,
        fontWeight: "700",
    },
    errorTextCol: { flex: 1 },
    errorTitle: {
        color: T.crimson,
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    errorBody: {
        color: T.crimson,
        fontSize: 11,
    },
    errorDismiss: {
        minWidth: 28,
        minHeight: 28,
        alignItems: "center",
        justifyContent: "center",
    },
    errorDismissText: {
        color: T.crimson,
        fontSize: 16,
        fontWeight: "700",
    },

    // ── Section eyebrow ──
    sectionEyebrow: {
        color: T.tx3V2,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 10,
    },

    // ── Tab row ──
    tabRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 12,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: T.bdDimV2,
        minHeight: 44,
        justifyContent: "center",
    },
    tabBtnActive: {
        borderBottomColor: T.blue,
    },
    tabText: {
        color: T.tx3V2,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.8,
    },
    tabTextActive: {
        color: T.tx1V2,
    },
    tabBody: {
        marginBottom: 14,
    },

    // ── Drop zone ──
    dropZone: {
        backgroundColor: T.bgSurfaceV2,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: T.bdBrightV2,
        borderRadius: T.rLg,
        paddingVertical: 30,
        paddingHorizontal: 14,
        alignItems: "center",
    },
    dropArrow: {
        color: T.teal,
        fontSize: 28,
        marginBottom: 8,
    },
    dropTitle: {
        color: T.tx1V2,
        fontSize: 14,
        fontWeight: "700",
    },
    dropSubtitle: {
        color: T.tx3V2,
        fontSize: 11,
        marginTop: 4,
        letterSpacing: 0.4,
    },

    // ── Inputs ──
    row: { flexDirection: "row", gap: 8 },
    col: { gap: 8 },
    input: {
        flex: 1,
        backgroundColor: T.bgInput,
        borderWidth: 1,
        borderColor: T.bdDefaultV2,
        borderRadius: T.rMd,
        color: T.tx1V2,
        fontSize: 13,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 44,
    },
    inputMulti: {
        minHeight: 90,
        textAlignVertical: "top",
    },
    addBtn: {
        backgroundColor: T.bgElevatedV2,
        borderWidth: 1,
        borderColor: T.bdBrightV2,
        borderRadius: T.rMd,
        paddingHorizontal: 16,
        paddingVertical: 10,
        justifyContent: "center",
        alignItems: "center",
        minHeight: 44,
    },
    addBtnText: {
        color: T.tx1V2,
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.6,
    },

    // ── Demo toggle ──
    demoRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: T.bgSurfaceV2,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        borderRadius: T.rMd,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
    },
    demoTextCol: { flex: 1, paddingRight: 10 },
    demoTitle: {
        color: T.amber,
        fontSize: 12,
        fontWeight: "800",
    },
    demoBody: {
        color: T.tx3V2,
        fontSize: 11,
        marginTop: 2,
        lineHeight: 15,
    },

    // ── Queue ──
    queueLabel: {
        color: T.tx3V2,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1.0,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    queueEmpty: {
        color: T.tx3V2,
        fontSize: 11,
        textAlign: "center",
        paddingVertical: 8,
        fontStyle: "italic",
    },
    queueCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: T.bgSurfaceV2,
        borderRadius: T.rMd,
        borderWidth: 1,
        borderColor: T.bdDimV2,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 6,
    },
    queueBody: { flex: 1 },
    queueHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    queueTypePill: {
        backgroundColor: T.blueDim,
        borderWidth: 1,
        borderColor: T.blueBd,
        borderRadius: T.rFull,
        paddingHorizontal: 8,
        paddingVertical: 1,
    },
    queueTypeText: {
        color: T.blue,
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 0.5,
    },
    queueSize: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 10,
    },
    queueName: {
        color: T.tx1V2,
        fontSize: 12.5,
        fontWeight: "600",
    },
    queueId: {
        color: T.tx3V2,
        fontFamily: T.fontMono,
        fontSize: 9,
        marginTop: 2,
    },
    queueRemove: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: T.crimsonDim,
        borderWidth: 1,
        borderColor: T.crimsonBd,
        alignItems: "center",
        justifyContent: "center",
    },
    queueRemoveText: {
        color: T.crimson,
        fontSize: 14,
        fontWeight: "800",
    },

    // ── Prompt bar ──
    promptWrap: {
        marginTop: 18,
        marginBottom: 14,
    },
    promptInner: {
        backgroundColor: T.bgSurfaceV2,
        borderRadius: 26.5,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    promptRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    promptBadge: {
        backgroundColor: T.tealDim,
        borderWidth: 1,
        borderColor: T.tealBd,
        borderRadius: T.rFull,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    promptBadgeText: {
        color: T.teal,
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.6,
    },
    promptInput: {
        flex: 1,
        color: T.tx1V2,
        fontSize: 13,
        paddingVertical: 6,
        paddingHorizontal: 4,
        minHeight: 38,
    },
    promptIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    promptIconGlyph: {
        fontSize: 14,
    },

    // ── Launch CTA ──
    launchOuter: {
        borderRadius: T.rLg,
        overflow: "hidden",
    },
    launchInner: {
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 52,
    },
    launchDisabled: {
        opacity: 0.45,
    },
    launchText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
        letterSpacing: 0.4,
    },

    statusItalic: {
        color: T.tx3V2,
        fontStyle: "italic",
        fontSize: 11,
        textAlign: "center",
        marginTop: 14,
    },
});
