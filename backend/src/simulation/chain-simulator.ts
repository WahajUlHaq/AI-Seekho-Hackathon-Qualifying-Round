import { v4 as uuidv4 } from "uuid";
import {
    ActionChain,
    ActionNode,
    ActionExecutionResult,
    SimulationState,
} from "../types/simulation.types";
import { traceCollector } from "../tracing/collector";

const FAILURE_REASONS: Record<string, string[]> = {
    verify: ["Database connection timeout", "Query returned empty result", "Access denied"],
    notify: ["SMTP server error", "Recipient unreachable", "Rate limit exceeded"],
    update_system: ["API endpoint unreachable", "Invalid data format", "Write permission denied"],
    mitigate: ["Resource allocation failed", "Budget limit exceeded", "Dependency service down"],
    diagnose: ["Service unavailable", "Timeout waiting for response"],
    monitor: ["Monitoring service offline", "Alert threshold config error"],
    escalate: ["Escalation channel unavailable", "On-call not responding"],
};

export class ActionChainSimulator {
    async simulateChain(
        chain: ActionChain,
        initialState: SimulationState,
        simulateFailures = true,
        pipelineId?: string
    ): Promise<ActionExecutionResult[]> {
        let currentState: SimulationState = { ...initialState, variables: { ...initialState.variables } };
        const stateHistory: SimulationState[] = [currentState];
        const results: ActionExecutionResult[] = [];

        for (const actionId of chain.execution_order) {
            const action = chain.actions.find((a) => a.action_id === actionId);
            if (!action) continue;

            // Check if dependencies are satisfied
            const dependenciesMet = action.depends_on.every((depId) =>
                results.some((r) => r.action_id === depId && r.status === "success")
            );

            if (!dependenciesMet && action.depends_on.length > 0) {
                const result: ActionExecutionResult = {
                    action_id: actionId,
                    status: "skipped",
                    before_state: currentState,
                    after_state: currentState,
                    execution_log: [`Skipped: dependencies not met (${action.depends_on.join(", ")})`],
                    cost: 0,
                    duration_ms: 0,
                    failure_reason: "Dependencies not satisfied",
                };
                results.push(result);
                if (pipelineId) {
                    traceCollector.log(pipelineId, {
                        pipeline_id: pipelineId,
                        event_type: "action_execute",
                        agent: "ActionChainSimulator",
                        message: `Action ${actionId} skipped — dependencies not met`,
                        decision: "skipped",
                    });
                }
                continue;
            }

            const result = await this.simulateSingleAction(action, simulateFailures, currentState);
            results.push(result);

            if (pipelineId) {
                traceCollector.log(pipelineId, {
                    pipeline_id: pipelineId,
                    event_type: "action_execute",
                    agent: "ActionChainSimulator",
                    message: `Action ${actionId} (${action.title}): ${result.status}`,
                    decision: result.status,
                    latency_ms: result.duration_ms,
                    data: {
                        cost: result.cost,
                        failure_reason: result.failure_reason,
                        log: result.execution_log,
                    },
                });
            }

            if (result.status === "success") {
                currentState = result.after_state;
                stateHistory.push(currentState);
            }
        }

        return results;
    }

    private async simulateSingleAction(
        action: ActionNode,
        simulateFailures: boolean,
        currentState: SimulationState
    ): Promise<ActionExecutionResult> {
        const startTime = Date.now();
        const beforeState: SimulationState = {
            ...currentState,
            variables: { ...currentState.variables },
        };
        const log: string[] = [];
        log.push(`Starting: ${action.title}`);

        // Simulate latency (5–200ms)
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 50) + 5));

        // Failure injection
        const willFail =
            simulateFailures &&
            action.simulatable &&
            Math.random() > action.simulation_details.expected_success_rate;

        if (willFail) {
            const reason = this.getRandomFailureReason(action.action_type);
            log.push(`FAILURE: ${reason}`);
            return {
                action_id: action.action_id,
                status: "failed",
                before_state: beforeState,
                after_state: beforeState,
                execution_log: log,
                cost: 0,
                duration_ms: Date.now() - startTime,
                failure_reason: reason,
            };
        }

        // Execute based on simulation type
        const afterVariables: Record<string, unknown> = { ...beforeState.variables };
        const simType = action.simulation_details.simulation_type;
        const params = action.simulation_details.parameters as Record<string, unknown>;

        switch (simType) {
            case "database_query":
                log.push("Executing database query...");
                log.push("Query returned: 47 units in stock");
                afterVariables["stock_level"] = 47;
                afterVariables["stock_verified"] = true;
                break;

            case "send_notification": {
                const recipient = String(params["recipient"] ?? "procurement team");
                log.push(`Sending notification to ${recipient}`);
                log.push("Notification sent successfully");
                afterVariables["notification_sent"] = true;
                afterVariables["notification_recipient"] = recipient;
                afterVariables["notification_timestamp"] = new Date().toISOString();
                break;
            }

            case "place_order": {
                const orderCost = Number(params["order_cost"] ?? action.constraints.max_cost);
                const qty = Number(params["quantity"] ?? 500);
                log.push(`Placing emergency order: ${qty} units, cost PKR ${orderCost}`);
                log.push("Order confirmation received: ORDER-12345");
                afterVariables["order_placed"] = true;
                afterVariables["order_id"] = "ORDER-12345";
                afterVariables["order_quantity"] = qty;
                const budgetRemaining = Number(afterVariables["budget_remaining"] ?? 500000);
                afterVariables["budget_remaining"] = budgetRemaining - orderCost;
                break;
            }

            case "update_dashboard":
                log.push("Updating dashboard metrics...");
                log.push("Dashboard updated successfully");
                afterVariables["dashboard_updated"] = true;
                afterVariables["customers_notified"] = Number(params["customer_count"] ?? 200);
                break;

            case "schedule_monitoring":
                log.push("Scheduling 24-hour monitoring alert...");
                log.push("Monitoring alert configured successfully");
                afterVariables["monitoring_active"] = true;
                afterVariables["monitoring_interval_hours"] = Number(params["interval_hours"] ?? 1);
                break;

            default:
                log.push(`Executing ${simType}...`);
                log.push("Completed successfully");
                afterVariables[`${action.action_id}_completed`] = true;
                break;
        }

        const duration = Date.now() - startTime;
        const cost = action.constraints.max_cost;
        log.push(`Completed in ${duration}ms, cost: PKR ${cost}`);

        const afterState: SimulationState = {
            state_id: `STATE-${uuidv4().slice(0, 8).toUpperCase()}`,
            timestamp: new Date().toISOString(),
            variables: afterVariables,
        };

        return {
            action_id: action.action_id,
            status: "success",
            before_state: beforeState,
            after_state: afterState,
            execution_log: log,
            cost,
            duration_ms: duration,
            failure_reason: null,
        };
    }

    private getRandomFailureReason(actionType: string): string {
        const reasons = FAILURE_REASONS[actionType] ?? ["Unknown error"];
        return reasons[Math.floor(Math.random() * reasons.length)];
    }
}

export const actionChainSimulator = new ActionChainSimulator();
