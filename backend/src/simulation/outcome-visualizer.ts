import {
    ActionChain,
    ActionExecutionResult,
    OutcomeVisualization,
    RecoveryPlan,
    SimulationState,
    StateDiff,
} from "../types/simulation.types";

export class OutcomeVisualizer {
    generate(
        initialState: SimulationState,
        executionResults: ActionExecutionResult[],
        recoveryPlans: RecoveryPlan[],
        actionChain: ActionChain,
        estimatedValuePKR = 2_000_000
    ): OutcomeVisualization {
        // Compute final state from last successful execution
        const lastSuccess = [...executionResults]
            .reverse()
            .find((r) => r.status === "success");
        const finalState = lastSuccess?.after_state ?? initialState;

        const stateDiff = this.computeStateDiff(initialState, finalState);

        const timeline = executionResults.map((r) => {
            const action = actionChain.actions.find((a) => a.action_id === r.action_id);
            return {
                action_id: r.action_id,
                action_title: action?.title ?? r.action_id,
                start_time: r.before_state.timestamp,
                end_time: r.after_state.timestamp,
                status: r.status,
                cost: r.cost,
                duration_ms: r.duration_ms,
            };
        });

        const succeeded = executionResults.filter((r) => r.status === "success").length;
        const failed = executionResults.filter((r) => r.status === "failed").length;
        const attempted = executionResults.filter((r) => r.status !== "skipped").length;
        const failuresRecovered = recoveryPlans.filter(
            (p) => p.recovery_strategy !== "skip_and_continue"
        ).length;

        const metrics = {
            total_cost: executionResults.reduce((sum, r) => sum + r.cost, 0),
            total_duration_ms: executionResults.reduce((sum, r) => sum + r.duration_ms, 0),
            success_rate: attempted > 0 ? succeeded / attempted : 0,
            actions_attempted: attempted,
            actions_succeeded: succeeded,
            actions_failed: failed,
            failures_recovered: failuresRecovered,
        };

        const riskReduction = Math.min(80, (succeeded / Math.max(attempted, 1)) * 80);

        const affectedEntities = [
            ...new Set(
                actionChain.actions.flatMap((a) =>
                    (a.simulation_details.parameters["affected_entities"] as string[] | undefined) ?? []
                )
            ),
        ];
        if (affectedEntities.length === 0) affectedEntities.push("SKU-1234", "Warehouse A");

        return {
            before_state: initialState,
            after_state: finalState,
            state_diff: stateDiff,
            action_execution_timeline: timeline,
            metrics,
            projected_impact: {
                risk_reduction: parseFloat(riskReduction.toFixed(1)),
                estimated_value: estimatedValuePKR,
                affected_entities: affectedEntities,
            },
        };
    }

    private computeStateDiff(before: SimulationState, after: SimulationState): StateDiff[] {
        const diff: StateDiff[] = [];
        const allKeys = new Set([
            ...Object.keys(before.variables),
            ...Object.keys(after.variables),
        ]);

        for (const key of allKeys) {
            const beforeValue = before.variables[key];
            const afterValue = after.variables[key];

            let changeType: StateDiff["change_type"];
            if (beforeValue === undefined && afterValue !== undefined) {
                changeType = "added";
            } else if (beforeValue !== undefined && afterValue === undefined) {
                changeType = "removed";
            } else if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
                changeType = "modified";
            } else {
                changeType = "unchanged";
            }

            diff.push({ variable: key, before_value: beforeValue, after_value: afterValue, change_type: changeType });
        }

        return diff;
    }
}

export const outcomeVisualizer = new OutcomeVisualizer();
