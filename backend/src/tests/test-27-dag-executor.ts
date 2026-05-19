import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import { DAGExecutor } from "../simulation/dag-executor";
import { SagaConstraintLedger } from "../simulation/saga-ledger";
import { ActionChain, SimulationState } from "../types/simulation.types";

async function test() {
    console.log("=== TEST 5.3: DAG Executor (M11) — levels, allSettled, forcedFailures, refund-eligible ===");

    const chain: ActionChain = {
        chain_id: "CHAIN-T5.3",
        action_count: 4,
        insight_id: "INS-001",
        actions: [
            {
                action_id: "ACT-001",
                action_type: "verify",
                title: "Verify stock",
                description: "",
                priority: "critical",
                depends_on: [],
                blocks: ["ACT-002", "ACT-003"],
                constraints: { max_cost: 0, max_duration_hours: 0.5, required_resources: [], api_rate_limit: 10 },
                simulatable: true,
                simulation_details: { simulation_type: "database_query", parameters: {}, expected_success_rate: 1 },
                failure_recovery: { retry_count: 1, fallback_action_id: null, rollback_required: false },
            },
            {
                // Sibling of ACT-003 at level 1 — should run in PARALLEL with ACT-003.
                action_id: "ACT-002",
                action_type: "notify",
                title: "Notify procurement (parallel sibling)",
                description: "",
                priority: "high",
                depends_on: ["ACT-001"],
                blocks: [],
                constraints: { max_cost: 0, max_duration_hours: 0.25, required_resources: [], api_rate_limit: 5 },
                simulatable: true,
                simulation_details: { simulation_type: "send_notification", parameters: { recipient: "procurement@example.com" }, expected_success_rate: 1 },
                failure_recovery: { retry_count: 1, fallback_action_id: null, rollback_required: false },
            },
            {
                action_id: "ACT-003",
                action_type: "mitigate",
                title: "Place emergency order (FORCED FAILURE)",
                description: "",
                priority: "critical",
                depends_on: ["ACT-001"],
                blocks: ["ACT-004"],
                constraints: { max_cost: 200000, max_duration_hours: 2, required_resources: [], api_rate_limit: 20 },
                simulatable: true,
                simulation_details: { simulation_type: "place_order", parameters: { order_cost: 200000, quantity: 100 }, expected_success_rate: 1 },
                failure_recovery: { retry_count: 1, fallback_action_id: null, rollback_required: false },
            },
            {
                action_id: "ACT-004",
                action_type: "monitor",
                title: "Schedule monitoring",
                description: "",
                priority: "high",
                depends_on: ["ACT-003"],
                blocks: [],
                constraints: { max_cost: 0, max_duration_hours: 0.5, required_resources: [], api_rate_limit: 5 },
                simulatable: true,
                simulation_details: { simulation_type: "schedule_monitoring", parameters: {}, expected_success_rate: 1 },
                failure_recovery: { retry_count: 0, fallback_action_id: null, rollback_required: false },
            },
        ],
        execution_order: ["ACT-001", "ACT-002", "ACT-003", "ACT-004"],
        total_estimated_cost: 200000,
        total_estimated_duration_hours: 3.25,
        constraint_violations: [],
    };

    const initialState: SimulationState = {
        state_id: "STATE-T5.3",
        timestamp: new Date().toISOString(),
        variables: { stock_level: 50, budget_remaining: 500000 },
    };

    const ledger = new SagaConstraintLedger("TEST-DAG", 500000);
    // Mimic M10: reserve every action's cost upfront so refund-first has rows to refund.
    chain.actions.forEach((a) => {
        if (a.constraints.max_cost > 0) ledger.reserve(a.action_id, a.constraints.max_cost);
    });
    const reservedBefore = ledger.reservedTotal();

    const executor = new DAGExecutor();

    // ── 1. Verify level grouping ──
    const levels = DAGExecutor.computeLevels(chain);
    const checks: Record<string, boolean> = {};
    checks["3 levels (0,1,2)"] = levels.length === 3 &&
        levels.map((l) => l.level).join(",") === "0,1,2";
    checks["Level 0 contains only ACT-001"] = levels[0].action_ids.join(",") === "ACT-001";
    checks["Level 1 contains ACT-002 + ACT-003 (parallel siblings)"] =
        levels[1].action_ids.includes("ACT-002") && levels[1].action_ids.includes("ACT-003");
    checks["Level 2 contains only ACT-004"] = levels[2].action_ids.join(",") === "ACT-004";

    // ── 2. Execute with deterministic forced failure on ACT-003 ──
    const out = await executor.execute({
        pipeline_id: "TEST-DAG-EXEC",
        chain,
        initialState,
        ledger,
        forcedFailures: { fail: [{ action_id: "ACT-003", reason: "supplier_api_down" }] },
        simulateRandomFailures: false,
    });

    const byId = new Map(out.results.map((r) => [r.action_id, r]));
    checks["ACT-001 succeeded"] = byId.get("ACT-001")?.status === "success";
    checks["ACT-002 succeeded (parallel with ACT-003)"] = byId.get("ACT-002")?.status === "success";
    checks["ACT-003 deterministically FAILED via forcedFailures"] =
        byId.get("ACT-003")?.status === "failed" &&
        byId.get("ACT-003")?.failure_reason?.includes("supplier_api_down") === true;
    checks["ACT-004 SKIPPED — dependency failed"] = byId.get("ACT-004")?.status === "skipped";

    // ── 3. Ledger invariants after DAG run ──
    //  ACT-001 was free → commit no-op
    //  ACT-002 was free → commit no-op
    //  ACT-003 reserved 200K but failed → still reserved (waiting for M12 refund)
    //  ACT-004 reserved 0 → no-op
    const reservedAfter = ledger.reservedTotal();
    const committedAfter = ledger.committedTotal();
    checks["Ledger: failed action's reserved row still outstanding"] =
        reservedAfter === 200000 && reservedBefore === 200000 && committedAfter === 0;

    // ── 4. State mutations occurred BETWEEN levels (level 0 stock_verified=true before level 1 ran) ──
    const finalVars = out.final_state.variables;
    checks["Final state has stock_verified=true (mutation from L0 applied before L1)"] =
        finalVars["stock_verified"] === true;
    checks["Final state has notification_sent=true (L1 sibling committed)"] =
        finalVars["notification_sent"] === true;
    checks["Final state has NO order_placed (ACT-003 failed → no mutation)"] =
        finalVars["order_placed"] !== true;

    for (const [name, passed] of Object.entries(checks)) {
        console.log(`  ${passed ? "✅" : "❌"} ${name}`);
    }

    const allPassed = Object.values(checks).every(Boolean);
    console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    console.log("DAG levels:", out.levels.map((l) => `L${l.level}: ${l.action_ids.join(",")}`).join("  |  "));
    console.log("Ledger snapshot:", {
        available: ledger.available(),
        reserved: ledger.reservedTotal(),
        committed: ledger.committedTotal(),
    });
}

test().catch((err) => {
    console.log("❌ FAIL:", err.message);
    console.log(err.stack);
});
