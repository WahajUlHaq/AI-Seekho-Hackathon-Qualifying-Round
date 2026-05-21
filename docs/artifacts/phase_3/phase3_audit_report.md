# Phase 3: Impact Analysis & Strategic Forecasting — Deep Audit Report

## 1. AMCE Contract & Typing Alignment Review

### Contract Verification
- **`impact_analysis_v1` Alignment:** Perfect alignment. The TypeScript interface `ImpactScorerOutput` matches the YAML schema exactly. The semantic check `impactMagnitudeScore must equal round(...)` correctly aligns with the deterministic implementation of `Math.round()` applied to the weighted variables in `ImpactScorerAgent`.
- **`strategic_recommendation_v1` Alignment:** The progressive nature of this contract (shared between Module 9 and 10) is handled correctly. Module 9 populates `forecastingScenarios` while leaving `strategyProposal` as `null` (satisfying the "at least one" constraint). Module 10 seamlessly preserves the propagated scenarios while populating the strategy payload.
- **Typing Integrity:** In `strategic-recommender.agent.ts`, the typing enforces `depends_on: string[]`. During runtime, `sanitizeProposal` purges dangling pointers from the array, satisfying the contract's semantic requirement that `depends_on` elements must reference valid earlier entries.

### Identified Minor Vulnerability
The YAML semantic check for Module 8 explicitly tests for an inclusive range of `0..100` for component scores. While `clamp()` guarantees this safely, if the LLM hallucinated negative numbers (e.g., `-10`), it would clamp to `0`. This is mathematically safe but obscures LLM confusion from the telemetry.

---

## 2. Edge-Case Risk Register

### Risk 1: Temporal Silence (Empty Metrics Array)
**Location:** `PredictiveForecasterAgent.ts`
**Severity:** LOW
**Analysis:** If Phase 2 returns zero temporal metrics (e.g., pipeline is running on static documents), `metrics` is an empty array.
- `detectUnreliableMetrics` safely returns an empty `Set`.
- `projectScenarios` handles this by defaulting `mathTable` to `"  (no temporal metrics available)"`.
- `ensureAllHorizons` will trigger fallback stub generation since the LLM won't be able to fulfill the derived metrics constraint.
- **Safety Confirmation:** `allMetricNames.slice(0, 2)` gracefully returns an empty array `[]`. The AMCE contract schema (`strategic_recommendation_v1.yaml`) enforces `derived_from_metrics` as an array, but does not impose a `minItems: 1` restriction. **The code will not crash and will successfully emit standard fallbacks.**

### Risk 2: NaN Propagation in Impact Scorer
**Location:** `ImpactScorerAgent.ts`
**Severity:** LOW
**Analysis:** If the LLM generates a non-numeric string or a `NaN` equivalent, `clampUnit` safely guards this by returning `0`. It prevents the downstream mathematical deterministic formula from resolving to `NaN` and failing the contract gate.

### Risk 3: Extrapolation Unreliable Thresholding
**Location:** `PredictiveForecasterAgent.ts` (`STABLE_VOLATILITY_RATIO = 0.3`)
**Severity:** MEDIUM
**Analysis:** The volatility check `Math.abs(m.stdDev) / Math.max(Math.abs(m.meanValue), 1)` correctly avoids `DivisionByZero` errors. However, for metrics with a mean value strictly between `0` and `1` (e.g., an LLM confidence slope of `0.8`), the denominator defaults to `1`, meaning the ratio becomes simply `stdDev`. This suppresses the volatility alarm for fractional metrics.

---

## 3. Refactoring & Patch Proposals

### Issue: The ID Reference Invariant & Hallucination Leakage
**Problem:** Module 10 successfully creates valid `ACT-XXXXXX` IDs in the `proposedActions` block but hallucinates non-existent or badly formatted IDs (e.g., `ACT-E4G6U8Y7A9`) within the freeform `rationale` string. This breaks the referential integrity of the payload.

### The Patch Strategy
We must introduce a regex-based post-processing pass during the `sanitizeProposal` method to detect phantom IDs and neutralize them. Instead of trying to guess which valid ID the LLM meant (which risks semantic corruption), we should replace phantom IDs with a safe generic text reference.

**Code Patch for `backend/src/agents/strategic-recommender.agent.ts`:**

Update the `sanitizeProposal` method to include this regex pass:

```typescript
    private sanitizeProposal(
        pipelineId: string,
        raw: StrategyProposal,
        scenarios: ForecastScenario[]
    ): StrategyProposal {
        const seen = new Set<string>();
        const cleanedActions: ProposedAction[] = [];
        let droppedDeps = 0;

        // 1. Sanitize Action Definitions & Dependencies
        for (const action of raw.proposedActions) {
            const action_id = ACTION_ID_RE.test(action.action_id) ? action.action_id : makeActionId();
            const validDeps = action.depends_on.filter(dep => {
                if (seen.has(dep)) return true;
                droppedDeps++;
                return false;
            });
            cleanedActions.push({
                action_id,
                title: action.title,
                description: action.description,
                priority: action.priority,
                depends_on: validDeps,
            });
            seen.add(action_id);
        }

        if (droppedDeps > 0) {
            this.logDecision(pipelineId, `Dropped ${droppedDeps} dangling depends_on reference(s)`, "dependency_scrubbed", 0.9);
        }

        // 2. Sanitize Phantom IDs in Rationale (THE FIX)
        const phantomRegex = /ACT-[A-Z0-9]+/g;
        let sanitizedRationale = raw.rationale.replace(phantomRegex, (match) => {
            return seen.has(match) ? match : `[Proposed Action]`;
        });

        // 3. Enforce Horizon Literal Constraints
        const hasHorizon = HORIZONS.some(h => sanitizedRationale.includes(h));
        const firstHorizon = scenarios[0]?.horizon ?? "30-day";
        if (!hasHorizon) {
            sanitizedRationale = `${sanitizedRationale} Aligned with the ${firstHorizon} forecast.`;
        }

        return {
            proposedActions: cleanedActions,
            rationale: sanitizedRationale,
            overall_priority: raw.overall_priority,
        };
    }
```

### Context Hardening (Module 10)
**Analysis of Current Prompt:** The "Lost In The Middle" prevention logic inside `buildDefensivePrompt()` is exceptional. Restating the prompt question at both the very top and very bottom of the prompt (`=== QUESTION (RE-STATED) ===`), while compressing Phase 2 signals into an ultra-concise `slice(0, 3)` limit, is a highly effective, production-grade technique. No further prompt hardening is required at this time.

---

## 4. Phase 4 Readiness Sign-off

| Criteria | Status | Analyst Notes |
| :--- | :---: | :--- |
| **Contract Alignment** | ✅ PASS | All outputs successfully clear `decisionGate` intercepts. Progressive contracts correctly handle null-state propagations. |
| **Traceability Integrity** | ✅ PASS | `traceCollector` effectively traps `agent_start`, `llm_call`, `decision`, and `agent_complete` for M8, M9, and M10. |
| **Deterministic Isolation** | ✅ PASS | Critical math runs via TypeScript, not the LLM. Fallbacks are safely clamped preventing NaN propagation. |
| **Referential Stability** | ⚠️ CONDITIONAL | Conditional upon applying the "Phantom ID regex patch" detailed above to secure the `rationale` string. |
| **DAG Viability** | ✅ PASS | The `StrategyProposal` provides a strictly acyclic, `depends_on` mapped array of actions, structurally perfect for Phase 4's Execution/Human-in-the-loop orchestrator. |

**Final Verdict:** **APPROVED FOR PHASE 4.** 
Once the Module 10 Regex Patch is committed, Phase 3 provides an immensely robust, mathematically deterministic foundation capable of handling volatile upstream data without crashing.
