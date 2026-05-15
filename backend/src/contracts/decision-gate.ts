import { contractRegistry } from "./registry";
import { contractValidator, ValidationLevel } from "./validator";
import { TraceEvent, TraceEventType } from "../tracing/collector";
import { v4 as uuidv4 } from "uuid";

export interface GateDecision {
    action: "PASS" | "WARN" | "REJECT";
    traceEvent: Omit<TraceEvent, "event_id" | "timestamp">;
    handleRejection: () => unknown;
}

export class DecisionGate {
    evaluate(
        moduleOutput: unknown,
        contractName: string,
        _inputData: unknown,
        pipelineId = "test"
    ): GateDecision {
        const contract = contractRegistry.get(contractName);

        if (!contract) {
            const traceEvent: Omit<TraceEvent, "event_id" | "timestamp"> = {
                pipeline_id: pipelineId,
                event_type: "contract_gate" as TraceEventType,
                agent: "DecisionGate",
                message: `Contract not found: ${contractName} — defaulting to PASS`,
                decision: "PASS",
                confidence: 0.5,
                data: { contract_name: contractName, reason: "contract_not_registered" },
            };
            return {
                action: "PASS",
                traceEvent,
                handleRejection: () => moduleOutput,
            };
        }

        const result = contractValidator.validate(moduleOutput, contract);
        const action = result.level;

        const traceEvent: Omit<TraceEvent, "event_id" | "timestamp"> = {
            pipeline_id: pipelineId,
            event_type: "contract_gate" as TraceEventType,
            agent: "DecisionGate",
            message: `Contract gate [${contractName}]: ${action} — errors: ${result.errors.length}, warnings: ${result.warnings.length}`,
            decision: action,
            confidence: action === "PASS" ? 1.0 : action === "WARN" ? 0.7 : 0.0,
            data: {
                contract_name: contractName,
                errors: result.errors,
                warnings: result.warnings,
            },
        };

        const handleRejection = (): unknown => {
            // Log the rejection recovery — callers should regenerate or use a fallback
            console.warn(
                `[DecisionGate] REJECT on contract "${contractName}". Errors: ${result.errors.join("; ")}`
            );
            return null;
        };

        return { action, traceEvent, handleRejection };
    }
}

export const decisionGate = new DecisionGate();
