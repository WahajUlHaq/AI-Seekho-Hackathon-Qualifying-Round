import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { ConstraintValidator } from "../simulation/constraint-validator";
import { ActionChain, ActionNode, Constraints } from "../types/simulation.types";

function test() {
    console.log("=== TEST 4.1: Constraint Validator (Module 10) ===");

    const mockChain: ActionChain = {
        chain_id: "CHAIN-001",
        action_count: 3,
        insight_id: "INS-001",
        actions: [
            {
                action_id: "ACT-001",
                action_type: "verify",
                title: "Verify stock",
                description: "Query DB",
                priority: "critical",
                depends_on: [],
                blocks: ["ACT-002"],
                constraints: { max_cost: 0, max_duration_hours: 0.5, required_resources: ["database_access"], api_rate_limit: 10 },
                simulatable: true,
                simulation_details: { simulation_type: "database_query", parameters: {}, expected_success_rate: 0.95 },
                failure_recovery: { retry_count: 3, fallback_action_id: null, rollback_required: false },
            },
            {
                action_id: "ACT-002",
                action_type: "notify",
                title: "Notify procurement",
                description: "Send email",
                priority: "high",
                depends_on: ["ACT-001"],
                blocks: [],
                constraints: { max_cost: 0, max_duration_hours: 0.25, required_resources: ["email"], api_rate_limit: 5 },
                simulatable: true,
                simulation_details: { simulation_type: "send_notification", parameters: {}, expected_success_rate: 0.95 },
                failure_recovery: { retry_count: 2, fallback_action_id: null, rollback_required: false },
            },
            {
                action_id: "ACT-003",
                action_type: "mitigate",
                title: "Place emergency order",
                description: "Over-budget order",
                priority: "critical",
                depends_on: ["ACT-001"],
                blocks: [],
                constraints: { max_cost: 600000, max_duration_hours: 2, required_resources: ["supplier_api"], api_rate_limit: 50 },
                simulatable: true,
                simulation_details: { simulation_type: "place_order", parameters: { order_cost: 600000 }, expected_success_rate: 0.9 },
                failure_recovery: { retry_count: 2, fallback_action_id: null, rollback_required: false },
            },
        ] as ActionNode[],
        execution_order: ["ACT-001", "ACT-002", "ACT-003"],
        total_estimated_cost: 600000,
        total_estimated_duration_hours: 2.75,
        constraint_violations: [],
    };

    const constraints: Constraints = {
        budget_limit: { amount: 500000, currency: "PKR" },
        time_limit: { max_duration_hours: 24 },
        resource_limits: { api_calls_per_hour: 100, compute_units: 50, human_hours_available: 8 },
        urgency_level: "critical",
    };

    try {
        const validator = new ConstraintValidator();
        const results = validator.validateActionChain(mockChain, constraints);

        const checks: Record<string, boolean> = {
            "Returns array": Array.isArray(results),
            "ACT-001 is feasible": results.find((r: any) => r.action_id === "ACT-001")?.is_feasible === true,
            "ACT-002 is feasible": results.find((r: any) => r.action_id === "ACT-002")?.is_feasible === true,
            "ACT-003 is NOT feasible (600K > 500K budget)":
                results.find((r: any) => r.action_id === "ACT-003")?.is_feasible === false,
            "ACT-003 has budget violation": results
                .find((r: any) => r.action_id === "ACT-003")
                ?.violations.some((v: any) => v.constraint_type === "budget") ?? false,
            "ACT-003 has recommended_modification":
                !!(results.find((r: any) => r.action_id === "ACT-003")?.recommended_modification),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nValidation results:");
        results.forEach((r: any) =>
            console.log(
                `  ${r.action_id}: ${r.is_feasible ? "✓ Feasible" : "✗ Infeasible"} (violations: ${r.violations.length})`
            )
        );

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
    }
}

test();
