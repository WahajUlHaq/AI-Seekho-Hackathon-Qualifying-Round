# Phase 2: Content Ingestion & Analysis Implementation Plan

This plan details the implementation of Modules 1 through 7 of the Autonomous Content-to-Action Agent, focusing on ingesting multi-format data, assessing credibility, filtering noise, detecting contradictions, and extracting insights using the established `BaseAgent` and AMCE contract framework.

## User Review Required
> [!IMPORTANT]
> - Please review the planned test data formats for Module 1. Is there a specific domain (e.g., supply chain, healthcare, inventory) you'd prefer for the mock data files?
> - Does the simple in-memory vector store for Module 5 RAG meet your requirements, or do you expect a more robust local vector DB approach given the hackathon constraints?

## Open Questions
> [!WARNING]
> - Should the `real-time feed` for Module 1 ingestion be simulated as a mock WebSocket server, or just a periodic function that yields mock JSON events?
> - For Module 2 (Credibility Scorer), do we have predefined source domains that automatically receive high authority scores (e.g., specific verified URLs), or should the LLM evaluate the authority purely dynamically?

## Proposed Changes

### Multi-Source Content Ingestion (Module 1)
#### [NEW] [multi-source-ingestion.agent.ts](file:///d:/Google%20Ai%20Seekho%202026/Autonomous%20Content-to-Action%20Agent/backend/src/agents/multi-source-ingestion.agent.ts)
- Extends `BaseAgent` and orchestrates parallel ingestion of at least 5 sources.
- Utilizes `pdf-parse` for PDFs, `cheerio` for URLs, and `papaparse` for CSVs.
- Maps output to conform to the `multi_source_ingestion_v1` contract.
#### [NEW] [backend/test-data/](file:///d:/Google%20Ai%20Seekho%202026/Autonomous%20Content-to-Action%20Agent/backend/test-data/)
- Populate mock data: `sample-report.pdf`, `sample-data.csv`, `sample-email.txt`, `urls.json`, `realtime-feed.json`.

### Credibility Scorer (Module 2)
#### [NEW] [credibility-scorer.agent.ts](file:///d:/Google%20Ai%20Seekho%202026/Autonomous%20Content-to-Action%20Agent/backend/src/agents/credibility-scorer.agent.ts)
- Extends `BaseAgent`.
- Implements strict math for `calculateRecencyScore` and `calculateAuthorityScore`.
- Leverages an LLM prompt via `llmClient` for contextual `calculateQualityScore`.

### Noise Filter & Deduplication (Module 3)
#### [NEW] [noise-filter.agent.ts](file:///d:/Google%20Ai%20Seekho%202026/Autonomous%20Content-to-Action%20Agent/backend/src/agents/noise-filter.agent.ts)
- Extends `BaseAgent`.
- Generates text embeddings using `llmClient.generateEmbedding()`.
- Calculates cosine similarity to filter duplicates (>85% similarity threshold).
- Screens for spam and stale content.

### Contradiction Detector (Module 4)
#### [NEW] [contradiction-detector.agent.ts](file:///d:/Google%20Ai%20Seekho%202026/Autonomous%20Content-to-Action%20Agent/backend/src/agents/contradiction-detector.agent.ts)
- Extends `BaseAgent`.
- Extracts individual claims from normalized content using a structured LLM extraction prompt.
- Mathematically/logically finds discrepancies (e.g., >20% numeric diff across sources).
- Evaluated against the `contradiction_detection_v1` contract.

### Conflict Resolution (Module 7)
#### [NEW] [conflict-resolution.agent.ts](file:///d:/Google%20Ai%20Seekho%202026/Autonomous%20Content-to-Action%20Agent/backend/src/agents/conflict-resolution.agent.ts)
- Extends `BaseAgent`.
- Applies heuristics (recency, credibility) and LLM reasoning to resolve contradictions without forcing false conclusions, generating investigation paths when necessary.

### RAG-Powered Insight Extraction (Module 5)
#### [NEW] [insight-extraction.agent.ts](file:///d:/Google%20Ai%20Seekho%202026/Autonomous%20Content-to-Action%20Agent/backend/src/agents/insight-extraction.agent.ts)
- Extends `BaseAgent`.
- Includes an in-memory chunking mechanism (500 tokens, 100 overlap).
- Embeds chunks and executes top-K similarity retrieval.
- Synthesizes context to extract trends, risks, opportunities, and persistent conflicts.

### Temporal Analysis Engine (Module 6)
#### [NEW] [temporal-analysis.agent.ts](file:///d:/Google%20Ai%20Seekho%202026/Autonomous%20Content-to-Action%20Agent/backend/src/agents/temporal-analysis.agent.ts)
- Extends `BaseAgent`.
- Uses mathematical analysis (linear regression slope, standard deviation) to identify Spikes, Declines, Drifts, and Anomalies over time-series data points.

## Verification Plan
### Automated Tests
- Create and run `npx ts-node src/agents/test-contradiction-detector.ts` with mock contradicting data files to verify if numeric, boolean, and temporal contradictions are correctly flagged and given appropriate severity levels (CRITICAL vs MEDIUM).
- Test embedding cosine similarity algorithms in isolation to ensure accurate >85% match detection.

### Manual Verification
- Manually run a mock multi-source pipeline and inspect the `traceCollector` output from the `GET /api/pipeline/:id/trace` route.
- Confirm agent sequence logs, check for the presence of `llm_call` traces from all new agents, and verify that the `decisionGate` intercepts and validates `multi_source_ingestion_v1` and `contradiction_detection_v1` contracts.
