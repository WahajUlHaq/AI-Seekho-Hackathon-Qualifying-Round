# Task List: Phase 3 - Simulation, Recovery & Saga Ledger

- [ ] **1. Implement Module 10: Constraint Validation**
  - [ ] Implement `backend/src/simulation/constraint-validator.ts`.
  - [ ] Integrate the `SagaConstraintLedger` to evaluate actions in cumulative execution order.
  - [ ] Implement logic to suggest specific constraint relaxations if an action is marked infeasible.

- [ ] **2. Implement Module 11: DAG Executor & State Machine**
  - [ ] Implement `backend/src/simulation/dag-executor.ts` using `Promise.allSettled` for level-parallel execution.
  - [ ] Implement `backend/src/simulation/state-machine.ts` defining state transitions and invariants (e.g., no negative stock).
  - [ ] Enforce that state mutations occur strictly *between* dependency levels, never during.
  - [ ] Integrate explicit structural validation checks for `forcedFailures` configurations to trigger deterministic simulation testing.

- [ ] **3. Implement Module 12: Failure Recovery Engine**
  - [ ] Implement `backend/src/simulation/failure-recovery.ts`.
  - [ ] Verify State Condition: Ensure `ledger.refund()` is invoked FIRST upon failure.
  - [ ] Add explicit structural test verifying `refund()` can only be called on `reserved` statuses, never on `committed` statuses.
  - [ ] Implement retry, fallback, and graceful skip strategies with recovery cost tracking.

- [ ] **4. Implement Module 13: Outcome Visualization**
  - [ ] Implement `backend/src/simulation/outcome-visualizer.ts`.
  - [ ] Generate the before/after state diff.
  - [ ] Generate the action execution timeline.
  - [ ] Generate the residual risk assessment.
  - [ ] Output the mandatory baseline comparison (agentic vs heuristic).
  - [ ] Output the mandatory cost/scalability analysis.

- [ ] **5. Integrate AMCE Validation & Data Lineage Tracing**
  - [ ] Enforce Zod `ALERT_ONLY` / `QUARANTINE` mode validation for M10-13 outputs.
  - [ ] Ensure the Antigravity Trace Logger dynamically captures the specific `from`, `to`, `data_type`, and `key_change` properties for every execution step.
