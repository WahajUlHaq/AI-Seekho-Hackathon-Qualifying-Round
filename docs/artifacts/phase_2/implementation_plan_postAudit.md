# Phase 2: Content Ingestion & Analysis Implementation Plan

This plan details the implementation of Modules 1 through 7 of the Autonomous Content-to-Action Agent, focusing on ingesting multi-format data, assessing credibility, filtering noise, detecting contradictions, and extracting insights using the established `BaseAgent` and AMCE contract framework.

## Proposed Changes

### Shared Infrastructure (Step 2.0) ✅ Complete
#### [NEW] [vector-store.interface.ts](file:///backend/src/interfaces/vector-store.interface.ts)
#### [NEW] [feed-adapter.interface.ts](file:///backend/src/interfaces/feed-adapter.interface.ts)
#### [NEW] [source-document.interface.ts](file:///backend/src/interfaces/source-document.interface.ts)
#### [NEW] [in-memory-vector.store.ts](file:///backend/src/stores/in-memory-vector.store.ts)
#### [NEW] [mock-realtime-feed.adapter.ts](file:///backend/src/adapters/mock-realtime-feed.adapter.ts)
#### [NEW] [authorityDomains.config.json](file:///backend/config/authorityDomains.config.json)
#### [NEW] [agentThresholds.config.json](file:///backend/config/agentThresholds.config.json)

---

### Multi-Source Content Ingestion (Module 1) ⚠️ Partial
#### [NEW] [multi-source-ingestion.agent.ts](file:///backend/src/agents/multi-source-ingestion.agent.ts)
- Extends `BaseAgent` and orchestrates parallel ingestion of at least 5 sources.
- Utilizes `pdf-parse` for PDFs, `cheerio` for URLs, and `papaparse` for CSVs.
- Maps output to conform to the `multi_source_ingestion_v1` contract.
#### [NEW] [backend/test-data/](file:///backend/test-data/)
- Populate mock data: `sample-report.pdf`, `sample-data.csv`, `sample-email.txt`, `urls.json`, `realtime-feed.json`.

---

### Credibility Scorer (Module 2) ⚠️ Partial
#### [NEW] [credibility-scorer.agent.ts](file:///backend/src/agents/credibility-scorer.agent.ts)
- Extends `BaseAgent`.
- Implements strict math for `calculateRecencyScore` and `calculateAuthorityScore`.
- Leverages an LLM prompt via `llmClient` for contextual `calculateQualityScore`.

---

### Noise Filter & Deduplication (Module 3) ⚠️ Partial
#### [NEW] [noise-filter.agent.ts](file:///backend/src/agents/noise-filter.agent.ts)
- Extends `BaseAgent`.
- Generates text embeddings using `llmClient.generateEmbedding()`.
- Calculates cosine similarity to filter duplicates (>85% similarity threshold).
- Screens for spam and stale content.

---

### Contradiction Detector (Module 4) ⚠️ Partial
#### [NEW] [contradiction-detector.agent.ts](file:///backend/src/agents/contradiction-detector.agent.ts)
- Extends `BaseAgent`.
- Extracts individual claims from normalized content using a structured LLM extraction prompt.
- Mathematically/logically finds discrepancies (e.g., >20% numeric diff across sources).
- Evaluated against the `contradiction_detection_v1` contract.

---

### Conflict Resolution (Module 7) ⚠️ Partial
#### [NEW] [conflict-resolution.agent.ts](file:///backend/src/agents/conflict-resolution.agent.ts)
- Extends `BaseAgent`.
- Applies heuristics (recency, credibility) and LLM reasoning to resolve contradictions without forcing false conclusions, generating investigation paths when necessary.

---

### RAG-Powered Insight Extraction (Module 5) ⚠️ Partial
#### [NEW] [insight-extraction.agent.ts](file:///backend/src/agents/insight-extraction.agent.ts)
- Extends `BaseAgent`.
- Includes an in-memory chunking mechanism (500 tokens, 100 overlap).
- Embeds chunks and executes top-K similarity retrieval.
- Synthesizes context to extract trends, risks, opportunities, and persistent conflicts.

---

### Temporal Analysis Engine (Module 6) ✅ Complete
#### [NEW] [temporal-analysis.agent.ts](file:///backend/src/agents/temporal-analysis.agent.ts)
- Extends `BaseAgent`.
- Uses mathematical analysis (linear regression slope, standard deviation) to identify Spikes, Declines, Drifts, and Anomalies over time-series data points.

---

## Verification Plan
### Automated Tests
- `npx ts-node src/agents/test-contradiction-detector.ts` (Status: PASS) - Verifies numeric, boolean, and temporal contradictions.
- `npx ts-node src/stores/test-cosine-similarity.ts` (Status: PASS) - Tests embedding cosine similarity algorithm.

### Manual Verification
- Fix the AMCE contract strings to trigger `decisionGate` for `_v1` schemas.
- Implement an end-to-end `pipeline-runner.ts` to trigger the mock multi-source pipeline and inspect the `traceCollector` output from the `GET /api/pipeline/:id/trace` route.
- Confirm agent sequence logs, check for the presence of `llm_call` traces from all new agents.
