import React, { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import type { PipelineApprovalRecord, Priority } from "@/types/pipeline";

interface Props {
    visible: boolean;
    record: PipelineApprovalRecord | null;
    operatorHandle: string;
    isActing: boolean;
    errorMessage?: string | null;
    onApprove: () => void;
    onReject: (reason?: string) => void;
}

const PRIORITY_COLOR: Record<Priority, string> = {
    CRITICAL: "#f87171",
    HIGH: "#fb923c",
    MEDIUM: "#facc15",
    LOW: "#9ca3af",
};

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

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.scrim}>
                <View style={styles.sheet}>
                    <View style={styles.headerRow}>
                        <Text style={styles.heading}>HITL APPROVAL</Text>
                        <View
                            style={[
                                styles.prioPill,
                                { backgroundColor: PRIORITY_COLOR[record.proposal.overall_priority] },
                            ]}
                        >
                            <Text style={styles.prioText}>{record.proposal.overall_priority}</Text>
                        </View>
                    </View>
                    <Text style={styles.pipeline}>{record.pipeline_id}</Text>

                    <ScrollView style={styles.scroll}>
                        <Text style={styles.label}>Rationale</Text>
                        <Text style={styles.rationale}>{record.proposal.rationale}</Text>

                        <Text style={styles.label}>
                            Proposed actions ({record.proposal.proposedActions.length})
                        </Text>
                        {record.proposal.proposedActions.map((a) => (
                            <View key={a.action_id} style={styles.action}>
                                <View style={styles.actionHeader}>
                                    <Text style={styles.actionId}>{a.action_id}</Text>
                                    <View
                                        style={[
                                            styles.prioPillSm,
                                            { backgroundColor: PRIORITY_COLOR[a.priority] },
                                        ]}
                                    >
                                        <Text style={styles.prioTextSm}>{a.priority}</Text>
                                    </View>
                                </View>
                                <Text style={styles.actionTitle}>{a.title}</Text>
                                <Text style={styles.actionDesc}>{a.description}</Text>
                                {a.depends_on.length > 0 && (
                                    <Text style={styles.actionDeps}>depends_on: {a.depends_on.join(", ")}</Text>
                                )}
                            </View>
                        ))}

                        <Text style={styles.label}>Rejection reason (optional)</Text>
                        <TextInput
                            value={reason}
                            onChangeText={setReason}
                            placeholder="Why are you rejecting?"
                            placeholderTextColor="#6b7280"
                            style={styles.input}
                            multiline
                            editable={!isActing}
                        />

                        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
                    </ScrollView>

                    <View style={styles.actionsRow}>
                        <Pressable
                            style={[styles.btn, styles.btnReject, isActing && styles.btnDisabled]}
                            disabled={isActing}
                            onPress={() => onReject(reason.trim() || undefined)}
                        >
                            <Text style={styles.btnText}>Reject</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.btn, styles.btnApprove, isActing && styles.btnDisabled]}
                            disabled={isActing}
                            onPress={onApprove}
                        >
                            {isActing ? (
                                <ActivityIndicator color="#0b0b0f" />
                            ) : (
                                <Text style={[styles.btnText, styles.btnTextDark]}>
                                    Sign &amp; Approve
                                </Text>
                            )}
                        </Pressable>
                    </View>
                    <Text style={styles.operator}>signing as {operatorHandle}</Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    scrim: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: "#111827",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 16,
        maxHeight: "85%",
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    heading: {
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontWeight: "700",
        fontSize: 14,
        letterSpacing: 1,
    },
    pipeline: {
        color: "#6b7280",
        fontFamily: "Menlo",
        fontSize: 11,
        marginTop: 2,
        marginBottom: 10,
    },
    scroll: {
        maxHeight: 460,
    },
    label: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 10,
        textTransform: "uppercase",
        marginTop: 10,
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    rationale: {
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontSize: 12,
        lineHeight: 17,
    },
    action: {
        backgroundColor: "#1f2937",
        borderRadius: 6,
        padding: 8,
        marginBottom: 6,
    },
    actionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    actionId: {
        color: "#60a5fa",
        fontFamily: "Menlo",
        fontSize: 11,
        fontWeight: "700",
    },
    actionTitle: {
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontSize: 12,
        marginTop: 2,
        fontWeight: "600",
    },
    actionDesc: {
        color: "#9ca3af",
        fontFamily: "Menlo",
        fontSize: 11,
        marginTop: 2,
        lineHeight: 15,
    },
    actionDeps: {
        color: "#6b7280",
        fontFamily: "Menlo",
        fontSize: 10,
        marginTop: 2,
    },
    prioPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
    },
    prioText: {
        color: "#0b0b0f",
        fontFamily: "Menlo",
        fontSize: 10,
        fontWeight: "700",
    },
    prioPillSm: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 999,
    },
    prioTextSm: {
        color: "#0b0b0f",
        fontFamily: "Menlo",
        fontSize: 9,
        fontWeight: "700",
    },
    input: {
        backgroundColor: "#0b0b0f",
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontSize: 12,
        padding: 8,
        borderRadius: 6,
        minHeight: 60,
        textAlignVertical: "top",
    },
    error: {
        color: "#f87171",
        fontFamily: "Menlo",
        fontSize: 11,
        marginTop: 8,
    },
    actionsRow: {
        flexDirection: "row",
        gap: 8,
        marginTop: 12,
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    btnReject: {
        backgroundColor: "#4c1d95",
    },
    btnApprove: {
        backgroundColor: "#34d399",
    },
    btnDisabled: {
        opacity: 0.5,
    },
    btnText: {
        color: "#e5e7eb",
        fontFamily: "Menlo",
        fontWeight: "700",
        fontSize: 13,
    },
    btnTextDark: {
        color: "#0b0b0f",
    },
    operator: {
        color: "#6b7280",
        fontFamily: "Menlo",
        fontSize: 10,
        marginTop: 8,
        textAlign: "center",
    },
});
