# Claude Code Prompt — Phase 2: Content Ingestion & Analysis
# Autonomous Content-to-Action Agent | AI Seekho Hackathon 2026

---

## ROLE & CONTEXT

You are implementing **Phase 2: Content Ingestion & Analysis** of an Autonomous Content-to-Action Agent
built with TypeScript/Node.js. The project already has a working `BaseAgent` class and an AMCE contract
validation framework. You are adding Modules 1 through 7 on top of that foundation.

The test domain is **supply chain**, but every agent you write must be **100% domain-agnostic** — no
hardcoded domain references anywhere in agent logic. Domain specificity lives only inside
`backend/test-data/` and config files. Switching domains must require zero code changes.

---

## ABSOLUTE ARCHITECTURE RULES (never violate these)

1. **Program to interfaces, never to implementations.** Every injectable dependency (vector store,
   feed adapter, LLM client, authority config) must have a TypeScript interface. Concrete classes
   implement those interfaces. Agents receive interfaces via constructor injection.

2. **No magic strings inside agents.** Domain names, domain-specific keywords, file paths, and
   threshold numbers must come from config objects or constructor parameters — never hardcoded
   inside agent class bodies.

3. **Every new agent extends `BaseAgent`** and emits traces via `traceCollector` exactly as existing
   agents do.

4. **Every agent's output is validated against its AMCE contract** via `decisionGate` before being
   returned. If you need a new contract, define it cleanly in the contracts registry.

5. **All thresholds are configurable.** Cosine similarity cutoff, chunk size, overlap, recency window,
   numeric discrepancy percentage — all must be parameters with documented defaults, not magic numbers.

---

## STEP-BY-STEP IMPLEMENTATION TASKS

---

### STEP 2.0 — Shared Interfaces & Config Files (do this FIRST)

Before writing any agent, create the following foundational pieces:

#### `backend/src/interfaces/vector-store.interface.ts`
```typescript
export interface VectorChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface VectorStore {
  upsert(chunks: VectorChunk[]): Promise<void>;
  query(embedding: number[], topK: number): Promise<VectorChunk[]>;
  clear(): void;
}
```

#### `backend/src/interfaces/feed-adapter.interface.ts`
```typescript
export interface FeedEvent {
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface FeedAdapter {
  stream(): AsyncGenerator<FeedEvent>;
}
```

#### `backend/src/interfaces/source-document.interface.ts`
This is the single normalized shape every agent passes around. It must have NO domain-specific fields.
```typescript
export type SourceType = 'pdf' | 'url' | 'csv' | 'txt' | 'realtime';

export interface SourceDocument {
  id: string;
  sourceType: SourceType;
  sourceUri: string;
  rawText: string;
  metadata: Record<string, unknown>;
  ingestedAt: string; // ISO 8601
  credibilityScore?: CredibilityResult;
}
```

#### `backend/config/authorityDomains.config.json`
```json
{
  "patterns": [
    { "match": ".gov",  "score": 28 },
    { "match": ".edu",  "score": 25 },
    { "match": ".org",  "score": 20 },
    { "match": "reuters.com", "score": 27 },
    { "match": "bloomberg.com", "score": 26 }
  ],
  "defaultFallback": "llm"
}
```
The agent loads this at startup. If a URL matches a pattern, use the config score. If not, call the LLM
once and cache the result in a session `Map<string, number>`. Never hardcode these patterns inside the
agent class.

#### `backend/config/agentThresholds.config.json`
```json
{
  "noiseFilter": {
    "cosineSimilarityThreshold": 0.85,
    "recencyScoreStaleThreshold": 0
  },
  "contradictionDetector": {
    "numericDiscrepancyPercent": 20,
    "temporalDiscrepancyHours": 24
  },
  "insightExtraction": {
    "chunkSizeTokens": 500,
    "chunkOverlapTokens": 100,
    "topKRetrieval": 5
  },
  "conflictResolution": {
    "credibilityDiffThreshold": 30,
    "temporalDiffHours": 24
  }
}
```

---

### STEP 2.1 — Module 1: Multi-Source Ingestion Agent

**File:** `backend/src/agents/multi-source-ingestion.agent.ts`

**What it does:**
- Extends `BaseAgent`.
- Accepts an array of source descriptors (URI + type) and a `FeedAdapter` for the real-time source.
- Runs ingestion of all 5+ sources **in parallel** using `Promise.allSettled`.
- Uses `pdf-parse` for PDFs, `cheerio` for HTML URLs, `papaparse` for CSVs, `fs.readFile` for `.txt`,
  and the injected `FeedAdapter` for real-time events.
- Normalizes every source into a `SourceDocument`.
- Validates output against the `multi_source_ingestion_v1` AMCE contract.
- Emits a `llm_call` trace entry for any LLM-assisted extraction step.

**Feed Adapter implementation to create alongside:**

`backend/src/adapters/mock-realtime-feed.adapter.ts`
- Implements `FeedAdapter`.
- `stream()` is an `async function*` that yields one `FeedEvent` every N milliseconds (configurable,
  default 500ms) from a static JSON array loaded from `backend/test-data/realtime-feed.json`.
- When the array is exhausted, the generator returns. No WebSocket server needed.

**Test data to create in `backend/test-data/` (supply chain domain, but generic field names):**
- `sample-report.pdf` — a multi-page report about shipment delays and supplier performance metrics.
- `sample-data.csv` — rows of inventory records with columns: `item_id`, `quantity`, `location`,
  `last_updated`, `status`.
- `sample-email.txt` — a plain text email thread discussing a logistics disruption.
- `urls.json` — array of 2–3 public URLs Claude can mock with cheerio (use placeholder text if
  offline; structure the mock fetch to be injectable).
- `realtime-feed.json` — array of 10–15 JSON event objects simulating a live data stream with fields:
  `id`, `timestamp`, `payload` (generic key-value pairs).

---

### STEP 2.2 — Module 2: Credibility Scorer Agent

**File:** `backend/src/agents/credibility-scorer.agent.ts`

**What it does:**
- Extends `BaseAgent`.
- Accepts an array of `SourceDocument[]`.
- For each document, produces a `CredibilityResult` with three sub-scores:

**Recency Score (0–40 points) — pure math, no LLM:**
```
score = max(0, 40 - (hoursSinceIngestion / maxAgeHours) * 40)
```
`maxAgeHours` comes from config, default 168 (7 days). A document ingested 0 hours ago = 40 points.
A document older than `maxAgeHours` = 0 points.

**Authority Score (0–30 points) — config-driven with LLM fallback:**
- Load `authorityDomains.config.json` at construction time.
- Check if `sourceUri` contains any pattern from the config → use that score.
- If no match and `fallback === "llm"` → call `llmClient` with a prompt asking to rate the domain's
  authority on a 0–30 scale. Cache the result in a `Map<string, number>` (session-scoped).
- For non-URL sources (PDF, CSV, TXT), use a configurable default (e.g., 15).

**Quality Score (0–30 points) — LLM-powered:**
- Send the first 500 chars of `rawText` to `llmClient` with a structured prompt asking it to return
  a JSON object `{ score: number, reasoning: string }`. Parse and validate.
- Emit one `llm_call` trace for this per document.

**Output:** Attach `credibilityScore: CredibilityResult` to each `SourceDocument` and return the
enriched array. Validate against `credibility_scorer_v1` contract.

---

### STEP 2.3 — Module 3: Noise Filter & Deduplication Agent

**File:** `backend/src/agents/noise-filter.agent.ts`

**What it does:**
- Extends `BaseAgent`.
- Takes enriched `SourceDocument[]` from Module 2.
- Runs three sequential filters, each logged as a trace step:

**Filter 1 — Stale removal:**
Remove any document where `credibilityScore.recency === 0`. Log removed IDs.

**Filter 2 — Spam detection (LLM):**
Batch the remaining documents and call `llmClient` with a prompt listing all document summaries, asking
it to return a JSON array of IDs it considers spam/irrelevant. Remove those. Emit one `llm_call` trace.

**Filter 3 — Deduplication (cosine similarity):**
- Call `llmClient.generateEmbedding(doc.rawText)` for each remaining document.
- Use `InMemoryVectorStore` (see below) to find pairs where cosine similarity > threshold from config.
- Keep the document with the higher total credibility score; discard the duplicate. Log which pairs were
  collapsed and why.

**`InMemoryVectorStore` to create alongside:**

`backend/src/stores/in-memory-vector.store.ts`
- Implements `VectorStore` interface.
- `upsert`: stores chunks in a `VectorChunk[]` array.
- `query`: computes cosine similarity between the query embedding and all stored embeddings; returns
  top-K sorted results.
- `clear`: empties the array.
- Include a pure `cosineSimilarity(a: number[], b: number[]): number` utility function. Export it
  separately so it can be unit-tested in isolation.

**Output:** Cleaned `SourceDocument[]`. Validate against `noise_filter_v1` contract.

---

### STEP 2.4 — Module 4: Contradiction Detector Agent

**File:** `backend/src/agents/contradiction-detector.agent.ts`

**What it does:**
- Extends `BaseAgent`.
- Takes cleaned `SourceDocument[]`.

**Step A — Claim Extraction (LLM):**
For each document, send `rawText` to `llmClient` with a structured prompt instructing it to extract
claims as a JSON array:
```json
[{ "topic": string, "claimType": "numeric|boolean|categorical|temporal", "value": string|number, "unit": string|null }]
```
Parse and validate each extracted array. Emit one `llm_call` trace per document.

**Step B — Group by topic:**
Aggregate all claims into a `Map<topic, Claim[]>`.

**Step C — Discrepancy checks (pure logic, no LLM):**
- **Numeric:** If two claims on the same topic have numeric values differing by > `numericDiscrepancyPercent`
  from config → flag as contradiction. Severity = `CRITICAL` if diff > 50%, else `MEDIUM`.
- **Boolean:** If two claims on the same topic have opposite boolean values → flag as `CRITICAL`.
- **Categorical:** If two claims on the same topic have different categorical values → flag as `MEDIUM`.
- **Temporal:** If two claims reference the same event with timestamps differing > `temporalDiffHours`
  from config → flag as `MEDIUM`.

**Output:** `ContradictionReport[]`. Validate against `contradiction_detection_v1` contract.

---

### STEP 2.5 — Module 7: Conflict Resolution Agent

**File:** `backend/src/agents/conflict-resolution.agent.ts`

**What it does:**
- Extends `BaseAgent`.
- Takes `ContradictionReport[]` and the enriched `SourceDocument[]` (needed for credibility scores).
- Applies resolution in this order (all thresholds from config):

**Rule 1 — Trust highest credibility (if credibility diff > `credibilityDiffThreshold`):**
Pick the claim from the source with the highest total credibility score. Set `resolutionMethod:
"credibility_weighted"`.

**Rule 2 — Trust most recent (if temporal diff > `temporalDiffHours`):**
Pick the claim from the most recently ingested source. Set `resolutionMethod: "recency_weighted"`.

**Rule 3 — Aggregate minor numeric discrepancies:**
If numeric diff is below threshold and no clear winner → compute the credibility-weighted average.
Set `resolutionMethod: "weighted_average"`.

**Rule 4 — Generate investigation path for severe unresolved conflicts:**
For any `CRITICAL` contradiction that Rule 1 and Rule 2 cannot resolve → call `llmClient` to generate
a structured `InvestigationPath` with suggested actions. Set `resolutionMethod: "investigation_required"`.
Emit one `llm_call` trace.

**Output:** `ResolvedClaim[]` + `InvestigationPath[]`. These feed into Module 5.

---

### STEP 2.6 — Module 5: RAG-Powered Insight Extraction Agent

**File:** `backend/src/agents/insight-extraction.agent.ts`

**What it does:**
- Extends `BaseAgent`.
- Accepts `VectorStore` (injected interface — defaults to `InMemoryVectorStore`).
- Takes cleaned `SourceDocument[]` + `ResolvedClaim[]` + `InvestigationPath[]`.

**Step A — Chunking:**
For each document's `rawText`, chunk it into segments of `chunkSizeTokens` tokens with
`chunkOverlapTokens` overlap (both from config). Approximate token count as `text.length / 4`.

**Step B — Embedding & Indexing:**
Call `llmClient.generateEmbedding(chunk)` for each chunk and `vectorStore.upsert()` all chunks.
Emit one `llm_call` trace for the batch.

**Step C — Retrieval & Synthesis:**
For each of these query strings (generated from resolved claims and investigation paths):
- Retrieve top-`topKRetrieval` chunks from `vectorStore.query()`.
- Concatenate retrieved chunks as context.
- Call `llmClient` with a master synthesis prompt that instructs it to extract insights and return
  strict JSON:
```json
{
  "trends": [{ "title": string, "description": string, "confidence": number }],
  "risks": [{ "title": string, "description": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL" }],
  "opportunities": [{ "title": string, "description": string }],
  "persistentConflicts": [{ "topic": string, "summary": string }]
}
```

**Output:** Final `InsightReport`. Validate against `insight_extraction_v1` contract.

---

### STEP 2.7 — Module 6: Temporal Analysis Engine

**File:** `backend/src/agents/temporal-analysis.agent.ts`

**What it does:**
- Extends `BaseAgent`.
- Takes cleaned `SourceDocument[]` and extracts any numeric time-series data points.

**Pure math functions to implement (no LLM for classification):**

```typescript
function linearRegressionSlope(points: { x: number; y: number }[]): number
function standardDeviation(values: number[]): number
function mean(values: number[]): number
```

**Pattern classification logic (thresholds from config):**
- `Spike`: a single point is > 2 standard deviations above the mean.
- `Decline`: linear regression slope < `-slopeThreshold` (configurable, default 0.1).
- `Drift`: slope is between `-slopeThreshold` and `+slopeThreshold` but std dev > `driftStdDevThreshold`.
- `Anomaly`: multiple spike points or sudden reversal.
- `Stable`: none of the above.

**Output:** `TemporalPattern[]` feeding into Module 5 RAG synthesis.

---

## VERIFICATION TESTS TO CREATE

### `backend/src/agents/test-contradiction-detector.ts`
- Load two mock contradicting JSON objects (one says `"inventory_units": 1000`, the other says
  `"inventory_units": 1450` for the same topic).
- Run `ContradictionDetectorAgent` directly.
- Assert output contains at least one contradiction flagged as `MEDIUM` or `CRITICAL`.
- Print the full `ContradictionReport` to console.

### `backend/src/stores/test-cosine-similarity.ts`
- Import the exported `cosineSimilarity` function from `in-memory-vector.store.ts`.
- Test: identical vectors → score ~1.0.
- Test: orthogonal vectors → score ~0.0.
- Test: known similar pair → score > 0.85.
- All assertions use `console.assert`. No test framework required.

Run both with: `npx ts-node src/agents/test-contradiction-detector.ts`

---

## FILE STRUCTURE SUMMARY

After all steps, the new files should be:

```
backend/
├── config/
│   ├── authorityDomains.config.json       ← NEW
│   └── agentThresholds.config.json        ← NEW
├── src/
│   ├── interfaces/
│   │   ├── vector-store.interface.ts      ← NEW
│   │   ├── feed-adapter.interface.ts      ← NEW
│   │   └── source-document.interface.ts   ← NEW
│   ├── stores/
│   │   ├── in-memory-vector.store.ts      ← NEW
│   │   └── test-cosine-similarity.ts      ← NEW
│   ├── adapters/
│   │   └── mock-realtime-feed.adapter.ts  ← NEW
│   └── agents/
│       ├── multi-source-ingestion.agent.ts    ← NEW
│       ├── credibility-scorer.agent.ts        ← NEW
│       ├── noise-filter.agent.ts              ← NEW
│       ├── contradiction-detector.agent.ts    ← NEW
│       ├── conflict-resolution.agent.ts       ← NEW
│       ├── insight-extraction.agent.ts        ← NEW
│       ├── temporal-analysis.agent.ts         ← NEW
│       └── test-contradiction-detector.ts     ← NEW
└── test-data/
    ├── sample-report.pdf                  ← NEW (supply chain content)
    ├── sample-data.csv                    ← NEW (inventory records)
    ├── sample-email.txt                   ← NEW (logistics email thread)
    ├── urls.json                          ← NEW (source URL descriptors)
    └── realtime-feed.json                 ← NEW (mock stream events)
```

---

## AGENT EXECUTION ORDER (matches workflow diagram)

```
Module 1 (Ingestion) 
  → Module 2 (Credibility Scorer) 
    → Module 3 (Noise Filter) 
      ├── Module 4 (Contradiction Detector) → Module 7 (Conflict Resolution)
      ├── Module 6 (Temporal Analysis)
      └── (all three feed into) → Module 5 (RAG Insight Extraction)
                                        → Output to Phase 3 / Module 8
```

---

## IMPORTANT REMINDERS

- Do NOT install any package not listed in the existing `package.json` without first checking if it's
  already present. Required new packages: `pdf-parse`, `cheerio`, `papaparse` — install only if absent.
- Every `llmClient` call must be wrapped in try/catch with a graceful fallback.
- All `Promise.allSettled` results must handle `rejected` cases and log them to `traceCollector` as
  `ingestion_error` events rather than crashing the pipeline.
- When generating test data files, use realistic but entirely fictional data. No real company names,
  no real URLs that may fail at runtime.
- The `VectorStore` injected into `InsightExtractionAgent` should default to a new `InMemoryVectorStore()`
  in the constructor if none is provided, so the agent works out of the box without wiring.
- When switching domains in the future, the only required action is: replace `backend/test-data/` and
  update `authorityDomains.config.json` if needed. Zero agent code changes.
