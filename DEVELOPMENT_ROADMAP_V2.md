# DEVELOPMENT ROADMAP V2 — Supply Chain Intelligence Agent
## Challenge 1: Using MASTER_PROMPT_V2.md with Antigravity + Claude Code

**Deadline: May 20, 2026**
**Development Time: May 14–20 (Phase 0 completed May 13)**

---

## OVERVIEW

**You have TWO documents:**
1. **MASTER_PROMPT_V2.md** — Complete technical specification (WHAT to build)
2. **THIS FILE** — Step-by-step development guide (HOW and WHEN to build it)

**Your Setup:**
- **Google Antigravity IDE** — Your development environment (all coding happens INSIDE it)
- **Claude Code** — AI assistant in Antigravity terminal
- **Screen Recording** — Running from Day 1 (for required Antigravity usage video)
- **Free AI APIs** — Gemini + Groq during development ($0 spent Days 1-5)
- **Vertex AI** — Demo day only via GCP credits (Days 6-7)

---

## GCP CREDITS STRATEGY

| Person | Role | Service | Budget |
|--------|------|---------|--------|
| Person A | Infrastructure | Cloud Run (backend) | $5 |
| Person B | AI Primary | Vertex AI Gemini | $5 |
| Person C | AI Backup + Files | Vertex AI fallback + Cloud Storage | $5 |

```
Days 1–5 (May 14–18)  →  FREE TIER ONLY (Gemini API + Groq)     $0 spent
Day 6    (May 19)      →  Cloud Run deploy + Vertex AI switch     ~$3-5 spent
Day 7    (May 20)      →  Demo recording + final submission       ~$1-2 spent
```

> ⚠️ Set $4 budget alert in GCP Console → Billing → Budgets for each account immediately.

---

## ✅ PHASE 0: Environment Setup (COMPLETED — May 13)

**What was built:**
- [x] Gemini API key obtained and tested
- [x] Groq API key obtained and tested
- [x] Project structure created inside Antigravity IDE
- [x] TypeScript + Express.js initialized
- [x] Dependencies installed (pdf-parse, cheerio, papaparse, zod, winston, etc.)
- [x] `utils/llm-output-parser.ts` — Universal JSON parser (strips markdown fences, fixes trailing commas)
- [x] `utils/llm-client.ts` — Multi-provider LLM client (gemini/groq/vertex with auto-fallback + cost tracking)
- [x] `utils/tabular-serializer.ts` — Row-level serialization for CSV/JSON (prevents RAG hallucination)
- [x] `utils/logger.ts` — Winston structured logging
- [x] `utils/cosine-similarity.ts` — Vector math for embeddings
- [x] `simulation/saga-constraint-ledger.ts` — Reserve/commit/refund pattern
- [x] `agents/pipeline-state.ts` — Shared state interface
- [x] Express server with `/api/health` endpoint + correlation ID middleware
- [x] Screen recording started in Antigravity

**Verification done:**
```bash
APP_ENV=development npx ts-node src/index.ts
# ✓ Server running on http://localhost:8000
curl http://localhost:8000/api/health
# ✓ {"status":"healthy","services":{"gemini":"up","groq":"up"}}
```

---

## PHASE 1: Core Agents — Phase A + B (Day 1: May 14)
**Duration: 10 hours**
**Modules: M1, M2, M3, M4, M7**
**Evaluation Criteria: Contradiction Handling (20%), Agentic Reasoning (20%)**

### Step 1.1: Create Realistic Mock Data (1 hour)

**Ask Claude Code:**
```
Create demo data files in backend/demo-data/ for the inventory shortage scenario.
Reference: MASTER_PROMPT_V2.md, "DOMAIN SCENARIO" section.

Create these 5 files:

1. warehouse-audit-report.pdf (generate a text file, we'll convert to PDF later)
   - Company: PakDistrib Ltd, Lahore Hub
   - Date: 7 days ago
   - 15 SKU rows including SKU-1234: 500 units, value PKR 2.5M
   - Footnote: "Counts verified by manual count on audit date"

2. supplier-dashboard.csv
   - 30 rows of daily data, columns: Date,Supplier_ID,SKU,Status,Lead_Time_Days,Reliability_Score,Unit_Cost_PKR
   - Last 3 rows show Supplier S-002 status changed to "Delayed", reliability dropped 0.92→0.61

3. procurement-budget.json
   - emergency_procurement.cap_pkr: 500000
   - requires_approval_above_pkr: 300000
   - approval_sla_hours: 4

4. news-article.txt
   - "Customs Strike Enters Day 3 at Karachi Port"
   - 500 words, mentions transport delays, 72+ hours expected

5. customer-complaints.json
   - 9 entries over last 4 hours
   - 5 about SKU-1234 unavailability (2 in Roman Urdu)
   - 1 spam ("Win iPhone"), 1 duplicate
   - 1 says "customer support bola stock hai" (internal contradiction)
```

### Step 1.2: Implement Module 1 — Multi-Source Ingestion (2.5 hours)

**Ask Claude Code:**
```
Implement backend/src/agents/multi-source-ingestion.agent.ts

Reference: MASTER_PROMPT_V2.md, Module 1 specification.

Requirements:
1. Use Promise.allSettled (NOT Promise.all) — one failure doesn't crash pipeline
2. Classify sources: trigger (complaints), context (PDF, CSV, news), constraint (budget JSON)
3. For CSV: use tabular-serializer.ts to convert each row to natural language sentence
4. For JSON: use serializeJSONDocument to flatten to sentences
5. For PDF: chunk at 500 tokens with 100-token overlap
6. For URL/text: chunk at 500 tokens
7. Input limits: PDF 10MB, CSV 5MB/10K rows, URL timeout 10s
8. Minimum 3 sources must succeed or throw pipeline-abort error
9. Import { llmClient } from "../utils/llm-client" — never import AI SDKs directly
10. Log each source ingestion to trace collector

Output interface: { sources: NormalizedSource[], failed: Array<{source_id, error}>, success_rate: number }

Test with all 5 demo-data files.
```

**Test:**
```bash
APP_ENV=development npx ts-node src/agents/test-ingestion.ts
# Expected: "5/5 sources ingested. CSV rows serialized. PDF chunked. Complaints parsed."
```

### Step 1.3: Implement Module 2 — Credibility Scorer (1 hour)

**Ask Claude Code:**
```
Implement backend/src/agents/credibility-scorer.agent.ts

Reference: MASTER_PROMPT_V2.md, Module 2 specification.

Requirements:
1. 3-axis scoring: recency (0-40), authority (0-30), quality (0-30)
2. Domain-aware authority map (supply chain specific):
   - Internal audit: 30, Supplier official: 28, Procurement: 27
   - Industry report: 22, Verified news: 18, Customer complaints: 12, Anonymous: 5
3. Min-axis threshold: HIGH needs min(axes) >= 15, MEDIUM needs authority >= 10
4. Generate human-readable scoring narrative for EACH source
5. Handle edge cases: no timestamp (recency 0, cap at LOW), future timestamp (treat as now)

Output: CredibilityScore[] with total_score, credibility_tier, reasoning string

Test with 5 demo sources — PDF should score MEDIUM (stale), complaints should score HIGH (fresh).
```

### Step 1.4: Implement Module 3 — Noise Filter (1.5 hours)

**Ask Claude Code:**
```
Implement backend/src/agents/noise-filter.agent.ts

Reference: MASTER_PROMPT_V2.md, Module 3 specification.

Requirements:
1. 3-tier similarity: >0.85 DUPLICATE, 0.60-0.85 CORROBORATING, <0.60 INDEPENDENT
2. Use llmClient.embed() for embedding generation
3. Spam detection: excessive special chars >30%, promo language, <50 chars
4. Minimum sources guard: if <2 kept, restore stale sources with LOW tier + warning
5. Return: FilteredSources + SimilarityLink[] (corroborating pairs)

Test: complaint C006 ("Win iPhone") should be removed as spam.
      Complaint C009 ("Duplicate") should be removed as duplicate.
```

### Step 1.5: Implement Module 4 — Contradiction Detector (2.5 hours)

**⚠️ THIS IS THE MOST IMPORTANT MODULE — 20% of your score depends on it.**

**Ask Claude Code:**
```
Implement backend/src/agents/contradiction-detector.agent.ts

Reference: MASTER_PROMPT_V2.md, Module 4 specification.

Requirements:
1. CLAIM NORMALIZATION: Convert all claims (text AND CSV rows) to canonical form:
   { canonical_topic, canonical_entity, canonical_value, canonical_unit, value_type }
   Example: "Product unavailable" → { topic: "inventory_level", entity: "SKU-1234", value: 0 }

2. STRUCTURED-TO-CLAIM: Convert CSV rows via structuredRowToClaim() before comparison

3. LLM CLAIM EXTRACTION: Use the extraction prompt from master prompt.
   Handle English, Urdu, Roman Urdu (Gemini translates natively).
   Parse with validateLLMOutput() using Zod schema.

4. EXPLICIT DETECTION: Compare normalized claims by topic+entity. Numeric diff >20% = conflict.

5. IMPLICIT DETECTION: Compute derived metrics.
   stock=500, demand=150/day → implied 3.3 days. If source claims "2 weeks" → contradiction.

6. SELF-CONTRADICTION: Check claims within single source for conflicting values.

7. THREE-WAY CONFLICT: When 3+ sources disagree, rank by credibility, compute confidence from gap.

8. Output: Contradiction[] with { contradiction_id, type, subtype, severity, conflicting_sources, confidence }

Test with demo data:
- Should detect: 500 units (PDF) vs ~0 units (complaints) = CRITICAL
- Should detect: Supplier "Active" (old CSV rows) vs "Delayed" (new rows) = HIGH
- Should detect: Port 24/7 (policy) vs trucks stalled (news) = MEDIUM
```

### Step 1.6: Implement Module 7 — Conflict Resolution (1.5 hours)

**⚠️ This runs IMMEDIATELY after M4, BEFORE M5.**

**Ask Claude Code:**
```
Implement backend/src/agents/conflict-resolution.agent.ts

Reference: MASTER_PROMPT_V2.md, Module 7 specification.

Requirements:
1. 5 strategies: trust_credible (gap>30), trust_recent (time>24h), aggregate, request_clarification, human_review
2. Dynamic confidence: confidence = min(0.95, 0.5 + gap/200) × strategyMultiplier
3. STATE MUTATION: Write each resolution to state.resolvedFacts.set(topicKey, { resolved_value, confidence, overridden_sources })
4. CASCADING CHECK: After all resolutions, re-check resolvedFacts for new contradictions
5. Never force false conclusions — if sources equally credible, strategy = request_clarification with investigation actions

Test: For 500 vs 0 units conflict:
- PDF credibility: 45, Complaints credibility: 75
- Gap: 30 → strategy: trust_credible (barely meets threshold)
- Resolved value: ~47 units (from complaints + sales data)
- resolvedFacts key: "inventory_level:SRC-001,SRC-005"
```

✅ **Phase 1 Complete Checklist:**
- [ ] 5 realistic mock data files created
- [ ] M1: 5 sources ingested in parallel with serialized CSV rows
- [ ] M2: Domain-aware credibility scores with narratives
- [ ] M3: Spam and duplicates filtered, corroborating links identified
- [ ] M4: 3 contradictions detected (explicit + implicit)
- [ ] M7: Conflicts resolved, resolvedFacts populated
- [ ] All modules validated with Zod contracts
- [ ] Trace logs show reasoning for each module

---

## PHASE 2: Intelligence + Decision Agents (Day 2: May 15)
**Duration: 10 hours**
**Modules: M5, M6, M8, M9**
**Evaluation Criteria: Insight Quality (20%), Action Chain (15%)**

### Step 2.1: Implement Module 5 — RAG Insight Extraction (3 hours)

**Ask Claude Code:**
```
Implement backend/src/agents/insight-extraction.agent.ts AND backend/src/rag/vector-store.ts

Reference: MASTER_PROMPT_V2.md, Module 5 specification.

CRITICAL: This module reads from state.resolvedFacts FIRST, not raw sources.

Requirements:
1. PipelineVectorStore: per-pipeline-run, in-memory
   - Structured sources: use pre-serialized chunks from M1 (row-per-chunk)
   - Unstructured sources: use 500-token text chunks from M1
   - DO NOT re-chunk structured data — serialized rows are already self-contained
   - Batch embeddings: 20 per batch, 200ms delay (rate limit safe)

2. Multi-query retrieval: 5 supply chain questions
   - "What are current inventory stock levels?"
   - "Are there supply chain disruptions or delivery delays?"
   - "What is the demand trend over recent days?"
   - "What budget constraints or procurement limits exist?"
   - "What policy or regulatory changes affect logistics?"
   Retrieve top-5 per question. Deduplicate by chunk_id. Up to 25 unique chunks.

3. LLM insight extraction: Use master prompt's extraction prompt.
   Categories: risk, opportunity, trend, contradiction (flag REQUIRES_RESOLUTION if unresolved).
   3-7 insights expected.

4. Insight deduplication: Embed title+description, merge if >0.80 similarity.

5. AMCE: BLOCK + BASE MODEL. After LLM generates insights, validate via Gemini 1.5 Pro.
   If validation fails: re-prompt with stricter instructions. If re-prompt fails: use base model output.

Test: Should extract insights like "Demand spike +30%", "Supplier reliability decline", "Stockout risk within 24h".
```

### Step 2.2: Implement Module 6 — Temporal Analysis (1.5 hours)

**Ask Claude Code:**
```
Implement backend/src/agents/temporal-analysis.agent.ts

Reference: MASTER_PROMPT_V2.md, Module 6 specification.

Requirements:
1. Structured time-series from CSV: auto-detect date column and metric columns
2. Unstructured temporal claims: LLM extracts, converts relative → absolute dates
3. Pattern detection: decline, spike (>2σ), drift, anomaly, stable
4. Minimum sample guard: <3 data points → return { pattern_type: "insufficient_data", confidence: 0 }
5. Linear regression for trend, R² for confidence

Test: CSV should show demand spike pattern (+30% in 3 days). Complaints should show spike (8 in 4h vs 1/day).
```

### Step 2.3: Implement Module 8 — Impact Analysis (2 hours)

**Ask Claude Code:**
```
Implement backend/src/agents/impact-analysis.agent.ts

Reference: MASTER_PROMPT_V2.md, Module 8 specification.

Requirements:
1. For each insight, generate impact analysis with LLM
2. Constraint tradeoff modeling: present 2-3 options per action area
   Example: Ground freight (PKR 200K, 72h, misses deadline) vs Air freight (PKR 450K, 12h, within cap)
3. Quantified impact: cost_pkr, affected_customers, risk_probability
4. Time horizon: immediate / short_term / medium_term / long_term
5. Mark which constraints are affected (budget, time, resource, urgency)

Test: Should identify stockout risk as CRITICAL with ~200 customers affected.
```

### Step 2.4: Implement Module 9 — Action Chain Generator (3.5 hours)

**Ask Claude Code:**
```
Implement backend/src/agents/action-chain-generator.agent.ts

Reference: MASTER_PROMPT_V2.md, Module 9 specification.

Requirements:
1. LLM generates 3-5 interconnected actions with depends_on, blocks arrays
2. POST-GENERATION VALIDATION (not LLM-dependent):
   a. Topological sort — detect circular dependencies
   b. All depends_on references exist (no orphans)
   c. Count: 3 ≤ actions ≤ 5
   d. At least 1 simulatable action
   e. At least 2 actions have dependencies (proves "interconnected")
   If validation fails → re-prompt LLM with specific error

3. Each action has: constraints (max_cost, max_duration, api_rate_limit),
   simulation_details (type, parameters, expected_success_rate),
   failure_recovery (retry_count, fallback_action_id, rollback_required)

4. Alternative generation: When M10 rejects infeasible action → re-prompt with
   specific constraint relaxation requirements → validate alternative

5. AMCE: BLOCK + BASE MODEL (Gemini 1.5 Pro validates chain quality)

Expected chain:
ACT-001: Verify stock (verify, no deps, cost 0, time 0.5h)
ACT-002: Notify procurement (notify, deps [ACT-001], cost 0, time 0.25h)
ACT-003: Place emergency order (mitigate, deps [ACT-001, ACT-002], cost 450K, time 2h)
ACT-004: Update delivery estimates (update_system, deps [ACT-003], cost 5K, time 1h)
ACT-005: Schedule monitoring (monitor, deps [ACT-001], cost 0, ongoing)
```

✅ **Phase 2 Complete Checklist:**
- [ ] M5: RAG working with serialized tabular chunks, multi-query retrieval, insight dedup
- [ ] M5: AMCE base model validation passing
- [ ] M6: Temporal patterns detected from CSV and unstructured sources
- [ ] M8: Impact analysis with constraint tradeoff options
- [ ] M9: 5-action chain generated with valid dependency graph
- [ ] M9: AMCE base model validation passing
- [ ] All modules log traces with reasoning

---

## PHASE 3: Simulation + Recovery (Day 3: May 16)
**Duration: 10 hours**
**Modules: M10, M11, M12, M13**
**Evaluation Criteria: Action Chain Simulation (15%), Robustness (15%)**

### Step 3.1: Implement Module 10 — Constraint Validation via Saga Ledger (2 hours)

**Ask Claude Code:**
```
Implement backend/src/simulation/constraint-validator.ts

Uses: SagaConstraintLedger from Phase 0.

Requirements:
1. For each action in execution order → ledger.reserveFunds(actionId, cost, time)
2. If approved → reservation held for M11
3. If denied → mark infeasible, trigger M9 alternative generation
4. Suggest specific constraint relaxations: "Reduce order quantity" or "Use ground freight"

Expected: All 5 actions reserved. Total: PKR 455K < PKR 500K cap. ✓
```

### Step 3.2: Implement Module 11 — DAG Executor + State Machine (3.5 hours)

**Ask Claude Code:**
```
Implement:
- backend/src/simulation/dag-executor.ts (level-parallel execution)
- backend/src/simulation/state-machine.ts (SupplyChainState + transitions + invariants)

Reference: MASTER_PROMPT_V2.md, Module 11 specification.

DAG Executor:
1. computeDependencyLevels() — group actions by topological depth
   Level 0: [ACT-001, ACT-005] — concurrent
   Level 1: [ACT-002]
   Level 2: [ACT-003]
   Level 3: [ACT-004]
2. For each level: Promise.allSettled(actions at this level)
3. State mutations happen BETWEEN levels only (no race conditions)

State Machine:
1. Define SupplyChainState type (stock, order_placed, budget_remaining, etc.)
2. STATE_TRANSITIONS map: action_type → (before, result) → after
3. assertStateInvariants(): budget ≥ 0, stock ≥ 0, customers_notified ≥ 0

Deterministic Failure:
1. SimulationConfig with forcedFailures array
2. DEMO_CONFIG forces ACT-003 to fail on attempt 1

Integration with Saga Ledger:
- Success → ledger.commit(actionId)
- Failure → return { status: 'failed', ledger_action: 'pending_refund' }
```

### Step 3.3: Implement Module 12 — Failure Recovery Engine (2 hours)

**Ask Claude Code:**
```
Implement backend/src/simulation/failure-recovery.ts

Reference: MASTER_PROMPT_V2.md, Module 12 specification.

CRITICAL FLOW:
1. FIRST: ledger.refund(failedActionId) — release escrowed funds
2. Log: "Refunded PKR X for failed actionId. Available budget: PKR Y"
3. Select strategy: retry, fallback, partial_rollback, graceful_skip
4. For retry: re-reserve funds → execute again (without forced failure)
5. For fallback: reserve for fallback action → execute
6. Track recovery cost: additional_time_ms, additional_cost_pkr

Test with DEMO_CONFIG:
- ACT-003 fails attempt 1 → refund PKR 450K → re-reserve → retry succeeds → commit
```

### Step 3.4: Implement Module 13 — Outcome Visualization (2.5 hours)

**Ask Claude Code:**
```
Implement backend/src/simulation/outcome-visualizer.ts

Reference: MASTER_PROMPT_V2.md, Module 13 specification.

Requirements:
1. Before/after state diff: variable → before → after → change_type (added/modified/unchanged)
2. Action execution timeline: action_id, title, start, end, status, cost, duration
3. Aggregate metrics: total_cost, total_duration, success_rate, failures_recovered
4. Residual risk: remaining risk probability, factors, active mitigations
5. BASELINE COMPARISON (MANDATORY):
   Simple heuristic vs agentic system — side by side
   Metrics: contradictions_handled, correct_stock, actions_generated, cost, risk_reduction
6. COST/SCALABILITY NOTE (MANDATORY):
   Cost per pipeline ($0.002 free / $0.05 Vertex), 10x/100x scaling discussion
```

✅ **Phase 3 Complete Checklist:**
- [ ] M10: Saga ledger validates all actions with cumulative budget tracking
- [ ] M11: DAG executor runs levels in parallel, state machine transitions work
- [ ] M11: ACT-003 fails deterministically on attempt 1
- [ ] M12: Refund → retry → success flow works correctly
- [ ] M13: Before/after diff, baseline comparison, cost report generated
- [ ] Full saga ledger audit log shows: reserve → fail → refund → re-reserve → commit

---

## PHASE 4: Orchestrator + Pipeline API (Day 4: May 17)
**Duration: 6 hours**
**Modules: M14, Orchestrator, API Routes**
**Evaluation Criteria: Antigravity Integration (20%)**

### Step 4.1: Implement Module 14 — Trace & Audit Logs (1.5 hours)

**Ask Claude Code:**
```
Implement:
- backend/src/tracing/collector.ts
- backend/src/tracing/data-lineage.ts
- backend/src/tracing/exporter.ts

Requirements:
1. TraceCollector singleton: log events from all modules
2. Data lineage: for each module pair, track from → to → data_type → key_change
3. Aggregate metrics: single-glance pipeline summary
4. Export: 7 artifact JSON files for submission
```

### Step 4.2: Implement Pipeline Orchestrator (2.5 hours)

**Ask Claude Code:**
```
Implement backend/src/agents/orchestrator.ts

This connects ALL modules in correct order with AMCE gates.

Phase A: M1 → AMCE gate → M2 → AMCE gate → M3 → AMCE gate
Phase B: M4 → AMCE gate → M7 → AMCE gate (resolvedFacts written)
Phase C: M5 → AMCE gate (BLOCK+BASE MODEL) → M6 → AMCE gate
Phase D: M8 → AMCE gate → M9 → AMCE gate (BLOCK+BASE MODEL) → M10 → AMCE gate
Phase E: M11 (DAG executor) → M12 (recovery if failures) → AMCE gates
Phase F: M13 → M14 → compile final result

Each AMCE gate:
- Structural validation via Zod (all modules)
- Base model validation via Gemini Pro (M5 and M9 only)
- On REJECT: re-prompt LLM, or use base model output as fallback

Emit SSE events for frontend progress: { module, status, phase }
```

### Step 4.3: Create API Routes (2 hours)

**Ask Claude Code:**
```
Implement:
- backend/src/routes/pipeline.routes.ts (POST /api/pipeline/run, GET /api/pipeline/:id)
- backend/src/routes/pipeline-stream.routes.ts (GET /api/pipeline/:id/stream — SSE)
- backend/src/routes/contracts.routes.ts (GET /api/contracts)

POST /api/pipeline/run body:
{
  "sources": [{ "source_id": "SRC-001", "source_type": "pdf", "content": "base64...", "metadata": {...} }, ...],
  "constraints": { "budget_limit": { "amount": 500000, "currency": "PKR" }, "time_limit": {...}, "urgency": "critical" }
}

Response: Complete PipelineResult with insights, contradictions, actions, simulation, outcome, trace.
Request validation with Zod. Error handling middleware.
```

**End-to-end test:**
```bash
APP_ENV=development curl -X POST http://localhost:8000/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d @demo-data/inventory-shortage-request.json
# Should return full pipeline result with trace
```

✅ **Phase 4 Complete Checklist:**
- [ ] M14: Trace exporter generates 7 artifact JSONs
- [ ] Orchestrator runs all 14 modules in correct Phase A→F order
- [ ] AMCE gates validate every module (base model on M5, M9)
- [ ] SSE endpoint streams real-time progress
- [ ] POST /api/pipeline/run returns complete result
- [ ] End-to-end test passes with demo data

---

## PHASE 5: Frontend + Mobile + Deploy (Day 5: May 18)
**Duration: 12 hours**
**Evaluation Criteria: Innovation & UX (10%)**

### Step 5.1: Set Up React Web Dashboard (1 hour)

```bash
cd ../frontend
npx create-react-app . --template typescript
npm install axios recharts react-router-dom
npm install -D tailwindcss @types/react-router-dom
npx tailwindcss init
```

### Step 5.2: Create Dashboard Components (5 hours)

**Ask Claude Code:**
```
Create these React components following MASTER_PROMPT_V2.md frontend architecture:

1. InputPanel.tsx — 5 source upload fields + constraint inputs + "Analyze" button
2. PipelineProgress.tsx — SSE-powered real-time status per module (✓/⚠/✗)
3. ContradictionViewer.tsx — Conflicting claims side-by-side with credibility scores + resolution
4. ActionChainGraph.tsx — Dependency graph with nodes + arrows + constraint badges
5. SagaLedgerTracker.tsx — Reserve/commit/refund timeline as PKR bar chart
6. SimulationDiff.tsx — Before/after state comparison table with color-coded changes
7. FailureRecoveryLog.tsx — Failure → refund → retry → success timeline
8. BaselineComparison.tsx — Agentic vs heuristic side-by-side cards
9. CostReport.tsx — Cost per module + total + scalability note
10. AgentTraceFlow.tsx — Phase A→F flowchart with expandable module details
11. DataLineageTable.tsx — from → to → data_type → key_change table

Use TailwindCSS. Color scheme: green=pass, yellow=warn, red=fail.
```

### Step 5.3: Deploy Frontend — Firebase Hosting (Person C, $0)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
# Share Firebase URL with team: https://your-app.web.app
```

### Step 5.4: Set Up Mobile App — Expo (2 hours)

```bash
cd ../mobile
npx create-expo-app ContentActionAgent
cd ContentActionAgent
npm install axios @react-navigation/native @react-navigation/stack
```

### Step 5.5: Create Mobile Screens (2.5 hours)

**Ask Claude Code:**
```
Create mobile screens following MASTER_PROMPT_V2.md mobile architecture:

1. HomeScreen.tsx — Text input + file picker + "Analyze" button + recent runs
2. ResultsScreen.tsx — Scrollable cards: insights → contradictions → actions → simulation
3. TraceScreen.tsx — Simplified vertical timeline of agent steps
4. LedgerScreen.tsx — Saga ledger status (budget remaining PKR)

Keep mobile UI simple and focused. Point API calls to backend URL.
```

### Step 5.6: Build APK (MANDATORY — 1 hour)

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Configure build
eas build:configure

# Build APK (preview profile generates .apk, not .aab)
eas build --platform android --profile preview

# Download .apk from the Expo dashboard when build completes
# Save to: submission/app-release.apk
```

> ⚠️ APK build takes 15-30 minutes on EAS servers. Start early. If EAS fails, fallback:
> ```bash
> cd android && ./gradlew assembleRelease
> # Output: android/app/build/outputs/apk/release/app-release.apk
> ```

✅ **Phase 5 Complete Checklist:**
- [ ] Web dashboard displays all pipeline results with real-time SSE progress
- [ ] Contradiction viewer shows conflicts clearly with credibility + resolution
- [ ] Saga ledger tracker shows reserve/commit/refund flow visually
- [ ] Baseline comparison card visible
- [ ] Frontend deployed to Firebase (Person C, $0)
- [ ] Mobile app runs on Android
- [ ] **APK file generated and saved to submission/**
- [ ] Mobile app points to backend URL

---

## PHASE 6: Production Switch + Stress Tests (Day 6: May 19)
**Duration: 8 hours**
**Evaluation Criteria: Robustness (15%)**

### Step 6.1: Deploy Backend — Cloud Run (Person A, ~$2)

```bash
gcloud run deploy content-action-agent \
  --source ./backend \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars APP_ENV=production
```

### Step 6.2: Configure Vertex AI (Person B + C keys)

```bash
# Person B and C each create service account keys in GCP Console
# Team lead configures .env.production with both keys
# Test production switch:
APP_ENV=production npx ts-node src/utils/test-llm-client.ts
# ✓ Vertex AI response confirmed
```

### Step 6.3: Run One Full Pipeline in Production

```bash
APP_ENV=production curl -X POST https://your-cloud-run-url/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d @demo-data/inventory-shortage-request.json
# Confirm trace shows "ai_provider_used": "vertex-ai"
```

### Step 6.4: Run 5 Stress Tests (Development Mode — Save Credits)

```bash
APP_ENV=development npm run test:stress
```

**Expected:**
```
✓ Test 1: Three-Way Conflict — 3 contradictions detected, credibility-ranked resolution
✓ Test 2: Budget Violation — ACT rejected, alternative generated
✓ Test 3: API Failure + Retry — Refund → re-reserve → retry succeeds → commit
✓ Test 4: Low-Credibility Outlier — Score 12 source ignored
✓ Test 5: Cascading Side Effect — ACT-004 rejected after ACT-003 consumed budget
All 5 stress tests passed.
```

✅ **Phase 6 Complete Checklist:**
- [ ] Backend deployed to Cloud Run (Person A's credits)
- [ ] Vertex AI keys configured and tested
- [ ] Production pipeline run succeeded with vertex-ai provider
- [ ] All 5 stress tests passing (development mode)
- [ ] Saga ledger audit log shows correct reserve/commit/refund flow in tests

---

## PHASE 7: Documentation + Videos + Submit (Day 7: May 20)
**Duration: 8 hours**

### Step 7.1: Create README.md (2.5 hours)

```
Include ALL of these sections (from FAQ submission checklist):

1. Architecture Overview — 14-module diagram, Phase A→F flow, AMCE layer
2. Data Sources — 5 input types, mock data files, credibility criteria
3. Data Schemas — All TypeScript interfaces documented
4. Tools & APIs — Gemini, Groq, Vertex AI, Express, React, Expo
5. Google Antigravity Role — Orchestration, reasoning, traces
6. Setup Steps for Judges:
   git clone → npm install → APP_ENV=development npm run dev → curl test
7. Privacy Note — No real data, no PII, synthetic scenarios
8. Cost & Latency Analysis — Per-pipeline cost, per-module latency, total
9. Scalability Note — 10x: queue + Groq fallback, 100x: paid tier + workers
10. Baseline Comparison — Table: agentic vs heuristic metrics
11. Assumptions & Limitations
12. Environment Strategy — Free (dev) → Vertex (demo) → fallback chain
```

### Step 7.2: Record VIDEO 1 — Product Demo (3-5 min, 1.5 hours)

**Record in production mode (Vertex AI).**

```
Segment 1 (30s): Introduction
Segment 2 (30s): Input — 5 sources uploaded, constraints set
Segment 3 (45s): Contradiction Detection — 500 vs 0 units, credibility comparison
Segment 4 (60s): Action Chain — 5 actions, dependency graph, saga ledger reserves
Segment 5 (45s): Failure & Recovery — ACT-003 fails, refund, retry, commit
Segment 6 (30s): Outcome — Before/after, baseline comparison, cost report
Segment 7 (30s): Trace — Workplan, data lineage, aggregate metrics
```

**Show BOTH web dashboard AND mobile app.**

### Step 7.3: Record VIDEO 2 — Antigravity Usage (2-3 min, 1 hour)

**Use screen recordings captured from Day 1 onwards.**

```
Show:
1. Coding INSIDE Antigravity IDE (editor, terminal)
2. Claude Code running in Antigravity terminal
3. How Antigravity helped with reasoning and planning
4. Antigravity trace logs being generated during execution
5. How Antigravity was central to building the system
```

### Step 7.4: Package Submission (1 hour)

```
submission/
├── backend/                          # Complete backend codebase
├── frontend/                         # React dashboard
├── mobile/                           # Expo mobile app source
├── app-release.apk                   # MANDATORY APK file
├── artifacts/                        # 7 Antigravity trace JSONs
│   ├── artifact-1-workplan.json
│   ├── artifact-2-task-plan.json
│   ├── artifact-3-decision-trace.json
│   ├── artifact-4-tool-calls.json
│   ├── artifact-5-action-execution.json
│   ├── artifact-6-recovery-trace.json
│   └── artifact-7-final-outcome.json
├── stress-tests/                     # 5 stress test results
├── demo-product.mp4                  # 3-5 min product demo
├── demo-antigravity.mp4              # 2-3 min Antigravity usage
└── README.md                         # Complete documentation
```

### Step 7.5: Final Verification

**Deliverables:**
- [ ] Mobile APK ✓
- [ ] Web dashboard ✓ (Firebase URL)
- [ ] Product demo video ✓ (3-5 min, production mode)
- [ ] Antigravity usage video ✓ (2-3 min)
- [ ] 7 Antigravity artifact JSONs ✓
- [ ] README with all required sections ✓
- [ ] 5 stress test results ✓

**Evaluation Criteria:**
- [ ] Antigravity integration 20% ✓ (built inside, traces, 2 videos)
- [ ] Agentic reasoning 20% ✓ (14 modules, 6 phases, decision chains)
- [ ] Contradiction handling 20% ✓ (3 detection modes, claim normalization, resolution)
- [ ] Action chain simulation 15% ✓ (DAG execution, saga ledger, state machine)
- [ ] Robustness 15% ✓ (5 stress tests, refund recovery, baseline comparison)
- [ ] Innovation & UX 10% ✓ (AMCE, saga ledger viz, tabular serialization, mobile APK)

**SUBMIT before May 20, 11:59 PM** 🚀

---

## TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Gemini rate limit (429) | LLMClient auto-falls back to Groq. Don't switch to Vertex early. |
| Vertex AI auth failed | Check service account key path. LLMClient falls back to free Gemini. |
| Contract validation REJECT | Check Zod schema. Re-prompt LLM. Use base model fallback. |
| CSV parsing wrong columns | Check delimiter auto-detection. Verify tabular serializer output. |
| Saga ledger "cannot refund" | Ensure refund called only on 'reserved' status, not 'committed'. |
| APK build failed (EAS) | Fallback: `cd android && ./gradlew assembleRelease` |
| Frontend CORS errors | Update backend CORS to include Firebase URL. Redeploy Cloud Run. |
| Pipeline >60s timeout | Add `--timeout=120` to Cloud Run deploy. Or reduce LLM retries. |

---

## TIME MANAGEMENT

```
Day 1 (May 14): Phase 1 — M1, M2, M3, M4, M7 (content analysis + contradictions)
Day 2 (May 15): Phase 2 — M5, M6, M8, M9 (intelligence + action chain)
Day 3 (May 16): Phase 3 — M10, M11, M12, M13 (simulation + recovery + outcome)
Day 4 (May 17): Phase 4 — M14, orchestrator, API routes, end-to-end test
Day 5 (May 18): Phase 5 — Frontend + mobile + APK + Firebase deploy
Day 6 (May 19): Phase 6 — Cloud Run + Vertex AI + stress tests
Day 7 (May 20): Phase 7 — README + 2 videos + package + SUBMIT
```

**This is your complete development plan. Follow it phase by phase. Good luck! 🚀**
