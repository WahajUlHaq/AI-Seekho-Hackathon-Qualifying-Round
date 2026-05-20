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
import {
    IngestionError,
    addTextSnippet,
    addUrl,
    pickAndStage,
    toRawSources,
    type StagedSource,
} from "@/services/IngestionService";
import { StagedSourceCard } from "@/components/StagedSourceCard";

type Tab = "file" | "url" | "text";

interface Props {
    operatorHandle: string;
    isStarting: boolean;
    lastErrorMessage?: string | null;
    onStart: (sources: ReturnType<typeof toRawSources>) => Promise<void>;
    onStartDemo: () => Promise<void>;
}

export function IngestionStagingScreen({
    operatorHandle,
    isStarting,
    lastErrorMessage,
    onStart,
    onStartDemo,
}: Props): React.ReactElement {
    const [demoMode, setDemoMode] = useState(false);
    const [tab, setTab] = useState<Tab>("file");
    const [queue, setQueue] = useState<StagedSource[]>([]);
    const [urlDraft, setUrlDraft] = useState("");
    const [textDraft, setTextDraft] = useState("");

    const addFile = async (): Promise<void> => {
        try {
            const staged = await pickAndStage();
            if (staged) setQueue((q) => [...q, staged]);
        } catch (err: unknown) {
            const msg = err instanceof IngestionError ? err.message : String(err);
            Alert.alert("Picker error", msg);
        }
    };

    const addUrlEntry = (): void => {
        try {
            const staged = addUrl(urlDraft);
            setQueue((q) => [...q, staged]);
            setUrlDraft("");
        } catch (err: unknown) {
            const msg = err instanceof IngestionError ? err.message : String(err);
            Alert.alert("Invalid URL", msg);
        }
    };

    const addTextEntry = (): void => {
        try {
            const staged = addTextSnippet(textDraft);
            setQueue((q) => [...q, staged]);
            setTextDraft("");
        } catch (err: unknown) {
            const msg = err instanceof IngestionError ? err.message : String(err);
            Alert.alert("Invalid snippet", msg);
        }
    };

    const remove = (id: string): void => setQueue((q) => q.filter((s) => s.id !== id));

    const launchStaged = async (): Promise<void> => {
        if (queue.length === 0) return;
        await onStart(toRawSources(queue));
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Stage Pipeline</Text>
                <Text style={styles.operator}>op: {operatorHandle}</Text>
            </View>

            {lastErrorMessage ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorTitle}>LAUNCH FAILED</Text>
                    <Text style={styles.errorBody}>{lastErrorMessage}</Text>
                </View>
            ) : null}

            <View style={styles.demoBox}>
                <View style={styles.demoTextCol}>
                    <Text style={styles.demoTitle}>Diagnostic / Demo Mode</Text>
                    <Text style={styles.demoBody}>
                        Submit an empty payload — backend will trigger its disk-fallback ingestion.
                    </Text>
                </View>
                <Switch
                    value={demoMode}
                    onValueChange={setDemoMode}
                    disabled={isStarting}
                    trackColor={{ true: "#34d399", false: "#374151" }}
                    thumbColor={demoMode ? "#0b0b0f" : "#9ca3af"}
                />
            </View>

            {demoMode ? (
                <View style={styles.demoLaunch}>
                    <Text style={styles.demoLaunchText}>
                        Staging is disabled. Press the button below to fire a diagnostic run.
                    </Text>
                    <Pressable
                        style={[styles.btn, styles.btnDemo, isStarting && styles.btnDisabled]}
                        onPress={() => onStartDemo()}
                        disabled={isStarting}
                    >
                        {isStarting ? (
                            <ActivityIndicator color="#0b0b0f" />
                        ) : (
                            <Text style={styles.btnText}>Launch demo run (disk fallback)</Text>
                        )}
                    </Pressable>
                </View>
            ) : (
                <>
                    <View style={styles.tabs}>
                        {(["file", "url", "text"] as Tab[]).map((t) => (
                            <Pressable
                                key={t}
                                style={[styles.tab, tab === t && styles.tabActive]}
                                onPress={() => setTab(t)}
                            >
                                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                                    {t.toUpperCase()}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <View style={styles.tabBody}>
                        {tab === "file" ? (
                            <Pressable style={styles.pickerBtn} onPress={addFile}>
                                <Text style={styles.pickerBtnText}>Pick a file (PDF / CSV / TXT / JSON)</Text>
                            </Pressable>
                        ) : tab === "url" ? (
                            <View style={styles.row}>
                                <TextInput
                                    style={styles.input}
                                    value={urlDraft}
                                    onChangeText={setUrlDraft}
                                    placeholder="https://…"
                                    placeholderTextColor="#6b7280"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <Pressable style={styles.addBtn} onPress={addUrlEntry}>
                                    <Text style={styles.addBtnText}>Add</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <View style={styles.col}>
                                <TextInput
                                    style={[styles.input, styles.inputMulti]}
                                    value={textDraft}
                                    onChangeText={setTextDraft}
                                    placeholder="Paste a text snippet…"
                                    placeholderTextColor="#6b7280"
                                    multiline
                                />
                                <Pressable style={styles.addBtn} onPress={addTextEntry}>
                                    <Text style={styles.addBtnText}>Add</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>

                    <Text style={styles.queueLabel}>Queue ({queue.length})</Text>
                    <ScrollView style={styles.queue}>
                        {queue.length === 0 ? (
                            <Text style={styles.queueEmpty}>No sources staged yet.</Text>
                        ) : (
                            queue.map((s) => (
                                <StagedSourceCard key={s.id} source={s} onRemove={() => remove(s.id)} />
                            ))
                        )}
                    </ScrollView>

                    <Pressable
                        style={[
                            styles.btn,
                            styles.btnLaunch,
                            (queue.length === 0 || isStarting) && styles.btnDisabled,
                        ]}
                        onPress={launchStaged}
                        disabled={queue.length === 0 || isStarting}
                    >
                        {isStarting ? (
                            <ActivityIndicator color="#0b0b0f" />
                        ) : (
                            <Text style={styles.btnText}>Launch Pipeline</Text>
                        )}
                    </Pressable>
                </>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0b0b0f", padding: 12 },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 12,
        marginTop: 8,
    },
    title: {
        color: "#e5e7eb",
        fontSize: 22,
        fontWeight: "700",
    },
    operator: {
        color: "#6b7280",
        fontFamily: "Menlo",
        fontSize: 11,
    },
    demoBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111827",
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    demoTextCol: { flex: 1, paddingRight: 12 },
    demoTitle: {
        color: "#fbbf24",
        fontFamily: "Menlo",
        fontSize: 12,
        fontWeight: "700",
    },
    demoBody: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 11,
        marginTop: 2,
    },
    demoLaunch: {
        marginTop: 8,
    },
    demoLaunchText: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 12,
        marginBottom: 12,
    },
    tabs: {
        flexDirection: "row",
        gap: 4,
        marginBottom: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: "#1f2937",
        alignItems: "center",
    },
    tabActive: {
        backgroundColor: "#374151",
    },
    tabText: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 11,
        fontWeight: "700",
    },
    tabTextActive: {
        color: "#e5e7eb",
    },
    tabBody: { marginBottom: 12 },
    pickerBtn: {
        backgroundColor: "#1f2937",
        borderRadius: 8,
        padding: 16,
        alignItems: "center",
    },
    pickerBtnText: {
        color: "#60a5fa",
        fontFamily: "Menlo",
        fontSize: 12,
    },
    row: { flexDirection: "row", gap: 6 },
    col: { gap: 6 },
    input: {
        flex: 1,
        backgroundColor: "#111827",
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontSize: 12,
        padding: 10,
        borderRadius: 6,
    },
    inputMulti: { minHeight: 80, textAlignVertical: "top" },
    addBtn: {
        backgroundColor: "#374151",
        paddingHorizontal: 16,
        justifyContent: "center",
        borderRadius: 6,
    },
    addBtnText: {
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontSize: 12,
        fontWeight: "700",
    },
    queueLabel: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    queue: {
        flex: 1,
        backgroundColor: "transparent",
    },
    queueEmpty: {
        color: "#6b7280",
        fontFamily: "Menlo",
        fontSize: 11,
        textAlign: "center",
        marginTop: 20,
    },
    btn: {
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
    },
    btnLaunch: { backgroundColor: "#34d399" },
    btnDemo: { backgroundColor: "#fbbf24" },
    btnDisabled: { opacity: 0.4 },
    btnText: {
        color: "#0b0b0f",
        fontFamily: "Menlo",
        fontWeight: "700",
        fontSize: 13,
    },
    errorBox: {
        backgroundColor: "#7f1d1d",
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
    },
    errorTitle: {
        color: "#fecaca",
        fontFamily: "Menlo",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    errorBody: {
        color: "#fee2e2",
        fontFamily: "Menlo",
        fontSize: 11,
    },
});
