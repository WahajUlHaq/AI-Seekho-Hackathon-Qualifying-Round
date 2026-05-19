# Task List: Phase 1 - Core Agents (M1-M4, M7)

- [ ] **1. Create V2 Mock Data Arsenal**
  - [ ] Generate `warehouse-audit-report.txt` (simulated PDF) with 500 units of SKU-1234 (stale context).
  - [ ] Generate `supplier-dashboard.csv` featuring 30 rows with a recent drop in reliability.
  - [ ] Generate `procurement-budget.json` detailing the PKR 500,000 emergency cap.
  - [ ] Generate `news-article.txt` detailing the Karachi Port Customs Strike.
  - [ ] Generate `customer-complaints.json` containing 9 entries, including spam, Urdu text, and 0 stock claims.

- [ ] **2. Implement Module 1: Multi-Source Ingestion**
  - [ ] Implement `backend/src/agents/multi-source-ingestion.agent.ts`.
  - [ ] Wrap parallel ingestions in `Promise.allSettled` to act as a circuit breaker.
  - [ ] Integrate `tabular-serializer.ts` to convert CSV/JSON rows to natural language.
  - [ ] Validate minimum 3 successful sources constraint.

- [ ] **3. Implement Module 2: Credibility Scorer**
  - [ ] Implement `backend/src/agents/credibility-scorer.agent.ts`.
  - [ ] Apply the 3-axis scoring matrix (recency, authority, quality).
  - [ ] Enforce the domain-aware authority map (e.g., Internal Audit = 30, Social = 5).

- [ ] **4. Implement Module 3: Noise Filter & Deduplication**
  - [ ] Implement `backend/src/agents/noise-filter.agent.ts`.
  - [ ] Implement the 3-tier semantic similarity check (>0.85 DUPLICATE, 0.60-0.85 CORROBORATING).
  - [ ] Test the minimum sources guard (restoring stale sources if count drops below 2).

- [ ] **5. Implement Module 4: Contradiction Detector**
  - [ ] Implement `backend/src/agents/contradiction-detector.agent.ts`.
  - [ ] Build the `structuredRowToClaim` normalizer to map inputs to `{topic, entity, value, unit}`.
  - [ ] Implement explicit numeric contradiction checks (>20% difference threshold).
  - [ ] Test implicit contradiction detection (e.g., stock/demand mismatch).

- [ ] **6. Implement Module 7: Conflict Resolution**
  - [ ] Implement `backend/src/agents/conflict-resolution.agent.ts`.
  - [ ] Implement the 5 resolution strategies (trust_credible, trust_recent, aggregate, request_clarification, human_review).
  - [ ] Mutate `PipelineState.resolvedFacts` properly, ensuring cascading checks are run.

- [ ] **7. AMCE Validation & Trace Logging Integration**
  - [ ] Connect M1, M2, M3, M4, and M7 to Zod structural schemas in the AMCE definitions folder.
  - [ ] Verify that Antigravity Trace Logger Engine captures all 5 core reasoning keys (`workplan_formulation`, etc.) for every module execution in Phase 1.
