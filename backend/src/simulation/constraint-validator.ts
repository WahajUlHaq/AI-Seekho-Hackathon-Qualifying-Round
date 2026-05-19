/**
 * Module 10 — Saga Constraint Validation (V2).
 *
 * Antigravity invokes this validator with the verified action chain from
 * M9. It evaluates actions in EXECUTION ORDER against:
 *   • The cumulative budget reservation via `SagaConstraintLedger`
 *     (each action `reserve()`s its `max_cost`; an overdraft → infeasible).
 *   • Per-action time and resource constraints from the global Constraints.
 *
 * On infeasibility, M10 produces a concrete `recommended_modification`
 * naming the violating constraint and a numeric relaxation suggestion
 * (e.g. "Increase budget by PKR 100K, or split the order into 2 batches").
 *
 * V2 AMCE: ALERT_ONLY Zod structural validation — no LLM judge.
 *
 * Returns BOTH the result list (back-compat with existing callers) and
 * the post-evaluation ledger snapshot so M11/M12 can inherit the reserved
 * rows downstream.
 */

import {
    ActionChain,
    ActionNode,
    Constraints,
    ConstraintValidationResult,
    ConstraintViolation,
} from "../types/simulation.types";
import {
    SagaConstraintLedger,
    SagaBudgetExceeded,
    SagaLedgerSnapshot,
} from "./saga-ledger";
import { antigravityFileLogger } from "../tracing/file-logger";
import {
    ConstraintValidationOutputSchema,
    evaluateWithZod,
} from "../contracts/zod-schemas";

export interface ConstraintValidationOutput {
    pipeline_id: string;
    results: ConstraintValidationResult[];
    ledger_snapshot: SagaLedgerSnapshot;
    cumulative_cost_pkr: number;
    cumulative_duration_hours: number;
    infeasible_count: number;
}

export class ConstraintValidator {
    /**
     * Legacy back-compat entry-point used by older tests/orchestrator code.
     * Internally constructs an ephemeral ledger so the cumulative budget
     * check still runs, but does NOT return the ledger.
     */
    validateActionChain(
        chain: ActionChain,
        constraints: Constraints,
        pipelineId = "legacy"
    ): ConstraintValidationResult[] {
        const ledger = new SagaConstraintLedger(pipelineId, constraints.budget_limit.amount);
        return this.validateWithLedger({
            pipeline_id: pipelineId,
            chain,
            constraints,
            ledger,
        }).results;
    }

    /**
     * V2 entry-point. The caller supplies the `SagaConstraintLedger` so
     * that M11/M12 can share the same reservation table downstream.
     */
    validateWithLedger(input: {
        pipeline_id: string;
        chain: ActionChain;
        constraints: Constraints;
        ledger: SagaConstraintLedger;
    }): ConstraintValidationOutput {
        const { pipeline_id, chain, constraints, ledger } = input;
        const startTime = Date.now();

        const results: ConstraintValidationResult[] = [];
        let cumulativeDurationHours = 0;

        // Evaluate in execution order so the cumulative ledger reflects
        // the actual order Antigravity will dispatch downstream.
        const orderedIds = chain.execution_order.length
            ? chain.execution_order
            : chain.actions.map((a) => a.action_id);

        for (const actionId of orderedIds) {
            const action = chain.actions.find((a) => a.action_id === actionId);
            if (!action) continue;

            const violations: ConstraintViolation[] = [];

            // ── Cumulative budget via Saga ledger ──
            try {
                ledger.reserve(action.action_id, action.constraints.max_cost, "m10_validation_reserve");
                antigravityFileLogger.append({
                    timestamp: new Date().toISOString(),
                    step: `M10_LedgerReserve_${action.action_id}`,
                    tool_called: "SagaConstraintLedger",
                    reasoning: `Reserved PKR ${action.constraints.max_cost} for ${action.action_id} (available remaining: PKR ${ledger.available()})`,
                    status: "SUCCESS",
                    rollback_action: "M12 may invoke ledger.refund() on this row if the action later fails",
                    latency_ms: 0,
                    cost: action.constraints.max_cost,
                    rubric_category: "constraint_evaluation",
                    data_lineage: {
                        from: "M10_ConstraintValidator",
                        to: "SagaConstraintLedger",
                        data_type: "LedgerReserve",
                        key_change: `available -PKR ${action.constraints.max_cost} → ${ledger.available()}`,
                    },
                });
            } catch (err) {
                if (err instanceof SagaBudgetExceeded) {
                    violations.push({
                        constraint_type: "budget",
                        limit: ledger.budget_limit_pkr,
                        required: err.required,
                        severity: "blocking",
                    });
                    antigravityFileLogger.append({
                        timestamp: new Date().toISOString(),
                        step: `M10_LedgerReserveBlocked_${action.action_id}`,
                        tool_called: "SagaConstraintLedger",
                        reasoning: `Cumulative budget overdraft on ${action.action_id}: needs PKR ${err.required}, only PKR ${err.available} available`,
                        status: "FAILED",
                        rollback_action: "Action marked infeasible; relaxation suggestion emitted",
                        latency_ms: 0,
                        cost: 0,
                        rubric_category: "constraint_evaluation",
                        data_lineage: {
                            from: "M10_ConstraintValidator",
                            to: "ConstraintValidationResult",
                            data_type: "LedgerReserveFailure",
                            key_change: `infeasible: requires +PKR ${err.required - err.available} budget relaxation`,
                        },
                    });
                } else {
                    throw err;
                }
            }

            // ── Per-action time ceiling ──
            if (action.constraints.max_duration_hours > constraints.time_limit.max_duration_hours) {
                violations.push({
                    constraint_type: "time",
                    limit: constraints.time_limit.max_duration_hours,
                    required: action.constraints.max_duration_hours,
                    severity: "blocking",
                });
            }

            // ── Resource (API rate-limit) ──
            if (action.constraints.api_rate_limit > constraints.resource_limits.api_calls_per_hour) {
                violations.push({
                    constraint_type: "resource",
                    limit: constraints.resource_limits.api_calls_per_hour,
                    required: action.constraints.api_rate_limit,
                    severity: "warning",
                });
            }

            cumulativeDurationHours += action.constraints.max_duration_hours;
            if (cumulativeDurationHours > constraints.time_limit.max_duration_hours) {
                // Soft cumulative time warning — don't double-count if already added.
                if (!violations.some((v) => v.constraint_type === "time")) {
                    violations.push({
                        constraint_type: "time",
                        limit: constraints.time_limit.max_duration_hours,
                        required: cumulativeDurationHours,
                        severity: "warning",
                    });
                }
            }

            const isFeasible = violations.every((v) => v.severity !== "blocking");
            const recommendedModification = this.suggestRelaxation(action, violations, ledger);

            results.push({
                action_id: action.action_id,
                is_feasible: isFeasible,
                violations,
                recommended_modification: recommendedModification,
            });
        }

        const snapshot = ledger.snapshot();
        const infeasibleCount = results.filter((r) => !r.is_feasible).length;
        const output: ConstraintValidationOutput = {
            pipeline_id,
            results,
            ledger_snapshot: snapshot,
            cumulative_cost_pkr: snapshot.reserved_pkr + snapshot.committed_pkr,
            cumulative_duration_hours: cumulativeDurationHours,
            infeasible_count: infeasibleCount,
        };

        // AMCE ALERT_ONLY — fast deterministic Zod, no LLM.
        const amce = evaluateWithZod(
            output,
            ConstraintValidationOutputSchema,
            "constraint_validation_v1",
            "ALERT_ONLY"
        );
        antigravityFileLogger.append({
            timestamp: new Date().toISOString(),
            step: "AMCE_M10_StructuralValidation",
            tool_called: "ZodValidator",
            reasoning: amce.passed
                ? `M10 output passed Zod structural schema (ALERT_ONLY). Actions=${results.length}, infeasible=${infeasibleCount}, cumulative_cost=PKR ${output.cumulative_cost_pkr}`
                : `M10 Zod warnings: ${amce.errors.join("; ")}`,
            status: amce.passed ? "SUCCESS" : "FAILED",
            rollback_action: amce.passed ? "none" : "Log warning; continue (ALERT_ONLY)",
            latency_ms: Date.now() - startTime,
            cost: 0,
            rubric_category: "constraint_evaluation",
            data_lineage: {
                from: "M10_ConstraintValidator",
                to: "M11_DAGExecutor",
                data_type: "ConstraintValidationOutput",
                key_change: `infeasible=${infeasibleCount}, available=PKR ${snapshot.available_pkr}`,
            },
        });

        return output;
    }

    private suggestRelaxation(
        action: ActionNode,
        violations: ConstraintViolation[],
        ledger: SagaConstraintLedger
    ): string | null {
        const blocking = violations.filter((v) => v.severity === "blocking");
        if (blocking.length === 0) return null;

        const budget = blocking.find((v) => v.constraint_type === "budget");
        const time = blocking.find((v) => v.constraint_type === "time");

        const parts: string[] = [];
        if (budget) {
            const gap = Math.max(0, budget.required - budget.limit);
            const headroomNow = ledger.available();
            const split = Math.max(2, Math.ceil(budget.required / Math.max(headroomNow, 1)));
            parts.push(
                `Raise budget by PKR ${gap.toLocaleString("en-US")} OR split '${action.title}' into ${split} sequential batches of ~PKR ${Math.ceil(budget.required / split).toLocaleString("en-US")} each`
            );
        }
        if (time) {
            const gap = time.required - time.limit;
            parts.push(
                `Extend time window by ${gap.toFixed(2)}h, parallelize ${action.action_id} with a peer-level action, or downsize scope to fit ${time.limit}h`
            );
        }
        if (parts.length === 0) {
            parts.push(
                `Relax non-blocking constraints (resource ceilings) before re-validating ${action.action_id}`
            );
        }
        return parts.join("; ");
    }
}

export const constraintValidator = new ConstraintValidator();
