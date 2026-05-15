# Task List — Content-to-Action Agent

**Challenge 1 · AI Seekho 2026 Hackathon**
**Last updated:** May 15, 2026

---

## Phase 0: Environment Setup ✅

- [x] Obtain Gemini API key (free tier)
- [x] Obtain Groq API key (free tier)
- [x] Create `.env.development` with free API keys
- [x] Create `.env.production` template (Vertex keys added Day 6)
- [x] Add both `.env` files to `.gitignore`
- [x] Initialize Node.js + TypeScript project
- [x] Install core dependencies (express, cors, dotenv, multer, uuid, zod, yaml)
- [x] Install AI SDKs (@google/generative-ai, groq-sdk)
- [x] Install content processing libs (pdf-parse, cheerio, axios, papaparse, csv-parser)
- [x] Configure `tsconfig.json`
- [x] Build `LLMClient` with environment switching + Vertex rotation
- [x] Test LLM client in development mode

---

## Phase 1: Core Infrastructure ✅

- [x] Build `BaseAgent` abstract class with trace + contract integration
- [x] Create `ContractRegistry` — YAML contract loader
- [x] Create `ContractValidator` — structural + semantic validation
- [x] Create 3 initial contract YAML definitions:
  - [x] `multi_source_ingestion_v1.yaml`
  - [x] `contradiction_detection_v1.yaml`
  - [x] `action_chain_v1.yaml`
- [x] Create `TraceCollector` for aggregating agent trace events
- [x] Create Express server (`index.ts`) with health check, CORS, logging
- [x] Create pipeline route stub (`pipeline.routes.ts`)

---

## Phase 2: Content Ingestion & Analysis (Modules 1–7) 🔴

### Utilities
- [ ] Create `backend/src/utils/cosine-similarity.ts` — vector similarity math
- [ ] Create `backend/src/utils/embedding.ts` — batch embedding wrapper

### Module 1: Multi-Source Content Ingestion
- [ ] Implement `backend/src/agents/multi-source-ingestion.agent.ts`
  - [ ] Extends `BaseAgent`
  - [ ] PDF parser (pdf-parse)
  - [ ] URL parser (cheerio / article-extractor)
  - [ ] CSV parser (papaparse)
  - [ ] JSON parser (native)
  - [ ] Real-time feed parser (EventEmitter mock)
  - [ ] Parallel ingestion via `Promise.all`
  - [ ] Output: `NormalizedSource[]` matching contract schema
  - [ ] Validate against `multi_source_ingestion_v1` contract

### Module 2: Source Credibility Scorer
- [ ] Implement `backend/src/agents/credibility-scorer.agent.ts`
  - [ ] Recency scoring (0–40 pts): hour/day/week/month/older
  - [ ] Authority scoring (0–30 pts): government → anonymous
  - [ ] Quality scoring (0–30 pts): citations, numerical data, structure (LLM-powered)
  - [ ] Tier classification: HIGH ≥70 / MEDIUM ≥40 / LOW ≥20 / UNVERIFIED <20
  - [ ] Output: `CredibilityScore[]`

### Module 3: Noise Filter & Deduplication
- [ ] Implement `backend/src/agents/noise-filter.agent.ts`
  - [ ] Staleness filter (recency_score === 0 → remove)
  - [ ] Deduplication via embedding cosine similarity (>85% = duplicate)
  - [ ] Keep highest credibility among duplicates
  - [ ] Spam detection (special chars, promotional language)
  - [ ] Output: `FilteredSources { kept_sources, removed_sources }`

### Module 4: Contradiction Detector ⭐ HIGH PRIORITY
- [ ] Implement `backend/src/agents/contradiction-detector.agent.ts`
  - [ ] LLM-powered factual claim extraction per source
  - [ ] Topic grouping of claims
  - [ ] Pairwise conflict detection:
    - [ ] Numeric (>20% difference)
    - [ ] Boolean (opposite values)
    - [ ] Categorical (different categories)
    - [ ] Temporal (different timeframes)
  - [ ] Severity scoring: CRITICAL / HIGH / MEDIUM / LOW
  - [ ] Validate against `contradiction_detection_v1` contract
  - [ ] Test with 3 conflicting sources

### Module 5: RAG-Powered Insight Extraction
- [ ] Implement `backend/src/agents/insight-extraction.agent.ts`
  - [ ] In-memory vector store (embedding array + cosine similarity)
  - [ ] Content chunking: 500 tokens, 100 token overlap
  - [ ] Embedding generation via `llmClient.generateEmbedding()`
  - [ ] Top-5 chunk retrieval via cosine similarity
  - [ ] LLM insight generation: 3–7 insights
  - [ ] Categories: trends, risks, opportunities, contradictions
  - [ ] Flag `REQUIRES_RESOLUTION` for contradictory insights
  - [ ] Output matches master prompt JSON format

### Module 6: Temporal Analysis Engine
- [ ] Implement `backend/src/agents/temporal-analysis.agent.ts`
  - [ ] Linear regression on time-series data points
  - [ ] Pattern detection: decline, spike (>2σ), drift, anomaly, stable
  - [ ] R² confidence scoring
  - [ ] LLM natural language explanation of detected patterns

### Module 7: Conflict Resolution Logic
- [ ] Implement `backend/src/agents/conflict-resolution.agent.ts`
  - [ ] Strategy: trust_credible (Δ>30 pts)
  - [ ] Strategy: trust_recent (Δ>24h)
  - [ ] Strategy: request_clarification (equal credibility & recency)
  - [ ] Strategy: aggregate (slight numeric differences)
  - [ ] Strategy: human_review (severe conflicts, equal credibility)
  - [ ] Generate investigation_actions array
  - [ ] Never force false conclusions

### Additional Contracts for Phase 2
- [ ] Create `credibility_scoring_v1.yaml`
- [ ] Create `noise_filter_v1.yaml`
- [ ] Create `insight_extraction_v1.yaml`
- [ ] Create `temporal_analysis_v1.yaml`
- [ ] Create `conflict_resolution_v1.yaml`

### Test Data
- [ ] Create `backend/test-data/sample-report.txt` (warehouse inventory — simulated PDF)
- [ ] Create `backend/test-data/sample-data.csv` (sales dashboard)
- [ ] Create `backend/test-data/sample-email.txt` (supplier notification)
- [ ] Create `backend/test-data/urls.json` (news article URLs)
- [ ] Create `backend/test-data/realtime-feed.json` (customer complaints)
- [ ] Create `backend/test-data/inventory-shortage-scenario.json` (full pipeline test request)

### Phase 2 Verification
- [ ] 5+ sources ingested in parallel successfully
- [ ] Credibility scores calculated correctly (test known inputs)
- [ ] Duplicates removed based on embedding similarity
- [ ] Contradictions detected across sources (test: 500 vs 50 units)
- [ ] Conflict resolution strategies applied correctly
- [ ] Insights extracted with RAG (3–7 per scenario)
- [ ] Temporal patterns detected (test: spike in complaints)
- [ ] All module outputs validated against their contracts
- [ ] No agent imports AI SDKs directly (all via `llmClient`)

---

## Phase 3: Action Chain & Simulation (Modules 8–13)

### Module 8: Impact Analysis with Constraints
- [ ] Implement `backend/src/agents/impact-analysis.agent.ts`
  - [ ] Budget constraint analysis
  - [ ] Time constraint analysis
  - [ ] Resource constraint analysis
  - [ ] Urgency level handling
  - [ ] Output: quantified_impact, constraints_violated, cascading_effects, risk_if_ignored

### Module 9: Action Chain Generator ⭐ HIGH PRIORITY
- [ ] Implement `backend/src/agents/action-chain-generator.agent.ts`
  - [ ] Generate 3–5 interconnected actions (not 1, not 10)
  - [ ] Action types: diagnose, notify, update_system, mitigate, monitor, verify, escalate
  - [ ] Dependency graph: `depends_on[]`, `blocks[]`
  - [ ] Per-action constraints: max_cost, max_duration, required_resources, api_rate_limit
  - [ ] Simulation config: simulation_type, parameters, expected_success_rate
  - [ ] Failure recovery config: retry_count, fallback_action_id, rollback_required
  - [ ] Determine `execution_order` from dependency graph
  - [ ] Validate against `action_chain_v1` contract

### Module 10: Constraint Validator
- [ ] Implement `backend/src/simulation/constraint-validator.ts`
  - [ ] Budget check: max_cost > budget_limit → BLOCKING
  - [ ] Time check: max_duration > time_limit → BLOCKING
  - [ ] Resource check: api_rate_limit > resource_limit → WARNING
  - [ ] Output: `ConstraintValidationResult[]` with recommended_modification
  - [ ] Mark infeasible actions

### Module 11: Action Chain Execution Simulator
- [ ] Implement `backend/src/simulation/chain-simulator.ts`
  - [ ] Execute actions sequentially per `execution_order`
  - [ ] Dependency checking before each action
  - [ ] State tracking: `SimulationState { state_id, timestamp, variables }`
  - [ ] Before/after state snapshots per action
  - [ ] Failure injection: `Math.random() > expected_success_rate`
  - [ ] Support `simulateFailures=true/false` toggle
  - [ ] Simulation types: database_query, send_notification, place_order, update_dashboard, schedule_monitoring

### Module 12: Failure Recovery & Rollback Engine ⭐ HIGH PRIORITY
- [ ] Implement `backend/src/simulation/failure-recovery.ts`
  - [ ] Strategy: retry (if retry_count > 0)
  - [ ] Strategy: fallback (if fallback_action_id exists)
  - [ ] Strategy: rollback (if rollback_required, restore previous state)
  - [ ] Strategy: skip_and_continue (last resort)
  - [ ] Full recovery logging in `recovery_execution_log[]`

### Module 13: Outcome Visualization
- [ ] Implement `backend/src/simulation/outcome-visualizer.ts`
  - [ ] State diff computation: added/removed/modified/unchanged
  - [ ] Action execution timeline (status, cost, duration per action)
  - [ ] Aggregate metrics: total_cost, total_duration, success_rate, failures_recovered
  - [ ] Projected impact: risk_reduction, estimated_value, affected_entities

### Additional Contracts for Phase 3
- [ ] Create `impact_analysis_v1.yaml`
- [ ] Create `constraint_validation_v1.yaml`
- [ ] Create `outcome_visualization_v1.yaml`

### Phase 3 Verification
- [ ] Impact analysis calculates constraints correctly
- [ ] Action chain generates exactly 3–5 actions
- [ ] Dependency graph is valid (no circular deps)
- [ ] Constraint validator rejects infeasible actions (test: PKR 600K vs 500K limit)
- [ ] Simulator executes actions with state tracking
- [ ] Failure injection works (random failures based on success rate)
- [ ] Recovery engine retries / falls back / rolls back correctly
- [ ] Outcome visualizer produces complete before/after diff

---

## Phase 4: Pipeline Orchestrator & API

### Orchestrator
- [ ] Implement `backend/src/agents/orchestrator.ts`
  - [ ] Sequential execution: M1 → contract gate → M2 → ... → M14
  - [ ] Contract gate at every module transition
  - [ ] Handle REJECT: re-generate or use fallback
  - [ ] Handle WARN: log and proceed
  - [ ] Trace every decision to `TraceCollector`
  - [ ] Return complete `PipelineResult`

### Module 14: Trace Exporter (Audit Log)
- [ ] Implement `backend/src/tracing/exporter.ts`
  - [ ] Export format: pipeline_id, environment, ai_provider_used
  - [ ] Workplan generation
  - [ ] Task plan array
  - [ ] Reasoning steps with agent, decision, confidence
  - [ ] Tool calls with provider info
  - [ ] Action execution logs
  - [ ] Recovery steps

### API Routes
- [ ] Full implementation of `POST /api/pipeline/run` with Zod validation
- [ ] Implement `GET /api/pipeline/:id` — retrieve results
- [ ] Implement `GET /api/pipeline/:id/trace` — retrieve trace
- [ ] Implement `GET /api/contracts` — list contracts
- [ ] Create `backend/src/routes/contracts.routes.ts`

### Phase 4 Verification
- [ ] Full pipeline runs end-to-end in development mode
- [ ] Contract gates validate every module output
- [ ] Trace includes all expected fields
- [ ] API endpoint accepts 5+ sources and returns complete result
- [ ] Test with inventory shortage scenario JSON

---

## Phase 5: Frontend & Mobile

### React Web Dashboard
- [ ] Initialize frontend with Vite + React + TypeScript
- [ ] Install dependencies (axios, recharts, react-router-dom)
- [ ] Implement `InputPanel` component (5 upload fields + constraints + run button)
- [ ] Implement `PipelineProgress` component (real-time module status)
- [ ] Implement `ContradictionViewer` component (side-by-side conflicts)
- [ ] Implement `ActionChainViewer` component (dependency graph visualization)
- [ ] Implement `SimulationResults` component (before/after + timeline + metrics)
- [ ] Implement `TraceViewer` component (expandable tree with provider info)
- [ ] Style with premium design (dark mode, gradients, animations)
- [ ] Deploy to Firebase Hosting (Person C, free tier)

### React Native Mobile App
- [ ] Initialize React Native project with TypeScript template
- [ ] Implement `HomeScreen` (input form + recent runs)
- [ ] Implement `ResultsScreen` (scrollable cards: insights, contradictions, actions, simulation)
- [ ] Implement `TraceScreen` (simplified trace view)
- [ ] Point API calls to Cloud Run backend URL
- [ ] Test on Android emulator

---

## Phase 6: Production Switch & Stress Tests

### Deployment
- [ ] Deploy backend to Cloud Run (Person A's GCP credits)
- [ ] Configure Vertex AI keys from Person B & C
- [ ] Test production switch: `APP_ENV=production`
- [ ] Verify trace shows `"ai_provider_used": "vertex-ai"`
- [ ] Update frontend CORS for Firebase URL
- [ ] Update mobile app with Cloud Run backend URL

### Stress Tests
- [ ] Implement `backend/test/stress-tests.ts`
  - [ ] Test 1: Conflicting values across 3 sources (500, 50, 150)
  - [ ] Test 2: Constraint violation (PKR 600K vs 500K budget)
  - [ ] Test 3: Action failure & retry (ACT-003 fails, retries succeed)
  - [ ] Test 4: Low-credibility false signal (credibility 15 vs 80+)
  - [ ] Test 5: Cascading side effect (budget reduction affects subsequent actions)
- [ ] All 5 stress tests PASS in development mode

### Demo Data
- [ ] Create `backend/demo-data/warehouse-report.pdf` (or .txt)
- [ ] Create `backend/demo-data/sales-dashboard.csv`
- [ ] Create `backend/demo-data/supplier-email.txt`
- [ ] Create `backend/demo-data/news-url.txt`
- [ ] Create `backend/demo-data/customer-complaints.json`
- [ ] Create `backend/demo-data/inventory-shortage-request.json`

---

## Phase 7: Documentation & Demo Video

### README
- [ ] Create `README.md` in project root
  - [ ] Architecture overview with 14-module diagram
  - [ ] Data sources (5 input types)
  - [ ] Tools & APIs (Gemini, Groq, Vertex AI, embeddings)
  - [ ] Environment strategy (dev vs production)
  - [ ] Google Antigravity role
  - [ ] Assumptions & constraints
  - [ ] Cost & latency analysis
  - [ ] Baseline comparison (with vs without contradiction detection)
  - [ ] Limitations & future improvements
  - [ ] How to run instructions

### Demo Video (3–5 minutes)
- [ ] Record in production mode (Vertex AI)
- [ ] Segment 1: Introduction (30s)
- [ ] Segment 2: Input — 5 sources + constraints (30s)
- [ ] Segment 3: Contradiction detection + credibility + resolution (45s)
- [ ] Segment 4: Action chain + dependency graph + constraint validation (60s)
- [ ] Segment 5: Failure & recovery (45s)
- [ ] Segment 6: Outcome — before/after + metrics (30s)
- [ ] Segment 7: Antigravity trace with provider info (30s)

---

## Final Submission Checklist

- [ ] Working prototype: backend + frontend + mobile ✓
- [ ] Mobile app runs on Android/iOS ✓
- [ ] Web dashboard shows all visualizations ✓
- [ ] Demo video (3–5 min) shows complete flow ✓
- [ ] Antigravity trace: workplan, task plan, reasoning, tools, recovery ✓
- [ ] README: architecture, sources, tools, strategy, cost, baseline, limitations ✓
- [ ] All evaluation criteria addressed:
  - [ ] Antigravity integration (20%) ✓
  - [ ] Agentic reasoning (20%) ✓
  - [ ] Contradiction handling (20%) ✓
  - [ ] Action chain simulation (15%) ✓
  - [ ] Robustness (15%) ✓
  - [ ] Innovation & UX (10%) ✓
