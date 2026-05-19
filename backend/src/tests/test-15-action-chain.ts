import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { ActionChainGeneratorAgent } from "../agents/action-chain-generator.agent";
import { Insight } from "../agents/insight-extraction.agent";
import { Constraints, ImpactAnalysis } from "../types/simulation.types";

async function test() {
    console.log("=== TEST 2.9: Action Chain Generator (Module 9) ===");

    const mockInsights: Insight[] = [
        {
            insight_id: "INS-001",
            title: "Critical inventory shortage risk",
            category: "risk",
            severity: "critical",
            description: "Stockout within 24 hours if no action taken.",
            confidence: 0.85,
            supporting_sources: ["SRC-002"],
            requires_resolution: false,
            contradiction_details: null,
            temporal_pattern: null,
            affected_entities: ["SKU-1234"],
            data_points: ["Stock: 50 units"],
        },
    ];

    const mockImpact: ImpactAnalysis[] = [
        {
            insight_id: "INS-001",
            primary_impact: "Stockout within 24 hours",
            impact_category: "risk",
            impact_severity: "critical",
            quantified_impact: {
                estimated_cost: 450000,
                estimated_time_hours: 4,
                affected_count: 200,
                cost_pkr: 450000,
                affected_customers: 200,
            },
            constraints_violated: [],
            time_horizon: "immediate",
            cascading_effects: ["Customer churn", "Revenue loss"],
            risk_if_ignored: "Complete stockout leading to PKR 2M revenue loss",
            options: [
                {
                    option_id: "OPT-A",
                    label: "Fastest resolution via air freight",
                    tradeoff: "fastest_resolution",
                    cost_pkr: 480000,
                    time_hours: 6,
                    affected_customers: 40,
                    rationale: "Resolves stockout inside 6 h",
                },
                {
                    option_id: "OPT-B",
                    label: "Standard freight + queuing",
                    tradeoff: "lowest_cost",
                    cost_pkr: 180000,
                    time_hours: 48,
                    affected_customers: 200,
                    rationale: "Cheapest path; 1-2 day customer delay",
                },
            ],
        },
    ];

    const constraints: Constraints = {
        budget_limit: { amount: 500000, currency: "PKR" },
        time_limit: { deadline: "2026-05-16T14:00:00Z", max_duration_hours: 24 },
        resource_limits: { api_calls_per_hour: 100, compute_units: 50, human_hours_available: 8 },
        urgency_level: "critical",
    };

    try {
        const agent = new ActionChainGeneratorAgent();
        // Actual API: agent.run({ pipeline_id, insights, impact_analyses, constraints })
        const output = await agent.run({
            pipeline_id: "TEST-ACTION-CHAIN",
            insights: mockInsights,
            impact_analyses: mockImpact,
            constraints,
        });

        const actions = output.actions ?? [];

        const checks: Record<string, boolean> = {
            "Has chain_id": !!(output.chain_id),
            "Has 3-5 actions": actions.length >= 3 && actions.length <= 5,
            "Each has action_id": actions.every((a: any) => !!(a.action_id)),
            "Each has action_type": actions.every((a: any) =>
                ["diagnose", "notify", "update_system", "mitigate", "monitor", "verify", "escalate"].includes(
                    a.action_type
                )
            ),
            "Each has depends_on array": actions.every((a: any) => Array.isArray(a.depends_on)),
            "Each has constraints object": actions.every((a: any) => !!(a.constraints)),
            "Each has failure_recovery": actions.every((a: any) => !!(a.failure_recovery)),
            "Has execution_order": Array.isArray(output.execution_order),
            "Execution order matches action count":
                output.execution_order.length === actions.length,
            "At least 3 simulatable": actions.filter((a: any) => a.simulatable).length >= 3,
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nAction chain:");
        actions.forEach((a: any) =>
            console.log(
                `  ${a.action_id}: [${a.action_type}] ${a.title} (depends: ${a.depends_on.join(",") || "none"})`
            )
        );
        console.log("Execution order:", output.execution_order.join(" → "));

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();
