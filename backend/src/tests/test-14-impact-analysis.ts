import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { ImpactAnalysisAgent } from "../agents/impact-analysis.agent";
import { Insight } from "../agents/insight-extraction.agent";
import { Constraints } from "../types/simulation.types";

async function test() {
    console.log("=== TEST 2.8: Impact Analysis (Module 8) ===");

    const mockInsights: Insight[] = [
        {
            insight_id: "INS-001",
            title: "Critical inventory shortage risk",
            category: "risk",
            severity: "critical",
            description: "Stock at 50 units with demand spiking 30% and supplier delayed 3 days.",
            confidence: 0.85,
            supporting_sources: ["SRC-002", "SRC-003"],
            requires_resolution: false,
            contradiction_details: null,
            temporal_pattern: "spike",
            affected_entities: ["SKU-1234", "Warehouse A"],
            data_points: ["Demand: +30%", "Stock: 50 units"],
        },
    ];

    const constraints: Constraints = {
        budget_limit: { amount: 500000, currency: "PKR" },
        time_limit: { deadline: "2026-05-16T14:00:00Z", max_duration_hours: 24 },
        resource_limits: { api_calls_per_hour: 100, compute_units: 50, human_hours_available: 8 },
        urgency_level: "critical",
    };

    try {
        const agent = new ImpactAnalysisAgent();
        // Actual API: agent.run({ pipeline_id, insights, constraints })
        const output = await agent.run({
            pipeline_id: "TEST-IMPACT",
            insights: mockInsights,
            constraints,
        });

        const analyses = output.impact_analyses;
        const analysis = analyses[0];

        const checks: Record<string, boolean> = {
            "Returns impact_analyses array": Array.isArray(analyses),
            "At least 1 analysis": analyses.length >= 1,
            "Has primary_impact": !!(analysis?.primary_impact),
            "Has impact_category": [
                "revenue", "cost", "risk", "compliance", "reputation", "operational",
            ].includes(analysis?.impact_category ?? ""),
            "Has impact_severity": [
                "critical", "high", "medium", "low",
            ].includes(analysis?.impact_severity ?? ""),
            "Has quantified_impact": !!(analysis?.quantified_impact),
            "Has cascading_effects array": Array.isArray(analysis?.cascading_effects),
            "Has risk_if_ignored": !!(analysis?.risk_if_ignored),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nImpact:", analysis?.impact_category, "/", analysis?.impact_severity);
        console.log("Quantified:", JSON.stringify(analysis?.quantified_impact));
        console.log("Cascading effects:", analysis?.cascading_effects?.length);

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();
