import {
    ActionChain,
    ActionNode,
    ActionExecutionResult,
    RecoveryPlan,
    SimulationState,
} from "../types/simulation.types";

export class FailureRecoveryEngine {
    async handleFailure(
        failedAction: ActionNode,
        failureResult: ActionExecutionResult,
        chain: ActionChain,
        stateHistory: SimulationState[]
    ): Promise<RecoveryPlan> {
        const log: string[] = [];
        log.push(
            `Action ${failedAction.action_id} (${failedAction.title}) failed: ${failureResult.failure_reason}`
        );

        // Strategy 1: Retry if retries remaining
        if (failedAction.failure_recovery.retry_count > 0) {
            log.push(
                `Retry available (${failedAction.failure_recovery.retry_count} attempts remaining)`
            );
            return {
                failed_action_id: failedAction.action_id,
                recovery_strategy: "retry",
                retry_attempts: failedAction.failure_recovery.retry_count,
                fallback_action: null,
                rollback_to_state: null,
                recovery_execution_log: log,
            };
        }

        // Strategy 2: Use fallback action if configured
        if (failedAction.failure_recovery.fallback_action_id) {
            const fallback = chain.actions.find(
                (a) => a.action_id === failedAction.failure_recovery.fallback_action_id
            ) ?? null;
            if (fallback) {
                log.push(`Using fallback action: ${fallback.action_id} (${fallback.title})`);
                return {
                    failed_action_id: failedAction.action_id,
                    recovery_strategy: "fallback",
                    retry_attempts: 0,
                    fallback_action: fallback,
                    rollback_to_state: null,
                    recovery_execution_log: log,
                };
            }
        }

        // Strategy 3: Rollback to previous state if required
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

        // Strategy 4: Skip and continue
        log.push("No recovery option available — skipping and continuing with remaining actions");
        return {
            failed_action_id: failedAction.action_id,
            recovery_strategy: "skip_and_continue",
            retry_attempts: 0,
            fallback_action: null,
            rollback_to_state: null,
            recovery_execution_log: log,
        };
    }
}

export const failureRecoveryEngine = new FailureRecoveryEngine();
