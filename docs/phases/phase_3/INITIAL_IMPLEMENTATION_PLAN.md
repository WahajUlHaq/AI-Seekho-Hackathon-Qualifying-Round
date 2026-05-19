# Initial Implementation Plan: Phase 3 - Simulation, Recovery & Saga Ledger

## 1. Antigravity Orchestration for Phase 3
During Phase 3 (Execution Simulation and Reporting), the Google Antigravity Central Orchestrator takes absolute control over Modules 10, 11, 12, and 13.
- **Module 10 (Saga Constraint Validation):** Antigravity routes the generated action chain into M10. The module utilizes the synchronous, in-memory `SagaConstraintLedger` to evaluate actions in cumulative execution order. If an action breaches the budget/time constraints, M10 marks it infeasible and automatically suggests specific constraint relaxations.
- **Module 11 (DAG Executor & State Machine):** Antigravity executes the Action Chain using a level-parallel DAG executor powered by `Promise.allSettled`. Explicit state mutations are enforced to occur strictly *between* dependency levels to completely eliminate race conditions.
- **Module 12 (Failure Recovery Engine):** On any deterministic or actual failure, Antigravity halts the level and invokes M12. The selective rollback flow ensures that `ledger.refund()` is invoked *first* to release escrowed funds. Only then does M12 execute retry, fallback, or graceful skip strategies while meticulously tracking recovery costs.
- **Module 13 (Outcome Visualization):** Antigravity invokes M13 to synthesize the execution results into the 5 mandatory outputs required by the hackathon spec: before/after state diff, action execution timeline, residual risk assessment, baseline comparison (agentic vs heuristic), and cost/scalability analysis.

## 2. AMCE Contract Mode (ALERT_ONLY / QUARANTINE)
For Modules 10 through 13, the AMCE layer scales down to high-efficiency Zod structural validation only.
- Since the generative heavy-lifting occurred in Phase 2, these deterministic simulation modules do not require expensive LLM base-model evaluations.
- AMCE operates in `ALERT_ONLY` or `QUARANTINE` mode, instantly verifying state transitions, ledger mutations, and outcome structures to keep latency and costs at zero.

## 3. Mandatory Trace Logging Properties (Data Lineage)
To fulfill the hackathon's integration tracing requirements, Antigravity will append the following explicit data lineage properties for every inter-module interaction in this phase:
- `from`: Originating module (e.g., M11)
- `to`: Receiving module (e.g., M12)
- `data_type`: Type of payload transferred (e.g., StateTransition, LedgerRefund)
- `key_change`: Delta applied to the global state (e.g., Budget +450K)
