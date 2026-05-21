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
import { T } from "@/lib/theme";

interface Props {
    onProvisioned: (handle: string) => void;
}

export function OperatorProvisioningScreen({ onProvisioned }: Props): React.ReactElement {
    const [handle, setHandle] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [focused, setFocused] = useState(false);

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

                <Text style={styles.label}>HANDLE</Text>
                <TextInput
                    style={[styles.input, focused && styles.inputFocused]}
                    value={handle}
                    onChangeText={(v) => {
                        setHandle(v);
                        setError(null);
                    }}
                    placeholder="operator-arham"
                    placeholderTextColor={T.tx3}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!saving}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                />
                <Text style={styles.hint}>
                    2–64 chars · letters, digits, '.', '_', '-'
                </Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                    style={[styles.btn, (!valid || saving) && styles.btnDisabled]}
                    onPress={submit}
                    disabled={!valid || saving}
                >
                    {saving ? (
                        <ActivityIndicator color={T.bgBase} />
                    ) : (
                        <Text style={styles.btnText}>PROVISION &amp; CONTINUE</Text>
                    )}
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: T.bgBase,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    card: {
        backgroundColor: T.bgSurface,
        borderWidth: 1,
        borderColor: T.bdDim,
        borderRadius: T.rLg,
        padding: 20,
        width: "100%",
        maxWidth: 480,
    },
    eyebrow: {
        color: T.amber,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1.0,
    },
    title: {
        color: T.tx1,
        fontSize: 22,
        fontWeight: "700",
        marginTop: 4,
        marginBottom: 10,
    },
    body: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 11,
        lineHeight: 17,
        marginBottom: 20,
    },
    label: {
        color: T.tx2,
        fontFamily: T.fontMono,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    input: {
        backgroundColor: T.bgInput,
        borderWidth: 1,
        borderColor: T.bdDefault,
        borderRadius: T.rMd,
        color: T.tx1,
        fontFamily: T.fontMono,
        fontSize: 12,
        padding: 12,
    },
    inputFocused: {
        borderColor: T.blue,
    },
    hint: {
        color: T.tx3,
        fontFamily: T.fontMono,
        fontSize: 10,
        marginTop: 6,
    },
    error: {
        color: T.crimson,
        fontFamily: T.fontMono,
        fontSize: 11,
        marginTop: 10,
    },
    btn: {
        backgroundColor: T.emerald,
        borderRadius: T.rMd,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 18,
        minHeight: 44,
    },
    btnDisabled: {
        opacity: 0.35,
    },
    btnText: {
        color: T.bgBase,
        fontFamily: T.fontMono,
        fontWeight: "700",
        fontSize: 13,
        letterSpacing: 0.6,
    },
});
