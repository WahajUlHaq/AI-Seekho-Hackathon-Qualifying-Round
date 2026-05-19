# Task List: Phase 2 - Intelligence & Decision Agents

- [ ] **1. Implement Ephemeral Vector Store (M5 Prep)**
  - [ ] Implement `backend/src/rag/vector-store.ts`.
  - [ ] Ensure the store is instantiated purely in-memory and handles batched embedding generation (rate-limit safe).
  - [ ] Test the instantiation and explicit destruction of the store per pipeline run.

- [ ] **2. Implement Module 5: RAG Insight Extraction**
  - [ ] Implement `backend/src/agents/insight-extraction.agent.ts`.
  - [ ] Configure the module to read strictly from `state.resolvedFacts` first.
  - [ ] Implement the Multi-Query retrieval logic utilizing the 5 domain-specific questions.
  - [ ] Implement insight deduplication logic (>0.80 embedding similarity).

- [ ] **3. Implement AMCE Base Model Validation for M5**
  - [ ] Implement `backend/src/contracts/base-model-benchmark.ts` logic for M5.
  - [ ] Ensure Gemini 1.5 Pro acts as the decision gate, forcing re-prompts on failure.

- [ ] **4. Implement Module 6: Temporal Analysis Engine**
  - [ ] Implement `backend/src/agents/temporal-analysis.agent.ts`.
  - [ ] Build pattern detection (decline, spike, drift, anomaly, stable).
  - [ ] Implement minimum sample guard returning `insufficient_data` for <3 data points.

- [ ] **5. Implement Module 8: Impact Analysis**
  - [ ] Implement `backend/src/agents/impact-analysis.agent.ts`.
  - [ ] Implement constraint tradeoff modeling to generate 2-3 feasible action paths per insight.
  - [ ] Quantify impact into explicitly structured metrics (cost_pkr, affected_customers).

- [ ] **6. Implement Module 9: Action Chain Generator**
  - [ ] Implement `backend/src/agents/action-chain-generator.agent.ts`.
  - [ ] Implement the Topological Sort validation step to detect circular dependencies and orphan references.
  - [ ] Implement logic to automatically re-prompt the LLM if the dependency graph validation fails.

- [ ] **7. Implement AMCE Base Model Validation for M9**
  - [ ] Implement Base Model validation for the action chain in the AMCE layer.
  - [ ] Verify that Antigravity accurately logs `BLOCK` events and recovery attempts inside the Trace Logger Engine during validation testing.
