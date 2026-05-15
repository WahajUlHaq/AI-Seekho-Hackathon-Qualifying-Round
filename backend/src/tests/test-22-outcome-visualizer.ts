import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { OutcomeVisualizer } from "../simulation/outcome-visualizer";
import { ActionChain, ActionExecutionResult, RecoveryPlan, SimulationState } from "../types/simulation.types";

function test() {
    console.log("=== TEST 4.4: Outcome Visualizer (Module 13) ===");

    const initialState: SimulationState = {
        state_id: "STATE-INIT",
        timestamp: "2026-05-15T14:00:00Z",
        variables: {
            stock_level: 50,
            stock_verified: false,
            order_placed: false,
            notification_sent: false,
        },
    };

    const finalState: SimulationState = {
        state_id: "STATE-FINAL",
        timestamp: "2026-05-15T17:45:00Z",
        variables: {
            stock_level: 50,
            stock_verified: true,
            order_placed: true,
            order_id: "ORDER-12345",
            notification_sent: true,
            monitoring_active: true,
        },
    };

    const mockChain: ActionChain = {
        chain_id: "CHAIN-001",
        action_count: 4,
        insight_id: "INS-001",
        actions: [
            { action_id: "ACT-001", action_type: "verify", title: "Verify stock levels", description: "", priority: "critical", depends_on: [], blocks: [], constraints: { max_cost: 0, max_duration_hours: 0.5, required_resources: [], api_rate_limit: 0 }, simulatable: true, simulation_details: { simulation_type: "database_query", parameters: {}, expected_success_rate: 1 }, failure_recovery: { retry_count: 0, fallback_action_id: null, rollback_required: false } },
            { action_id: "ACT-002", action_type: "notify", title: "Notify procurement team", description: "", priority: "high", depends_on: [], blocks: [], constraints: { max_cost: 0, max_duration_hours: 0.25, required_resources: [], api_rate_limit: 0 }, simulatable: true, simulation_details: { simulation_type: "send_notification", parameters: {}, expected_success_rate: 1 }, failure_recovery: { retry_count: 0, fallback_action_id: null, rollback_required: false } },
            { action_id: "ACT-003", action_type: "mitigate", title: "Place emergency order", description: "", priority: "critical", depends_on: [], blocks: [], constraints: { max_cost: 450000, max_duration_hours: 2, required_resources: [], api_rate_limit: 0 }, simulatable: true, simulation_details: { simulation_type: "place_order", parameters: {}, expected_success_rate: 0.9 }, failure_recovery: { retry_count: 0, fallback_action_id: null, rollback_required: false } },
            { action_id: "ACT-003-retry", action_type: "mitigate", title: "Place emergency order (retry)", description: "", priority: "critical", depends_on: [], blocks: [], constraints: { max_cost: 450000, max_duration_hours: 2, required_resources: [], api_rate_limit: 0 }, simulatable: true, simulation_details: { simulation_type: "place_order", parameters: {}, expected_success_rate: 1 }, failure_recovery: { retry_count: 0, fallback_action_id: null, rollback_required: false } },
        ],
        execution_order: ["ACT-001", "ACT-002", "ACT-003", "ACT-003-retry"],
        total_estimated_cost: 450000,
        total_estimated_duration_hours: 3,
        constraint_violations: [],
    };

    const executionResults: ActionExecutionResult[] = [
        { action_id: "ACT-001", status: "success", cost: 0, duration_ms: 234, before_state: initialState, after_state: initialState, execution_log: ["Queried DB"], failure_reason: null },
        { action_id: "ACT-002", status: "success", cost: 0, duration_ms: 156, before_state: initialState, after_state: initialState, execution_log: ["Email sent"], failure_reason: null },
        { action_id: "ACT-003", status: "failed", cost: 0, duration_ms: 5000, before_state: initialState, after_state: initialState, execution_log: ["FAILURE: Supplier API timeout"], failure_reason: "Supplier API timeout" },
        { action_id: "ACT-003-retry", status: "success", cost: 450000, duration_ms: 567, before_state: initialState, after_state: finalState, execution_log: ["Order placed: ORDER-12345"], failure_reason: null },
    ];

    const recoveryPlans: RecoveryPlan[] = [
        { failed_action_id: "ACT-003", recovery_strategy: "retry", retry_attempts: 1, fallback_action: null, rollback_to_state: null, recovery_execution_log: ["Retrying ACT-003"] },
    ];

    try {
        const visualizer = new OutcomeVisualizer();
        // Actual API: generate(initialState, executionResults, recoveryPlans, actionChain)
        const outcome = visualizer.generate(initialState, executionResults, recoveryPlans, mockChain);

        const checks: Record<string, boolean> = {
            "Has before_state": !!(outcome.before_state),
            "Has after_state": !!(outcome.after_state),
            "Has state_diff array": Array.isArray(outcome.state_diff),
            "State diff detects added variables": outcome.state_diff.some(
                (d: any) => d.change_type === "added"
            ),
            "State diff detects modified variables": outcome.state_diff.some(
                (d: any) => d.change_type === "modified"
            ),
            "Has metrics": !!(outcome.metrics),
            "Metrics has total_cost": typeof outcome.metrics?.total_cost === "number",
            "Metrics has success_rate": typeof outcome.metrics?.success_rate === "number",
            "Success rate < 100% (had failures)": (outcome.metrics?.success_rate ?? 1) < 1,
            "Has projected_impact": !!(outcome.projected_impact),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nMetrics:", JSON.stringify(outcome.metrics, null, 2));
        console.log("State changes:", outcome.state_diff.filter((d: any) => d.change_type !== "unchanged").length);

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();
