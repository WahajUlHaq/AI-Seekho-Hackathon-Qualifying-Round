import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { TemporalAnalysisAgent } from "../agents/temporal-analysis.agent";

async function test() {
    console.log("=== TEST 2.6: Temporal Analysis (Module 6) ===");

    const spikeData = [
        { timestamp: "2026-05-12T00:00:00Z", value: 52 },
        { timestamp: "2026-05-13T00:00:00Z", value: 68 },
        { timestamp: "2026-05-14T00:00:00Z", value: 89 },
        { timestamp: "2026-05-15T00:00:00Z", value: 95 },
    ];

    const declineData = [
        { timestamp: "2026-05-01T00:00:00Z", value: 500 },
        { timestamp: "2026-05-05T00:00:00Z", value: 400 },
        { timestamp: "2026-05-10T00:00:00Z", value: 250 },
        { timestamp: "2026-05-15T00:00:00Z", value: 50 },
    ];

    const stableData = [
        { timestamp: "2026-05-12T00:00:00Z", value: 100 },
        { timestamp: "2026-05-13T00:00:00Z", value: 102 },
        { timestamp: "2026-05-14T00:00:00Z", value: 99 },
        { timestamp: "2026-05-15T00:00:00Z", value: 101 },
    ];

    try {
        const engine = new TemporalAnalysisAgent();
        // Actual API: agent.run({ pipeline_id, time_series_data: [{metric_name, data_points}] })
        const output = await engine.run({
            pipeline_id: "TEST-TEMPORAL",
            time_series_data: [
                { metric_name: "daily_sales", data_points: spikeData },
                { metric_name: "stock_level", data_points: declineData },
                { metric_name: "baseline_metric", data_points: stableData },
            ],
        });

        const patterns = output.patterns;
        const spikeResult = patterns.find((p: any) => p.metric_name === "daily_sales");
        const declineResult = patterns.find((p: any) => p.metric_name === "stock_level");
        const stableResult = patterns.find((p: any) => p.metric_name === "baseline_metric");

        const checks: Record<string, boolean> = {
            "Returns patterns array": Array.isArray(patterns),
            "Three patterns returned": patterns.length === 3,
            "Spike: direction is increasing": spikeResult?.change_direction === "increasing",
            "Decline: detected as decline": declineResult?.pattern_type === "decline",
            "Decline: direction is decreasing": declineResult?.change_direction === "decreasing",
            "Stable: low change magnitude": (stableResult?.change_magnitude ?? 999) < 5,
            "All have confidence scores": patterns.every(
                (r: any) => typeof r.confidence === "number"
            ),
        };

        for (const [name, passed] of Object.entries(checks)) {
            console.log(`  ${passed ? "✅" : "❌"} ${name}`);
        }

        console.log("\nResults:");
        patterns.forEach((p: any) =>
            console.log(`  ${p.metric_name} → ${p.pattern_type} (${p.change_direction}, magnitude: ${p.change_magnitude?.toFixed(3)})`)
        );

        const allPassed = Object.values(checks).every(Boolean);
        console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    } catch (error: any) {
        console.log("❌ FAIL:", error.message);
        console.log(error.stack?.split("\n").slice(0, 5).join("\n"));
    }
}

test();
