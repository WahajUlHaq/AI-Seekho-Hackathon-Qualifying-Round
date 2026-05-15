import { contractValidator } from "./validator";
import { Contract } from "./registry";
import { TraceEvent } from "../tracing/collector";

export interface GateResult {
    action: "PASS" | "WARN" | "REJECT";
    errors: string[];
    warnings: string[];
    semantic_issues: string[];
    traceEvent: Omit<TraceEvent, "event_id" | "timestamp">;
}

export class DecisionGate {
    async evaluate(
        output: unknown,
        contract: Contract,
        context?: string
    ): Promise<GateResult> {
        const structural = contractValidator.validate(output, contract);

        let errors = [...structural.errors];
        let warnings = [...structural.warnings];
        let semantic_issues: string[] = [];
        let action: "PASS" | "WARN" | "REJECT" = structural.level;

        if (
            structural.level !== "REJECT" &&
            contract.semantic_checks &&
            contract.semantic_checks.length > 0
        ) {
            const semantic = await contractValidator.validateSemantic(output, contract, context);
            semantic_issues = semantic.semantic_issues ?? [];
            action = semantic.level;
            errors = [
                ...structural.errors,
                ...semantic.errors.filter((e) => !structural.errors.includes(e)),
            ];
        }

        const confidence = action === "PASS" ? 1.0 : action === "WARN" ? 0.5 : 0.0;

        // pipeline_id and agent are filled in by the caller before logging
        const traceEvent: Omit<TraceEvent, "event_id" | "timestamp"> = {
            pipeline_id: "",
            event_type: "contract_gate",
            agent: "",
            message: `Contract gate: ${action}`,
            decision: action,
            confidence,
            data: { errors, warnings, semantic_issues },
        };

        return { action, errors, warnings, semantic_issues, traceEvent };
    }
}

export const decisionGate = new DecisionGate();
