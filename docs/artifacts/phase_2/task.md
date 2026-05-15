# Phase 2: Content Ingestion & Analysis Task List

- [ ] **Step 2.1: Implement Multi-Source Ingestion (Module 1)**
  - [ ] Create `backend/src/agents/multi-source-ingestion.agent.ts` extending `BaseAgent`.
  - [ ] Implement parallel ingestion logic for 5+ sources using `pdf-parse`, `cheerio`, `papaparse`, etc.
  - [ ] Create mock test data files in `backend/test-data/` (`sample-report.pdf`, `sample-data.csv`, `sample-email.txt`, `urls.json`, `realtime-feed.json`).
  - [ ] Verify validation against `multi_source_ingestion_v1` contract.
  
- [ ] **Step 2.2: Implement Credibility Scorer (Module 2)**
  - [ ] Create `backend/src/agents/credibility-scorer.agent.ts` extending `BaseAgent`.
  - [ ] Implement mathematical Recency scoring (0-40 points).
  - [ ] Implement Authority scoring (0-30 points) based on source types.
  - [ ] Implement LLM-powered Quality scoring (0-30 points) via `llmClient`.
  
- [ ] **Step 2.3: Implement Noise Filter (Module 3)**
  - [ ] Create `backend/src/agents/noise-filter.agent.ts` extending `BaseAgent`.
  - [ ] Filter stale sources (`recency_score === 0`).
  - [ ] Implement deduplication utilizing `llmClient.generateEmbedding()` and cosine similarity (`>85%` threshold).
  - [ ] Implement LLM-powered spam detection logic.
  
- [ ] **Step 2.4: Implement Contradiction Detector (Module 4)**
  - [ ] Create `backend/src/agents/contradiction-detector.agent.ts` extending `BaseAgent`.
  - [ ] Implement LLM-based claim extraction using the Master Prompt schema.
  - [ ] Group extracted claims by topic.
  - [ ] Implement discrepancy checks for Numeric, Boolean, Categorical, and Temporal types.
  - [ ] Validate output against `contradiction_detection_v1` contract.
  
- [ ] **Step 2.5: Implement Conflict Resolution (Module 7)**
  - [ ] Create `backend/src/agents/conflict-resolution.agent.ts` extending `BaseAgent`.
  - [ ] Implement deterministic logic: trust most credible (if >30 diff) or most recent (if >24h diff).
  - [ ] Implement aggregation for minor numeric discrepancies.
  - [ ] Configure investigation path generation for severe unresolved conflicts.
  
- [ ] **Step 2.6: Implement Insight Extraction (Module 5)**
  - [ ] Create `backend/src/agents/insight-extraction.agent.ts` extending `BaseAgent`.
  - [ ] Implement simple in-memory chunking (500 tokens, 100 overlap).
  - [ ] Use `llmClient.generateEmbedding()` to build an in-memory vector store.
  - [ ] Execute top-5 similarity retrieval and LLM synthesis using the master prompt.
  - [ ] Format extracted insights into Trends, Risks, Opportunities, and Contradictions.
  
- [ ] **Step 2.7: Implement Temporal Analysis (Module 6)**
  - [ ] Create `backend/src/agents/temporal-analysis.agent.ts` extending `BaseAgent`.
  - [ ] Add linear regression and standard deviation functions.
  - [ ] Classify patterns as Decline, Spike, Drift, Anomaly, or Stable based on trend slopes and variance.
