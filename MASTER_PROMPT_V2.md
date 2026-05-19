# MASTER PROMPT V2 — Supply Chain Intelligence Agent
## InnoCollab AI Seekho 2026 — Challenge 1: Autonomous Content-to-Action Agent

> **⏰ HARD DEADLINE: May 20, 2026. Built INSIDE Google Antigravity IDE with Claude Code.**
> 
> This document is the SINGLE SOURCE OF TRUTH. It supersedes all previous versions.

---

## ROLE & CONTEXT

You are an expert full-stack AI systems architect building a **production-grade hackathon prototype** for Challenge 1: Autonomous Content-to-Action Agent.

**Domain (LOCKED):** Industrial Supply Chain & Logistics — Pakistan Corridor Model

This is NOT a summarizer. It is an **enterprise-grade agentic pipeline** that:
- Ingests **5+ sources in parallel** across 5 distinct types (PDF, CSV, JSON, URL, real-time feed)
- Applies **tabular-to-text serialization** so structured data never hallucinates in RAG
- Detects **explicit, implicit, and self-contradictions** using normalized claim comparison
- Resolves conflicts BEFORE extracting insights (M7 before M5 — correct pipeline ordering)
- Generates **3-5 interconnected action chains** with topological dependency validation
- Validates constraints via **Saga-pattern ledger** (reserve → commit / refund, never simple deduct)
- Simulates execution via **level-parallel DAG executor** (concurrent non-dependent actions)
- Handles **deterministic failure injection** with selective rollback and recovery cost tracking
- Validates critical modules via **AMCE contract enforcement** (base model on M5 and M9 only)
- Shows **before/after state, baseline comparison, residual risk, cost/latency metrics**
- Produces **complete Antigravity traces** with inter-module data lineage

**Tech Stack:**
```
Backend:    Express.js + Node.js + TypeScript
            Zod (validation), Winston (logging), better-sqlite3 (storage)
            pdf-parse, cheerio, papaparse (ingestion)

AI APIs:    Gemini 1.5 Flash   — primary LLM (free: 15 req/min)
            Gemini 1.5 Pro     — AMCE base model, M5 & M9 only (free)
            text-embedding-004 — embeddings (free)
            Groq Llama-3.1-70b — automatic fallback on rate limit
            Vertex AI Gemini   — demo day only (GCP credits)

Frontend:   React 18 + TypeScript + TailwindCSS + Recharts
            Server-Sent Events for live pipeline progress

Mobile:     Expo (React Native) → APK via EAS Build (MANDATORY)

Platform:   Google Antigravity IDE — all development happens INSIDE it
```

---

## DOMAIN SCENARIO (LOCKED)

**Scenario: "Inventory Shortage Crisis — Lahore Distribution Hub"**

| # | Type | File | Age | Role | Key Signal | Contradiction Seed |
|---|------|------|-----|------|------------|-------------------|
| 1 | PDF | Warehouse Audit Report | 7 days old | context | SKU-1234: 500 units | STALE vs real-time complaints |
| 2 | CSV | Supplier Performance Dashboard | Real-time | context | Supplier delayed, reliability 0.92→0.61 | "Active" old rows vs "Delayed" new |
| 3 | JSON | Procurement Budget & Rules | Current | constraint | Emergency cap PKR 500K | Hard budget constraint |
| 4 | URL | News: Customs Strike Karachi | Today | context | Why supplier delayed | Port 24/7 vs trucks stalled |
| 5 | Feed | Customer Complaints (8 entries) | Last 4h | trigger | "SKU-1234 out of stock" | Contradicts PDF's 500 units |

---

## PIPELINE ARCHITECTURE

```
PHASE A — DATA PREPARATION (M1 → M2 → M3)
  M1: Multi-Source Ingestion
      ├── Promise.allSettled (circuit breaker — partial failures don't crash pipeline)
      ├── Tabular-to-Text Serialization for CSV/JSON (prevents RAG hallucination)
      ├── Source role classification (trigger / context / constraint)
      ├── Chunking at ingestion time (text=500-token chunks, structured=row-per-chunk)
      └── Input size limits enforced
  M2: Source Credibility Scorer
      ├── 3-axis scoring (recency 0-40, authority 0-30, quality 0-30)
      ├── Domain-aware authority map (supply chain specific)
      ├── Min-axis thresholds (can't be HIGH if any axis < 15)
      └── Human-readable scoring narrative for trace logs
  M3: Noise Filter & Deduplication
      ├── 3-tier similarity (>0.85 DUPLICATE, 0.60-0.85 CORROBORATING, <0.60 INDEPENDENT)
      ├── Spam detection (special chars, promo language, too short)
      ├── Cross-format semantic dedup (CSV row vs PDF paragraph with same data)
      └── Minimum sources guard (restore stale sources if too few remain)

PHASE B — CONFLICT ANALYSIS (M4 → M7) ← CORRECT ORDER: Resolve BEFORE insights
  M4: Contradiction Detector
      ├── Claim normalization (raw text → canonical {topic, entity, value, unit, type})
      ├── Structured-to-claim bridge (CSV rows → normalized claims for cross-format detection)
      ├── 4 explicit types (numeric, boolean, categorical, temporal)
      ├── Implicit contradiction detection (computed: stock/demand ≠ claimed duration)
      ├── Self-contradiction detection (within single source across pages)
      └── Three-way+ conflict handling (credibility-ranked multi-source resolution)
  M7: Conflict Resolution Logic
      ├── 5 strategies (trust_credible, trust_recent, aggregate, request_clarification, human_review)
      ├── Dynamic confidence calibration (credibility gap → confidence score)
      ├── State mutation: writes to PipelineState.resolvedFacts Map
      ├── Cascading check: does resolution create NEW contradictions?
      └── All downstream modules READ resolvedFacts first, raw sources second

PHASE C — INTELLIGENCE (M5 → M6) ← USES RESOLVED DATA ONLY
  M5: RAG-Powered Insight Extraction
      ├── Per-pipeline vector store (created, used, destroyed — no cross-run contamination)
      ├── Serialized tabular chunks (not raw CSV) prevent hallucination
      ├── Multi-query retrieval (5 domain-specific analytical questions, not one generic embed)
      ├── Insight deduplication (>0.80 embedding similarity → merge)
      └── AMCE BLOCK + BASE MODEL validation (critical decision input)
  M6: Temporal Analysis Engine
      ├── Structured time-series from CSV/JSON (direct extraction)
      ├── Unstructured temporal claims via LLM (relative dates → absolute)
      ├── Pattern detection: decline, spike, drift, anomaly, stable
      ├── Minimum sample guard (< 3 data points → "insufficient_data")
      └── Statistical trend with confidence (R² for linear regression)

PHASE D — DECISION MAKING (M8 → M9 → M10)
  M8: Impact Analysis with Constraints
      ├── Constraint tradeoff modeling (cost vs time options with reasoning)
      └── Quantified impact: cost PKR, affected customers, risk probability
  M9: Action Chain Generator
      ├── 3-5 interconnected actions (validated: at least 2 have dependencies)
      ├── Topological sort validation (circular dep check, orphan ref check)
      ├── Dependency graph with execution order
      ├── Alternative action generation when M10 rejects infeasible actions
      └── AMCE BLOCK + BASE MODEL validation (critical for simulation)
  M10: Constraint Validation via Saga Ledger
      ├── reserveFunds(actionId, amount) — escrow, not deduct
      ├── Actions validated in execution order (cumulative budget deduction)
      └── Infeasible actions: suggest specific constraint relaxations

PHASE E — EXECUTION (M11 → M12)
  M11: Action Chain Simulator (Level-Parallel DAG)
      ├── Group actions by dependency level → run each level via Promise.allSettled
      ├── State machine: explicit before/after SupplyChainState transitions
      ├── Deterministic failure injection (forcedFailures config, reproducible tests)
      ├── State invariant checks (no negative budget, no negative stock)
      ├── On success: ledger.commit(actionId)
      └── On failure: signal "pending_refund" to Module 12
  M12: Failure Recovery & Rollback Engine
      ├── FIRST: ledger.refund(actionId) — release escrowed funds
      ├── THEN: select strategy (retry, fallback, partial_rollback, graceful_skip)
      ├── Selective rollback (only undo failed action's state, preserve prior successes)
      ├── Recovery cost tracking (additional time, cost, pipeline delay)
      └── Re-reserve for retry/fallback before executing

PHASE F — REPORTING (M13 → M14)
  M13: Outcome Visualization
      ├── Before/after state diff (added, removed, modified, unchanged)
      ├── Action execution timeline (timestamps, status, cost, duration per action)
      ├── Residual risk assessment (remaining risk factors + active mitigations)
      ├── Baseline comparison (agentic vs simple heuristic — REQUIRED by FAQ)
      └── Cost/scalability note (cost per pipeline, 10x/100x scaling — REQUIRED by FAQ)
  M14: Agentic Workflow Trace & Audit Logs
      ├── Inter-module data lineage (from → to → data type → key change)
      ├── Aggregate pipeline metrics (single-glance summary for judges)
      ├── Workplan + task plan + reasoning steps + tool calls
      └── Decisions, failures, recovery, provider info

AMCE CONTRACT ENFORCEMENT (cross-cutting, selective):
  M1-M4, M6-M8, M10-M14: Zod structural validation only (ALERT_ONLY/QUARANTINE)
  M5 and M9: BLOCK + Gemini 1.5 Pro base model validation (2 extra LLM calls total)
```

---

## CROSS-CUTTING INFRASTRUCTURE (Phase 0 — COMPLETED)

### Universal JSON Parser
```typescript
// backend/src/utils/llm-output-parser.ts
import { ZodSchema } from 'zod';

export function extractJson(raw: string): unknown {
    let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    const start = Math.min(firstBrace >= 0 ? firstBrace : Infinity, firstBracket >= 0 ? firstBracket : Infinity);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start === Infinity || end < 0) throw new Error('No JSON found in LLM output');
    cleaned = cleaned.substring(start, end + 1)
        .replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/:\s*undefined/g, ': null');
    return JSON.parse(cleaned);
}

export function validateLLMOutput<T>(raw: string, schema: ZodSchema<T>): T {
    const parsed = extractJson(raw);
    const result = schema.safeParse(parsed);
    if (!result.success) throw new Error(`Schema validation: ${result.error.message}`);
    return result.data;
}
```

### Tabular-to-Text Serializer
```typescript
// backend/src/utils/tabular-serializer.ts
export function serializeCSVRow(row: Record<string, any>, columns: string[]): string {
    const parts: string[] = [];
    if (row.Date || row.date || row.timestamp) parts.push(`As of ${row.Date ?? row.date ?? row.timestamp}`);
    const entityFields = ['Supplier_ID', 'supplier_id', 'SKU', 'sku', 'Product', 'product_id'];
    for (const f of entityFields) { if (row[f]) parts.push(`${f.replace(/_/g, ' ')} ${row[f]}`); }
    const skip = new Set(['Date', 'date', 'timestamp', ...entityFields]);
    for (const col of columns) {
        if (skip.has(col) || row[col] === undefined) continue;
        parts.push(`${col.replace(/_/g, ' ').toLowerCase()}: ${row[col]}`);
    }
    return parts.join(', ') + '.';
}

export function serializeJSONDocument(data: Record<string, any>, path = ''): string[] {
    const sentences: string[] = [];
    for (const [key, value] of Object.entries(data)) {
        const label = key.replace(/_/g, ' ');
        const fullPath = path ? `${path} ${label}` : label;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sentences.push(...serializeJSONDocument(value, fullPath));
        } else {
            const fv = typeof value === 'number' && value > 999 ? value.toLocaleString() : String(value);
            sentences.push(`The ${fullPath} is ${fv}.`);
        }
    }
    return sentences;
}
```

### Saga Constraint Ledger (Reserve → Commit / Refund)
```typescript
// backend/src/simulation/saga-constraint-ledger.ts
interface Reservation { action_id: string; amount_pkr: number; time_hours: number; status: 'reserved'|'committed'|'refunded'; }

export class SagaConstraintLedger {
    private totalBudgetPKR: number;
    private totalTimeHours: number;
    private reservations = new Map<string, Reservation>();
    public auditLog: string[] = [];

    constructor(budget: number, timeHours: number) {
        this.totalBudgetPKR = budget;
        this.totalTimeHours = timeHours;
    }

    reserveFunds(actionId: string, amountPKR: number, timeHours: number): { approved: boolean; reason?: string } {
        const available = this.getAvailableBudget();
        if (amountPKR > available) return { approved: false, reason: `Needs PKR ${amountPKR}, available PKR ${available}` };
        this.reservations.set(actionId, { action_id: actionId, amount_pkr: amountPKR, time_hours: timeHours, status: 'reserved' });
        this.auditLog.push(`RESERVED: ${actionId} — PKR ${amountPKR}`);
        return { approved: true };
    }

    commit(actionId: string): void {
        const r = this.reservations.get(actionId);
        if (!r || r.status !== 'reserved') throw new Error(`Cannot commit ${actionId}`);
        r.status = 'committed';
        this.auditLog.push(`COMMITTED: ${actionId} — PKR ${r.amount_pkr}`);
    }

    refund(actionId: string): void {
        const r = this.reservations.get(actionId);
        if (!r || r.status !== 'reserved') throw new Error(`Cannot refund ${actionId}`);
        r.status = 'refunded';
        this.auditLog.push(`REFUNDED: ${actionId} — PKR ${r.amount_pkr} released`);
    }

    getAvailableBudget(): number {
        const locked = [...this.reservations.values()]
            .filter(r => r.status === 'reserved' || r.status === 'committed')
            .reduce((s, r) => s + r.amount_pkr, 0);
        return this.totalBudgetPKR - locked;
    }

    getSpentBudget(): number {
        return [...this.reservations.values()].filter(r => r.status === 'committed').reduce((s, r) => s + r.amount_pkr, 0);
    }
}
```

### LLM Client (Multi-Provider, Cost Tracking, Auto-Fallback)
```typescript
// backend/src/utils/llm-client.ts — supports gemini (dev), groq (fallback), vertex (production)
// Auto-selects provider based on APP_ENV
// Tracks: module, purpose, provider, model, tokens, latency, attempt number
// Falls back: vertex → gemini-free → groq (pipeline never breaks)
// See MASTER_PROMPT_ENTERPRISE_FINAL.md for full implementation
```

### Pipeline State (Shared Across All Modules)
```typescript
// backend/src/agents/pipeline-state.ts
export interface PipelineState {
    pipeline_id: string;
    rawSources: NormalizedSource[];           // Phase A
    ingestionFailures: Array<{source_id: string; error: string}>;
    credibilityScores: CredibilityScore[];
    filteredSources: FilteredSources;
    similarityLinks: SimilarityLink[];        // corroborating pairs
    contradictions: Contradiction[];          // Phase B
    resolvedFacts: Map<string, ResolvedFact>; // KEY: downstream reads here first
    insights: Insight[];                      // Phase C (from resolved data)
    temporalPatterns: TemporalPattern[];
    impactAnalyses: ImpactAnalysis[];         // Phase D
    actionChain: ActionChain;
    constraintLedger: SagaConstraintLedger;
    simulationResults: ActionExecutionResult[]; // Phase E
    recoveryPlans: RecoveryPlan[];
    outcome: OutcomeVisualization;            // Phase F
    baselineComparison: BaselineComparison;
    trace: AntigravityTrace;
}
```

---

## MODULE SPECIFICATIONS (Phases 1-4)

*Each module below includes: purpose, key interfaces, implementation notes, LLM prompts where applicable, edge cases handled, and AMCE contract mode. Full code is in MASTER_PROMPT_ENTERPRISE_FINAL.md — reference it for complete implementations.*

### Module 1: Multi-Source Content Ingestion

**Purpose:** Ingest 5+ sources simultaneously. Classify roles. Serialize tabular data. Chunk at ingestion time.

**Key Design Decisions:**
- `Promise.allSettled` not `Promise.all` — one corrupt PDF doesn't crash the pipeline
- CSV/JSON rows serialized to natural language BEFORE chunking (prevents RAG hallucination)
- Sources classified as `trigger` (complaints), `context` (PDF, news), `constraint` (budget JSON)
- Minimum 3 sources must succeed or pipeline aborts with clear error
- Input limits: PDF 10MB/50 pages, CSV 5MB/10K rows, URL timeout 10s

**Edge Cases:** Corrupted PDF (catch → mark failed), URL 404 (mark failed), CSV wrong delimiter (auto-detect), empty/image-only PDF (confidence 0), Urdu encoding (force UTF-8), all sources fail (abort with message), real-time feed >100 entries (sample 25).

**AMCE:** ALERT_ONLY — structural Zod validation only.

### Module 2: Source Credibility Scorer

**Purpose:** Score on 3 axes with domain-aware authority map and minimum-axis thresholds.

**Supply Chain Authority Map:** Internal audit: 30, Supplier official: 28, Procurement system: 27, Industry report: 22, Verified news: 18, Customer complaints: 12, Social/anonymous: 5.

**Tier Rules:** HIGH requires total ≥ 70 AND min(axes) ≥ 15. MEDIUM requires total ≥ 40 AND authority ≥ 10. LOW ≥ 20. Below = UNVERIFIED.

**Must Produce:** Human-readable scoring narrative for each source (required for trace logs).

**Edge Cases:** No timestamp (recency 0, cap at LOW), future timestamp (treat as now), duplicate source different dates (both scored, M3 handles dedup).

### Module 3: Noise Filter & Deduplication

**Purpose:** 3-tier similarity. Spam detection. Cross-format dedup. Minimum sources guard.

**3-Tier Similarity:** >0.85 = DUPLICATE (remove lower credibility), 0.60-0.85 = CORROBORATING (keep both, link), <0.60 = INDEPENDENT.

**Cross-Format Dedup:** CSV row `SKU-1234,500,Lahore` and PDF paragraph `"500 units of SKU-1234 at Lahore"` — detected as CORROBORATING via claim-level comparison, not text similarity.

**Spam Rules:** Excessive special chars >30%, promo language, <50 chars, only numbers.

**Guard:** If filtering removes too many sources (< 2 kept), restore stale sources with LOW tier and warn.

### Module 4: Contradiction Detector

**Purpose:** Detect explicit, implicit, and self-contradictions using normalized claims.

**Claim Normalization (CRITICAL):** Raw text → `{canonical_topic, canonical_entity, canonical_value, canonical_unit, value_type}`. Example: `"Product unavailable"` → `{topic: "inventory_level", entity: "SKU-1234", value: 0, unit: "units"}`. CSV row → same format via `structuredRowToClaim()`.

**3 Detection Modes:**
1. **Explicit:** Direct value comparison (500 vs 0 units, >20% numeric diff)
2. **Implicit:** Computed — stock 500 / demand 150/day = 3.3 days, but source claims "2 weeks" → contradiction
3. **Self-contradiction:** Within single source across pages/sections

**Three-Way+ Conflicts:** Rank all conflicting claims by credibility, pick highest, compute confidence from credibility gap.

**LLM Prompt:** Extract factual claims in English (handles Urdu/Roman Urdu translation). JSON output with canonical fields. Validated via Zod.

**Edge Cases:** No contradictions found (return empty array, note "high consistency"), all sources contradict (flag all, use credibility ranking, confidence 0.3), self-contradicting source (flag with `subtype: intra_source`).

**AMCE:** QUARANTINE — Zod structural validation, no base model.

### Module 7: Conflict Resolution Logic (RUNS BEFORE M5)

**Purpose:** Resolve contradictions. Write to `PipelineState.resolvedFacts`. All downstream modules read from resolvedFacts.

**5 Strategies:** trust_credible (gap > 30), trust_recent (time diff > 24h), aggregate (slight numeric diffs), request_clarification (equal credibility), human_review (severe + equal).

**Dynamic Confidence:** `confidence = min(0.95, 0.5 + credibilityGap / 200) × strategyMultiplier`.

**State Mutation:** Each resolution writes to `state.resolvedFacts.set(topicKey, { resolved_value, confidence, overridden_sources, investigation_actions })`.

**Cascading Check:** After all resolutions, re-check resolvedFacts map for new contradictions created by resolution.

### Module 5: RAG-Powered Insight Extraction (READS RESOLVED DATA)

**Purpose:** Extract insights from RESOLVED data using multi-query RAG. Deduplicate insights.

**Vector Store:** Per-pipeline-run (created, used, destroyed). Structured sources use pre-serialized chunks (row-per-chunk from M1). Unstructured sources use 500-token text chunks. Rate-limit-safe batched embedding (20 chunks per batch, 200ms delay).

**Multi-Query Retrieval:** 5 domain-specific analytical questions: stock levels/shortages, supply chain disruptions, demand trends, budget constraints, policy/regulatory changes. Up to 25 unique retrieved chunks across all questions.

**Insight Deduplication:** Embed each insight title+description, merge if >0.80 similarity (combine supporting_sources).

**AMCE:** BLOCK + BASE MODEL (Gemini 1.5 Pro validates insight quality).

### Module 6: Temporal Analysis Engine

**Purpose:** Detect temporal patterns from structured time-series (CSV) and LLM-extracted temporal claims.

**Structured Extraction:** Auto-detect date columns and metric columns in CSV. Direct time-series construction.

**Unstructured Extraction:** LLM converts relative dates ("last week", "yesterday") to absolute timestamps.

**Patterns:** decline, spike (>2σ), drift, anomaly, stable. Minimum 3 data points required or return `insufficient_data`.

### Module 8: Impact Analysis with Constraints

**Purpose:** Analyze implications with constraint tradeoff modeling.

**Tradeoff Table:** For each insight, model 2-3 action options with cost_pkr, time_hours, risk_level, feasibility boolean, and reasoning. Example: Ground freight PKR 200K/72h (misses deadline) vs Air freight PKR 450K/12h (meets deadline, within cap).

### Module 9: Action Chain Generator

**Purpose:** Generate 3-5 interconnected actions with validated dependency graph.

**Validation Rules (applied AFTER LLM generation):**
1. All dependency references exist (no orphans)
2. No circular dependencies (topological sort)
3. At least 3, at most 5 actions
4. At least 1 simulatable action
5. At least 2 actions have dependencies (proves "interconnected")

**Alternative Generation:** When M10 rejects an infeasible action, M9 re-prompts LLM with specific constraint relaxation requirements.

**AMCE:** BLOCK + BASE MODEL (Gemini 1.5 Pro validates action quality).

### Module 10: Constraint Validation via Saga Ledger

**Purpose:** Validate each action against cumulative budget using reserve/commit/refund pattern.

**Flow:** For each action in execution order → `ledger.reserveFunds(actionId, cost, time)`. If approved → reservation held for M11. If denied → flag infeasible, trigger M9 alternative generation.

### Module 11: Action Chain Simulator (Level-Parallel DAG)

**Purpose:** Execute action chain with concurrent non-dependent actions, deterministic failure injection, state invariant checks.

**Level-Parallel Execution:**
```
Level 0: ACT-001 + ACT-005 (no deps) → run concurrently via Promise.allSettled
Level 1: ACT-002 (depends on ACT-001) → runs after Level 0 completes
Level 2: ACT-003 (depends on ACT-001, ACT-002) → runs after Level 1
Level 3: ACT-004 (depends on ACT-003) → runs after Level 2
```
State mutations happen BETWEEN levels only. No race conditions.

**Deterministic Failure Config:**
```typescript
const DEMO_CONFIG = {
    deterministicMode: true,
    forcedFailures: [{ action_id: 'ACT-003', fail_on_attempt: 1, failure_reason: 'Supplier API timeout' }]
};
```

**On Success:** `ledger.commit(actionId)`, apply state transition, assert invariants.
**On Failure:** Signal `pending_refund` to M12.

**State Invariants:** budget ≥ 0, stock ≥ 0, customers_notified ≥ 0.

### Module 12: Failure Recovery & Rollback Engine

**Purpose:** Refund BEFORE recovering. Selective rollback. Track recovery costs.

**Flow:**
1. `ledger.refund(failedActionId)` — release escrowed funds
2. Select strategy: retry (re-reserve funds), fallback (reserve for fallback action), partial_rollback (undo only this action's state), graceful_skip
3. Execute recovery
4. Track: retry_attempts, additional_time_ms, additional_cost_pkr

### Module 13: Outcome Visualization

**Purpose:** State diff, timeline, residual risk, baseline comparison, cost report.

**Baseline Comparison (REQUIRED by FAQ):**
```
Simple Heuristic:                    Agentic System:
- No contradiction detection         - 3 contradictions detected + resolved
- Trusted stale PDF (wrong)          - Correctly identified stale data
- 1 generic action                   - 5 interconnected actions
- No constraint check                - Saga ledger with PKR tracking
- No failure recovery                - Retry succeeded on ACT-003
- Cost: PKR 600K (over-ordered)      - Cost: PKR 455K (optimized)
- Risk reduction: 40%                - Risk reduction: 80%
```

**Cost/Scalability Note (REQUIRED by FAQ):**
```
Cost per pipeline: ~$0.002 (free tier) | ~$0.05 (Vertex AI)
10x scale: Queue pipelines, Groq fallback for rate limits
100x scale: Need paid tier, message queue, horizontal workers
Latency: ~30-60s per pipeline (14 modules + 2 base model checks)
```

### Module 14: Agentic Workflow Trace

**Purpose:** Complete Antigravity trace with data lineage and aggregate metrics.

**Data Lineage:** For each module pair: from → to → data_type → record_count → transformation → key_change.

**Aggregate Metrics:** sources_ingested, contradictions_detected, contradictions_resolved, insights_extracted, actions_generated, actions_succeeded, actions_failed, failures_recovered, contract_validations, total_cost, total_duration, llm_calls, estimated_cost_usd.

---

## BACKEND ARCHITECTURE

```
backend/
├── src/
│   ├── index.ts                              # Express app, CORS, health check, correlation ID
│   ├── config.ts                             # Environment config (APP_ENV=development|production)
│   ├── routes/
│   │   ├── pipeline.routes.ts                # POST /api/pipeline/run, GET /api/pipeline/:id
│   │   ├── pipeline-stream.routes.ts         # GET /api/pipeline/:id/stream (SSE progress)
│   │   ├── contracts.routes.ts               # GET /api/contracts
│   │   └── health.routes.ts                  # GET /api/health
│   ├── agents/
│   │   ├── pipeline-state.ts                 # Shared mutable state across modules
│   │   ├── multi-source-ingestion.agent.ts   # M1
│   │   ├── credibility-scorer.agent.ts       # M2
│   │   ├── noise-filter.agent.ts             # M3
│   │   ├── contradiction-detector.agent.ts   # M4
│   │   ├── conflict-resolution.agent.ts      # M7 (runs after M4, before M5)
│   │   ├── insight-extraction.agent.ts       # M5
│   │   ├── temporal-analysis.agent.ts        # M6
│   │   ├── impact-analysis.agent.ts          # M8
│   │   ├── action-chain-generator.agent.ts   # M9
│   │   └── orchestrator.ts                   # Main pipeline: Phase A→B→C→D→E→F
│   ├── contracts/
│   │   ├── registry.ts                       # Load YAML contracts
│   │   ├── validator.ts                      # Zod structural validation
│   │   ├── base-model-benchmark.ts           # Gemini Pro validation for M5, M9
│   │   ├── decision-gate.ts                  # PASS/WARN/REJECT logic
│   │   └── definitions/*.yaml               # Contract YAML files
│   ├── simulation/
│   │   ├── saga-constraint-ledger.ts         # Reserve/commit/refund pattern
│   │   ├── dag-executor.ts                   # Level-parallel DAG execution
│   │   ├── failure-recovery.ts               # Refund → retry/fallback/rollback
│   │   ├── state-machine.ts                  # SupplyChainState transitions + invariants
│   │   └── outcome-visualizer.ts             # Diff, timeline, baseline, cost report
│   ├── rag/
│   │   ├── vector-store.ts                   # In-memory per-pipeline, cosine similarity
│   │   ├── retriever.ts                      # Multi-query retrieval (5 domain questions)
│   │   └── chunker.ts                        # Text chunking (PDF/URL) — CSV uses serialized rows
│   ├── tracing/
│   │   ├── collector.ts                      # TraceCollector singleton
│   │   ├── data-lineage.ts                   # Inter-module data flow tracking
│   │   └── exporter.ts                       # Export to JSON for frontend/submission
│   ├── utils/
│   │   ├── llm-client.ts                     # Multi-provider (gemini/groq/vertex) with fallback
│   │   ├── llm-output-parser.ts              # Universal JSON parser
│   │   ├── tabular-serializer.ts             # CSV/JSON → natural language sentences
│   │   ├── logger.ts                         # Winston structured logging
│   │   └── cosine-similarity.ts              # Vector math
│   └── database/
│       └── db.ts                             # better-sqlite3 for pipeline history
├── test/
│   └── stress-tests.ts                       # 5 deterministic stress tests
├── demo-data/                                # 5 mock source files
├── package.json
├── tsconfig.json
└── .env
```

---

## FRONTEND ARCHITECTURE (React Web Dashboard — Phase 5)

```
frontend/
├── src/
│   ├── App.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx                     # Main pipeline execution page
│   │   ├── PipelineResults.tsx               # Full results view
│   │   └── TraceViewer.tsx                   # Antigravity trace visualization
│   ├── components/
│   │   ├── InputPanel.tsx                    # 5 source upload + constraint inputs + "Analyze" button
│   │   ├── PipelineProgress.tsx              # SSE-powered real-time module status (✓/⚠/✗)
│   │   ├── CredibilityTable.tsx              # Source scores with domain-aware authority breakdown
│   │   ├── ContradictionViewer.tsx           # Conflicting claims side-by-side + resolution
│   │   ├── InsightCards.tsx                  # Insights with severity badges + supporting sources
│   │   ├── ActionChainGraph.tsx              # Dependency graph visualization (nodes + arrows)
│   │   ├── SagaLedgerTracker.tsx             # Reserve/commit/refund timeline (PKR tracker)
│   │   ├── SimulationDiff.tsx                # Before/after state comparison table
│   │   ├── FailureRecoveryLog.tsx            # Failure → refund → retry → success timeline
│   │   ├── BaselineComparison.tsx            # Agentic vs heuristic side-by-side metrics
│   │   ├── CostReport.tsx                    # Cost per module, total, scalability note
│   │   ├── AgentTraceFlow.tsx                # Visual flowchart: Phase A→B→C→D→E→F
│   │   └── DataLineageTable.tsx              # Inter-module data flow (from → to → key change)
│   ├── hooks/
│   │   └── usePipeline.ts                    # API hooks + SSE connection
│   └── utils/
│       └── api.ts                            # Axios client (auto-selects backend URL by env)
```

**Key Frontend Requirements:**
- Real-time SSE progress (not spinner) — show which module is running with status indicators
- Contradiction viewer must show credibility scores and resolution reasoning
- Saga ledger tracker shows reserve → commit / refund flow visually (PKR bar chart)
- Baseline comparison is a visual side-by-side card (required for submission)
- Trace viewer must be expandable tree with data lineage
- Color-code: green = pass/success, yellow = warn/QUARANTINE, red = fail/BLOCK

---

## MOBILE APP (Expo — Phase 5, APK MANDATORY)

```
mobile/
├── App.tsx
├── screens/
│   ├── HomeScreen.tsx                        # Text input + file picker + "Analyze" button
│   ├── ResultsScreen.tsx                     # Scrollable cards: insights → contradictions → actions → simulation
│   ├── TraceScreen.tsx                       # Simplified vertical timeline of agent steps
│   └── LedgerScreen.tsx                      # Saga ledger status (budget remaining PKR)
├── components/
│   ├── InsightCard.tsx
│   ├── ContradictionCard.tsx
│   ├── ActionChainCard.tsx
│   ├── SimulationResultCard.tsx
│   └── StatusBadge.tsx                       # PASS/WARN/REJECT visual indicator
├── app.json                                  # Expo config
└── eas.json                                  # EAS Build config for APK generation
```

**APK Build (MANDATORY):**
```bash
npx create-expo-app ContentActionAgent
cd ContentActionAgent
npx eas build --platform android --profile preview
# Output: .apk file for submission
```

---

## DEMO SCENARIO WALKTHROUGH

**Input:** 5 sources uploaded simultaneously with constraints: Budget PKR 500K, Time 24h, Urgency: Critical.

| Module | Output | Key Event |
|--------|--------|-----------|
| **M1** | 5/5 sources ingested (Promise.allSettled) | CSV rows serialized to sentences |
| **M2** | PDF: 45 MEDIUM (stale), CSV: 85 HIGH, JSON: 90 HIGH, News: 60 MEDIUM, Complaints: 75 HIGH | PDF flagged stale |
| **M3** | 1 spam complaint removed, 1 duplicate removed, 3 kept + 2 corroborating links | Spam "Win iPhone" filtered |
| **M4** | 3 contradictions: 500 vs 0 units (CRITICAL), Active vs Delayed supplier (HIGH), Port 24/7 vs trucks stalled (MEDIUM) | Claim normalization catches "unavailable" = 0 units |
| **M7** | Resolved: Trust complaints (credibility 75, fresh) over PDF (credibility 45, stale). Stock ≈ 47 units. | resolvedFacts updated, cascading check clean |
| **M5** | 5 insights extracted from RESOLVED data. Demand spike +30%, supplier reliability decline, stockout risk. | Multi-query retrieval + insight dedup |
| **M6** | Demand: spike pattern (+30% in 3 days). Complaints: spike (8 in 4 hours vs 1/day normal). | CSV time-series extracted directly |
| **M8** | Impact: Stockout in 24h. 200 customers affected. Air freight feasible (PKR 450K, 12h). | Tradeoff: ground (misses deadline) vs air (within cap) |
| **M9** | 5-action chain: verify → notify → order → update → monitor. Topo-sort valid, 3 deps confirmed. | AMCE base model validates chain quality |
| **M10** | All 5 actions reserved via Saga ledger. Total reserved: PKR 455K < PKR 500K cap. ✓ | Cumulative reservation — not per-action check |
| **M11** | Level 0: ACT-001+ACT-005 (parallel). Level 1: ACT-002. Level 2: ACT-003 **FAILS** (API timeout). | Deterministic failure injection. ledger signals pending_refund. |
| **M12** | Refund ACT-003 (PKR 450K released). Re-reserve for retry. ACT-003 retry: SUCCESS. | Saga ledger: refund → re-reserve → commit |
| **M11** | Level 3: ACT-004 SUCCESS. All committed. | State invariants pass |
| **M13** | Before/after diff. Risk reduced 80%. Cost PKR 455K. Baseline comparison: agentic 2x better. | Residual risk: 15% (order could delay beyond 72h) |
| **M14** | Full trace: 12 lineage steps, 15 tasks, 8 decisions, 1 failure, 1 recovery, 14 contract validations. | Aggregate metrics: 14 LLM calls, ~$0.002 |

---

## STRESS TESTS (DETERMINISTIC — REPRODUCIBLE)

| # | Test Name | What It Proves | Expected Result |
|---|-----------|---------------|-----------------|
| 1 | Three-way conflict | Contradiction handling with 3 conflicting sources | 3 contradictions detected, credibility-ranked resolution |
| 2 | Budget violation | Constraint rejection + alternative generation | ACT-003 rejected (PKR 600K > 500K), cheaper alternative generated |
| 3 | API failure + retry | Saga ledger refund + retry + re-commit | Fail attempt 1 → refund → re-reserve → succeed attempt 2 |
| 4 | Low-credibility outlier | Noise filtering + down-ranking | Unverified source (score 12) ignored, not used for insights |
| 5 | Cascading side effect | Cumulative budget deduction + downstream rejection | ACT-003 (PKR 450K) + ACT-004 (PKR 60K) > remaining → ACT-004 rejected → email alternative |

All tests use `deterministicMode: true` — identical results every run.

---

## EVALUATION CRITERIA ALIGNMENT

| Criteria | Weight | How This System Addresses It |
|----------|--------|------------------------------|
| **Antigravity integration** | 20% | Built INSIDE Antigravity. 2 videos submitted. Full traces with workplan, task plan, data lineage. |
| **Agentic reasoning** | 20% | 14 modules in 6 phases. Clear decision chains. Conflict resolution with investigation paths. |
| **Contradiction handling** | 20% | Normalized claims. 3 detection modes (explicit, implicit, self). Never forces false conclusions. |
| **Action chain simulation** | 15% | 3-5 actions with DAG execution. Saga ledger. Deterministic failure injection. Before/after state. |
| **Robustness, cost, latency** | 15% | 5 stress tests. Saga refund recovery. Cost tracking. Baseline comparison. Scalability analysis. |
| **Innovation & UX** | 10% | AMCE contracts. Saga ledger visualization. Tabular serialization. SSE progress. Mobile APK. |

---

## SUBMISSION CHECKLIST (from FAQ)

| # | Deliverable | Required | Notes |
|---|-------------|----------|-------|
| 1 | **Mobile APK** | MANDATORY | Expo EAS Build → .apk file |
| 2 | Web dashboard | Optional | React + Firebase Hosting |
| 3 | **Product demo video (3-5 min)** | MANDATORY | Input → contradiction → action → failure → recovery → outcome |
| 4 | **Antigravity usage video (2-3 min)** | MANDATORY | Screen recording of coding IN Antigravity |
| 5 | **Antigravity traces/logs** | MANDATORY | 7 artifact JSONs (workplan, tasks, decisions, tools, execution, recovery, outcome) |
| 6 | **README** | MANDATORY | Architecture, schemas, setup, privacy, cost, baseline, limitations |
| 7 | Privacy note | In README | No real data, no PII, synthetic scenarios |
| 8 | Data schemas | In README | All interfaces documented |
| 9 | Setup steps for judges | In README | npm install → npm run dev → curl test |
| 10 | Cost/scalability | In README | Per-pipeline cost, 10x/100x scaling |
| 11 | **Baseline comparison** | MANDATORY | Agentic vs heuristic side-by-side |
| 12 | **Robustness evidence** | MANDATORY | At least 1 failure/recovery demo |

---

## CRITICAL IMPLEMENTATION NOTES

1. **Pipeline ordering:** M4 → M7 → M5 (resolve conflicts BEFORE extracting insights)
2. **Tabular serialization:** CSV/JSON rows become sentences BEFORE embedding (no hallucination)
3. **Saga ledger:** NEVER simple deduct — always reserve → commit / refund
4. **DAG execution:** Level-parallel only — state mutations between levels, never concurrent
5. **AMCE base model:** Only M5 and M9 — saves 12 LLM calls, avoids rate limits
6. **Deterministic failures:** All stress tests use forcedFailures config (reproducible)
7. **2 videos required:** Product demo (3-5 min) + Antigravity usage (2-3 min)
8. **APK mandatory:** Only .apk accepted, not PWA — use Expo EAS Build
9. **Build inside Antigravity:** Not "connect to Antigravity later" — code INSIDE it from Day 1
10. **Start screen recording Day 1:** You need footage for the Antigravity usage video

**Deadline: May 20, 2026. This is your final blueprint. Start building.**
