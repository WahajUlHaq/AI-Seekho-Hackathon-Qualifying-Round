import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { FailureRecoveryEngine } from "../simulation/failure-recovery";
import { ActionChain, ActionNode, ActionExecutionResult, SimulationState } from "../types/simulation.types";

async function test() {
    console.log("=== TEST 4.3: Failure Recovery Engine (Module 12) ===");

    const failedAction: ActionNode = {
        action_id: "ACT-003",
        action_type: "mitigate",
        title: "Place emergency order",
        description: "Over-budget order",
        priority: "critical",
        depends_on: ["ACT-001"],
        blocks: [],
        constraints: { max_cost: 450000, max_duration_hours: 2, required_resources: ["supplier_api"], api_rate_limit: 10 },
        simulatable: true,
        simulation_details: { simulation_type: "place_order", parameters: {}, expected_success_rate: 0.0 },
        failure_recovery: {
            retry_count: 3,
            fallback_action_id: "ACT-MANUAL-ORDER",
            rollback_required: false,
        },
    };

    const failureResult: ActionExecutionResult = {
        action_id: "ACT-003",
        status: "failed",
        failure_reason: "Supplier API timeout",
        before_state: { state_id: "STATE-2", timestamp: new Date().toISOString(), variables: {} },
        after_state: { state_id: "STATE-2", timestamp: new Date().toISOString(), variables: {} },
        execution_log: ["Attempting to place order", "FAILURE: Supplier API timeout"],
        cost: 0,
        duration_ms: 5000,
    };

    const mockChain: ActionChain = {
        chain_id: "CHAIN-001",
        action_count: 2,
        insight_id: "INS-001",
        actions: [
            failedAction,
            {
                action_id: "ACT-MANUAL-ORDER",
                action_type: "mitigate",
                title: "Manual order via phone",
                description: "Manual fallback",
                priority: "high",
                depends_on: [],
                blocks: [],
                constraints: { max_cost: 450000, max_duration_hours: 4, required_resources: [], api_rate_limit: 0 },
                simulatable: false,
                simulation_details: { simulation_type: "place_order", parameters: {}, expected_success_rate: 0.9 },
                failure_recovery: { retry_count: 0, fallback_action_id: null, rollback_required: false },
            },
        ],
        execution_order: ["ACT-003", "ACT-MANUAL-ORDER"],
        total_estimated_cost: 450000,
        total_estimated_duration_hours: 4,
        constraint_violations: [],
    };

    const stateHistory: SimulationState[] = [
        { state_id: "STATE-1", timestamp: "2026-05-15T14:00:00Z", variables: { stock: 50 } },
        { state_id: "STATE-2", timestamp: "2026-05-15T14:30:00Z", variables: { stock: 50, verified: true } },
    ];

    try {
        const engine = new FailureRecoveryEngine();
        const plan = await engine.handleFailure(failedAction, failureResult, mockChain, stateHistory);

        const checks: Record<string, boolean> = {
            "Returns recovery plan": !!(plan),
            "Has recovery_strategy": !!(plan.recovery_strategy),
            "Strategy is retry (retry_count=3 > 0)": plan.recovery_strategy === "retry",
            "Retry attempts set": (plan.retry_attempts ?? 0) > 0,
            "Has recovery_execution_log": Array.isArray(plan.recovery_execution_log),
            "Log mentions failure": plan.recovery_execution_log.some((l: string) =>
                l.toLowerCase().includes("fail") || l.toLowerCase().includes("retry")
            ),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nRecovery plan:", plan.recovery_strategy);
        console.log("Log:", plan.recovery_execution_log);

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();
