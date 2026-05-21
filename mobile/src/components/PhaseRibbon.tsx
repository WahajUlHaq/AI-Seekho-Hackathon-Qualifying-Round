import React from "react";
import { StyleSheet, View } from "react-native";
import { PhaseCard } from "./PhaseCard";
import type {
    ExecutionChainOutput,
    OutcomeReportOutput,
    RecoveryPlanOutput,
    WorkflowAuditOutput,
} from "@/types/execution";
import { T } from "@/lib/theme";

interface Props {
    chain: ExecutionChainOutput | null;
    recovery: RecoveryPlanOutput | null;
    outcome: OutcomeReportOutput | null;
    audit: WorkflowAuditOutput | null;
    active: boolean;
}

export function PhaseRibbon({
    chain,
    recovery,
    outcome,
    audit,
    active,
}: Props): React.ReactElement {
    const cellState = (filled: unknown): "loading" | "filled" | "empty" => {
        if (filled) return "filled";
        return active ? "loading" : "empty";
    };

    const chainSummary = chain
        ? `${chain.overall_status} · ${chain.execution_results.length} action(s) · ${chain.total_execution_ms} ms`
        : undefined;
    const recoverySummary = recovery ? summarizeRecord(recovery) : undefined;
    const outcomeSummary = outcome ? summarizeRecord(outcome) : undefined;
    const auditSummary = audit
        ? `${audit.finalized_status} · ${audit.verification_hash.slice(0, 16)}…`
        : undefined;

    return (
        <View style={styles.row}>
            <PhaseCard
                title="Chain"
                state={cellState(chain)}
                summary={chainSummary}
                raw={chain}
                statusKey={chain?.overall_status}
            />
            <PhaseCard
                title="Recovery"
                state={cellState(recovery)}
                summary={recoverySummary}
                raw={recovery}
            />
            <PhaseCard
                title="Outcome"
                state={cellState(outcome)}
                summary={outcomeSummary}
                raw={outcome}
            />
            <PhaseCard
                title="Audit"
                state={cellState(audit)}
                summary={auditSummary}
                raw={audit}
                statusKey={audit?.finalized_status}
            />
        </View>
    );
}

function summarizeRecord(r: Record<string, unknown>): string {
    const keys = Object.keys(r);
    if (keys.length === 0) return "(empty)";
    return keys.slice(0, 3).join(", ");
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 8,
        backgroundColor: T.bgBase,
        borderTopWidth: 1,
        borderTopColor: T.bdDim,
    },
});
