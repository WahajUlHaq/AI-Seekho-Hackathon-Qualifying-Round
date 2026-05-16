# Phase 4: HITL Gate, Simulated Execution, and Audit Finalization

This phase translates the structured `StrategyProposal` from Phase 3 into observable simulated outcomes. It introduces an explicit Human-in-the-Loop (HITL) consent gate, simulates execution with dynamic failure injection, manages automated rollback/recovery, and ultimately compiles a consolidated compliance audit.

> [!IMPORTANT]
> **User Review Required: Module Definitions and HITL Gate**
> 1. **M14 Re-definition:** The Master Prompt originally vaguely assigned M14 as "Orchestrator". Since `pipeline-runner.ts` already serves as the Orchestrator, M14 has been explicitly defined here as the **Workflow Audit Agent**, responsible for consolidating the `traceCollector` events into a final compliance payload.
> 2. **HITL Interception:** We are explicitly placing a mock HITL Gate (plus DAG topological sorting) *before* M11. This prevents cyclical graphs from entering the simulation loop and reflects real-world architectural constraints where a human must approve CRITICAL proposals. 
> Please confirm if these structural alignments are approved.

## Proposed Changes

### [NEW] `backend/src/utils/dag-sorter.ts`
- Pure utility function implementing Kahn's Algorithm. Ensures the `depends_on` relationships formulated in Phase 3 are flattened into a safe, linear, acyclic execution array.

### [NEW] `backend/src/agents/execution-simulator.agent.ts` (M11)
- Extends `BaseAgent`.
- **Input Contract:** Takes `StrategicRecommenderOutput`.
- **Role:** Iterates over sorted actions. Uses LLM to simulate outcomes of the action (e.g., "Database locked") based on injected failure probabilities. 
- **Side Effects:** Pure simulation. No real DB/API mutations occur.

### [NEW] `backend/src/agents/failure-recovery.agent.ts` (M12)
- Extends `BaseAgent`.
- **Input Contract:** Takes output of M11 (which includes `FAILED` action flags).
- **Role:** Synthesizes an alternate path (fallback or skip) and cascades `SKIPPED` status to downstream dependents.

### [NEW] `backend/src/agents/outcome-visualizer.agent.ts` (M13)
- Extends `BaseAgent`.
- **Input Contract:** Takes consolidated execution arrays from M11 and M12.
- **Role:** Generates projected cost, time-to-resolution, and before/after variable diffs.

### [NEW] `backend/src/agents/workflow-audit.agent.ts` (M14)
- Extends `BaseAgent`.
- **Input Contract:** Takes M13 output + full lifecycle pipeline ID.
- **Role:** Queries `traceCollector` and compiles a comprehensive compliance receipt.

### AMCE Contract Integration
- **`execution_simulation_v1.yaml`**: Ensures the output array strictly matches the input length of actions, enforcing `status` enum validation (`SUCCESS`, `FAILED`, `SKIPPED`). *(Note: Semantic checks will validate inner object logic, as YAML recursive properties are limited).*
- **`failure_recovery_v1.yaml`**: Validates the recovery array mapping.
- **`outcome_visualization_v1.yaml`**: Validates the presence of `total_cost` and `projected_risk_reduction` numerics.
- **`workflow_audit_v1.yaml`**: Enforces string schema for the final cryptographic hash/receipt.

> [!WARNING]
> **Critical Risks**
> 1. **Cascade Failure Sync:** If M11 marks an action as `FAILED`, M12 must flawlessly intercept and mark all downstream dependencies as `SKIPPED`. If M12 misses a dependency, the simulator will attempt an invalid state transition.
> 2. **LLM Context Bloat (M13 & M14):** By M13 and M14, the pipeline payload will be massive. Pushing the entire execution trace into the context window for visualization/audit runs a severe risk of "Lost In The Middle" hallucination or token limits. 
> 3. **DAG Cyclic Halts:** If Kahn's Algorithm in the DAG sorter encounters a cycle that wasn't caught by M10, it must degrade gracefully (e.g., sort purely by priority) rather than throwing an unhandled exception that crashes the pipeline runner.

---

**Open Questions for the User:**
1. Should the HITL Consent Gate block ALL pipelines pending manual approval, or should it only block pipelines containing actions flagged as `CRITICAL` or `HIGH` priority?
2. Does the Execution Simulator (M11) need to simulate actual time delays (e.g., `setTimeout`) to test asynchronous non-blocking thread behavior, or should the simulation execute instantly?
3. Should M14's Workflow Audit Agent be responsible for physically writing the final payload to disk/DB, or should it just return the JSON object to `pipeline-runner.ts` to handle storage?