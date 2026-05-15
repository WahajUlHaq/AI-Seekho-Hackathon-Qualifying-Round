import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { ActionChainSimulator } from "../simulation/chain-simulator";
import { ActionChain, SimulationState } from "../types/simulation.types";

async function test() {
    console.log("=== TEST 4.2: Chain Simulator — Happy Path (Module 11) ===");

    const mockChain: ActionChain = {
        chain_id: "CHAIN-001",
        action_count: 2,
        insight_id: "INS-001",
        actions: [
            {
                action_id: "ACT-001",
                action_type: "verify",
                title: "Verify stock levels",
                description: "Query warehouse database",
                priority: "critical",
                depends_on: [],
                blocks: ["ACT-002"],
                constraints: { max_cost: 0, max_duration_hours: 0.5, required_resources: ["database_access"], api_rate_limit: 10 },
                simulatable: true,
                simulation_details: {
                    simulation_type: "database_query",
                    parameters: { query: "SELECT stock FROM inventory WHERE sku='SKU-1234'" },
                    expected_success_rate: 1.0, // always succeed in happy path
                },
                failure_recovery: { retry_count: 3, fallback_action_id: null, rollback_required: false },
            },
            {
                action_id: "ACT-002",
                action_type: "notify",
                title: "Notify procurement team",
                description: "Send urgent alert",
                priority: "critical",
                depends_on: ["ACT-001"],
                blocks: [],
                constraints: { max_cost: 0, max_duration_hours: 0.25, required_resources: ["email"], api_rate_limit: 5 },
                simulatable: true,
                simulation_details: {
                    simulation_type: "send_notification",
                    parameters: { recipient: "procurement@company.com" },
                    expected_success_rate: 1.0,
                },
                failure_recovery: { retry_count: 2, fallback_action_id: null, rollback_required: false },
            },
        ],
        execution_order: ["ACT-001", "ACT-002"],
        total_estimated_cost: 0,
        total_estimated_duration_hours: 0.75,
        constraint_violations: [],
    };

    const initialState: SimulationState = {
        state_id: "STATE-INIT",
        timestamp: new Date().toISOString(),
        variables: { stock_level: 0, stock_verified: false, notification_sent: false },
    };

    try {
        const simulator = new ActionChainSimulator();
        // simulateFailures=false for happy path; no pipelineId needed for unit test
        const results = await simulator.simulateChain(mockChain, initialState, false);

        const checks: Record<string, boolean> = {
            "Returns results array": Array.isArray(results),
            "All 2 actions executed": results.length === 2,
            "ACT-001 succeeded": results[0]?.status === "success",
            "ACT-002 succeeded": results[1]?.status === "success",
            "Each has before_state": results.every((r: any) => !!(r.before_state)),
            "Each has after_state": results.every((r: any) => !!(r.after_state)),
            "Each has execution_log": results.every(
                (r: any) => Array.isArray(r.execution_log) && r.execution_log.length > 0
            ),
            "ACT-002 ran after ACT-001 (dependency respected)":
                results.findIndex((r: any) => r.action_id === "ACT-001") <
                results.findIndex((r: any) => r.action_id === "ACT-002"),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nExecution log:");
        results.forEach((r: any) =>
            console.log(`  ${r.action_id}: ${r.status} (${r.duration_ms}ms, cost: ${r.cost})`)
        );

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();
