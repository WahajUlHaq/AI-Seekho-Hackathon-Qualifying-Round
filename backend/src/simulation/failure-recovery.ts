/**
 * Module 12 — Failure Recovery Engine (V2).
 *
 * V2 invariants enforced here:
 *   • `ledger.refund()` is invoked FIRST upon any action failure to
 *     release escrowed funds. Retry/fallback/skip strategies execute
 *     AFTER the refund completes, never before.
 *   • Refund is permitted ONLY when the failed action has an outstanding
 *     `reserved` row — committed rows cannot be unspent (the ledger
 *     enforces this; M12 surfaces the precondition in its trace).
 *   • Recovery cost (cost of running the fallback / additional retry) is
 *     tracked separately from the refunded amount so M13 can report the
 *     net financial impact of recovery.
 */

import {
    ActionChain,
    ActionNode,
    ActionExecutionResult,
    RecoveryPlan,
    SimulationState,
} from "../types/simulation.types";
import {
    SagaConstraintLedger,
    SagaLedgerStateError,
} from "./saga-ledger";
import { antigravityFileLogger } from "../tracing/file-logger";

export interface RecoveryHandleInput {
    pipeline_id: string;
    failedAction: ActionNode;
    failureResult: ActionExecutionResult;
    chain: ActionChain;
    stateHistory: SimulationState[];
    ledger?: SagaConstraintLedger;        // optional for legacy callers
}

export interface EnhancedRecoveryPlan extends RecoveryPlan {
    refund_invoked: boolean;
    refund_amount_pkr: number;
    refund_status: "SUCCESS" | "NOT_ELIGIBLE" | "NO_LEDGER";
    recovery_cost_pkr: number;
}

export class FailureRecoveryEngine {
    /**
     * Legacy entry-point (test-21 + older orchestrator callsites). Accepts
     * positional args and returns the plain `RecoveryPlan` shape. The new
     * V2 callsite uses `handle()` with a ledger.
     */
    async handleFailure(
        failedAction: ActionNode,
        failureResult: ActionExecutionResult,
        chain: ActionChain,
        stateHistory: SimulationState[]
    ): Promise<RecoveryPlan> {
        const enhanced = await this.handle({
            pipeline_id: "legacy",
            failedAction,
            failureResult,
            chain,
            stateHistory,
        });
        // Strip V2-only fields for legacy callers.
        const { refund_invoked, refund_amount_pkr, refund_status, recovery_cost_pkr, ...legacy } = enhanced;
        return legacy;
    }

    /**
     * V2 entry-point. Refund FIRST, then plan retry/fallback/skip.
     */
    async handle(input: RecoveryHandleInput): Promise<EnhancedRecoveryPlan> {
        const { pipeline_id, failedAction, failureResult, chain, stateHistory, ledger } = input;
        const log: string[] = [];
        log.push(
            `Action ${failedAction.action_id} (${failedAction.title}) failed: ${failureResult.failure_reason}`
        );

        // ── Step 1: ALWAYS attempt refund FIRST ──
        const refundOutcome = this.refundFirst(pipeline_id, failedAction, ledger);
        log.push(refundOutcome.log_line);

        // ── Step 2: Decide retry / fallback / rollback / skip ──
        let plan: RecoveryPlan;
        let recoveryCostPkr = 0;

        if (failedAction.failure_recovery.retry_count > 0) {
            log.push(
                `Retry available (${failedAction.failure_recovery.retry_count} attempts remaining)`
            );
            plan = {
                failed_action_id: failedAction.action_id,
                recovery_strategy: "retry",
                retry_attempts: failedAction.failure_recovery.retry_count,
                fallback_action: null,
                rollback_to_state: null,
                recovery_execution_log: log,
            };
            // Retry's cost is the original max_cost (a future reserve() will be needed).
            recoveryCostPkr = failedAction.constraints.max_cost;
        } else if (failedAction.failure_recovery.fallback_action_id) {
            const fallback = chain.actions.find(
                (a) => a.action_id === failedAction.failure_recovery.fallback_action_id
            ) ?? null;
            if (fallback) {
                log.push(`Using fallback action: ${fallback.action_id} (${fallback.title})`);
                plan = {
                    failed_action_id: failedAction.action_id,
                    recovery_strategy: "fallback",
                    retry_attempts: 0,
                    fallback_action: fallback,
                    rollback_to_state: null,
                    recovery_execution_log: log,
                };
                recoveryCostPkr = fallback.constraints.max_cost;
            } else {
                log.push(
                    `Fallback ID ${failedAction.failure_recovery.fallback_action_id} not present in chain — falling through to rollback/skip`
                );
                plan = this.rollbackOrSkip(failedAction, stateHistory, log);
            }
        } else if (failedAction.failure_recovery.rollback_required && stateHistory.length >= 2) {
            const rollbackState = stateHistory[stateHistory.length - 2];
            log.push(`Rolling back to state: ${rollbackState.state_id}`);
            plan = {
                failed_action_id: failedAction.action_id,
                recovery_strategy: "rollback",
                retry_attempts: 0,
                fallback_action: null,
                rollback_to_state: rollbackState,
                recovery_execution_log: log,
            };
        } else {
            log.push("No recovery option available — skipping and continuing with remaining actions");
            plan = {
                failed_action_id: failedAction.action_id,
                recovery_strategy: "skip_and_continue",
                retry_attempts: 0,
                fallback_action: null,
                rollback_to_state: null,
                recovery_execution_log: log,
            };
        }

        antigravityFileLogger.append({
            timestamp: new Date().toISOString(),
            step: `M12_RecoveryPlanned_${failedAction.action_id}`,
            tool_called: "FailureRecoveryEngine",
            reasoning: `Strategy=${plan.recovery_strategy}, refund_invoked=${refundOutcome.invoked}, refund_amount=PKR ${refundOutcome.amount}, recovery_cost=PKR ${recoveryCostPkr}`,
            status: plan.recovery_strategy === "skip_and_continue" ? "ROLLED_BACK" : "SUCCESS",
            rollback_action:
                plan.recovery_strategy === "rollback"
                    ? `Rollback to ${plan.rollback_to_state?.state_id ?? "n/a"}`
                    : plan.recovery_strategy === "fallback"
                    ? `Execute fallback ${plan.fallback_action?.action_id ?? "n/a"}`
                    : plan.recovery_strategy === "retry"
                    ? `Retry ${plan.retry_attempts} attempts`
                    : "skip_and_continue",
            latency_ms: 0,
            cost: recoveryCostPkr,
            rubric_category: "failure_recovery",
            data_lineage: {
                from: "M12_FailureRecoveryEngine",
                to: plan.recovery_strategy === "fallback" || plan.recovery_strategy === "retry"
                    ? "M11_DAGExecutor"
                    : "M13_OutcomeVisualizer",
                data_type: "RecoveryPlan",
                key_change: `${plan.recovery_strategy} (refunded PKR ${refundOutcome.amount}, new cost PKR ${recoveryCostPkr})`,
            },
        });

        return {
            ...plan,
            refund_invoked: refundOutcome.invoked,
            refund_amount_pkr: refundOutcome.amount,
            refund_status: refundOutcome.status,
            recovery_cost_pkr: recoveryCostPkr,
        };
    }

    private rollbackOrSkip(
        failedAction: ActionNode,
        stateHistory: SimulationState[],
        log: string[]
    ): RecoveryPlan {
        if (failedAction.failure_recovery.rollback_required && stateHistory.length >= 2) {
            const rollbackState = stateHistory[stateHistory.length - 2];
            log.push(`Rolling back to state: ${rollbackState.state_id}`);
            return {
                failed_action_id: failedAction.action_id,
                recovery_strategy: "rollback",
                retry_attempts: 0,
                fallback_action: null,
                rollback_to_state: rollbackState,
                recovery_execution_log: log,
            };
        }
        log.push("No further recovery option — skipping");
        return {
            failed_action_id: failedAction.action_id,
            recovery_strategy: "skip_and_continue",
            retry_attempts: 0,
            fallback_action: null,
            rollback_to_state: null,
            recovery_execution_log: log,
        };
    }

    private refundFirst(
        pipelineId: string,
        failedAction: ActionNode,
        ledger?: SagaConstraintLedger
    ): { invoked: boolean; amount: number; status: EnhancedRecoveryPlan["refund_status"]; log_line: string } {
        if (!ledger) {
            return {
                invoked: false,
                amount: 0,
                status: "NO_LEDGER",
                log_line: "No SagaConstraintLedger supplied — refund step skipped (legacy caller)",
            };
        }

        const reservedRow = ledger.findReservedRow(failedAction.action_id);
        if (!reservedRow) {
            // Already committed or never reserved — refund is not eligible.
            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: `M12_RefundNotEligible_${failedAction.action_id}`,
                tool_called: "SagaConstraintLedger",
                reasoning: `No 'reserved' ledger row for ${failedAction.action_id} — refund precondition not met. (Row may be already committed or never reserved.)`,
                status: "ROLLED_BACK",
                rollback_action: "Skip refund; proceed to retry/fallback selection",
                latency_ms: 0,
                cost: 0,
                rubric_category: "failure_recovery",
                data_lineage: {
                    from: "M12_FailureRecoveryEngine",
                    to: "SagaConstraintLedger",
                    data_type: "LedgerRefundSkipped",
                    key_change: "no reserved row to refund",
                },
            });
            return {
                invoked: false,
                amount: 0,
                status: "NOT_ELIGIBLE",
                log_line: `Refund precondition not met for ${failedAction.action_id} (no outstanding reserved row); proceeding to recovery strategy selection`,
            };
        }

        try {
            const refunded = ledger.refund(reservedRow, "m12_failure_refund");
            antigravityFileLogger.append({
                timestamp: new Date().toISOString(),
                step: `M12_LedgerRefund_${failedAction.action_id}`,
                tool_called: "SagaConstraintLedger",
                reasoning: `Refunded PKR ${refunded.amount_pkr} from reserved row ${refunded.row_id} BEFORE any retry/fallback. Available now: PKR ${ledger.available()}.`,
                status: "SUCCESS",
                rollback_action: "Escrowed funds released; retry/fallback may now re-reserve",
                latency_ms: 0,
                cost: -refunded.amount_pkr,
                rubric_category: "failure_recovery",
                data_lineage: {
                    from: "M12_FailureRecoveryEngine",
                    to: "SagaConstraintLedger",
                    data_type: "LedgerRefund",
                    key_change: `available +PKR ${refunded.amount_pkr} → ${ledger.available()}`,
                },
            });
            return {
                invoked: true,
                amount: refunded.amount_pkr,
                status: "SUCCESS",
                log_line: `STEP 1 [refund-first]: released PKR ${refunded.amount_pkr} from row ${refunded.row_id} — ledger now has PKR ${ledger.available()} available`,
            };
        } catch (err) {
            if (err instanceof SagaLedgerStateError) {
                // Defensive — should not happen if findReservedRow returned a row,
                // but cover the race where the ledger was mutated between calls.
                antigravityFileLogger.append({
                    timestamp: new Date().toISOString(),
                    step: `M12_RefundStateError_${failedAction.action_id}`,
                    tool_called: "SagaConstraintLedger",
                    reasoning: `Refund precondition failed for ${failedAction.action_id}: ${err.message}`,
                    status: "FAILED",
                    rollback_action: "Refund skipped; ledger remains untouched. Recovery strategy continues without refund.",
                    latency_ms: 0,
                    cost: 0,
                    rubric_category: "failure_recovery",
                    data_lineage: {
                        from: "M12_FailureRecoveryEngine",
                        to: "SagaConstraintLedger",
                        data_type: "LedgerRefundError",
                        key_change: `ineligible: ${err.current_status}`,
                    },
                });
                return {
                    invoked: false,
                    amount: 0,
                    status: "NOT_ELIGIBLE",
                    log_line: `Refund precondition error: ${err.message}`,
                };
            }
            throw err;
        }
    }
}

export const failureRecoveryEngine = new FailureRecoveryEngine();
