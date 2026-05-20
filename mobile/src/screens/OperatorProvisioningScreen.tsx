import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { isValidHandle, setOperatorHandle } from "@/services/IdentityService";

interface Props {
    onProvisioned: (handle: string) => void;
}

export function OperatorProvisioningScreen({ onProvisioned }: Props): React.ReactElement {
    const [handle, setHandle] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const valid = isValidHandle(handle);

    const submit = async (): Promise<void> => {
        if (!valid) {
            setError("2–64 chars: letters, digits, '.', '_', '-'.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await setOperatorHandle(handle);
            onProvisioned(handle.trim());
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={styles.card}>
                <Text style={styles.eyebrow}>FIRST-TIME PROVISIONING</Text>
                <Text style={styles.title}>Operator Identity</Text>
                <Text style={styles.body}>
                    Your operator handle is embedded in every HITL signature and persisted to the
                    audit ledger. It cannot be changed for committed receipts, so choose carefully.
                </Text>

                <Text style={styles.label}>Handle</Text>
                <TextInput
                    style={styles.input}
                    value={handle}
                    onChangeText={(v) => {
                        setHandle(v);
                        setError(null);
                    }}
                    placeholder="operator-arham"
                    placeholderTextColor="#6b7280"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!saving}
                />
                <Text style={styles.hint}>
                    2–64 chars · letters, digits, '.', '_', '-'
                </Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                    style={[
                        styles.btn,
                        (!valid || saving) && styles.btnDisabled,
                    ]}
                    onPress={submit}
                    disabled={!valid || saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#0b0b0f" />
                    ) : (
                        <Text style={styles.btnText}>Provision &amp; Continue</Text>
                    )}
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#0b0b0f",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    card: {
        backgroundColor: "#111827",
        borderRadius: 12,
        padding: 20,
        width: "100%",
        maxWidth: 480,
    },
    eyebrow: {
        color: "#fbbf24",
        fontFamily: "Menlo",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1,
    },
    title: {
        color: "#e5e7eb",
        fontSize: 22,
        fontWeight: "700",
        marginTop: 4,
        marginBottom: 8,
    },
    body: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 20,
    },
    label: {
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontSize: 11,
        marginBottom: 4,
    },
    input: {
        backgroundColor: "#0b0b0f",
        color: "#e5e7eb",
        borderRadius: 8,
        padding: 12,
        fontFamily: "Menlo",
        fontSize: 14,
    },
    hint: {
        color: "#6b7280",
        fontFamily: "Menlo",
        fontSize: 10,
        marginTop: 4,
    },
    error: {
        color: "#f87171",
        fontFamily: "Menlo",
        fontSize: 11,
        marginTop: 8,
    },
    btn: {
        backgroundColor: "#34d399",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 16,
    },
    btnDisabled: {
        opacity: 0.4,
    },
    btnText: {
        color: "#0b0b0f",
        fontFamily: "Menlo",
        fontWeight: "700",
        fontSize: 14,
    },
});
