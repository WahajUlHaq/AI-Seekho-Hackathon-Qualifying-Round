# Task List — Phase 3: Impact Analysis & Strategic Forecasting

- [ ] **Step 3.1: Define Contracts**
  - [ ] Create `backend/src/contracts/definitions/impact_analysis_v1.yaml` for Module 8.
  - [ ] Create `backend/src/contracts/definitions/strategic_recommendation_v1.yaml` for Modules 9/10.
  - [ ] Register both contracts in `backend/src/contracts/registry.ts`.

- [ ] **Step 3.2: Implement ImpactScorerAgent (Module 8)**
  - [ ] Create `backend/src/agents/impact-scorer.agent.ts` extending `BaseAgent`.
  - [ ] Implement weighting logic: Financial (40%), Operational (35%), Reputational (25%).
  - [ ] Inject `llmClient` to parse insights into the 0-100 Impact Magnitude Score.
  - [ ] Wire up `decisionGate` via `BaseAgent` to validate output.

- [ ] **Step 3.3: Implement PredictiveForecaster (Module 9)**
  - [ ] Create `backend/src/agents/predictive-forecaster.agent.ts` extending `BaseAgent`.
  - [ ] Ingest `linearRegressionSlope` and temporal data from Phase 2.
  - [ ] Use `llmClient` to project 30, 60, and 90-day scenarios.
  - [ ] Ensure `traceCollector` logs the generation of these specific scenarios.

- [ ] **Step 3.4: Implement Strategic Recommender (Module 10)**
  - [ ] Create `backend/src/agents/strategic-recommender.agent.ts` extending `BaseAgent`.
  - [ ] Consume the Impact Score (M8) and Scenarios (M9).
  - [ ] Generate a final `StrategyProposal` containing prioritized action items.

- [ ] **Step 3.5: Verification & Integration**
  - [ ] Verify `decisionGate` successfully intercepts and validates outputs from all three new agents.
  - [ ] Verify `traceCollector` logs `agent_start`, `llm_call`, and `agent_complete` for each module.
  - [ ] Integrate Modules 8, 9, and 10 into the main pipeline execution chain.
