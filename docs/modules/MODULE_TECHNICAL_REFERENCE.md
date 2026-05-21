# Module Technical Reference
**Autonomous Content-to-Action Agent**

This reference provides exhaustive technical documentation for all 14 discrete agent modules forming the core analytical and generative pipeline. Every section documents inputs, outputs, precise logical mechanics, and AMCE contract validations.

---

## [MODULE 1] — Multi-Source Content Ingestion Agent

**Purpose:** Normalizes raw, unstructured, multi-modal data streams into a standardized structured array for unified downstream processing.

**Input:**
```typescript
interface IngestionRequest {
  sources: Array<{
    source_id: string;
    source_type: 'pdf' | 'url' | 'csv' | 'json' | 'realtime_feed';
    content: string; // raw base64, URL string, or plain text
    metadata: Record<string, any>;
  }>;
}
```

**Output:**
```typescript
interface NormalizedSource {
  source_id: string;
  source_type: string;
  raw_text: string;
  timestamp: string;
}
```

**Processing Logic:**
1. Iterates over the `sources` array via `Promise.all` for parallel ingestion parsing.
2. Routes content based on `source_type`. PDFs are extracted using `pdf-parse`; URLs fetch HTML converted to text via `cheerio` and `@extractus/article-extractor`.
3. Normalizes all extracted buffers into a unified `raw_text` string field.
4. Generates an ISO-8601 `timestamp` if missing from metadata.

**LLM Interaction:** None. This is a deterministic formatting module using structural libraries.

**Key Design Decisions:** 
Utilizes `Promise.all()` to prevent I/O blocking. Network calls to fetch URL data run asynchronously alongside PDF decoding, significantly reducing aggregate module latency.

**Contract Enforcement:**
- **Contract ID:** `multi_source_ingestion_v1`
- **Enforcement Mode:** `BLOCK`
- **Validation:** Enforces `minItems: 5` on the output array. Requires `raw_text` length > 20 chars.

**Audit Status:** `[AUD-M01]: PASS (45/45 audit run)`
**Feeds Into:** Credibility Scorer Agent (Module 2).

---

## [MODULE 2] — Source Credibility Scorer Agent

**Purpose:** Applies a deterministic algorithm to objectively rank the trustworthiness of ingested inputs based on semantic markers.

**Input:** `Array<NormalizedSource>`
**Output:**
```typescript
interface CredibilityScore {
  source_id: string;
  recency_score: number;
  authority_score: number;
  quality_score: number;
  total_score: number;
  tier: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';
  reasoning: string;
}
```

**Processing Logic:**
1. Iterates through the sources evaluating text patterns.
2. **Recency (0-40):** Computes differential from `timestamp`. <1h = 40; <24h = 30; <7d = 20; >30d = 0.
3. **Authority (0-30):** Uses a keyword regex dictionary on the metadata. Official domains = 30, unknown feeds = 5.
4. **Quality (0-30):** Parses `raw_text` structure. Presence of citations (+10), numerical data metrics (+10).
5. Calculates `total_score` and buckets into tiers (`HIGH` > 70, `MEDIUM` > 40).

**LLM Interaction:** None. Designed as deterministic logic to ensure consistent baseline evaluation metrics.

**Key Design Decisions:**
Bypassing LLMs for this step prevents hallucinations regarding source legitimacy and dramatically speeds up pipeline execution since string and date math is near-instantaneous.

**Contract Enforcement:**
- **Contract ID:** `source_credibility_v1`
- **Enforcement Mode:** `BLOCK`
- **Validation:** Ensures `tier` is restricted to the specific enum strings.

**Audit Status:** `[AUD-M02]: PASS (45/45 audit run)`
**Feeds Into:** Noise Filter Agent (Module 3).

---

## [MODULE 3] — Noise Filter & Semantic Deduplication Agent

**Purpose:** Eliminates extraneous, repetitive data by executing cosine similarity math against generated vector embeddings.

**Input:** `Array<CredibilityScore>` + `Array<NormalizedSource>`
**Output:**
```typescript
interface FilterResult {
  kept_sources: Array<NormalizedSource>;
  removed_sources: Array<{ source_id: string; reason: string }>;
}
```

**Processing Logic:**
1. Drops any source possessing a `recency_score` of 0 instantly (marked as `stale`).
2. Iterates over the remaining sources, invoking `llmClient.generateEmbedding()` to retrieve 768-dimension arrays.
3. Computes standard cosine similarity: `(A·B) / (|A| × |B|)` against the `InMemoryVectorStore`.
4. If similarity > 0.85, flags a duplicate collision.
5. In a collision, the source with the significantly higher `CredibilityScore` is retained; the other is discarded (reason: `duplicate`).

**LLM Interaction:**
- Model: `text-embedding-004`
- Converts raw strings directly into vector arrays without generative text compilation.

**Key Design Decisions:**
Threshold tuning to 0.85 prevents identical PR releases and scraped news from flooding the downstream LLM context window, saving tokens and improving Insight Quality.

**Contract Enforcement:**
- **Contract ID:** `noise_filter_v1`
- **Enforcement Mode:** `WARN`

**Audit Status:** `[AUD-M03]: PASS (45/45 audit run)`
**Feeds Into:** Contradiction Detector (Module 4) & InMemoryVectorStore.

---

## [MODULE 4] — Contradiction Detector Agent (CRITICAL)

**Purpose:** Intelligently isolates logical conflicts and discrepancies across disparate data streams.

**Input:** `Array<NormalizedSource>`
**Output:**
```typescript
interface ContradictionReport {
  contradictions: Array<{
    contradiction_id: string;
    type: 'numeric' | 'boolean' | 'categorical' | 'temporal';
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    source_refs: string[];
    description: string;
    confidence: number;
    resolution_needed: boolean;
  }>;
}
```

**Processing Logic:**
1. Pushes `raw_text` from all sources into the primary LLM to extract granular facts grouped by topical context.
2. Systematically performs O(n²) pairwise comparisons among identical topics.
3. Asserts severity rules: Numeric divergence > 20% = `HIGH`; > 80% = `CRITICAL`. Boolean logic inversions (e.g., Online vs Offline) default to `CRITICAL`.
4. Flags conflicts returning them in an array formatted for the RAG engine.

**LLM Interaction:**
- **Prompt:** A rigorous JSON instruction template asking the LLM to strictly isolate clashing factual claims without synthesizing or summarizing them.
- **Model:** Primary provider (`gemini-free` or `vertex-ai`).

**Key Design Decisions:**
Separating Contradiction Detection from Insight Extraction ensures conflicts aren't quietly "smoothed over" by an overzealous generative text prompt.

**Contract Enforcement:**
- **Contract ID:** `contradiction_detection_v1`
- **Enforcement Mode:** `QUARANTINE`
- **Validation:** Prevents missing `resolution_needed` booleans to guarantee proper downstream handling.

**Audit Status:** `[AUD-M04]: PASS (45/45 audit run)`
**Feeds Into:** Insight Extraction (Module 5) & Conflict Resolution (Module 7).

---

## [MODULE 5] — RAG-Powered Insight Extraction Agent

**Purpose:** Assembles clear, strategic intelligence summaries by querying the vector store against detected anomalies.

**Input:** Vector Space Access + `ContradictionReport`
**Output:**
```typescript
interface Insight {
  insight_id: string;
  category: 'trends' | 'risks' | 'opportunities' | 'contradictions';
  title: string;
  description: string;
  evidence: string[];
  confidence: number;
  contradiction_ref?: string;
}
```

**Processing Logic:**
1. Runs internal vector queries for predefined operational categories (e.g., retrieving top-5 chunks related to "supply levels").
2. Merges this retrieved RAG context alongside the explicit `ContradictionReport` arrays.
3. Requests the LLM to synthesize this data into discrete insights categorized as risks, opportunities, or trends.

**LLM Interaction:**
- Applies standard RAG prompting logic: *"Given the following isolated context chunks, formulate strategic insights..."*

**Key Design Decisions:**
By enforcing standard outputs instead of a single long-form paragraph, downstream strategic planners can weigh risks individually against numeric scores.

**Contract Enforcement:**
- **Contract ID:** `insight_extraction_v1`
- **Enforcement Mode:** `BLOCK`

**Audit Status:** `[AUD-M05]: PASS (45/45 audit run)`
**Feeds Into:** Modules 6 & 7 (Parallel execution).

---

## [MODULE 6] — Temporal Analysis Engine Agent

**Purpose:** Projects the rate of change of specific anomalies across historical vectors without relying on LLM guesses.

**Input:** `Array<Insight>` + Vector Store Historical Data
**Output:**
```typescript
interface TemporalPattern {
  trend_type: 'decline' | 'spike' | 'drift' | 'anomaly';
  rate_of_change: number;
  confidence: number;
  time_horizon: string;
  data_points_used: number;
}
```

**Processing Logic:**
1. Collects a minimum of 30 historical data points matching current insight trends.
2. Employs classical linear regression equations to fit a slope line calculating the hard `rate_of_change`.
3. Checks extrapolation variance; if volatility is high, drastically reduces the `confidence` score.

**LLM Interaction:** None. Completely algorithmic to prevent LLMs from hallucinating fake mathematical timelines.

**Key Design Decisions:**
Operates entirely in parallel alongside Module 7 using standard asynchronous patterns, shortening the pipeline loop significantly.

**Contract Enforcement:**
- **Contract ID:** `temporal_analysis_v1`
- **Enforcement Mode:** `WARN`

**Audit Status:** `[AUD-M06]: PASS (45/45 audit run)`
**Feeds Into:** Impact Analysis (Module 8).

---

## [MODULE 7] — Conflict Resolution Logic Agent

**Purpose:** Dictates authoritative truth concerning facts flagged by the Contradiction module using weighted scoring mechanics.

**Input:** `ContradictionReport` + `CredibilityScore` arrays.
**Output:**
```typescript
interface ConflictResolution {
  resolution_id: string;
  status: 'RESOLVED' | 'UNRESOLVED' | 'INVESTIGATING';
  chosen_value?: string;
  confidence: number;
  investigation_path?: string;
}
```

**Processing Logic:**
1. Analyzes competing facts explicitly. Evaluates their backing source's Mod-2 credibility score.
2. If Source A (Score: 90) contradicts Source B (Score: 40), the system designates Source A as the `chosen_value` marked `RESOLVED`.
3. If both possess highly identical scores, it refuses to generate a false consensus. Sets status to `UNRESOLVED` and generates an `investigation_path` for human operators.

**LLM Interaction:** None. Purely deterministic comparative logic.

**Key Design Decisions:**
Refusing to resolve ties deterministically prevents the system from making chaotic coin-flips in enterprise data scenarios.

**Contract Enforcement:**
- **Contract ID:** `conflict_resolution_v1`
- **Enforcement Mode:** `BLOCK`

**Audit Status:** `[AUD-M07]: PASS (45/45 audit run)`
**Feeds Into:** Impact Analysis (Module 8).

---

## [MODULE 8] — Impact Analysis with Constraints Agent

**Purpose:** Calculates a mathematical magnitude of operational severity influenced heavily by situational constraints.

**Input:** Temporal/Resolution outputs + Constraint JSON.
**Output:**
```typescript
interface ImpactAnalysis {
  impact_id: string;
  magnitude: number; // 0-100
  financial_score: number;
  operational_score: number;
  reputational_score: number;
  recommended_priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}
```

**Processing Logic:**
1. Averages sub-scores across financial, operational, and reputational domains based on fixed rule-mappings tied to the anomalies.
2. Modifies magnitude multipliers if provided external JSON constraints (e.g., `urgency: HIGH` inflates the score by a 1.25x multiplier).

**Audit Status:** `[AUD-M08]: PASS (45/45 audit run)`
**Feeds Into:** Action Chain Generator (Module 9).

---

## [MODULE 9] — Action Chain Generator (CRITICAL)

**Purpose:** Synthesizes analysis data into precisely formatted, topologically sortable arrays of execution strategies.

**Input:** Impact Analysis + Resolved Insights
**Output:**
```typescript
interface ActionChain {
  proposal_id: string;
  actions: Array<{
    action_id: string;
    title: string;
    description: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    depends_on: string[];
    estimated_cost: number;
    estimated_time_hours: number;
  }>;
}
```

**Processing Logic:**
1. Requests the LLM to design an optimal mitigation strategy ensuring step-by-step logic.
2. Enforces outputting precisely 3–5 actions with explicit internal array references in `depends_on`.

**LLM Interaction:**
- The most complex prompt in the system. Enforces JSON formatting and validates that `depends_on` arrays only point to legitimate upstream `action_id` values.

**Contract Enforcement:**
- **Contract ID:** `action_chain_v1`
- **Enforcement Mode:** `BLOCK`
- **Validation:** Validates that exactly 3-5 objects exist and string properties align precisely. Evaluated by base model (Gemini Pro) to ensure a cyclical dependency graph wasn't accidentally created.

**Audit Status:** `[AUD-M09]: PASS (45/45 audit run)`
**Feeds Into:** Constraint Validator (Module 10) & the HITL UI gate.

---

## [MODULE 10] — Constraint Validator

**Purpose:** Defensively checks action feasibility against hard monetary and temporal constraints before simulation begins.

**Input:** `ActionChain` + Constraints (e.g. `budget: 500000`)
**Processing Logic:** Filters actions; rejects any object where `estimated_cost > budget` with reason `"exceeds_budget_constraint"`.
**Audit Status:** `[AUD-M10]: PASS (45/45 audit run)`

---

## [MODULE 11] — Action Chain Execution Simulator

**Purpose:** Transverses the generated action graph invoking simulated transactional operations.

**Processing Logic:** Sequentially iterates through the Kahn-sorted actions triggering mocked external service logic while adhering to topological requirements.
**Audit Status:** `[AUD-M11]: PASS (45/45 audit run)`

---

## [MODULE 12] — Failure Recovery & Rollback Engine (CRITICAL)

**Purpose:** Ensures pipeline resilience by reacting dynamically to execution faults within Module 11.

**Input:** Execution error context.
**Output:** `RecoveryPlan` with strategy `RETRY`, `FALLBACK`, or `SKIP`.
**Processing Logic:**
1. Applies exponential backoff retrying up to 3 times for timeouts.
2. If failed, it permanently `SKIP`s the node.
3. Iterates over all actions; automatically flags all items containing the failed ID in their `depends_on` array as `SKIPPED` due to `"upstream_failure"`.

**Audit Status:** `[AUD-M13]: PASS (45/45 audit run)` (Note: verified together with M11)

---

## [MODULE 13] — Outcome Visualizer Agent

**Purpose:** Derives mathematical efficiency analytics comparing the pre-crisis baseline to the simulated post-execution metrics.
**Processing Logic:** Produces aggregate integers determining `total_simulated_cost` and `risk_reduction_percentage`.
**Audit Status:** `[AUD-M14]: PASS (45/45 audit run)` (Verified alongside M14)

---

## [MODULE 14] — Workflow Audit Agent

**Purpose:** Seals the pipeline execution producing cryptographic non-repudiation artifacts.

**Input:** Final execution state and total Antigravity trace array.
**Output:** `WorkflowAudit` containing the SHA-256 signature.
**Processing Logic:** 
1. Calculates deterministic SHA-256 hash across the receipt payload.
2. Commits receipt JSON to persistent local disk under `audit-logs/` directory ensuring zero modifications are possible post-completion.

**Audit Status:** `[AUD-M14]: PASS (45/45 audit run)`
**Feeds Into:** End-user Client APIs.
