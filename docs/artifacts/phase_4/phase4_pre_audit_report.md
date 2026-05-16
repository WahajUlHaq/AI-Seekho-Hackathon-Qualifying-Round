# Phase 4: HITL Consent Gate & Autonomous Action Execution
## Pre-Audit Design Review & Threat Model

---

## 1. Contract Completeness Review (`action_chain_v1.yaml`)

The planned contract for Phase 4 must track not just the output, but the execution metadata, HITL audit trails, and cascade failures.

**Missing Fields to Add to Schema:**
- `overall_status`: Enum `[SUCCESS, PARTIAL_SUCCESS, FAILED]` representing the final state of the entire DAG.
- `approved_by`: String (nullable). Stores the HITL credential/user ID who authorized the execution, satisfying audit compliance.
- `approval_timestamp`: String (ISO 8601).
- `total_execution_ms`: Number. Performance telemetry for the full chain.
- `execution_results`: Array of objects. Each object must strictly map to an `action_id` and include:
  - `status`: `[SUCCESS, FAILED, SKIPPED]`
  - `latency_ms`: Number
  - `error_message`: String (nullable)
  - `output_summary`: String (nullable)

---

## 2. Algorithmic Edge-Case Specifications (`dag-sorter.ts`)

If the LLM hallucinates a cyclic dependency (e.g., A → B → A), the pipeline runner will hang indefinitely or trigger a StackOverflow if relying on naive recursive DFS.

**Required Algorithmic Signature & Fail-Safe:**
We mandate the use of **Kahn’s Algorithm** (in-degree counting) because it naturally isolates cycles.

```typescript
export function sortActionsTopologically(actions: ProposedAction[]): ProposedAction[] {
    // 1. Build adjacency list and in-degree map
    // 2. Queue nodes with in-degree 0
    // 3. Process queue, decrementing in-degrees of neighbors
    // 4. If processed count !== total actions, A CYCLE EXISTS.
    
    if (processed.length !== actions.length) {
        // FAIL-SAFE DEGRADATION:
        console.warn("[DAG Sorter] Cyclic dependency detected. Degrading to Priority Sort.");
        return [...actions].sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));
    }
    
    return processed;
}
```
*Constraint:* Under no circumstances should the sorting utility throw an unhandled exception. It must degrade gracefully to a priority-based flat execution list.

---

## 3. State Machine Blueprint (`execution.routes.ts`)

To eliminate concurrency risks (e.g., double-clicking the "Approve" button causing duplicate external API calls), the backend must enforce strict state transitions using an atomic locking mechanism (in-memory `Map` or Redis lock).

**Valid State Transitions:**
- `PENDING` ➔ `EXECUTING` (Triggered by HITL approval)
- `EXECUTING` ➔ `COMPLETED` (All actions processed, including skipped ones)
- `EXECUTING` ➔ `FAILED` (Critical runtime crash in the dispatcher itself)

**Invalid Transitions (Must return 409 Conflict / 400 Bad Request):**
- `EXECUTING` ➔ `EXECUTING` (Prevents double-click duplicate dispatch)
- `COMPLETED` ➔ `EXECUTING` (Prevents re-running a finished pipeline)
- `FAILED` ➔ `EXECUTING` (Pipeline must be regenerated, not forcefully resumed)

**Implementation Directive:**
The approval route must use an atomic check-and-set:
```typescript
if (pipeline.state !== 'PENDING') {
    return res.status(409).json({ error: "Pipeline is already executing or finalized." });
}
pipeline.state = 'EXECUTING'; // Lock acquired
```

---

## 4. Pre-Flight Implementation Sign-off

The following execution constraints must be satisfied during the Phase 4 coding phase to achieve absolute AMCE compliance:

1. **Cascade Failure Interception (Dispatcher Loop):**
   - The `action-dispatcher.agent.ts` must maintain an active `Set<string>` of successful `action_id`s.
   - Before executing `Action X`, it must check `Action X.depends_on.every(id => successfulSet.has(id))`.
   - If `false`, immediately mark `Action X` as `SKIPPED` with `error_message: "Upstream dependency failed or was skipped"`.
2. **Trace Collector Isolation:**
   - Verify that `traceCollector.log(pipelineId, {...})` relies exclusively on the synchronous `pipelineId` passed through the execution chain context. Avoid relying on global state or `async_hooks` which can leak under heavy concurrent Node.js loads.
3. **Idempotent Mock Executors:**
   - Ensure the mocked external actions (e.g., `send_notification`, `database_update`) are idempotent so that if the system crashes mid-execution, re-running a fresh pipeline doesn't corrupt downstream mock state.

**Verdict:** 
The design blueprints are verified and hardened against the primary threat vectors. We are officially cleared to begin coding Phase 4.
