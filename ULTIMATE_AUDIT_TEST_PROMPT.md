# ULTIMATE SYSTEM AUDIT TEST PROMPT
## Autonomous Content-to-Action Agent — InnoCollab AI Seekho 2026
### Complete End-to-End Verification: Backend + Web Frontend + Mobile App

---

> **ORCHESTRATOR:** Google Antigravity (Primary Orchestrator — Mandatory)
> **ASSISTANT LLMs:** Claude Code / Gemini / Groq (running inside Antigravity IDE)
> **AUDIT SCOPE:** Full System — 14 Backend Modules + Next.js Web Frontend + Expo Mobile App
> **AUDIT MODE:** Run this prompt in Google Antigravity. Antigravity will assign sub-tasks to its agents, call Claude Code where needed, and compile all results into a final pass/fail verdict per section.
> **PURPOSE:** Pre-documentation final verification gate. Every section must reach PASS before documentation generation begins.

---

## HOW TO USE THIS PROMPT IN GOOGLE ANTIGRAVITY

```
1. Open your Antigravity project workspace (content-action-agent/).
2. Paste this entire document into the Antigravity Agent input.
3. Antigravity will:
   - Parse the audit plan into a structured task list
   - Assign each section to a dedicated audit agent
   - Spin up Claude Code sub-agents for code inspection tasks
   - Execute all test commands directly in the Antigravity terminal
   - Emit trace events for each section (PASS / WARN / FAIL)
   - Produce a final consolidated audit receipt at the end
4. For any FAIL, Antigravity must emit a remediation instruction block before moving
   to the next section.
5. A section may only be marked PASS when ALL sub-checks within it succeed.
```

**Antigravity Orchestration Directive:**
```
You are the orchestration brain. Run every check below as an independent sub-agent task.
Log each result to the Antigravity trace under the key "audit_event" with fields:
  { section, check_id, status: "PASS"|"WARN"|"FAIL", detail, remediation? }
At the end, produce an AuditSummaryReceipt containing:
  - Total checks run
  - Total PASS / WARN / FAIL counts
  - SHA-256 hash of the entire receipt payload
  - Timestamp of audit completion
Do NOT proceed to documentation generation unless all FAIL counts equal zero.
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 0 — ENVIRONMENT & INFRASTRUCTURE BASELINE
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### [AUD-ENV-01] Project Structure Integrity
**Antigravity Sub-Agent:** File System Inspector
```bash
# Run inside Antigravity terminal:
ls -la content-action-agent/
ls -la content-action-agent/backend/src/
ls -la content-action-agent/frontend/src/
ls -la content-action-agent/mobile/src/
```
**PASS Criteria:**
- [ ] `backend/src/agents/` directory exists with ≥ 14 agent `.ts` files
- [ ] `backend/src/contracts/definitions/` directory exists with ≥ 10 YAML contract files
- [ ] `backend/src/utils/llm-client.ts` exists (singleton LLMClient)
- [ ] `backend/src/tracing/collector.ts` exists (TraceCollector)
- [ ] `backend/src/utils/dag-sorter.ts` exists (Kahn's Algorithm)
- [ ] `backend/audit-logs/` directory exists (workflow audit receipts)
- [ ] `frontend/src/features/execution/hooks/useLiveTrace.ts` exists
- [ ] `frontend/src/features/execution/components/HITLApprovalPhase.tsx` exists
- [ ] `mobile/src/services/BiometricSecurityService.ts` exists
- [ ] `mobile/src/hooks/useStandalonePipeline.ts` exists
- [ ] `.env.development` exists (not committed to git)
- [ ] `.env.production` exists (not committed to git)
- [ ] `.env.example` exists and is committed
- [ ] `.gitignore` contains `.env.development` and `.env.production`

---

### [AUD-ENV-02] Environment Variables Compliance
**Antigravity Sub-Agent:** Config Inspector
```bash
# Verify .env.example has all required keys
cat content-action-agent/backend/.env.example
cat content-action-agent/mobile/.env.example
```
**PASS Criteria:**
- [ ] `GEMINI_API_KEY` present
- [ ] `GROQ_API_KEY` present
- [ ] `PRIMARY_PROVIDER` present
- [ ] `FALLBACK_PROVIDER` present
- [ ] `EMERGENCY_FALLBACK` present
- [ ] `PRIMARY_MODEL` present
- [ ] `BASE_MODEL` present
- [ ] `EMBEDDING_MODEL` present
- [ ] `VERTEX_KEY_1` present (value may be placeholder)
- [ ] `VERTEX_PROJECT_ID_1` present
- [ ] `VERTEX_KEY_2` present
- [ ] `VERTEX_PROJECT_ID_2` present
- [ ] `PORT` present
- [ ] `NODE_ENV` present
- [ ] `APP_ENV` present
- [ ] `EXPO_PUBLIC_OPERATOR_HANDLE` present in mobile `.env.example`
- [ ] `EXPO_PUBLIC_API_BASE_URL` present in mobile `.env.example`

---

### [AUD-ENV-03] TypeScript Compilation — Zero Errors
**Antigravity Sub-Agent:** TypeScript Verifier
```bash
cd content-action-agent/backend && APP_ENV=development npx tsc --noEmit 2>&1
cd content-action-agent/frontend && npx tsc --noEmit 2>&1
cd content-action-agent/mobile && npx tsc --noEmit 2>&1
```
**PASS Criteria:**
- [ ] Backend: `0 errors, 0 warnings`
- [ ] Frontend: `0 errors, 0 warnings`
- [ ] Mobile: `0 errors, 0 warnings`
- [ ] No `implicit any` types in any file across all three projects
- [ ] All async functions have proper `try/catch` error guards

---

### [AUD-ENV-04] ESLint Static Analysis — Zero Problems
```bash
cd content-action-agent/backend && npm run lint 2>&1
cd content-action-agent/frontend && npm run lint 2>&1
cd content-action-agent/mobile && npm run lint 2>&1
```
**PASS Criteria:**
- [ ] Backend: `0 problems`
- [ ] Frontend: `0 problems`
- [ ] Mobile: `0 problems`

---

### [AUD-ENV-05] LLMClient Singleton Architecture Compliance
**Antigravity Sub-Agent:** Code Pattern Inspector
```bash
# Verify NO agent file imports AI SDKs directly
grep -rn "from '@google/generative-ai'" content-action-agent/backend/src/agents/ 2>&1
grep -rn "from 'groq-sdk'" content-action-agent/backend/src/agents/ 2>&1
grep -rn "from '@google-cloud/aiplatform'" content-action-agent/backend/src/agents/ 2>&1

# Verify all agents import the llmClient singleton
grep -rn "from '../utils/llm-client'" content-action-agent/backend/src/agents/ 2>&1
```
**PASS Criteria:**
- [ ] Zero direct AI SDK imports in any file under `backend/src/agents/`
- [ ] All 14 agent files reference `../utils/llm-client` singleton
- [ ] `LLMClient` export in `llm-client.ts` is a singleton (`export const llmClient = new LLMClient()`)

---

### [AUD-ENV-06] LLMClient Multi-Environment Switching Test
```bash
cd content-action-agent/backend
APP_ENV=development npx ts-node src/utils/test-llm-client.ts 2>&1
```
**PASS Criteria:**
- [ ] Output contains: `[LLMClient] Initialized in development mode → primary: gemini-free`
- [ ] Output contains: `✓ Response:` (successful completion from Gemini free tier)
- [ ] Output contains: `✓ Embedding dimensions: 768`
- [ ] Output contains: `⚠ Skipped` for Vertex AI test (expected in development mode)
- [ ] No uncaught exceptions

---

### [AUD-ENV-07] Vertex AI Fallback Chain Logic Verification
**Antigravity Sub-Agent:** Code Logic Analyzer (Claude Code)
```
Ask Claude Code to inspect backend/src/utils/llm-client.ts and verify:
1. Primary → Fallback → Emergency provider chain is correctly implemented
2. Vertex account rotation logic correctly increments currentVertexAccount index
3. When all Vertex accounts are exhausted, fallback to free Gemini is triggered
4. Budget limit check (account.spent >= account.limit) gates Vertex calls
5. Error codes 429 and "quota"/"billing" messages trigger account rotation
```
**PASS Criteria:**
- [ ] Three-tier fallback chain confirmed in code
- [ ] Vertex account rotation logic covers both accounts
- [ ] Emergency fallback to `groq` is reachable
- [ ] No infinite recursion possible in fallback loop

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 1 — BACKEND: 14-MODULE PIPELINE AUDIT
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> **Antigravity Directive:** Start the backend server before running module tests:
> ```bash
> cd content-action-agent/backend && APP_ENV=development npm run dev &
> # Wait 5 seconds, then verify:
> curl -s http://localhost:8000/health | grep '"status":"ok"'
> ```

---

### [AUD-M01] Module 1 — Multi-Source Content Ingestion
**Antigravity Sub-Agent:** Ingestion Tester

**Structural Check:**
```bash
# Verify file exists and has correct exports
grep -n "class MultiSourceIngestionAgent\|export" \
  content-action-agent/backend/src/agents/multi-source-ingestion.agent.ts
```

**Functional Test — 5 Sources Parallel Ingestion:**
```bash
curl -s -X POST http://localhost:8000/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "sources": [
      {"source_id":"SRC-001","source_type":"pdf","content":"base64_encoded_pdf_here","metadata":{"filename":"warehouse_report.pdf","timestamp":"2026-05-21T10:00:00Z"}},
      {"source_id":"SRC-002","source_type":"url","content":"https://example.com/supply-news","metadata":{"timestamp":"2026-05-21T09:00:00Z"}},
      {"source_id":"SRC-003","source_type":"csv","content":"item,qty,price\nWidget-A,500,120\nWidget-B,50,200","metadata":{"filename":"inventory.csv","timestamp":"2026-05-21T08:00:00Z"}},
      {"source_id":"SRC-004","source_type":"json","content":"{\"metric\":\"sales\",\"value\":45000}","metadata":{"timestamp":"2026-05-20T12:00:00Z"}},
      {"source_id":"SRC-005","source_type":"realtime_feed","content":"[{\"event\":\"complaint\",\"text\":\"Product out of stock\"}]","metadata":{"timestamp":"2026-05-21T10:30:00Z"}}
    ],
    "constraints":{"budget":500000,"time_hours":48,"urgency":"HIGH"}
  }' | jq '.ingestion.sources | length'
```

**Contract Compliance Check:**
```bash
# Verify contract file exists
cat content-action-agent/backend/src/contracts/definitions/multi_source_ingestion_v1.yaml
```

**PASS Criteria:**
- [ ] All 5 source types (`pdf`, `url`, `csv`, `json`, `realtime_feed`) are handled
- [ ] Ingestion runs in parallel (`Promise.all` pattern confirmed in source)
- [ ] Response contains ≥ 5 normalized source objects
- [ ] Each source has `source_id`, `source_type`, `raw_text`, `timestamp` fields
- [ ] `raw_text` min length ≥ 20 characters for all sources
- [ ] `agent_start` trace event emitted for this module
- [ ] Contract `multi_source_ingestion_v1` enforcement mode is `BLOCK`
- [ ] Contract validator PASS/WARN/REJECT decision logged in trace

---

### [AUD-M02] Module 2 — Source Credibility Scorer
**Antigravity Sub-Agent:** Credibility Tester

**Scoring Logic Verification (Claude Code Inspection):**
```
Ask Claude Code to inspect backend/src/agents/credibility-scorer.agent.ts and confirm:
1. Recency scoring: within-last-hour=40, last-day=30, last-week=20, last-month=10, older=0
2. Authority scoring: official/company=30, verified-news=25, industry-report=20, user-verified=15, anonymous=5
3. Quality scoring: citations=+10, numerical-data=+10, coherent-structure=+10
4. Tier classification: ≥70=HIGH, ≥40=MEDIUM, ≥20=LOW, <20=UNVERIFIED
5. Output includes 'reasoning' field explaining the score breakdown
```

**Functional Test — Known Score Expectations:**
```bash
# Source with timestamp from 30 minutes ago should score HIGH on recency
# Verify by checking trace output from the pipeline run above
curl -s http://localhost:8000/api/pipeline/last/trace | \
  jq '.events[] | select(.module == "credibility_scorer") | .output'
```

**PASS Criteria:**
- [ ] Four scoring dimensions implemented: recency, authority, quality, total
- [ ] `HIGH`/`MEDIUM`/`LOW`/`UNVERIFIED` tier assignment verified in code
- [ ] `reasoning` field populated in all credibility score objects
- [ ] `Promise.all` parallel scoring confirmed
- [ ] Contract `source_credibility_v1` validation passes

---

### [AUD-M03] Module 3 — Noise Filter & Semantic Deduplication
**Antigravity Sub-Agent:** Noise Filter Tester

**Structural Check (Claude Code):**
```
Inspect backend/src/agents/noise-filter.agent.ts and verify:
1. InMemoryVectorStore is used (not an external DB)
2. Cosine similarity calculation is implemented (cosineSimilarity function)
3. Similarity threshold of 0.85 used for duplicate detection
4. Stale source removal (recency_score === 0) is checked before deduplication
5. Higher-credibility source is kept when duplicates are found
6. gemini-embedding-001 or text-embedding-004 is used via llmClient.generateEmbedding()
7. Spam detection step exists as a separate filter pass
```

**Functional Dedup Test:**
```bash
# Send 2 near-identical sources and verify only 1 passes through
curl -s -X POST http://localhost:8000/api/debug/noise-filter \
  -H "Content-Type: application/json" \
  -d '{
    "sources": [
      {"source_id":"DEDUP-A","raw_text":"Widget stock is critically low at 50 units","timestamp":"2026-05-21T09:00:00Z"},
      {"source_id":"DEDUP-B","raw_text":"Widget stock critically low, only 50 units remaining","timestamp":"2026-05-20T09:00:00Z"}
    ]
  }' | jq '.kept_sources | length'
# Expected: 1 (DEDUP-A kept as newer)
```

**PASS Criteria:**
- [ ] Cosine similarity deduplication logic present
- [ ] Threshold at 0.85
- [ ] Higher-credibility source retained on dedup collision
- [ ] Stale source filter (recency_score === 0) applied first
- [ ] Removed sources list includes `reason` field (`stale` or `duplicate`)
- [ ] Contract `noise_filter_v1` validation passes

---

### [AUD-M04] Module 4 — Contradiction Detector
**Antigravity Sub-Agent:** Contradiction Tester

**Contradiction Type Coverage (Claude Code Inspection):**
```
Inspect backend/src/agents/contradiction-detector.agent.ts and verify:
1. All 4 contradiction types handled: numeric, boolean, categorical, temporal
2. Numeric: threshold of >20% divergence triggers detection
3. Boolean: any difference triggers CRITICAL severity
4. LLM claim extraction using llmClient.complete() with structured JSON prompt
5. Claims grouped by topic before cross-comparison
6. All pairs checked (O(n²) pairwise comparison)
7. contradiction_id generated uniquely (e.g. CONTRA-<timestamp>)
8. confidence field populated for each contradiction
9. resolution_needed boolean set based on severity
```

**Functional Contradiction Test — Known Conflict:**
```bash
curl -s -X POST http://localhost:8000/api/debug/contradiction-detect \
  -H "Content-Type: application/json" \
  -d '{
    "sources": [
      {"source_id":"SRC-A","raw_text":"Current warehouse stock level is 500 units of Widget-A","timestamp":"2026-05-21T09:00:00Z"},
      {"source_id":"SRC-B","raw_text":"Warehouse audit shows only 50 units of Widget-A in stock","timestamp":"2026-05-21T08:30:00Z"},
      {"source_id":"SRC-C","raw_text":"The warehouse system is fully operational","timestamp":"2026-05-21T09:00:00Z"},
      {"source_id":"SRC-D","raw_text":"Warehouse system has been down since yesterday","timestamp":"2026-05-21T09:00:00Z"}
    ]
  }' | jq '{
    total: .contradictions | length,
    numeric: [.contradictions[] | select(.type=="numeric")] | length,
    boolean: [.contradictions[] | select(.type=="boolean")] | length,
    critical: [.contradictions[] | select(.severity=="CRITICAL")] | length
  }'
```
**Expected output:** `{ "total": 2, "numeric": 1, "boolean": 1, "critical": 1 }`

**PASS Criteria:**
- [ ] Numeric contradiction (500 vs 50 units, 90% divergence → CRITICAL) detected
- [ ] Boolean contradiction (system up vs down) detected as CRITICAL
- [ ] Both contradictions appear in response
- [ ] `resolution_needed: true` on both
- [ ] Contract `contradiction_detection_v1` with enforcement_mode `QUARANTINE` passes
- [ ] Trace logs `contradiction_detected` events for each conflict found

---

### [AUD-M05] Module 5 — RAG-Powered Insight Extraction
**Antigravity Sub-Agent:** Insight Quality Tester

**Code Inspection (Claude Code):**
```
Inspect backend/src/agents/insight-extraction.agent.ts and verify:
1. RAG pattern: embeddings generated → vector store queried → LLM synthesis
2. Four insight categories handled: trends, risks, opportunities, contradictions
3. Contradictions flagged from Module 4 are surfaced in insights
4. Each insight has: insight_id, category, title, description, evidence[], confidence, action_required
5. insight_id matches regex pattern (e.g., INS-<timestamp> or uuid)
6. llmClient.complete() and llmClient.generateEmbedding() both used
7. RAG retrieves most relevant context chunks before synthesis
```

**Output Quality Verification:**
```bash
curl -s http://localhost:8000/api/pipeline/last/trace | \
  jq '.events[] | select(.module == "insight_extraction") | .output.insights | length'
# Expected: ≥ 3 insights
```

**PASS Criteria:**
- [ ] ≥ 3 insights generated in full pipeline run
- [ ] At minimum 1 risk insight and 1 opportunity insight present
- [ ] Contradiction-flagged insights include `contradiction_ref` field
- [ ] Insight `confidence` is between 0.0 and 1.0
- [ ] Contract `insight_extraction_v1` validation passes

---

### [AUD-M06] Module 6 — Temporal Analysis Engine
**Antigravity Sub-Agent:** Temporal Tester

**Code Inspection (Claude Code):**
```
Inspect backend/src/agents/temporal-analysis.agent.ts and verify:
1. Linear regression implemented over historical data series (not just LLM guessing)
2. Four temporal patterns detected: decline, spike, drift, anomaly
3. 30 historical points used for fitting the regression line
4. rate_of_change metric computed from regression slope
5. reliability_score degraded when extrapolation variance exceeds threshold
6. Output includes: trend_type, rate_of_change, confidence, time_horizon, data_points_used
7. Module runs in parallel with Conflict Resolution via Promise.all in orchestrator
```

**PASS Criteria:**
- [ ] Linear regression logic present (not purely LLM-generated trend)
- [ ] `rate_of_change` field populated as numeric value
- [ ] Temporal patterns enum (`decline`|`spike`|`drift`|`anomaly`) enforced
- [ ] `data_points_used` ≥ 1 in output
- [ ] Parallel execution with conflict resolution confirmed in orchestrator file
- [ ] Contract `temporal_analysis_v1` validation passes

---

### [AUD-M07] Module 7 — Conflict Resolution Engine
**Antigravity Sub-Agent:** Conflict Resolution Tester

**Code Inspection (Claude Code):**
```
Inspect backend/src/agents/conflict-resolution.agent.ts and verify:
1. Consensus selection logic uses credibility weights (higher credibility = more weight)
2. Unresolved conflicts scheduled for human investigation (investigation_path populated)
3. Does NOT force a false consensus — unresolvable conflicts remain as UNRESOLVED
4. Output includes: resolution_id, status (RESOLVED|UNRESOLVED|INVESTIGATING), chosen_value, confidence
5. Module runs in parallel with Temporal Analysis via Promise.all
```

**Functional Test — Unresolvable Conflict:**
```bash
# A conflict where both sources have equal credibility should remain UNRESOLVED
curl -s http://localhost:8000/api/pipeline/last/trace | \
  jq '.events[] | select(.module == "conflict_resolution") | .output.resolutions[] | select(.status == "UNRESOLVED")'
```

**PASS Criteria:**
- [ ] Credibility-weighted consensus selection implemented
- [ ] UNRESOLVED status returned for equal-credibility conflicts
- [ ] `investigation_path` populated for unresolved items
- [ ] No forced false conclusions (confirmed in code logic)
- [ ] Contract `conflict_resolution_v1` validation passes

---

### [AUD-M08] Module 8 — Impact Analysis with Constraints
**Antigravity Sub-Agent:** Impact Scorer Tester

**Code Inspection (Claude Code):**
```
Inspect backend/src/agents/impact-scorer.agent.ts and verify:
1. Impact score (0-100) computed as average of financial + operational + reputational scores
2. Score is deterministic given same inputs (no random variance)
3. Constraints accepted: budget (PKR), time_hours, urgency (LOW|MEDIUM|HIGH|CRITICAL)
4. Output includes: impact_id, magnitude (0-100), financial_score, operational_score, reputational_score, recommended_priority
5. CRITICAL/HIGH/MEDIUM/LOW priority assigned based on magnitude thresholds
```

**PASS Criteria:**
- [ ] Three sub-score averaging logic confirmed
- [ ] Priority assignment thresholds defined in code
- [ ] All three constraint types (budget, time, urgency) affect the analysis
- [ ] Contract `impact_analysis_v1` validation passes

---

### [AUD-M09] Module 9 — Action Chain Generator (3-5 Actions)
**Antigravity Sub-Agent:** Action Chain Tester

**Code Inspection (Claude Code):**
```
Inspect backend/src/agents/strategic-recommender.agent.ts and verify:
1. Generates exactly 3-5 ProposedAction objects (not 1, not 10)
2. Each action has: action_id (ACT-NNN format), title, description, priority, depends_on[], estimated_cost, estimated_time_hours
3. depends_on array forms a valid DAG (no circular references at generation time)
4. At least one action has a non-empty depends_on array (demonstrates chaining)
5. Priority values are CRITICAL | HIGH | MEDIUM | LOW
6. estimated_cost populated in PKR
```

**Functional Action Count Test:**
```bash
curl -s http://localhost:8000/api/pipeline/last | \
  jq '.proposal.actions | length'
# Expected: between 3 and 5
```

**Dependency Chain Test:**
```bash
curl -s http://localhost:8000/api/pipeline/last | \
  jq '.proposal.actions[] | select(.depends_on | length > 0) | {id: .action_id, deps: .depends_on}'
# Expected: at least 1 action with non-empty depends_on
```

**PASS Criteria:**
- [ ] Action count is between 3 and 5 (inclusive)
- [ ] At least 1 action has a populated `depends_on` array
- [ ] `action_id` follows ACT-NNN pattern
- [ ] All four priority levels defined in type system
- [ ] Contract `action_chain_v1` validation passes

---

### [AUD-M10] Module 10 — Constraint Validator
**Antigravity Sub-Agent:** Constraint Tester

**Code Inspection (Claude Code):**
```
Inspect backend/src/agents/constraint-validator.agent.ts (or execution-simulator path) and verify:
1. Budget constraint check: action.estimated_cost <= available_budget
2. Time constraint check: action.estimated_time_hours <= available_time
3. Urgency escalation: CRITICAL urgency overrides LOW-priority actions
4. Infeasible actions are REJECTED and logged with reason
5. Modified/alternative actions generated when rejections occur
6. Running budget total updated after each validated action
```

**Stress Test — Budget Violation:**
```bash
curl -s -X POST http://localhost:8000/api/debug/constraint-validate \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      {"action_id":"ACT-001","estimated_cost":450000,"estimated_time_hours":24,"priority":"HIGH"},
      {"action_id":"ACT-002","estimated_cost":600000,"estimated_time_hours":12,"priority":"MEDIUM"}
    ],
    "constraints": {"budget": 500000, "time_hours": 48}
  }' | jq '{
    act001_status: (.results[] | select(.action_id=="ACT-001") | .status),
    act002_status: (.results[] | select(.action_id=="ACT-002") | .status)
  }'
# Expected: { "act001_status": "APPROVED", "act002_status": "REJECTED" }
```

**PASS Criteria:**
- [ ] ACT-001 (PKR 450K < 500K limit) → APPROVED
- [ ] ACT-002 (PKR 600K > 500K limit) → REJECTED
- [ ] Rejection reason populated: `"exceeds_budget_constraint"`
- [ ] Alternative action recommendation generated for rejected action
- [ ] Running budget ledger updated after each approval
- [ ] Contract `constraint_validation_v1` validation passes

---

### [AUD-M11] Module 11 — HITL Consent Gate (State Machine)
**Antigravity Sub-Agent:** HITL Gate Tester

**Code Inspection (Claude Code):**
```
Inspect backend/src/agents/execution-simulator.agent.ts and pipelineApprovalStore:
1. pipelineApprovalStore registers new pipelines in PENDING state
2. POST /api/execution/:id/approve transitions state to EXECUTING
3. POST /api/execution/:id/reject transitions state to REJECTED
4. 409 Conflict returned if approve called on non-PENDING pipeline
5. Execution cannot begin until state is EXECUTING (gate enforced in code)
6. approver_name captured from request body during approval
```

**State Transition Test:**
```bash
# Get last pipeline ID
PIPELINE_ID=$(curl -s http://localhost:8000/api/pipeline/last | jq -r '.pipeline_id')

# Verify it starts in PENDING
curl -s http://localhost:8000/api/execution/$PIPELINE_ID/status | jq '.state'
# Expected: "PENDING"

# Test double-approve returns 409
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:8000/api/execution/$PIPELINE_ID/approve \
  -H "Content-Type: application/json" \
  -d '{"approver_name":"audit_operator"}'
# First call: 200

curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:8000/api/execution/$PIPELINE_ID/approve \
  -H "Content-Type: application/json" \
  -d '{"approver_name":"audit_operator"}'
# Second call: 409
```

**PASS Criteria:**
- [ ] New pipelines register as PENDING
- [ ] First approve call → 200, state transitions to EXECUTING
- [ ] Second approve call on same pipeline → 409 Conflict
- [ ] Reject endpoint transitions state to REJECTED
- [ ] Execution blocked if state ≠ EXECUTING
- [ ] `approver_name` stored in pipeline record

---

### [AUD-M12] Module 12 — Kahn's Topological DAG Sorter
**Antigravity Sub-Agent:** DAG Sorter Tester

**Code Inspection (Claude Code):**
```
Inspect backend/src/utils/dag-sorter.ts and verify:
1. Kahn's algorithm implemented (in-degree tracking, queue-based BFS)
2. Cycle detection: when topological sort cannot complete all nodes, cycle is confirmed
3. graph_cycle_detected event logged to trace on cycle discovery
4. Fallback to priority-descending flat sort when cycle detected
5. Output is a sorted array where each action's dependencies appear before it
6. The sorted order is deterministic given the same input graph
```

**Cycle Detection Test (Claude Code generates test):**
```
Ask Claude Code to write a unit test for dag-sorter.ts that:
1. Creates a valid DAG: A→B→C and verifies topological order
2. Creates a circular DAG: A→B→C→A and verifies cycle is detected
3. Verifies the fallback sort is priority-descending when cycle occurs
Run: APP_ENV=development npx ts-node src/utils/test-dag-sorter.ts
```

**PASS Criteria:**
- [ ] Valid DAG returns correct topological order
- [ ] Circular reference triggers `graph_cycle_detected` trace event
- [ ] Fallback sort is priority-descending (CRITICAL → HIGH → MEDIUM → LOW)
- [ ] Infinite loop impossible (confirmed: cycle detection exits cleanly)
- [ ] Sort is deterministic for same input

---

### [AUD-M13] Module 13 — Execution Simulator + Failure Recovery
**Antigravity Sub-Agent:** Execution & Recovery Tester

**Code Inspection (Claude Code):**
```
Inspect backend/src/agents/execution-simulator.agent.ts and failure-recovery.agent.ts:
1. Sequential iteration through Kahn-sorted action chain confirmed
2. At least one action has simulated failure injection (random or deterministic)
3. Failure recovery evaluates: RETRY (with backoff), FALLBACK, SKIP in that priority order
4. RETRY: re-executes up to 3 times with exponential backoff
5. SKIP: taints downstream nodes — all child actions in depends_on chain are cascade-skipped
6. Cascade skip marks affected nodes as SKIPPED with reason "upstream_failure"
7. recovery_strategy logged per failed action in trace
8. RecoveryPlanEntry type used in type system
```

**Functional Failure & Recovery Test:**
```bash
# Approve the pipeline to start execution
curl -s -X POST http://localhost:8000/api/execution/$PIPELINE_ID/approve \
  -H "Content-Type: application/json" \
  -d '{"approver_name":"audit_operator"}'

# Poll until COMPLETED or FAILED
sleep 10

# Check for recovery events
curl -s http://localhost:8000/api/pipeline/$PIPELINE_ID/trace | \
  jq '[.events[] | select(.type == "failure_recovery")] | length'
# Expected: ≥ 1 recovery event

# Check cascade skips
curl -s http://localhost:8000/api/pipeline/$PIPELINE_ID | \
  jq '[.execution_results[] | select(.status == "SKIPPED")] | length'
# Expected: ≥ 0 (≥1 if any upstream failure occurred)
```

**PASS Criteria:**
- [ ] At least 1 action failure is simulated in the execution chain
- [ ] RETRY with backoff attempted before SKIP
- [ ] Recovery strategy logged per failed action
- [ ] Cascade skips applied to all downstream dependents on SKIP
- [ ] SKIPPED nodes have `reason: "upstream_failure"` in their execution record
- [ ] Pipeline eventually reaches COMPLETED or FAILED (no infinite hang)

---

### [AUD-M14] Module 14 — Outcome Visualizer + Workflow Audit
**Antigravity Sub-Agent:** Audit & Outcome Tester

**Outcome Visualizer Check (Claude Code):**
```
Inspect backend/src/agents/outcome-visualizer.agent.ts and verify:
1. Before/after state computed for: total_cost, risk_level, operational_efficiency
2. Simulated cost totaled from all executed actions
3. Risk reduction percentage calculated
4. Latency saved metric included
5. Projected impact over 90-day horizon referenced
```

**Workflow Audit Check (Claude Code):**
```
Inspect backend/src/agents/workflow-audit.agent.ts and verify:
1. SHA-256 hash computed over receipt content (deterministic)
2. audit_id generated uniquely per pipeline
3. verification_hash field populated in output
4. signature_block contains: approver, timestamp, pipeline_id
5. finalized_status present: "PASS" | "FAIL" | "PARTIAL"
6. Audit receipt written to audit-logs/ directory
7. NO direct disk I/O from any other agent (only workflow-audit writes files)
8. Event count included in receipt
```

**SHA-256 Verification Test:**
```bash
# Retrieve the completed pipeline audit receipt
curl -s http://localhost:8000/api/pipeline/$PIPELINE_ID/audit | \
  jq '{
    audit_id: .audit_id,
    hash_present: (.verification_hash | length > 0),
    hash_length: (.verification_hash | length),
    approver: .signature_block.approver,
    status: .finalized_status
  }'
# Expected: hash_present=true, hash_length=64 (SHA-256 hex), status present
```

**Audit Log File Persistence Test:**
```bash
ls -la content-action-agent/backend/audit-logs/ | grep $PIPELINE_ID
# Expected: at least 1 file matching the pipeline_id
```

**PASS Criteria:**
- [ ] Before/after state comparison present in outcome visualization
- [ ] SHA-256 `verification_hash` is 64-character hex string
- [ ] `audit_id` is unique
- [ ] `signature_block.approver` matches operator name from HITL approval
- [ ] `finalized_status` populated
- [ ] Audit log file written to `audit-logs/` directory
- [ ] No other agent writes to disk (only workflow-audit)

---

### [AUD-ORCH] Orchestrator — Full Pipeline End-to-End Integration
**Antigravity Sub-Agent:** Orchestrator E2E Tester

**Code Inspection (Claude Code):**
```
Inspect backend/src/agents/ orchestrator file and verify:
1. Modules 1-7 run in correct sequence (ingestion → credibility → noise → contradiction → insight → temporal+conflict in parallel)
2. Promise.all used for parallel execution of Temporal Analysis + Conflict Resolution
3. Modules 8-9 (impact → action chain) run sequentially after phase 1
4. HITL gate intercepts between Module 9 and Module 11
5. Contract validator called after each module (not just at the end)
6. Antigravity trace events emitted at each transition: agent_start, agent_complete, contract_check
7. ai_provider_used field present in the trace output
```

**Full End-to-End Timing Test:**
```bash
time curl -s -X POST http://localhost:8000/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d @content-action-agent/backend/test-data/full-test-request.json \
  | jq '.pipeline_id'
# Should complete ingestion→proposal in < 60 seconds
```

**Trace Completeness Check:**
```bash
curl -s http://localhost:8000/api/pipeline/$PIPELINE_ID/trace | \
  jq '{
    total_events: (.events | length),
    agent_starts: [.events[] | select(.type=="agent_start")] | length,
    contract_checks: [.events[] | select(.type=="contract_check")] | length,
    provider_logged: (.events[] | select(.ai_provider_used != null) | .ai_provider_used) | length > 0
  }'
```

**PASS Criteria:**
- [ ] ≥ 14 `agent_start` events in trace (one per module)
- [ ] ≥ 14 `contract_check` events in trace (one per module)
- [ ] `ai_provider_used` field present in trace events
- [ ] Temporal Analysis and Conflict Resolution show parallel execution timestamps
- [ ] Pipeline completes ingestion-to-proposal phase in < 60 seconds
- [ ] HITL gate prevents execution from starting without approval

---

### [AUD-CONTRACT] Contract Enforcement Layer (AMCE-Inspired)
**Antigravity Sub-Agent:** Contract Compliance Tester

**YAML Contract File Audit:**
```bash
ls content-action-agent/backend/src/contracts/definitions/
# Expected: ≥ 10 YAML contract files (one per module minimum)
```

**Validator Logic Check (Claude Code):**
```
Inspect backend/src/contracts/validator.ts and verify:
1. Structural validation: field presence, type checks, enum membership, min/max ranges, regex patterns
2. Semantic validation: llmClient used for divergence checks on LLM outputs
3. Three enforcement modes implemented: BLOCK (rejects), QUARANTINE (flags), WARN (logs)
4. REJECT triggers re-generation attempt before final failure
5. Contract version management: registry tracks version string per contract
6. Validation history is queryable at GET /api/validations
```

**Enforcement Mode Test:**
```bash
# Test that BLOCK mode actually blocks pipeline on schema violation
curl -s -X POST http://localhost:8000/api/debug/contract-validate \
  -H "Content-Type: application/json" \
  -d '{
    "contract_id": "multi_source_ingestion_v1",
    "payload": {"sources": []}
  }' | jq '.decision'
# Expected: "REJECT" (empty sources array violates min_items: 5)
```

**PASS Criteria:**
- [ ] ≥ 10 YAML contract definitions present
- [ ] All three enforcement modes (BLOCK/QUARANTINE/WARN) implemented
- [ ] Empty sources array triggers REJECT decision
- [ ] Rejected outputs trigger re-generation (retry logic present)
- [ ] Semantic validation via llmClient confirmed in code
- [ ] Validation history endpoint returns previous decisions

---

### [AUD-STRESS] Five Canonical Stress Tests
**Antigravity Sub-Agent:** Stress Test Runner

#### Stress Test 1 — Maximum Source Divergence
```bash
curl -s -X POST http://localhost:8000/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d @content-action-agent/backend/test-data/stress-test-1-divergent-sources.json \
  | jq '{
    contradictions: .analysis.contradictions | length,
    conflicts_detected: (.analysis.contradictions | length > 0),
    resolution_attempted: (.analysis.resolutions | length > 0)
  }'
```
**PASS:** ≥ 2 contradictions detected, ≥ 1 resolution attempted

#### Stress Test 2 — Budget Constraint Violation
```bash
# Action with estimated_cost > constraint budget
curl -s -X POST http://localhost:8000/api/debug/constraint-validate \
  -H "Content-Type: application/json" \
  -d '{"actions":[{"action_id":"ACT-OVER","estimated_cost":999999}],"constraints":{"budget":500000}}' \
  | jq '.results[0].status'
# Expected: "REJECTED"
```
**PASS:** REJECTED with reason `exceeds_budget_constraint`, alternative action suggested

#### Stress Test 3 — Action Failure & Retry Sequence
```bash
curl -s http://localhost:8000/api/pipeline/$PIPELINE_ID/trace | \
  jq '[.events[] | select(.type=="failure_recovery" and .recovery_strategy=="RETRY")] | length'
# Expected: ≥ 1 RETRY event
```
**PASS:** At least 1 RETRY recovery event logged, success on subsequent attempt

#### Stress Test 4 — Low-Credibility Outlier Signal
```bash
curl -s -X POST http://localhost:8000/api/debug/credibility-filter \
  -H "Content-Type: application/json" \
  -d '{
    "sources":[
      {"source_id":"LOW-CRED","credibility_score":15,"claim":"Stock is at critical zero"},
      {"source_id":"HIGH-1","credibility_score":85,"claim":"Stock at adequate 400 units"},
      {"source_id":"HIGH-2","credibility_score":90,"claim":"Stock at 380 units"},
      {"source_id":"HIGH-3","credibility_score":80,"claim":"Stock at 420 units"}
    ]
  }' | jq '.low_credibility_ignored | length'
# Expected: 1 (LOW-CRED ignored)
```
**PASS:** Low-credibility source ignored, logged as `"Ignored: low credibility outlier"`

#### Stress Test 5 — Cascading Budget Side Effect
```bash
# After executing a high-cost emergency action, verify subsequent action budget re-validation
curl -s http://localhost:8000/api/pipeline/$PIPELINE_ID/trace | \
  jq '[.events[] | select(.type=="budget_revalidation")] | length'
# Expected: ≥ 1 budget revalidation event after emergency action execution
```
**PASS:** Budget ledger updated after each execution, downstream actions re-validated against updated budget

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 2 — WEB FRONTEND (NEXT.JS) AUDIT
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> **Antigravity Directive:** Start the web frontend:
> ```bash
> cd content-action-agent/frontend && npm run dev &
> # Wait 5 seconds, then verify: curl -s http://localhost:3000 | grep "<html"
> ```

---

### [AUD-FE-01] Transport Layer Hook — `useLiveTrace.ts`
**Antigravity Sub-Agent:** Frontend Hook Inspector (Claude Code)
```
Inspect frontend/src/features/execution/hooks/useLiveTrace.ts and verify:
1. LiveTraceState interface exported with fields:
   - events: TraceEvent[]
   - status: LiveTraceStatus
   - pipelineState: 'PENDING' | 'EXECUTING' | 'REJECTED' | 'COMPLETED' | 'idle'
   - proposal: StrategyProposal | null
   - auditRecord: WorkflowAudit | null
2. EventSource connection established against /api/pipeline/:id/stream
3. Message handler for 'hitl_pending' event transitions pipelineState to 'PENDING'
4. Message handler for 'hitl_approved' event transitions pipelineState to 'EXECUTING'
5. Message handler for 'agent_complete' event appends to events array
6. Final receipt captured when 'pipeline_complete' event fires
7. Cleanup: EventSource properly closed on component unmount
```

**PASS Criteria:**
- [ ] All 5 fields of `LiveTraceState` present with correct types
- [ ] EventSource lifecycle correctly managed (open, message, error, close)
- [ ] `pipelineState` transitions confirmed for `hitl_pending` and `hitl_approved` events
- [ ] `proposal` populated from `hitl_pending` event payload
- [ ] `auditRecord` populated from `pipeline_complete` event payload
- [ ] No memory leaks: EventSource closed in cleanup function

---

### [AUD-FE-02] Two-Phase Split Interface — `page.tsx`
**Antigravity Sub-Agent:** Frontend Page Inspector (Claude Code)
```
Inspect frontend/src/app/pipeline/[pipeline_id]/page.tsx and verify:
1. Component uses useLiveTrace hook to get pipelineState and proposal
2. Conditional rendering: pipelineState === 'PENDING' && proposal → render <HITLApprovalPhase>
3. Otherwise → render <LiveExecutionPhase>
4. Both phase components receive correct props
5. No direct execution logic in page.tsx (delegated to child components)
6. Loading state handled when pipelineState === 'idle'
```

**PASS Criteria:**
- [ ] Phase split boundary implemented exactly as specified
- [ ] `HITLApprovalPhase` rendered when `pipelineState === 'PENDING'`
- [ ] `LiveExecutionPhase` rendered for all other executing/completed states
- [ ] Props correctly passed: `pipelineId`, `proposal`, `events`, `status`, `auditRecord`
- [ ] TypeScript `use(params)` pattern used for Next.js dynamic route params

---

### [AUD-FE-03] HITL Approval Sub-Component — `HITLApprovalPhase.tsx`
**Antigravity Sub-Agent:** HITL UI Inspector (Claude Code)
```
Inspect frontend/src/features/execution/components/HITLApprovalPhase.tsx and verify:
1. Action list rendered using topological (Kahn-sorted) order based on depends_on arrays
2. Visual dependency hierarchy shown (parent actions appear above children)
3. Approve button triggers: prompt for operator name → POST /api/execution/${pipelineId}/approve
4. Reject button triggers: POST /api/execution/${pipelineId}/reject
5. 409 Conflict error handled with destructive Toast notification
6. Loading/disabled states applied to buttons during API call
7. Operator name is required input (cannot approve with empty name)
```

**Browser Smoke Test:**
```bash
# Open browser to pipeline page for a PENDING pipeline
curl -s http://localhost:3000/pipeline/$PIPELINE_ID
# Verify 200 response and page renders
```

**PASS Criteria:**
- [ ] Action list renders in topological dependency order
- [ ] Approve and Reject buttons present
- [ ] Operator name input required before approval
- [ ] 409 error produces destructive Toast (not a silent failure)
- [ ] Buttons disabled during API call (no double-submit)

---

### [AUD-FE-04] DAG Node Dependency Visualization
**Antigravity Sub-Agent:** DAG UI Inspector (Claude Code)
```
Inspect frontend/src/features/execution/components/ for DAG visualization and verify:
1. depends_on arrays from each action are rendered visually (not dropped/ignored)
2. Parent-child relationships shown (arrows, indentation, or graph canvas)
3. Parallel actions (no mutual dependencies) shown at same level
4. At least a topological card list is rendered if full graph canvas is not implemented
5. Each action card shows: action_id, title, priority badge, estimated_cost, depends_on list
```

**PASS Criteria:**
- [ ] `depends_on` data is NOT dropped from UI rendering
- [ ] Visual hierarchy or dependency indicators present
- [ ] Each action card shows action_id and priority badge
- [ ] Estimated cost shown in PKR format

---

### [AUD-FE-05] Failure Recovery SKIPPED Node Visualization
**Antigravity Sub-Agent:** Execution UI Inspector (Claude Code)
```
Inspect frontend/src/features/execution/components/LiveExecutionPhase.tsx (or AgentReasoningLedger):
1. Execution results parse RecoveryPlanEntry type
2. SKIPPED status nodes rendered with muted/gray visual style (not plain text errors)
3. SKIPPED badge applied to affected child nodes
4. Cascade skip reason shown: "upstream_failure" in node details
5. RETRY events shown with attempt counter badge
6. FALLBACK events shown with alternative path indicator
```

**PASS Criteria:**
- [ ] SKIPPED nodes have distinct muted/gray visual treatment
- [ ] `SKIPPED` badge visible on cascade-skipped nodes
- [ ] Recovery strategy (RETRY/FALLBACK/SKIP) shown per failed action
- [ ] Not just plain text errors — structured recovery state UI

---

### [AUD-FE-06] Cryptographic Compliance Certificate — `AuditCertificate.tsx`
**Antigravity Sub-Agent:** Audit UI Inspector (Claude Code)
```
Inspect frontend/src/features/execution/components/AuditCertificate.tsx and verify:
1. Component only renders when pipeline is COMPLETED and auditRecord is non-null
2. Fields rendered: audit_id, verification_hash (SHA-256), signature_block.approver, finalized_status
3. verification_hash styled distinctively (monospace, colored, break-all for long hash)
4. Card border uses emerald/green color scheme (compliance visual signal)
5. "Cryptographic Compliance Receipt Verified" header present
6. AuditCertificate component wired into LiveExecutionPhase when auditRecord is available
```

**PASS Criteria:**
- [ ] Component exists with correct field mapping to `WorkflowAudit` schema
- [ ] `verification_hash` displayed in styled monospace format
- [ ] Emerald/green compliance visual theme confirmed in JSX
- [ ] Component conditionally rendered only when `auditRecord !== null`
- [ ] `audit_id`, `approver`, and `finalized_status` all rendered

---

### [AUD-FE-07] Web Frontend OpenAPI Type Alignment
**Antigravity Sub-Agent:** Type Safety Inspector (Claude Code)
```
Inspect frontend/src/types/openapi.d.ts and verify:
1. StrategyProposal type matches backend output schema
2. WorkflowAudit type matches backend audit receipt schema  
3. TraceEvent type matches backend trace event schema
4. ActionNode type matches backend ProposedAction schema
5. All component prop types reference these OpenAPI-derived types (no inline any types)
```

**PASS Criteria:**
- [ ] `StrategyProposal`, `WorkflowAudit`, `TraceEvent`, `ActionNode` all present in types
- [ ] No `any` types in component prop definitions
- [ ] Types match backend output shapes (verify by cross-referencing with backend interfaces)

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 3 — MOBILE APP (EXPO) AUDIT
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> **Antigravity Directive:** Verify mobile project builds before testing modules:
> ```bash
> cd content-action-agent/mobile && npx expo start --non-interactive &
> sleep 10
> # Confirm Metro bundler starts without errors
> ```

---

### [AUD-MOB-01] Dynamic Operator Identity (Zero Hardcoding Compliance)
**Antigravity Sub-Agent:** Mobile Config Inspector (Claude Code)
```
Inspect the entire mobile/src/ directory and verify:
1. ZERO occurrences of hardcoded 'OPERATOR_HANDLE' constant strings
2. All operator identity references use: process.env.EXPO_PUBLIC_OPERATOR_HANDLE
3. When EXPO_PUBLIC_OPERATOR_HANDLE is undefined/empty at runtime:
   - Operator Provisioning/Registration screen renders automatically
   - This screen captures user credentials via a form
   - After submission, identity stored securely in expo-secure-store
4. API client uses: process.env.EXPO_PUBLIC_API_BASE_URL
5. API client has documented fallback URL structure in .env file
```

**Hardcoded String Check:**
```bash
grep -rn "OPERATOR_HANDLE\s*=\s*['\"]" content-action-agent/mobile/src/ 2>&1
# Expected: 0 matches
grep -rn "EXPO_PUBLIC_OPERATOR_HANDLE" content-action-agent/mobile/src/ 2>&1
# Expected: ≥ 1 match in config or service file
```

**PASS Criteria:**
- [ ] Zero hardcoded `OPERATOR_HANDLE` string assignments in source code
- [ ] `EXPO_PUBLIC_OPERATOR_HANDLE` read from environment in config
- [ ] Operator Provisioning screen component exists and renders when env var is absent
- [ ] Provisioned identity written to `expo-secure-store` (not AsyncStorage)
- [ ] `EXPO_PUBLIC_API_BASE_URL` used in API client

---

### [AUD-MOB-02] Hardware-Backed Cryptographic Signing Service
**Antigravity Sub-Agent:** Biometric Security Inspector (Claude Code)
```
Inspect mobile/src/services/BiometricSecurityService.ts and verify:
1. expo-local-authentication used to check hardware biometric availability
2. Biometric authentication gate fires BEFORE signature generation
3. SHA-256 HMAC computed over: (deviceSecret + pipelineId + rationale) concatenated
4. deviceSecret generated once and stored in expo-secure-store (pinned secret)
5. expo-crypto used for SHA-256 HMAC computation
6. Output signature is hex-encoded string
7. approved_by constructed as: "${operatorHandle}::[SHA256_HEX_SIGNATURE]"
8. Signature function rejects if biometric auth fails (error thrown, not silent)
```

**Code Verification Commands:**
```bash
grep -n "expo-local-authentication\|expo-secure-store\|expo-crypto" \
  content-action-agent/mobile/src/services/BiometricSecurityService.ts

grep -n "SHA256\|hmac\|digest\|CryptoDigestAlgorithm" \
  content-action-agent/mobile/src/services/BiometricSecurityService.ts

grep -n "approved_by\|::\[" \
  content-action-agent/mobile/src/services/BiometricSecurityService.ts
```

**PASS Criteria:**
- [ ] `expo-local-authentication` import confirmed
- [ ] `expo-secure-store` import confirmed
- [ ] `expo-crypto` import confirmed
- [ ] HMAC computation uses all three inputs: deviceSecret, pipelineId, rationale
- [ ] deviceSecret persisted in secure store (generated once)
- [ ] `approved_by` string format: `"operatorHandle::[hexsig]"` confirmed
- [ ] Biometric failure throws error (no silent approval)
- [ ] Function is async with proper try/catch

---

### [AUD-MOB-03] Type Safety Contracts Boundary — `pipeline.ts`
**Antigravity Sub-Agent:** Mobile Type Inspector (Claude Code)
```
Inspect mobile/src/types/pipeline.ts and verify all required interfaces/types:
1. PipelineStatus: 'INITIALIZED'|'PROCESSING'|'PENDING'|'EXECUTING'|'SUCCESS'|'FAILED'
2. SourceType: 'PDF'|'CSV'|'TXT'|'URL'
3. RawSource: { source_id, source_type: SourceType, content, metadata }
4. ActionNode: { action_id, title, description, priority, depends_on[], estimated_cost }
5. StrategyProposal: { proposal_id, actions: ActionNode[], created_at }
6. TraceEvent: { event_id, type, timestamp, module, payload }
7. No implicit 'any' types anywhere in this file
```

**PASS Criteria:**
- [ ] All 6 type definitions present with correct field shapes
- [ ] `PipelineStatus` is a union type with all 6 status strings
- [ ] `SourceType` is a union type with all 4 source type strings
- [ ] No `any` types in the file
- [ ] Types mirror backend interface shapes

---

### [AUD-MOB-04] Document Ingestion Service — `IngestionService.ts`
**Antigravity Sub-Agent:** Ingestion Service Inspector (Claude Code)
```
Inspect mobile/src/services/IngestionService.ts and verify:
1. expo-document-picker used for file selection dialog
2. expo-file-system used to read selected file contents as string
3. Supported file types: PDF, CSV, TXT
4. Payload assembler compiles RawSource[] array from selections
5. RawSource[] payload dispatched to POST /api/pipeline/run endpoint
6. API base URL from process.env.EXPO_PUBLIC_API_BASE_URL
7. Empty payload '{}' toggle exists for demo mode (backend disk-ingestion fallback)
8. Error handling covers: picker cancellation, file read failure, network error
```

**PASS Criteria:**
- [ ] `expo-document-picker` import confirmed
- [ ] `expo-file-system` import confirmed for file content reading
- [ ] All 3 file types (PDF, CSV, TXT) handled
- [ ] `RawSource[]` type used in payload assembler
- [ ] Empty payload `{}` demo mode toggle exists
- [ ] Async error handling covers all failure points

---

### [AUD-MOB-05] Multi-Channel Pipeline State Hook — `useStandalonePipeline.ts`
**Antigravity Sub-Agent:** Mobile State Hook Inspector (Claude Code)
```
Inspect mobile/src/hooks/useStandalonePipeline.ts and verify:
1. react-native-event-source used for SSE streaming from /api/pipeline/:id/stream
2. Polling fallback implemented: timer-based polling of /api/execution/:id/status
3. Polling activates when: network drops, app backgrounds, EventSource errors
4. ClientPipelineStatus synthesis: 4 discrete backend phase routes mapped to unified client status
5. BFF Pattern: view is isolated from backend schema changes via ClientPipelineStatus
6. Backend in-memory drop detected and surfaced as user notification
7. Terminal SUCCESS state triggers: pull of /api/execution/:id/audit endpoint
8. On SUCCESS: WorkflowAuditAgent SHA-256 hash extracted from audit payload
9. On SUCCESS: hash committed to expo-secure-store as immutable local ledger entry
10. Verified audit proof displayed on monitor screen (not hidden in storage only)
```

**Code Verification:**
```bash
grep -n "EventSource\|event-source\|EventSource" \
  content-action-agent/mobile/src/hooks/useStandalonePipeline.ts

grep -n "setInterval\|polling\|poll" \
  content-action-agent/mobile/src/hooks/useStandalonePipeline.ts

grep -n "expo-secure-store\|SecureStore" \
  content-action-agent/mobile/src/hooks/useStandalonePipeline.ts

grep -n "verification_hash\|SHA256\|audit" \
  content-action-agent/mobile/src/hooks/useStandalonePipeline.ts
```

**PASS Criteria:**
- [ ] `react-native-event-source` import confirmed
- [ ] Timer-based polling fallback implemented
- [ ] Polling activates on EventSource error
- [ ] `ClientPipelineStatus` type defined and used (BFF pattern)
- [ ] `/api/execution/:id/audit` call triggered on SUCCESS
- [ ] `verification_hash` extracted from audit response
- [ ] Hash stored in `expo-secure-store` as immutable ledger entry
- [ ] Audit verification status exposed in hook return value for UI display

---

### [AUD-MOB-06] Ingestion Staging Screen — `IngestionStagingScreen.tsx`
**Antigravity Sub-Agent:** Mobile UI Inspector (Claude Code)
```
Inspect mobile/src/screens/IngestionStagingScreen.tsx and verify:
1. File picker button calls IngestionService.pickDocuments()
2. Text snippet editor allows manual text input as an additional source
3. Selected sources displayed in a scrollable list before submission
4. "Run Pipeline" button calls IngestionService.submitPipeline()
5. "Demo Mode" toggle sends empty payload {} (backend disk-ingestion fallback)
6. Loading state shown during pipeline initialization
7. On success, navigates/transitions to OperationalMonitorScreen
8. Error states shown for: no sources selected, API unreachable
```

**PASS Criteria:**
- [ ] File picker integration present
- [ ] Text snippet editor present
- [ ] Demo mode toggle exists
- [ ] Navigation to monitor screen on success
- [ ] Error states handled and displayed

---

### [AUD-MOB-07] Operational Monitor Screen — `OperationalMonitorScreen.tsx`
**Antigravity Sub-Agent:** Monitor Screen Inspector (Claude Code)
```
Inspect mobile/src/screens/OperationalMonitorScreen.tsx and verify:
1. useStandalonePipeline hook drives all data
2. Real-time trace events rendered in scrollable list (dark theme)
3. When pipelineStatus === 'PENDING': interactive action card overlay renders
4. Action card overlay shows the strategy proposal action list
5. "Approve" button in overlay triggers biometric authentication flow
6. BiometricSecurityService.signApproval() called with pipelineId + rationale
7. On biometric success: POST to approve endpoint with signed approved_by string
8. Audit verification proof shown when pipeline reaches SUCCESS:
   - SHA-256 hash from local secure store displayed
   - "Verified" badge shown
9. Screen handles all PipelineStatus states gracefully (loading, processing, pending, executing, success, failed)
```

**PASS Criteria:**
- [ ] Dark-themed UI confirmed in JSX/styles
- [ ] Trace events list renders in real-time
- [ ] PENDING state shows biometric approval overlay
- [ ] Biometric sign → POST approve flow confirmed
- [ ] SUCCESS state shows audit verification hash and "Verified" badge
- [ ] All 6 PipelineStatus states have UI representation

---

### [AUD-MOB-08] App Entry Point — `App.tsx`
**Antigravity Sub-Agent:** App Structure Inspector (Claude Code)
```
Inspect mobile/App.tsx and verify:
1. Single-state toggle architecture (not a heavy navigation framework)
2. Two primary views wired: IngestionStagingScreen and OperationalMonitorScreen
3. State variable controls which screen is shown (e.g., activeScreen or currentPipelineId)
4. Operator Provisioning screen shown first if EXPO_PUBLIC_OPERATOR_HANDLE absent
5. Clean TypeScript — no any types, no implicit returns
```

**PASS Criteria:**
- [ ] Two-screen toggle architecture implemented
- [ ] No React Navigation overhead (single state variable pattern)
- [ ] Operator Provisioning gate present
- [ ] No TypeScript errors in App.tsx

---

### [AUD-MOB-09] Mobile Dependency Compliance
```bash
cd content-action-agent/mobile
cat package.json | jq '.dependencies | keys[]'
```

**PASS Criteria (all packages must be present):**
- [ ] `expo-secure-store`
- [ ] `expo-local-authentication`
- [ ] `expo-crypto`
- [ ] `expo-document-picker`
- [ ] `expo-file-system`
- [ ] `react-native-event-source`

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 4 — ANTIGRAVITY INTEGRATION AUDIT (20% SCORE WEIGHT)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> This section specifically validates Antigravity's role as the primary orchestrator.
> Every item here directly maps to the 20% "Antigravity Integration" evaluation criterion.

---

### [AUD-AG-01] Antigravity Trace Completeness
**Antigravity Self-Audit:** Run a complete pipeline and inspect your own trace output.

**Required Trace Sections:**
```bash
curl -s http://localhost:8000/api/pipeline/$PIPELINE_ID/trace | \
  jq '{
    has_workplan: (. | has("workplan")),
    has_task_plan: (. | has("task_plan")),
    has_reasoning_steps: (.events | map(select(.type == "reasoning_step")) | length > 0),
    has_tool_calls: (.events | map(select(.type == "tool_call")) | length > 0),
    has_decisions: (.events | map(select(.type == "decision")) | length > 0),
    has_failures: (.events | map(select(.type == "failure")) | length > 0),
    has_recovery: (.events | map(select(.type == "failure_recovery")) | length > 0),
    has_provider_info: (.events | map(select(.ai_provider_used != null)) | length > 0)
  }'
```

**PASS Criteria — All fields must be `true`:**
- [ ] `has_workplan: true`
- [ ] `has_task_plan: true`
- [ ] `has_reasoning_steps: true` (≥ 1 reasoning_step event)
- [ ] `has_tool_calls: true` (≥ 1 tool_call event)
- [ ] `has_decisions: true` (≥ 1 decision event)
- [ ] `has_failures: true` (≥ 1 failure event)
- [ ] `has_recovery: true` (≥ 1 failure_recovery event)
- [ ] `has_provider_info: true` (ai_provider_used field present)

---

### [AUD-AG-02] Antigravity as Sole Orchestrator
**Antigravity Self-Audit:**
```
Verify in your own configuration and in backend/src/agents/ that:
1. The pipeline orchestrator IS invoked through Antigravity's agent framework
2. No module bypasses Antigravity to call the backend directly outside of the trace
3. All 14 agent sub-tasks appear in the Antigravity task plan
4. Antigravity workplan shows the complete pipeline phases (Phase 1→2→3→4)
```

**PASS Criteria:**
- [ ] 14 sub-tasks visible in Antigravity task plan
- [ ] All agent completions logged through Antigravity trace collector
- [ ] `ai_provider_used: "vertex-ai"` OR `"gemini-free"` OR `"groq"` in trace events

---

### [AUD-AG-03] Antigravity Reasoning Chain Quality
**Antigravity Self-Audit:**
```
Review the reasoning_step events in your trace output and confirm:
1. Each module logs its reasoning: WHY a specific decision was made
2. Contradiction detection: reasoning explains which claims conflict and why
3. Conflict resolution: reasoning explains which source was prioritized and why
4. Action chain generation: reasoning explains why 3-5 actions were chosen
5. Failure recovery: reasoning explains why RETRY vs FALLBACK vs SKIP was chosen
```

**PASS Criteria:**
- [ ] ≥ 5 distinct reasoning steps logged across the full pipeline trace
- [ ] Contradiction detection reasoning present with specifics
- [ ] Failure recovery reasoning present with strategy justification
- [ ] Multi-step decision chains traceable in the trace output

---

### [AUD-AG-04] Demo Video Trace Requirement
**Antigravity Sub-Agent:** Demo Readiness Verifier
```
Simulate the exact demo day flow (7 segments) and verify Antigravity trace captures all:
Segment 1: Context setup (5 sources ingested → trace shows ingestion events)
Segment 2: Contradiction discovery (trace shows contradiction_detected events)
Segment 3: Conflict resolution (trace shows resolution events + reasoning)
Segment 4: HITL gate (trace shows hitl_pending → hitl_approved events)
Segment 5: Failure & recovery (trace shows failure → retry → success events)
Segment 6: Outcome (trace shows outcome_visualization event with before/after)
Segment 7: Trace viewer shows workplan/task/reasoning/tools/recovery + ai_provider_used
```

**PASS Criteria:**
- [ ] Trace viewer shows all 7 demo segment events in correct order
- [ ] `ai_provider_used: "vertex-ai"` visible in trace for demo day (when production env used)
- [ ] Trace can be exported as JSON for the judges

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 5 — DEPLOYMENT & ACCESSIBILITY AUDIT
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### [AUD-DEPLOY-01] Backend — Cloud Run Accessibility
```bash
# Replace with actual Cloud Run URL
CLOUD_RUN_URL="https://your-backend.run.app"
curl -s $CLOUD_RUN_URL/health | jq '.status'
# Expected: "ok"

curl -s -o /dev/null -w "%{http_code}" $CLOUD_RUN_URL/api/contracts
# Expected: 200
```
**PASS Criteria:**
- [ ] `/health` endpoint returns `{"status":"ok"}`
- [ ] CORS configured to allow Firebase frontend URL
- [ ] `/api/contracts` accessible without auth

---

### [AUD-DEPLOY-02] Frontend — Firebase Hosting Accessibility
```bash
FIREBASE_URL="https://your-app.web.app"
curl -s -o /dev/null -w "%{http_code}" $FIREBASE_URL
# Expected: 200

# Verify frontend connects to Cloud Run backend (not localhost)
curl -s $FIREBASE_URL | grep -i "cloud_run_url\|EXPO_PUBLIC_API_BASE_URL" || true
```
**PASS Criteria:**
- [ ] Firebase URL returns 200
- [ ] Frontend configured to point to Cloud Run URL (not localhost:8000)
- [ ] Pipeline page accessible at `$FIREBASE_URL/pipeline`

---

### [AUD-DEPLOY-03] Production Environment Switch
```bash
cd content-action-agent/backend
APP_ENV=production npx ts-node src/utils/test-llm-client.ts 2>&1 | head -5
# Expected first line: [LLMClient] Initialized in production mode → primary: vertex-ai
```
**PASS Criteria:**
- [ ] Production mode initializes with `vertex-ai` as primary
- [ ] Vertex AI keys loaded from `.env.production`
- [ ] Fallback chain to `gemini-free` → `groq` accessible

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 6 — HACKATHON EVALUATION CRITERIA ALIGNMENT AUDIT
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Criterion | Weight | Audit Section | Status |
|:---|:---:|:---|:---:|
| Antigravity Integration | 20% | AUD-AG-01 through AUD-AG-04 | ⬜ |
| Agentic Reasoning & Workflow | 20% | AUD-M01 through AUD-ORCH | ⬜ |
| Insight Quality & Contradiction Handling | 20% | AUD-M04, AUD-M05, AUD-M07 | ⬜ |
| Action Chain & Outcome Simulation | 15% | AUD-M09, AUD-M11, AUD-M13, AUD-M14 | ⬜ |
| Robustness, Scalability, Cost & Latency | 15% | AUD-STRESS, AUD-M10, AUD-M12 | ⬜ |
| Innovation & UX | 10% | AUD-FE-*, AUD-MOB-*, AUD-CONTRACT | ⬜ |

**Antigravity Directive:** Fill in the Status column with PASS / WARN / FAIL after completing each section. This table becomes the executive summary of the audit.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 7 — FINAL AUDIT RECEIPT GENERATION
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Antigravity Final Directive:** After all sections complete, generate and emit the following AuditSummaryReceipt:

```json
{
  "receipt_type": "SYSTEM_AUDIT_RECEIPT",
  "project": "Autonomous Content-to-Action Agent",
  "hackathon": "InnoCollab AI Seekho 2026 — Challenge 1",
  "audit_timestamp": "<ISO-8601 timestamp>",
  "orchestrator": "Google Antigravity",
  "total_checks": "<number>",
  "pass_count": "<number>",
  "warn_count": "<number>",
  "fail_count": "<number>",
  "sections": {
    "environment": "<PASS|WARN|FAIL>",
    "backend_14_modules": "<PASS|WARN|FAIL>",
    "contract_enforcement": "<PASS|WARN|FAIL>",
    "stress_tests": "<PASS|WARN|FAIL>",
    "web_frontend": "<PASS|WARN|FAIL>",
    "mobile_app": "<PASS|WARN|FAIL>",
    "antigravity_integration": "<PASS|WARN|FAIL>",
    "deployment": "<PASS|WARN|FAIL>"
  },
  "documentation_gate": "<AUTHORIZED|BLOCKED>",
  "verification_hash": "<SHA-256 of entire receipt payload>",
  "remediation_items": [
    { "check_id": "<id>", "issue": "<description>", "fix": "<instruction>" }
  ]
}
```

**Gate Rule:**
- `documentation_gate: "AUTHORIZED"` only when `fail_count === 0`
- `documentation_gate: "BLOCKED"` if `fail_count > 0`
- All remediation items must be resolved before documentation generation begins

---

## APPENDIX A — QUICK-REFERENCE FILE MAP

| File | Audit Check |
|:---|:---|
| `backend/src/utils/llm-client.ts` | AUD-ENV-05, AUD-ENV-06, AUD-ENV-07 |
| `backend/src/agents/multi-source-ingestion.agent.ts` | AUD-M01 |
| `backend/src/agents/credibility-scorer.agent.ts` | AUD-M02 |
| `backend/src/agents/noise-filter.agent.ts` | AUD-M03 |
| `backend/src/agents/contradiction-detector.agent.ts` | AUD-M04 |
| `backend/src/agents/insight-extraction.agent.ts` | AUD-M05 |
| `backend/src/agents/temporal-analysis.agent.ts` | AUD-M06 |
| `backend/src/agents/conflict-resolution.agent.ts` | AUD-M07 |
| `backend/src/agents/impact-scorer.agent.ts` | AUD-M08 |
| `backend/src/agents/strategic-recommender.agent.ts` | AUD-M09 |
| `backend/src/agents/execution-simulator.agent.ts` | AUD-M10, AUD-M11 |
| `backend/src/utils/dag-sorter.ts` | AUD-M12 |
| `backend/src/agents/failure-recovery.agent.ts` | AUD-M13 |
| `backend/src/agents/outcome-visualizer.agent.ts` | AUD-M14 |
| `backend/src/agents/workflow-audit.agent.ts` | AUD-M14 |
| `backend/src/contracts/validator.ts` | AUD-CONTRACT |
| `backend/src/contracts/definitions/*.yaml` | AUD-CONTRACT |
| `frontend/src/features/execution/hooks/useLiveTrace.ts` | AUD-FE-01 |
| `frontend/src/app/pipeline/[pipeline_id]/page.tsx` | AUD-FE-02 |
| `frontend/src/features/execution/components/HITLApprovalPhase.tsx` | AUD-FE-03 |
| `frontend/src/features/execution/components/AuditCertificate.tsx` | AUD-FE-06 |
| `frontend/src/types/openapi.d.ts` | AUD-FE-07 |
| `mobile/src/services/BiometricSecurityService.ts` | AUD-MOB-02 |
| `mobile/src/services/IngestionService.ts` | AUD-MOB-04 |
| `mobile/src/types/pipeline.ts` | AUD-MOB-03 |
| `mobile/src/hooks/useStandalonePipeline.ts` | AUD-MOB-05 |
| `mobile/src/screens/IngestionStagingScreen.tsx` | AUD-MOB-06 |
| `mobile/src/screens/OperationalMonitorScreen.tsx` | AUD-MOB-07 |
| `mobile/App.tsx` | AUD-MOB-08 |

---

## APPENDIX B — KNOWN GAPS FROM PREVIOUS AUDIT (MUST BE RESOLVED)

The following items were identified in the previous `post_audit_report.md` and were NOT resolved. This audit **must confirm each is now fixed:**

| Gap ID | Original Issue | Verification Check |
|:---|:---|:---|
| **GAP-01** | HITL PENDING state omitted from UI — users could not approve/reject | AUD-FE-02, AUD-FE-03 |
| **GAP-02** | DAG depends_on arrays dropped from frontend rendering | AUD-FE-04 |
| **GAP-03** | Failure recovery SKIPs shown as plain text errors (not SKIPPED badges) | AUD-FE-05 |
| **GAP-04** | WorkflowAudit SHA-256 hash not surfaced to browser | AUD-FE-06 |

**All four gaps must show PASS in this audit for the frontend section to be considered complete.**

---

## APPENDIX C — DEMO DAY READINESS QUICK CHECKLIST

Before submitting, verify all of these independently:

```
[ ] Backend starts in BOTH development and production modes without errors
[ ] 5+ sources can be ingested simultaneously (parallel ingestion confirmed)
[ ] At least 2 contradictions detected in full test run
[ ] Action chain produces exactly 3-5 actions
[ ] At least 1 action fails and recovers (RETRY confirmed in trace)
[ ] Budget constraint violation caught (over-budget action REJECTED)
[ ] Cascade skip confirmed on downstream actions after upstream failure
[ ] Before/after state shown with total cost and risk reduction
[ ] SHA-256 verification hash visible in web frontend AuditCertificate
[ ] SHA-256 hash stored in mobile secure store and shown on monitor screen
[ ] Biometric authentication required before mobile HITL approval
[ ] Antigravity trace shows: workplan, task plan, reasoning, tool calls, failures, recovery, provider
[ ] "ai_provider_used": "vertex-ai" visible in trace when running in production mode
[ ] Cloud Run backend publicly accessible
[ ] Firebase frontend publicly accessible
[ ] Mobile app runs on Android/iOS without Metro errors
[ ] All 5 stress tests pass
[ ] TypeScript: 0 errors, 0 warnings across all 3 projects
[ ] ESLint: 0 problems across all 3 projects
[ ] README documents: architecture, data sources, tools, Antigravity role, environment strategy, cost/latency, limitations
[ ] Demo video recorded: 4:30 min, shows all 7 segments, recorded in production mode (Vertex AI)
```

---

*This audit prompt was designed for Google Antigravity as the primary orchestrating agent. All checks are executable within the Antigravity terminal environment. Sub-agent tasks are delegated to Claude Code running inside Antigravity for code inspection tasks. The final AuditSummaryReceipt with SHA-256 verification hash serves as the official pre-documentation gate clearance.*
