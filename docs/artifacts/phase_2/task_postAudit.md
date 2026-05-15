# Phase 2: Content Ingestion & Analysis Task List

- [x] **Step 2.0: Shared Infrastructure**
  - [x] Create `vector-store.interface.ts`, `feed-adapter.interface.ts`, `source-document.interface.ts`.
  - [x] Create `in-memory-vector.store.ts` and `mock-realtime-feed.adapter.ts`.
  - [x] Create `authorityDomains.config.json` and `agentThresholds.config.json`.
  - [x] Run verification: Unit tests for shared utilities `test-cosine-similarity.ts`.

- [ ] **Step 2.1: Implement Multi-Source Ingestion (Module 1)**
  - [x] Create `backend/src/agents/multi-source-ingestion.agent.ts` extending `BaseAgent`.
  - [x] Implement parallel ingestion logic for 5+ sources using `pdf-parse`, `cheerio`, `papaparse`, etc.
  - [x] Create mock test data files in `backend/test-data/` (`sample-report.pdf`, `sample-data.csv`, `sample-email.txt`, `urls.json`, `realtime-feed.json`).
  - [x] `FeedAdapter` injected properly.
  - [ ] Validate against `multi_source_ingestion_v1` contract. ← ⚠️ PARTIAL: BaseAgent constructor needs `_v1` suffix
  - [ ] Rejected sources logged to `traceCollector` as `ingestion_error`. ← ⚠️ PARTIAL: Change event string `failure` to `ingestion_error`
  - [ ] Fix Dependency Injection violation ← ⚠️ PARTIAL: `MockRealtimeFeedAdapter` instantiated inside method

- [ ] **Step 2.2: Implement Credibility Scorer (Module 2)**
  - [x] Create `backend/src/agents/credibility-scorer.agent.ts` extending `BaseAgent`.
  - [ ] Implement mathematical Recency scoring (0-40 points). ← ⚠️ PARTIAL: Implement strict time buckets instead of continuous slope
  - [x] Implement Authority scoring (0-30 points) based on source types with LLM caching.
  - [x] Implement LLM-powered Quality scoring (0-30 points) via `llmClient`.
  - [ ] Validate output against `credibility_scorer_v1` contract. ← ⚠️ PARTIAL: BaseAgent constructor needs `_v1` suffix

- [ ] **Step 2.3: Implement Noise Filter (Module 3)**
  - [x] Create `backend/src/agents/noise-filter.agent.ts` extending `BaseAgent`.
  - [x] Filter stale sources (`recency_score === 0`).
  - [x] Implement deduplication utilizing `llmClient.generateEmbedding()` and cosine similarity (`>85%` threshold) preserving highest-credibility document.
  - [x] Implement LLM-powered batched spam detection logic.
  - [ ] Validate output against `noise_filter_v1` contract. ← ⚠️ PARTIAL: BaseAgent constructor needs `_v1` suffix

- [ ] **Step 2.4: Implement Contradiction Detector (Module 4)**
  - [x] Create `backend/src/agents/contradiction-detector.agent.ts` extending `BaseAgent`.
  - [x] Implement LLM-based claim extraction grouping by topic.
  - [x] Implement severity discrepancy checks for Numeric, Boolean, Categorical, and Temporal types.
  - [ ] Validate output against `contradiction_detection_v1` contract. ← ⚠️ PARTIAL: BaseAgent constructor needs `_v1` suffix

- [ ] **Step 2.5: Implement Conflict Resolution (Module 7)**
  - [x] Create `backend/src/agents/conflict-resolution.agent.ts` extending `BaseAgent`.
  - [x] Implement deterministic rules (credibility diff >30, temporal diff >24h, weighted averages).
  - [x] Configure LLM investigation path generation for unresolved CRITICAL conflicts.
  - [ ] Set `resolutionMethod` field on resolved output. ← ⚠️ PARTIAL: Interface currently maps it as `strategy`
  - [ ] Read all thresholds from config.

- [ ] **Step 2.6: Implement Insight Extraction (Module 5)**
  - [x] Create `backend/src/agents/insight-extraction.agent.ts` extending `BaseAgent`.
  - [x] Implement in-memory chunking (500 tokens, 100 overlap) and top-5 retrieval via injected `VectorStore`.
  - [ ] Fail-safe Promise handling. ← ⚠️ PARTIAL: Replace `Promise.all` with `Promise.allSettled` for embeddings
  - [ ] LLM synthesis returns JSON `{ trends, risks, opportunities, persistentConflicts }`. ← ⚠️ PARTIAL: Fix schema property `persistent_conflicts` to `persistentConflicts`
  - [ ] Validate output against `insight_extraction_v1` contract. ← ⚠️ PARTIAL: BaseAgent constructor needs `_v1` suffix

- [x] **Step 2.7: Implement Temporal Analysis (Module 6)**
  - [x] Create `backend/src/agents/temporal-analysis.agent.ts` extending `BaseAgent`.
  - [x] Implement pure math functions (`linearRegressionSlope`, `standardDeviation`, `mean`).
  - [x] Classify patterns as Decline, Spike, Drift, Anomaly, or Stable based on config thresholds.

- [ ] **Step 2.8: Verification & Integration**
  - [ ] Create `pipeline-runner.ts` to trigger Mock multi-source pipeline end-to-end. ← ❌ MISSING
  - [ ] Verify `decisionGate` actively intercepts and processes `_v1` schema rules.
  - [ ] Verify `GET /api/pipeline/:id/trace` returns full pipeline event stream including LLM calls and decisions.
  - [ ] Run verification: `npx ts-node src/pipeline-runner.ts` and inspect outputs.
