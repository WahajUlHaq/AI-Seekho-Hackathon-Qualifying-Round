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
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { usePipelineContext } from "@/context/PipelineContext";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { StagedSourceCard } from "@/components/StagedSourceCard";
import { StatusBadge } from "@/components/StatusBadge";
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

type Tab = "file" | "url" | "text";

interface Props {
    operatorHandle: string;
}

export function DashboardScreen({ operatorHandle }: Props): React.ReactElement {
    const pipeline = usePipelineContext();
    const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

    const [demoMode, setDemoMode] = useState(false);
    const [tab, setTab] = useState<Tab>("file");
    const [queue, setQueue] = useState<StagedSource[]>([]);
    const [urlDraft, setUrlDraft] = useState("");
    const [textDraft, setTextDraft] = useState("");
    const [dismissedMsg, setDismissedMsg] = useState<string | null>(null);
    const [urlFocused, setUrlFocused] = useState(false);
    const [textFocused, setTextFocused] = useState(false);

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
            Alert.alert("Invalid snippet", err instanceof IngestionError ? err.message : String(err));
        }
    };

    const remove = (id: string): void => setQueue((q) => q.filter((s) => s.id !== id));

    const launchStaged = async (): Promise<void> => {
        if (queue.length === 0) return;
        const id = await pipeline.start(toRawSources(queue));
        if (id) {
            setQueue([]);
            navigation.navigate("Execution");
        }
    };

    const launchDemo = async (): Promise<void> => {
        const id = await pipeline.startDemo();
        if (id) navigation.navigate("Execution");
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Header ───────────────────────────── */}
                <View style={styles.header}>
                    <View style={styles.headerCol}>
                        <Text style={styles.eyebrow}>OPERATOR</Text>
                        <Text style={styles.operator} numberOfLines={1}>
                            {operatorHandle}
                        </Text>
                    </View>
                    {pipeline.pipelineId ? (
                        <View style={styles.headerCol}>
                            <Text style={styles.eyebrow}>ACTIVE PIPELINE</Text>
                            <View style={styles.activeRow}>
                                <StatusBadge status={pipeline.derivedStatus} />
                            </View>
                            <Text style={styles.pipelineId} numberOfLines={1}>
                                {pipeline.pipelineId}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <DashboardMetrics receipts={pipeline.ledgerReceipts} />

                <View style={styles.stagingSection}>
                    <Text style={styles.sectionHeading}>LAUNCH PIPELINE</Text>

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

                    <View style={styles.demoBox}>
                        <View style={styles.demoTextCol}>
                            <Text style={styles.demoTitle}>Diagnostic / Demo Mode</Text>
                            <Text style={styles.demoBody}>
                                Submit empty payload — backend uses disk-fallback ingestion.
                            </Text>
                        </View>
                        <Switch
                            value={demoMode}
                            onValueChange={setDemoMode}
                            disabled={pipeline.isStarting}
                            trackColor={{ true: T.emerald, false: T.bdBright }}
                            thumbColor={T.bgBase}
                        />
                    </View>

                    {demoMode ? (
                        <Pressable
                            style={[
                                styles.btn,
                                styles.btnDemo,
                                pipeline.isStarting && styles.btnDisabled,
                            ]}
                            onPress={launchDemo}
                            disabled={pipeline.isStarting}
                        >
                            {pipeline.isStarting ? (
                                <ActivityIndicator color={T.bgBase} />
                            ) : (
                                <Text style={styles.btnText}>
                                    Launch demo run (disk fallback)
                                </Text>
                            )}
                        </Pressable>
                    ) : (
                        <>
                            <View style={styles.tabs}>
                                {(["file", "url", "text"] as Tab[]).map((t) => {
                                    const active = tab === t;
                                    return (
                                        <Pressable
                                            key={t}
                                            style={[styles.tab, active && styles.tabActive]}
                                            onPress={() => setTab(t)}
                                        >
                                            <Text
                                                style={[
                                                    styles.tabText,
                                                    active && styles.tabTextActive,
                                                ]}
                                            >
                                                {t.toUpperCase()}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <View style={styles.tabBody}>
                                {tab === "file" ? (
                                    <Pressable style={styles.pickerBtn} onPress={addFile}>
                                        <Text style={styles.pickerBtnText}>
                                            Pick a file (PDF / CSV / TXT / JSON)
                                        </Text>
                                    </Pressable>
                                ) : tab === "url" ? (
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                urlFocused && styles.inputFocused,
                                            ]}
                                            value={urlDraft}
                                            onChangeText={setUrlDraft}
                                            placeholder="https://…"
                                            placeholderTextColor={T.tx3}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            onFocus={() => setUrlFocused(true)}
                                            onBlur={() => setUrlFocused(false)}
                                        />
                                        <Pressable style={styles.addBtn} onPress={addUrlEntry}>
                                            <Text style={styles.addBtnText}>ADD</Text>
                                        </Pressable>
                                    </View>
                                ) : (
                                    <View style={styles.col}>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                styles.inputMulti,
                                                textFocused && styles.inputFocused,
                                            ]}
                                            value={textDraft}
                                            onChangeText={setTextDraft}
                                            placeholder="Paste a text snippet…"
                                            placeholderTextColor={T.tx3}
                                            multiline
                                            onFocus={() => setTextFocused(true)}
                                            onBlur={() => setTextFocused(false)}
                                        />
                                        <Pressable style={styles.addBtn} onPress={addTextEntry}>
                                            <Text style={styles.addBtnText}>ADD</Text>
                                        </Pressable>
                                    </View>
                                )}
                            </View>

                            <Text style={styles.queueLabel}>QUEUE · {queue.length}</Text>
                            {queue.length === 0 ? (
                                <Text style={styles.queueEmpty}>No sources staged yet.</Text>
                            ) : (
                                <View style={styles.queue}>
                                    {queue.map((s) => (
                                        <StagedSourceCard
                                            key={s.id}
                                            source={s}
                                            onRemove={() => remove(s.id)}
                                        />
                                    ))}
                                </View>
                            )}

                            <Pressable
                                style={[
                                    styles.btn,
                                    styles.btnLaunch,
                                    (queue.length === 0 || pipeline.isStarting) &&
                                        styles.btnDisabled,
                                ]}
                                onPress={launchStaged}
                                disabled={queue.length === 0 || pipeline.isStarting}
                            >
                                {pipeline.isStarting ? (
                                    <ActivityIndicator color={T.bgBase} />
                                ) : (
                                    <Text style={styles.btnText}>Launch Pipeline</Text>
                                )}
                            </Pressable>
                        </>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bgBase },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 24 },

    // ── Header ──
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        backgroundColor: T.bgSurface,
        borderBottomWidth: 1,
        borderBottomColor: T.bdDim,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    headerCol: { flex: 1 },
    eyebrow: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: 1.0,
    },
    operator: {
        color: T.tx1,
        fontFamily: T.fontMono,
        fontSize: 13,
        fontWeight: "700",
        marginTop: 2,
    },
    activeRow: { marginTop: 4 },
    pipelineId: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        marginTop: 3,
    },

    // ── Staging ──
    stagingSection: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 4,
    },
    sectionHeading: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: "700",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 10,
    },

    // ── Error box ──
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
        marginBottom: 10,
    },
    errorIcon: {
        color: T.crimson,
        fontSize: 16,
        fontFamily: T.fontMono,
        fontWeight: "700",
    },
    errorTextCol: {
        flex: 1,
    },
    errorTitle: {
        color: T.crimson,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    errorBody: {
        color: T.crimson,
        fontFamily: T.fontMono,
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

    // ── Demo box ──
    demoBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: T.bgSurface,
        borderWidth: 1,
        borderColor: T.bdDim,
        borderRadius: T.rMd,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    demoTextCol: { flex: 1, paddingRight: 12 },
    demoTitle: {
        color: T.amber,
        fontFamily: T.fontMono,
        fontSize: 11,
        fontWeight: "700",
    },
    demoBody: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 10,
        marginTop: 2,
    },

    // ── Source tabs ──
    tabs: {
        flexDirection: "row",
        gap: 4,
        marginBottom: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        backgroundColor: T.bgSurface,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
        minHeight: 44,
        justifyContent: "center",
    },
    tabActive: {
        backgroundColor: T.bgElevated,
        borderBottomColor: T.blue,
    },
    tabText: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    tabTextActive: {
        color: T.tx1,
    },
    tabBody: { marginBottom: 12 },

    // ── File picker + inputs ──
    pickerBtn: {
        backgroundColor: T.bgSurface,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: T.bdBright,
        borderRadius: T.rMd,
        padding: 14,
        alignItems: "center",
    },
    pickerBtnText: {
        color: T.blue,
        fontFamily: T.fontMono,
        fontSize: 11,
        fontWeight: "600",
    },
    row: { flexDirection: "row", gap: 6 },
    col: { gap: 6 },
    input: {
        flex: 1,
        backgroundColor: T.bgInput,
        borderWidth: 1,
        borderColor: T.bdDefault,
        borderRadius: T.rSm,
        color: T.tx1,
        fontFamily: T.fontMono,
        fontSize: 11,
        paddingHorizontal: 10,
        paddingVertical: 9,
    },
    inputFocused: {
        borderColor: T.blue,
    },
    inputMulti: { minHeight: 80, textAlignVertical: "top" },
    addBtn: {
        backgroundColor: T.bgElevated,
        borderWidth: 1,
        borderColor: T.bdBright,
        borderRadius: T.rSm,
        paddingHorizontal: 14,
        paddingVertical: 9,
        justifyContent: "center",
        alignItems: "center",
        minHeight: 44,
    },
    addBtnText: {
        color: T.tx1,
        fontFamily: T.fontMono,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.6,
    },

    // ── Queue ──
    queueLabel: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    queue: {},
    queueEmpty: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 11,
        textAlign: "center",
        paddingVertical: 12,
    },

    // ── Launch buttons ──
    btn: {
        borderRadius: T.rMd,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
        minHeight: 44,
    },
    btnLaunch: { backgroundColor: T.emerald },
    btnDemo: { backgroundColor: T.amber },
    btnDisabled: { opacity: 0.35 },
    btnText: {
        color: T.bgBase,
        fontFamily: T.fontMono,
        fontWeight: "700",
        fontSize: 13,
        letterSpacing: 0.4,
    },
});
