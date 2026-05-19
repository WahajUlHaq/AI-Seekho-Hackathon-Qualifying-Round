import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

import {
    SagaConstraintLedger,
    SagaBudgetExceeded,
    SagaLedgerStateError,
} from "../simulation/saga-ledger";

function test() {
    console.log("=== TEST 5.2: Saga Constraint Ledger (M10 + M12 shared) ===");
    const checks: Record<string, boolean> = {};

    // Setup
    const ledger = new SagaConstraintLedger("TEST-SAGA", 500000);

    // 1. Reserve happy path
    const a = ledger.reserve("ACT-001", 100000, "test");
    checks["reserve creates row with status=reserved"] = a.status === "reserved" && a.amount_pkr === 100000;
    checks["available decreases after reserve"] = ledger.available() === 400000;

    // 2. Commit moves reserved → committed
    const aCommitted = ledger.commit(a);
    checks["commit moves reserved → committed"] = aCommitted.status === "committed";
    checks["available unchanged after commit (still spent)"] = ledger.available() === 400000;

    // 3. STRICT INVARIANT: refund must NOT work on committed
    let committedRefundBlocked = false;
    try {
        ledger.refund(aCommitted);
    } catch (err) {
        committedRefundBlocked = err instanceof SagaLedgerStateError && err.current_status === "committed";
    }
    checks["refund on COMMITTED row throws SagaLedgerStateError"] = committedRefundBlocked;

    // 4. Reserve a second row and refund it
    const b = ledger.reserve("ACT-002", 200000, "test");
    checks["second reserve succeeds"] = b.status === "reserved" && ledger.available() === 200000;
    const bRefunded = ledger.refund(b);
    checks["refund on RESERVED row succeeds"] = bRefunded.status === "refunded";
    checks["available restored after refund"] = ledger.available() === 400000;

    // 5. Refund a refunded row should also fail (only `reserved` is eligible)
    let doubleRefundBlocked = false;
    try {
        ledger.refund(bRefunded);
    } catch (err) {
        doubleRefundBlocked = err instanceof SagaLedgerStateError && err.current_status === "refunded";
    }
    checks["double-refund (refunded row) throws SagaLedgerStateError"] = doubleRefundBlocked;

    // 6. Overdraft must throw SagaBudgetExceeded
    let overdraftBlocked = false;
    try {
        ledger.reserve("ACT-003", 999999, "test"); // larger than remaining 400000
    } catch (err) {
        overdraftBlocked = err instanceof SagaBudgetExceeded;
    }
    checks["overdraft reserve throws SagaBudgetExceeded"] = overdraftBlocked;

    // 7. History captures every transition
    const snapshot = ledger.snapshot();
    checks["history captures all transitions"] = snapshot.history.length >= 4;
    checks["snapshot reserved totals consistent"] =
        snapshot.committed_pkr === 100000 && snapshot.refunded_pkr === 200000;

    for (const [name, passed] of Object.entries(checks)) {
        console.log(`  ${passed ? "✅" : "❌"} ${name}`);
    }

    const allPassed = Object.values(checks).every(Boolean);
    console.log(allPassed ? "\n✅ PASS" : "\n❌ FAIL");
    console.log("Final ledger:", {
        available: snapshot.available_pkr,
        committed: snapshot.committed_pkr,
        refunded: snapshot.refunded_pkr,
        history_count: snapshot.history.length,
    });
}

test();
