# Task List — Phase 4: Execution & Outcome

- [ ] **Step 4.1: Human-in-the-Loop (HITL) Gate & DAG Sorter Utility**
  - [ ] Create `backend/src/utils/dag-sorter.ts` to implement Kahn's algorithm for topological sorting of the `StrategyProposal.proposedActions` array.
  - [ ] Create mock state validation (e.g., locking) to represent HITL approval before passing the DAG to Module 11.

- [ ] **Step 4.2: Action Chain Execution Simulator (M11)**
  - [ ] Create `backend/src/contracts/definitions/execution_simulation_v1.yaml` defining action status arrays (`SUCCESS`, `FAILED`, `SKIPPED`).
  - [ ] Create `backend/src/agents/execution-simulator.agent.ts` extending `BaseAgent`.
  - [ ] Implement sequential execution traversal using `this.llmComplete(...)` to simulate mock external API/DB side-effects and inject random failures.

- [ ] **Step 4.3: Failure Recovery Engine (M12)**
  - [ ] Create `backend/src/contracts/definitions/failure_recovery_v1.yaml` defining recovery strategies (retry, fallback, skip).
  - [ ] Create `backend/src/agents/failure-recovery.agent.ts` extending `BaseAgent`.
  - [ ] Implement logic to intercept `FAILED` actions from M11, utilizing the LLM to dynamically generate a recovery path and rollback states.

- [ ] **Step 4.4: Outcome Visualization (M13)**
  - [ ] Create `backend/src/contracts/definitions/outcome_visualization_v1.yaml` defining before/after diffs and quantitative metrics.
  - [ ] Create `backend/src/agents/outcome-visualizer.agent.ts` extending `BaseAgent`.
  - [ ] Consume the final M11/M12 execution arrays and synthesize them into impact projections (cost, latency, risk reduction) using `this.llmComplete(...)`.

- [ ] **Step 4.5: Workflow Trace & Audit Logs (M14)**
  - [ ] Create `backend/src/contracts/definitions/workflow_audit_v1.yaml` defining a consolidated, cryptographically hashed audit payload.
  - [ ] Create `backend/src/agents/workflow-audit.agent.ts` extending `BaseAgent`.
  - [ ] Extract full lifecycle data from `traceCollector` and compile the final compliance receipt.

- [ ] **Step 4.6: Verification & Integration**
  - [ ] Update `backend/src/pipeline-runner.ts` to wire M11, M12, M13, and M14 sequentially after M10.
  - [ ] Run the pipeline and assert that all new agents successfully emit `agent_start` and `agent_complete` trace events via `traceCollector.log`.
  - [ ] Verify `decisionGate` intercepts and passes all `_v1.yaml` contracts successfully.

