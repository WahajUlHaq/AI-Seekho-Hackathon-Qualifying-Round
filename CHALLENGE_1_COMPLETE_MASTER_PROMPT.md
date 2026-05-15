# Ultimate Build Prompt — InnoCollab AI Seekho 2026 Hackathon
## Challenge 1: Autonomous Content-to-Action Agent (Insight → Action System)

> **⏰ HARD DEADLINE: Complete working prototype must be delivered before May 20, 2026. No extensions.**

---

## ROLE & CONTEXT

You are an expert full-stack AI systems architect building a **production-grade hackathon prototype** for **Challenge 1: Autonomous Content-to-Action Agent**.

This is NOT a summarization tool. This is an **advanced agentic AI system** that:
- Ingests **5+ content sources simultaneously** (PDFs, URLs, CSVs, dashboards, real-time feeds)
- Detects **contradictions and conflicts** across sources
- Performs **temporal analysis** to track how signals change over time
- Filters **noise, duplicates, and low-credibility content**
- Generates **3-5 interconnected action chains** (not single actions)
- Simulates execution with **constraint validation** (budget, time, resources, urgency)
- Handles **failure recovery and rollback** when actions fail
- Shows **before/after state changes** with cost/latency metrics

All governed by an **AMCE-inspired contract enforcement layer** that validates every module output against base models.

**Tech Stack:**
- Backend: **Express.js on Node.js (JavaScript & TypeScript)**
- Frontend: **React (TypeScript)**
- Mobile: **React Native** (MANDATORY per hackathon rules)
- Platform: **Google Antigravity** (mandatory for orchestration)
- LLMs: **Free tier APIs** (Gemini, Groq, Hugging Face, Ollama)

---

## SYSTEM OVERVIEW — THE COMPLETE PIPELINE

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS CONTENT-TO-ACTION AGENT                               │
│                                                                                     │
│  INPUTS (5+ simultaneous sources)                                                   │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 1] Multi-Source Content Ingestion (5+ sources in parallel)                │
│    │         - PDF/Report + Website/Article + CSV/JSON + Dashboard + Real-time Feed│
│    │                                                                                │
│    ▼                                                                                │
│  [Module 2] Source Credibility Scorer                                              │
│    │         - Timestamp freshness, source authority, content quality               │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 3] Noise Filter & Deduplication                                           │
│    │         - Remove duplicates, spam-like content, stale data                     │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 4] Contradiction Detector                                                 │
│    │         - Identify conflicting claims across sources                           │
│    │         - Score conflicts by severity                                          │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 5] RAG-Powered Insight Extraction                                         │
│    │         - Extract insights, trends, risks, opportunities                       │
│    │         - Flag contradictions that need resolution                             │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 6] Temporal Analysis Engine                                               │
│    │         - Detect how signals change over time                                  │
│    │         - Identify: decline, spike, drift, anomaly                             │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 7] Conflict Resolution Logic                                              │
│    │         - When conflicts exist: explain + generate investigation path          │
│    │         - Don't force false conclusions                                        │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 8] Impact Analysis with Constraints                                       │
│    │         - Analyze implications under cost, time, resource, urgency constraints │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 9] Action Chain Generator (3-5 interconnected actions)                    │
│    │         - Build dependency graph of actions                                    │
│    │         - Attach constraints to each action                                    │
│    │                                                                                │
│    ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────┐                   │
│  │       CONTRACT ENFORCEMENT LAYER (AMCE-Inspired)            │                   │
│  │                                                             │                   │
│  │  Every Module Output ──► Base Model Validation              │                   │
│  │         │                                                   │                   │
│  │         ▼                                                   │                   │
│  │  Contract Check (schema + semantic + divergence)            │                   │
│  │         │                                                   │                   │
│  │         ▼                                                   │                   │
│  │  Decision Gate: PASS / WARN / REJECT                        │                   │
│  │         │              │                                    │                   │
│  │      PASS           REJECT                                  │                   │
│  │         │              │                                    │                   │
│  │    Proceed      Re-generate or                              │                   │
│  │                 Use Fallback                                 │                   │
│  └─────────────────────────────────────────────────────────────┘                   │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 10] Constraint Validator                                                  │
│    │          - Check if each action violates budget/time/resource/urgency limits   │
│    │          - Reject/modify infeasible actions                                    │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 11] Action Chain Execution Simulator                                      │
│    │          - Execute actions sequentially with state tracking                    │
│    │          - Simulate failures (API error, invalid data, etc.)                   │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 12] Failure Recovery & Rollback Engine                                    │
│    │          - When action fails: retry, replace, or rollback                      │
│    │          - Log recovery strategy                                               │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 13] Outcome Visualization                                                 │
│    │          - Before vs After state                                               │
│    │          - Action execution logs                                               │
│    │          - Cost/latency metrics                                                │
│    │          - Projected impact                                                    │
│    │                                                                                │
│    ▼                                                                                │
│  [Module 14] Agentic Workflow Trace & Audit Logs                                   │
│              - Workplan, task plan, reasoning, tool calls, decisions, failures      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## FREE AI API OPTIONS

Since you want to use **free AI APIs**, here are your options with pros/cons:

### Option 1: Google Gemini (RECOMMENDED for this hackathon)
```bash
# Free tier: Gemini 1.5 Flash (generous rate limits)
npm install @google/generative-ai
```

**Pros:**
- Google product (fits with Antigravity requirement)
- Free tier: 15 requests/minute, 1 million tokens/minute
- Fast responses, good quality
- Multimodal (can process images/PDFs directly)

**Cons:**
- Requires Google API key (free to create)

**Setup:**
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
```

### Option 2: Groq (FASTEST, FREE)
```bash
npm install groq-sdk
```

**Pros:**
- **Extremely fast** (8x faster than OpenAI)
- Free tier: 30 requests/minute, 14,400/day
- Runs Llama 3, Mixtral, Gemma models
- Great for production-like demos

**Cons:**
- Rate limits stricter than Gemini

**Setup:**
```typescript
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
```

### Option 3: Hugging Face Inference API
```bash
npm install @huggingface/inference
```

**Pros:**
- Completely free for public models
- Access to thousands of models
- Good for specialized tasks

**Cons:**
- Slower than Gemini/Groq
- Lower quality on complex reasoning

### Option 4: Ollama (LOCAL, COMPLETELY FREE)
```bash
# Install Ollama locally
curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull llama3.1
ollama pull mistral
```

**Pros:**
- 100% free, no API keys
- No rate limits
- Full data privacy
- Runs on your machine

**Cons:**
- Requires good hardware (8GB+ RAM)
- Slower than cloud APIs
- Quality depends on model size

**Recommended Stack for This Hackathon:**
- **Primary LLM:** Gemini 1.5 Flash (free, fast, high quality)
- **Base Model for AMCE validation:** Gemini 1.5 Pro (free, highest quality)
- **Embeddings:** Gemini Embedding API (free) or `all-MiniLM-L6-v2` via Hugging Face
- **Fallback:** Groq with Llama 3.1 (if Gemini rate limits hit)

---

## MODULE SPECIFICATIONS

### Module 1: Multi-Source Content Ingestion (5+ Sources in Parallel)

**Purpose:** Ingest at least 5 different content sources simultaneously and normalize them.

**Required Input Types:**
1. **PDF/Report** (e.g., warehouse inventory report)
2. **Website/Article** (e.g., news about transport delays)
3. **CSV/JSON** (e.g., sales dashboard data)
4. **Table/Dashboard** (e.g., supplier performance metrics)
5. **Mock Real-time Feed** (e.g., customer complaint stream)

**Implementation Requirements:**

```typescript
interface MultiSourceInput {
    sources: Array<{
        source_id: string;
        source_type: "pdf" | "url" | "csv" | "json" | "table" | "realtime_feed";
        content: string | Buffer;
        metadata: {
            url?: string;
            filename?: string;
            timestamp: string;
            credibility_score?: number;  // Will be computed by Module 2
        };
    }>;
}

interface NormalizedSource {
    source_id: string;
    source_type: string;
    raw_text: string;
    structured_data?: Record<string, any>;  // For CSV/JSON
    extraction_confidence: number;
    timestamp: string;
    word_count: number;
    metadata: Record<string, any>;
}
```

**Parallel Ingestion Logic:**
```typescript
class MultiSourceIngestionAgent {
    async ingestAll(inputs: MultiSourceInput): Promise<NormalizedSource[]> {
        // Process all sources in parallel using Promise.all
        const ingestionPromises = inputs.sources.map(source => 
            this.ingestSingle(source)
        );
        
        const results = await Promise.all(ingestionPromises);
        
        // Log ingestion summary
        console.log(`Ingested ${results.length} sources in parallel`);
        
        return results;
    }
    
    private async ingestSingle(source: SourceInput): Promise<NormalizedSource> {
        switch (source.source_type) {
            case "pdf":
                return this.ingestPDF(source);
            case "url":
                return this.ingestURL(source);
            case "csv":
                return this.ingestCSV(source);
            case "json":
                return this.ingestJSON(source);
            case "table":
                return this.ingestTable(source);
            case "realtime_feed":
                return this.ingestRealtimeFeed(source);
            default:
                throw new Error(`Unsupported source type: ${source.source_type}`);
        }
    }
}
```

**Libraries:**
- PDF: `pdf-parse`
- URL: `axios` + `cheerio` or `@extractus/article-extractor`
- CSV: `csv-parser` or `papaparse`
- JSON: native `JSON.parse`
- Real-time feed: mock streaming with `setInterval` or `EventEmitter`

**Output Contract:**
```yaml
contract_id: "multi_source_ingestion_v1"
module_name: "multi_source_ingestion_agent"
version: "1.0.0"
output_schema:
  sources:
    type: array
    min_items: 5  # MUST ingest at least 5 sources
    items:
      source_id:
        type: string
        nullable: false
      source_type:
        type: enum
        values: ["pdf", "url", "csv", "json", "table", "realtime_feed"]
        nullable: false
      raw_text:
        type: string
        min_length: 20
        nullable: false
      timestamp:
        type: string
        regex_pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
        nullable: false
enforcement_mode: "BLOCK"
```

---

### Module 2: Source Credibility Scorer

**Purpose:** Score each source's credibility based on timestamp freshness, source authority, and content quality.

**Scoring Criteria:**
1. **Recency Score (0-40 points):**
   - Within last hour: 40
   - Within last day: 30
   - Within last week: 20
   - Within last month: 10
   - Older than month: 0

2. **Source Authority Score (0-30 points):**
   - Official government/company source: 30
   - Verified news outlet: 25
   - Industry report: 20
   - User-generated (verified): 15
   - Anonymous/unverified: 5

3. **Content Quality Score (0-30 points):**
   - Has citations/references: +10
   - Has numerical data: +10
   - Coherent structure: +10

**Total Credibility Score: 0-100**

**Implementation:**
```typescript
interface CredibilityScore {
    source_id: string;
    recency_score: number;
    authority_score: number;
    quality_score: number;
    total_score: number;
    credibility_tier: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
    reasoning: string;
}

class SourceCredibilityScorer {
    async scoreAll(sources: NormalizedSource[]): Promise<CredibilityScore[]> {
        return Promise.all(sources.map(source => this.scoreSingle(source)));
    }
    
    private async scoreSingle(source: NormalizedSource): Promise<CredibilityScore> {
        const recencyScore = this.calculateRecencyScore(source.timestamp);
        const authorityScore = this.calculateAuthorityScore(source.metadata);
        const qualityScore = await this.calculateQualityScore(source.raw_text);
        
        const totalScore = recencyScore + authorityScore + qualityScore;
        
        let tier: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
        if (totalScore >= 70) tier = "HIGH";
        else if (totalScore >= 40) tier = "MEDIUM";
        else if (totalScore >= 20) tier = "LOW";
        else tier = "UNVERIFIED";
        
        return {
            source_id: source.source_id,
            recency_score: recencyScore,
            authority_score: authorityScore,
            quality_score: qualityScore,
            total_score: totalScore,
            credibility_tier: tier,
            reasoning: `Recency: ${recencyScore}, Authority: ${authorityScore}, Quality: ${qualityScore}`
        };
    }
    
    private calculateRecencyScore(timestamp: string): number {
        const now = new Date();
        const sourceTime = new Date(timestamp);
        const hoursDiff = (now.getTime() - sourceTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 1) return 40;
        if (hoursDiff < 24) return 30;
        if (hoursDiff < 168) return 20;
        if (hoursDiff < 720) return 10;
        return 0;
    }
}
```

---

### Module 3: Noise Filter & Deduplication

**Purpose:** Remove duplicates, spam-like content, stale data, and irrelevant content.

**Filtering Rules:**
1. **Duplicate Detection:** If two sources have >85% text similarity (cosine similarity of embeddings), keep only the one with higher credibility score.
2. **Spam Detection:** If content has excessive special characters, promotional language, or keyword stuffing → flag as spam.
3. **Staleness Filter:** If credibility recency score is 0 → mark as stale.
4. **Relevance Filter:** Use embeddings to check if content is relevant to the query/context.

**Implementation:**
```typescript
interface FilteredSources {
    kept_sources: NormalizedSource[];
    removed_sources: Array<{
        source_id: string;
        reason: "duplicate" | "spam" | "stale" | "irrelevant";
        details: string;
    }>;
}

class NoiseFilter {
    async filter(
        sources: NormalizedSource[], 
        credibilityScores: CredibilityScore[]
    ): Promise<FilteredSources> {
        const kept: NormalizedSource[] = [];
        const removed: Array<any> = [];
        
        // Step 1: Remove stale sources
        for (let i = 0; i < sources.length; i++) {
            const score = credibilityScores.find(s => s.source_id === sources[i].source_id);
            if (score && score.recency_score === 0) {
                removed.push({
                    source_id: sources[i].source_id,
                    reason: "stale",
                    details: "Content timestamp older than 1 month"
                });
                continue;
            }
            kept.push(sources[i]);
        }
        
        // Step 2: Deduplicate using embeddings
        const deduplicated = await this.deduplicateBySimilarity(kept, credibilityScores);
        
        // Step 3: Spam detection
        const filtered = await this.filterSpam(deduplicated);
        
        return {
            kept_sources: filtered.kept,
            removed_sources: [...removed, ...filtered.removed]
        };
    }
    
    private async deduplicateBySimilarity(
        sources: NormalizedSource[],
        scores: CredibilityScore[]
    ): Promise<NormalizedSource[]> {
        // Generate embeddings for all sources
        const embeddings = await this.generateEmbeddings(sources.map(s => s.raw_text));
        
        const kept: NormalizedSource[] = [];
        const seen = new Set<number>();
        
        for (let i = 0; i < sources.length; i++) {
            if (seen.has(i)) continue;
            
            let duplicates: number[] = [];
            for (let j = i + 1; j < sources.length; j++) {
                if (seen.has(j)) continue;
                
                const similarity = this.cosineSimilarity(embeddings[i], embeddings[j]);
                if (similarity > 0.85) {
                    duplicates.push(j);
                }
            }
            
            if (duplicates.length > 0) {
                // Keep the one with highest credibility
                const allIndices = [i, ...duplicates];
                const bestIndex = this.selectBestByCredibility(allIndices, scores);
                kept.push(sources[bestIndex]);
                allIndices.forEach(idx => seen.add(idx));
            } else {
                kept.push(sources[i]);
                seen.add(i);
            }
        }
        
        return kept;
    }
}
```

---

### Module 4: Contradiction Detector

**Purpose:** Identify conflicting claims across sources and score severity.

**Contradiction Types:**
1. **Numeric Contradiction:** "Stock is 500 units" vs "Stock is 50 units"
2. **Boolean Contradiction:** "System is operational" vs "System is down"
3. **Categorical Contradiction:** "High priority" vs "Low priority"
4. **Temporal Contradiction:** "Will happen in 2 days" vs "Will happen in 2 weeks"

**Implementation:**
```typescript
interface Contradiction {
    contradiction_id: string;
    type: "numeric" | "boolean" | "categorical" | "temporal";
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    conflicting_sources: Array<{
        source_id: string;
        claim: string;
        credibility_score: number;
    }>;
    topic: string;
    confidence: number;
    resolution_needed: boolean;
}

class ContradictionDetector {
    async detectAll(
        sources: NormalizedSource[],
        credibilityScores: CredibilityScore[]
    ): Promise<Contradiction[]> {
        const contradictions: Contradiction[] = [];
        
        // Extract claims from all sources using LLM
        const claims = await this.extractClaims(sources);
        
        // Group claims by topic
        const claimsByTopic = this.groupClaimsByTopic(claims);
        
        // Check for contradictions within each topic
        for (const [topic, topicClaims] of Object.entries(claimsByTopic)) {
            const conflicts = await this.findConflicts(topicClaims);
            if (conflicts.length > 0) {
                contradictions.push(...conflicts);
            }
        }
        
        return contradictions;
    }
    
    private async extractClaims(sources: NormalizedSource[]): Promise<Claim[]> {
        // Use LLM to extract factual claims from each source
        const prompt = `Extract all factual claims from the following text. 
        For each claim, identify:
        - The claim statement
        - The topic (e.g., "inventory_level", "system_status", "delivery_time")
        - Whether it's numeric, boolean, categorical, or temporal
        
        Text: {source_text}
        
        Respond in JSON format:
        {
          "claims": [
            {
              "claim": "Stock level is 500 units",
              "topic": "inventory_level",
              "type": "numeric",
              "value": 500,
              "unit": "units"
            }
          ]
        }`;
        
        // Call LLM for each source in parallel
        const claimExtractions = await Promise.all(
            sources.map(source => this.llmClient.extract(prompt, source.raw_text))
        );
        
        return claimExtractions.flatMap((extraction, idx) => 
            extraction.claims.map(claim => ({
                ...claim,
                source_id: sources[idx].source_id
            }))
        );
    }
    
    private async findConflicts(claims: Claim[]): Promise<Contradiction[]> {
        const contradictions: Contradiction[] = [];
        
        // Check all pairs of claims
        for (let i = 0; i < claims.length; i++) {
            for (let j = i + 1; j < claims.length; j++) {
                const conflict = this.checkConflict(claims[i], claims[j]);
                if (conflict) {
                    contradictions.push(conflict);
                }
            }
        }
        
        return contradictions;
    }
    
    private checkConflict(claim1: Claim, claim2: Claim): Contradiction | null {
        if (claim1.type !== claim2.type) return null;
        
        switch (claim1.type) {
            case "numeric":
                const percentDiff = Math.abs(claim1.value - claim2.value) / 
                                   Math.max(claim1.value, claim2.value);
                if (percentDiff > 0.2) {  // >20% difference
                    return {
                        contradiction_id: `CONTRA-${Date.now()}`,
                        type: "numeric",
                        severity: percentDiff > 0.5 ? "CRITICAL" : "HIGH",
                        conflicting_sources: [
                            { source_id: claim1.source_id, claim: claim1.claim, credibility_score: 0 },
                            { source_id: claim2.source_id, claim: claim2.claim, credibility_score: 0 }
                        ],
                        topic: claim1.topic,
                        confidence: 0.9,
                        resolution_needed: true
                    };
                }
                break;
            
            case "boolean":
                if (claim1.value !== claim2.value) {
                    return {
                        contradiction_id: `CONTRA-${Date.now()}`,
                        type: "boolean",
                        severity: "CRITICAL",
                        conflicting_sources: [
                            { source_id: claim1.source_id, claim: claim1.claim, credibility_score: 0 },
                            { source_id: claim2.source_id, claim: claim2.claim, credibility_score: 0 }
                        ],
                        topic: claim1.topic,
                        confidence: 0.95,
                        resolution_needed: true
                    };
                }
                break;
        }
        
        return null;
    }
}
```

**Output Contract:**
```yaml
contract_id: "contradiction_detection_v1"
output_schema:
  contradictions:
    type: array
    items:
      contradiction_id:
        type: string
        nullable: false
      severity:
        type: enum
        values: ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
        nullable: false
      resolution_needed:
        type: boolean
        nullable: false
enforcement_mode: "QUARANTINE"
```

---

### Module 5: RAG-Powered Insight Extraction

**Purpose:** Extract insights, trends, risks, and opportunities, flagging contradictions that need resolution.

**Insight Categories:**
- **Trends:** Patterns over time (increasing, decreasing, cyclical)
- **Risks:** Potential negative outcomes
- **Opportunities:** Potential positive outcomes
- **Contradictions:** Conflicting evidence requiring investigation

**LLM Prompt:**
```typescript
const INSIGHT_EXTRACTION_PROMPT = `You are an expert analyst. Given multiple content sources (some may contradict each other), extract meaningful insights.

SOURCES:
{source_summaries}

DETECTED CONTRADICTIONS:
{contradictions}

SOURCE CREDIBILITY SCORES:
{credibility_scores}

RULES:
1. Extract 3-7 specific, actionable insights
2. For each insight, cite which sources support it
3. If sources contradict, flag the insight as "REQUIRES_RESOLUTION" and explain the conflict
4. Prioritize insights from high-credibility sources
5. Identify: trends (over time), risks (negative potential), opportunities (positive potential)

Respond in this exact JSON format:
{
  "insights": [
    {
      "insight_id": "INS-001",
      "title": "Inventory shortage risk escalating",
      "description": "Demand increased 30% while supplier reliability dropped 40%",
      "category": "risk",
      "severity": "critical",
      "confidence": 0.85,
      "supporting_sources": ["SRC-001", "SRC-003", "SRC-004"],
      "requires_resolution": false,
      "contradiction_details": null,
      "temporal_pattern": "accelerating_decline",
      "affected_entities": ["Warehouse A", "Product SKU-1234"],
      "data_points": ["Demand: +30%", "Supplier reliability: -40%"]
    },
    {
      "insight_id": "INS-002",
      "title": "Stock level conflicting reports",
      "description": "Source A claims 500 units remaining, Source B claims 50 units",
      "category": "contradiction",
      "severity": "high",
      "confidence": 0.7,
      "supporting_sources": ["SRC-001", "SRC-002"],
      "requires_resolution": true,
      "contradiction_details": {
        "type": "numeric",
        "conflicting_values": [
          {"source": "SRC-001", "value": "500 units", "credibility": 65},
          {"source": "SRC-002", "value": "50 units", "credibility": 85}
        ],
        "likely_correct": "SRC-002 (higher credibility + more recent)"
      },
      "temporal_pattern": null,
      "affected_entities": ["Product SKU-1234"],
      "data_points": ["Stock: 500 units (SRC-001)", "Stock: 50 units (SRC-002)"]
    }
  ]
}`;
```

---

### Module 6: Temporal Analysis Engine

**Purpose:** Detect how signals change over time (decline, spike, drift, anomaly).

**Temporal Patterns:**
1. **Decline:** Value decreasing over time (e.g., sales dropping 25% QoQ)
2. **Spike:** Sudden sharp increase (e.g., complaints jumped 10x in one day)
3. **Drift:** Gradual change (e.g., delivery time slowly increasing)
4. **Anomaly:** Unexpected outlier (e.g., zero orders on a Monday)

**Implementation:**
```typescript
interface TemporalPattern {
    pattern_type: "decline" | "spike" | "drift" | "anomaly" | "stable";
    metric_name: string;
    time_window: string;
    change_magnitude: number;
    change_direction: "increasing" | "decreasing" | "volatile";
    confidence: number;
    data_points: Array<{ timestamp: string; value: number }>;
}

class TemporalAnalysisEngine {
    async analyzeTimeSeries(
        metricName: string,
        dataPoints: Array<{ timestamp: string; value: number }>
    ): Promise<TemporalPattern> {
        // Sort by timestamp
        dataPoints.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        // Calculate trend
        const trend = this.calculateTrend(dataPoints);
        
        // Detect pattern type
        let patternType: "decline" | "spike" | "drift" | "anomaly" | "stable";
        
        if (Math.abs(trend.slope) < 0.05) {
            patternType = "stable";
        } else if (this.detectSpike(dataPoints)) {
            patternType = "spike";
        } else if (Math.abs(trend.slope) > 0.3) {
            patternType = trend.slope < 0 ? "decline" : "drift";
        } else {
            patternType = "drift";
        }
        
        return {
            pattern_type: patternType,
            metric_name: metricName,
            time_window: this.getTimeWindow(dataPoints),
            change_magnitude: Math.abs(trend.percentChange),
            change_direction: trend.slope > 0 ? "increasing" : "decreasing",
            confidence: trend.r_squared,
            data_points: dataPoints
        };
    }
    
    private detectSpike(dataPoints: Array<{ timestamp: string; value: number }>): boolean {
        if (dataPoints.length < 3) return false;
        
        // Check if any point is >2 standard deviations from mean
        const values = dataPoints.map(d => d.value);
        const mean = values.reduce((a, b) => a + b) / values.length;
        const stdDev = Math.sqrt(
            values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
        );
        
        return values.some(val => Math.abs(val - mean) > 2 * stdDev);
    }
}
```

---

### Module 7: Conflict Resolution Logic

**Purpose:** When conflicts exist, explain the conflict and generate an investigation path instead of forcing a false conclusion.

**Resolution Strategies:**
1. **Trust Most Credible:** If one source has significantly higher credibility, trust it
2. **Trust Most Recent:** If timestamps differ significantly, trust newer data
3. **Request Clarification:** If sources are equally credible, generate an action to verify
4. **Aggregate:** If numeric values differ slightly, compute weighted average
5. **Flag for Human Review:** If conflict is severe and sources are equally credible

**Implementation:**
```typescript
interface ConflictResolution {
    contradiction_id: string;
    resolution_strategy: "trust_credible" | "trust_recent" | "request_clarification" | "aggregate" | "human_review";
    recommended_value: any;
    confidence: number;
    reasoning: string;
    investigation_actions: Array<{
        action_type: string;
        description: string;
        priority: "critical" | "high" | "medium";
    }>;
}

class ConflictResolutionEngine {
    async resolve(
        contradiction: Contradiction,
        credibilityScores: CredibilityScore[]
    ): Promise<ConflictResolution> {
        // Get credibility scores for conflicting sources
        const sourceScores = contradiction.conflicting_sources.map(source => 
            credibilityScores.find(cs => cs.source_id === source.source_id)
        );
        
        // Strategy 1: Trust most credible if difference > 30 points
        const maxScore = Math.max(...sourceScores.map(s => s.total_score));
        const minScore = Math.min(...sourceScores.map(s => s.total_score));
        
        if (maxScore - minScore > 30) {
            const mostCredible = sourceScores.find(s => s.total_score === maxScore);
            const bestSource = contradiction.conflicting_sources.find(
                s => s.source_id === mostCredible.source_id
            );
            
            return {
                contradiction_id: contradiction.contradiction_id,
                resolution_strategy: "trust_credible",
                recommended_value: bestSource.claim,
                confidence: 0.8,
                reasoning: `Source ${bestSource.source_id} has significantly higher credibility (${mostCredible.total_score} vs ${minScore})`,
                investigation_actions: [
                    {
                        action_type: "verify_data",
                        description: `Verify claim from ${bestSource.source_id}: "${bestSource.claim}"`,
                        priority: "medium"
                    }
                ]
            };
        }
        
        // Strategy 2: Trust most recent if credibility similar
        const timestamps = contradiction.conflicting_sources.map(s => 
            // Get timestamp from source metadata
        );
        const mostRecent = Math.max(...timestamps.map(t => new Date(t).getTime()));
        const oldestTimestamp = Math.min(...timestamps.map(t => new Date(t).getTime()));
        const hoursDiff = (mostRecent - oldestTimestamp) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {  // More than 24 hours apart
            // Trust the most recent
            // ... implementation
        }
        
        // Strategy 3: Request clarification if both equally credible and recent
        return {
            contradiction_id: contradiction.contradiction_id,
            resolution_strategy: "request_clarification",
            recommended_value: null,
            confidence: 0.5,
            reasoning: "Conflicting sources have similar credibility and recency. Manual verification required.",
            investigation_actions: [
                {
                    action_type: "verify_primary_source",
                    description: "Check primary data source (warehouse database) to resolve conflict",
                    priority: "critical"
                },
                {
                    action_type: "cross_reference",
                    description: "Find additional sources to corroborate one of the claims",
                    priority: "high"
                }
            ]
        };
    }
}
```

---

### Module 8: Impact Analysis with Constraints

**Purpose:** Analyze implications under cost, time, resource, urgency, and API limit constraints.

**Constraint Types:**
```typescript
interface Constraints {
    budget_limit: {
        amount: number;
        currency: string;
    };
    time_limit: {
        deadline: string;  // ISO 8601
        max_duration_hours: number;
    };
    resource_limits: {
        api_calls_per_hour: number;
        compute_units: number;
        human_hours_available: number;
    };
    urgency_level: "critical" | "high" | "medium" | "low";
}

interface ImpactAnalysis {
    insight_id: string;
    primary_impact: string;
    impact_category: "revenue" | "cost" | "risk" | "compliance" | "reputation" | "operational";
    impact_severity: "critical" | "high" | "medium" | "low";
    quantified_impact: {
        estimated_cost: number | null;
        estimated_time_hours: number | null;
        affected_count: number | null;  // e.g., number of customers affected
    };
    constraints_violated: string[];  // Which constraints this impact violates
    time_horizon: "immediate" | "short_term" | "medium_term" | "long_term";
    cascading_effects: string[];
    risk_if_ignored: string;
}
```

---

### Module 9: Action Chain Generator (3-5 Interconnected Actions)

**Purpose:** Generate 3-5 interconnected actions that form a dependency chain.

**Action Chain Structure:**
```typescript
interface ActionNode {
    action_id: string;
    action_type: "diagnose" | "notify" | "update_system" | "mitigate" | "monitor" | "verify" | "escalate";
    title: string;
    description: string;
    priority: "critical" | "high" | "medium" | "low";
    
    // Dependencies
    depends_on: string[];  // action_ids that must complete first
    blocks: string[];      // action_ids that are blocked by this action
    
    // Constraints
    constraints: {
        max_cost: number;
        max_duration_hours: number;
        required_resources: string[];
        api_rate_limit: number;
    };
    
    // Simulation
    simulatable: boolean;
    simulation_details: {
        simulation_type: string;
        parameters: Record<string, any>;
        expected_success_rate: number;
    };
    
    // Failure handling
    failure_recovery: {
        retry_count: number;
        fallback_action_id: string | null;
        rollback_required: boolean;
    };
}

interface ActionChain {
    chain_id: string;
    insight_id: string;
    actions: ActionNode[];
    execution_order: string[];  // action_ids in execution order
    total_estimated_cost: number;
    total_estimated_duration_hours: number;
    constraint_violations: Array<{
        action_id: string;
        constraint_type: string;
        violation_details: string;
    }>;
}
```

**Action Chain Generation Prompt:**
```typescript
const ACTION_CHAIN_PROMPT = `You are an operations strategist. Given the following insight and impact analysis, generate a chain of 3-5 interconnected actions.

INSIGHT:
{insight}

IMPACT ANALYSIS:
{impact}

CONSTRAINTS:
- Budget limit: {budget_limit}
- Time limit: {time_limit}
- Resource limits: {resource_limits}
- Urgency: {urgency}

RULES:
1. Generate 3-5 actions that form a logical dependency chain
2. Each action must have: diagnose/notify/update/mitigate/monitor/verify/escalate type
3. Actions must respect the constraints (if an action violates a constraint, mark it as infeasible)
4. At least 3 actions must be simulatable
5. Define failure recovery for each action

Example chain structure:
1. Diagnose root cause → 2. Notify stakeholder → 3. Update system → 4. Launch mitigation → 5. Schedule monitoring

Respond in JSON:
{
  "actions": [
    {
      "action_id": "ACT-001",
      "action_type": "verify",
      "title": "Verify current stock levels",
      "description": "Query warehouse database to get real-time inventory count",
      "priority": "critical",
      "depends_on": [],
      "blocks": ["ACT-002", "ACT-003"],
      "constraints": {
        "max_cost": 0,
        "max_duration_hours": 0.5,
        "required_resources": ["database_access"],
        "api_rate_limit": 100
      },
      "simulatable": true,
      "simulation_details": {
        "simulation_type": "database_query",
        "parameters": {"query": "SELECT * FROM inventory WHERE sku='SKU-1234'"},
        "expected_success_rate": 0.95
      },
      "failure_recovery": {
        "retry_count": 3,
        "fallback_action_id": "ACT-MANUAL-VERIFY",
        "rollback_required": false
      }
    }
  ],
  "execution_order": ["ACT-001", "ACT-002", "ACT-003", "ACT-004", "ACT-005"]
}`;
```

---

### Module 10: Constraint Validator

**Purpose:** Check if each action violates budget/time/resource/urgency limits. Reject or modify infeasible actions.

```typescript
interface ConstraintValidationResult {
    action_id: string;
    is_feasible: boolean;
    violations: Array<{
        constraint_type: "budget" | "time" | "resource" | "urgency";
        limit: number;
        required: number;
        severity: "blocking" | "warning";
    }>;
    recommended_modification: string | null;
}

class ConstraintValidator {
    validateActionChain(
        chain: ActionChain,
        constraints: Constraints
    ): ConstraintValidationResult[] {
        return chain.actions.map(action => this.validateSingle(action, constraints));
    }
    
    private validateSingle(
        action: ActionNode,
        constraints: Constraints
    ): ConstraintValidationResult {
        const violations: any[] = [];
        
        // Check budget
        if (action.constraints.max_cost > constraints.budget_limit.amount) {
            violations.push({
                constraint_type: "budget",
                limit: constraints.budget_limit.amount,
                required: action.constraints.max_cost,
                severity: "blocking"
            });
        }
        
        // Check time
        if (action.constraints.max_duration_hours > constraints.time_limit.max_duration_hours) {
            violations.push({
                constraint_type: "time",
                limit: constraints.time_limit.max_duration_hours,
                required: action.constraints.max_duration_hours,
                severity: "blocking"
            });
        }
        
        // Check API rate limits
        if (action.constraints.api_rate_limit > constraints.resource_limits.api_calls_per_hour) {
            violations.push({
                constraint_type: "resource",
                limit: constraints.resource_limits.api_calls_per_hour,
                required: action.constraints.api_rate_limit,
                severity: "warning"
            });
        }
        
        const isFeasible = violations.filter(v => v.severity === "blocking").length === 0;
        
        let recommendedModification = null;
        if (!isFeasible) {
            if (violations.some(v => v.constraint_type === "budget")) {
                recommendedModification = "Reduce scope or use lower-cost alternative";
            } else if (violations.some(v => v.constraint_type === "time")) {
                recommendedModification = "Parallelize with other actions or reduce wait time";
            }
        }
        
        return {
            action_id: action.action_id,
            is_feasible: isFeasible,
            violations,
            recommended_modification: recommendedModification
        };
    }
}
```

---

### Module 11: Action Chain Execution Simulator

**Purpose:** Execute actions sequentially with state tracking. Simulate failures (API error, invalid data, etc.).

```typescript
interface SimulationState {
    state_id: string;
    timestamp: string;
    variables: Record<string, any>;  // e.g., { stock_level: 50, order_placed: true }
}

interface ActionExecutionResult {
    action_id: string;
    status: "success" | "failed" | "skipped";
    before_state: SimulationState;
    after_state: SimulationState;
    execution_log: string[];
    cost: number;
    duration_ms: number;
    failure_reason: string | null;
}

class ActionChainSimulator {
    private currentState: SimulationState;
    
    async simulateChain(
        chain: ActionChain,
        initialState: SimulationState,
        simulateFailures: boolean = true  // For stress testing
    ): Promise<ActionExecutionResult[]> {
        this.currentState = initialState;
        const results: ActionExecutionResult[] = [];
        
        for (const actionId of chain.execution_order) {
            const action = chain.actions.find(a => a.action_id === actionId);
            
            // Check if dependencies are satisfied
            const dependenciesMet = action.depends_on.every(depId => 
                results.find(r => r.action_id === depId && r.status === "success")
            );
            
            if (!dependenciesMet) {
                results.push({
                    action_id: actionId,
                    status: "skipped",
                    before_state: this.currentState,
                    after_state: this.currentState,
                    execution_log: ["Skipped: dependencies not met"],
                    cost: 0,
                    duration_ms: 0,
                    failure_reason: "Dependencies not satisfied"
                });
                continue;
            }
            
            // Simulate execution
            const result = await this.simulateSingleAction(action, simulateFailures);
            results.push(result);
            
            // Update state
            if (result.status === "success") {
                this.currentState = result.after_state;
            }
        }
        
        return results;
    }
    
    private async simulateSingleAction(
        action: ActionNode,
        simulateFailures: boolean
    ): Promise<ActionExecutionResult> {
        const startTime = Date.now();
        const beforeState = { ...this.currentState };
        const log: string[] = [];
        
        log.push(`Starting action: ${action.title}`);
        
        // Simulate failure randomly if stress testing
        const willFail = simulateFailures && Math.random() > action.simulation_details.expected_success_rate;
        
        if (willFail) {
            log.push(`FAILURE: ${this.getRandomFailureReason(action.action_type)}`);
            return {
                action_id: action.action_id,
                status: "failed",
                before_state: beforeState,
                after_state: beforeState,
                execution_log: log,
                cost: 0,
                duration_ms: Date.now() - startTime,
                failure_reason: this.getRandomFailureReason(action.action_type)
            };
        }
        
        // Execute based on action type
        let afterState = { ...beforeState };
        
        switch (action.simulation_details.simulation_type) {
            case "database_query":
                log.push("Executing database query...");
                log.push("Query returned: 50 units in stock");
                afterState.variables.stock_level = 50;
                afterState.variables.stock_verified = true;
                break;
                
            case "send_notification":
                log.push(`Sending notification to ${action.simulation_details.parameters.recipient}`);
                log.push("Notification sent successfully");
                afterState.variables.notification_sent = true;
                afterState.variables.notification_timestamp = new Date().toISOString();
                break;
                
            case "place_order":
                const orderCost = action.simulation_details.parameters.order_cost;
                log.push(`Placing emergency order: ${orderCost} PKR`);
                log.push("Order confirmation received: ORDER-12345");
                afterState.variables.order_placed = true;
                afterState.variables.order_id = "ORDER-12345";
                afterState.variables.budget_remaining -= orderCost;
                break;
                
            case "update_dashboard":
                log.push("Updating dashboard metrics...");
                log.push("Dashboard updated successfully");
                afterState.variables.dashboard_updated = true;
                break;
        }
        
        const duration = Date.now() - startTime;
        const cost = action.constraints.max_cost;
        
        log.push(`Action completed in ${duration}ms, cost: ${cost} PKR`);
        
        return {
            action_id: action.action_id,
            status: "success",
            before_state: beforeState,
            after_state: afterState,
            execution_log: log,
            cost,
            duration_ms: duration
        };
    }
    
    private getRandomFailureReason(actionType: string): string {
        const failures = {
            "verify": ["Database connection timeout", "Query returned empty result", "Access denied"],
            "notify": ["SMTP server error", "Recipient email bounced", "Rate limit exceeded"],
            "update_system": ["API endpoint unreachable", "Invalid data format", "Write permission denied"],
            "mitigate": ["Resource allocation failed", "Budget limit exceeded", "Dependency service down"]
        };
        
        const reasons = failures[actionType] || ["Unknown error"];
        return reasons[Math.floor(Math.random() * reasons.length)];
    }
}
```

---

### Module 12: Failure Recovery & Rollback Engine

**Purpose:** When an action fails, retry, replace, or rollback state.

```typescript
interface RecoveryPlan {
    failed_action_id: string;
    recovery_strategy: "retry" | "fallback" | "rollback" | "skip_and_continue";
    retry_attempts: number;
    fallback_action: ActionNode | null;
    rollback_to_state: SimulationState | null;
    recovery_execution_log: string[];
}

class FailureRecoveryEngine {
    async handleFailure(
        failedAction: ActionNode,
        failureResult: ActionExecutionResult,
        chain: ActionChain,
        stateHistory: SimulationState[]
    ): Promise<RecoveryPlan> {
        const log: string[] = [];
        
        log.push(`Action ${failedAction.action_id} failed: ${failureResult.failure_reason}`);
        
        // Strategy 1: Retry if retries available
        if (failedAction.failure_recovery.retry_count > 0) {
            log.push(`Attempting retry (${failedAction.failure_recovery.retry_count} attempts remaining)`);
            
            return {
                failed_action_id: failedAction.action_id,
                recovery_strategy: "retry",
                retry_attempts: failedAction.failure_recovery.retry_count,
                fallback_action: null,
                rollback_to_state: null,
                recovery_execution_log: log
            };
        }
        
        // Strategy 2: Use fallback action if available
        if (failedAction.failure_recovery.fallback_action_id) {
            const fallbackAction = chain.actions.find(
                a => a.action_id === failedAction.failure_recovery.fallback_action_id
            );
            
            log.push(`Using fallback action: ${fallbackAction.title}`);
            
            return {
                failed_action_id: failedAction.action_id,
                recovery_strategy: "fallback",
                retry_attempts: 0,
                fallback_action: fallbackAction,
                rollback_to_state: null,
                recovery_execution_log: log
            };
        }
        
        // Strategy 3: Rollback if required
        if (failedAction.failure_recovery.rollback_required) {
            const rollbackState = stateHistory[stateHistory.length - 2];  // Previous state
            log.push(`Rolling back to previous state: ${rollbackState.state_id}`);
            
            return {
                failed_action_id: failedAction.action_id,
                recovery_strategy: "rollback",
                retry_attempts: 0,
                fallback_action: null,
                rollback_to_state: rollbackState,
                recovery_execution_log: log
            };
        }
        
        // Strategy 4: Skip and continue with remaining actions
        log.push("No recovery option available. Skipping and continuing with chain.");
        
        return {
            failed_action_id: failedAction.action_id,
            recovery_strategy: "skip_and_continue",
            retry_attempts: 0,
            fallback_action: null,
            rollback_to_state: null,
            recovery_execution_log: log
        };
    }
}
```

---

### Module 13: Outcome Visualization

**Purpose:** Show before vs after state, action logs, cost/latency metrics, and projected impact.

```typescript
interface OutcomeVisualization {
    before_state: SimulationState;
    after_state: SimulationState;
    state_diff: Array<{
        variable: string;
        before_value: any;
        after_value: any;
        change_type: "added" | "removed" | "modified" | "unchanged";
    }>;
    
    action_execution_timeline: Array<{
        action_id: string;
        action_title: string;
        start_time: string;
        end_time: string;
        status: "success" | "failed" | "skipped";
        cost: number;
        duration_ms: number;
    }>;
    
    metrics: {
        total_cost: number;
        total_duration_ms: number;
        success_rate: number;
        actions_attempted: number;
        actions_succeeded: number;
        actions_failed: number;
        failures_recovered: number;
    };
    
    projected_impact: {
        risk_reduction: number;  // 0-100%
        estimated_value: number;  // PKR
        affected_entities: string[];
    };
}

class OutcomeVisualizer {
    generate(
        initialState: SimulationState,
        finalState: SimulationState,
        executionResults: ActionExecutionResult[],
        recoveryPlans: RecoveryPlan[]
    ): OutcomeVisualization {
        // Compute state diff
        const diff = this.computeStateDiff(initialState, finalState);
        
        // Build timeline
        const timeline = executionResults.map(result => ({
            action_id: result.action_id,
            action_title: result.action_id,  // Would be enriched with actual title
            start_time: result.before_state.timestamp,
            end_time: result.after_state.timestamp,
            status: result.status,
            cost: result.cost,
            duration_ms: result.duration_ms
        }));
        
        // Calculate metrics
        const metrics = {
            total_cost: executionResults.reduce((sum, r) => sum + r.cost, 0),
            total_duration_ms: executionResults.reduce((sum, r) => sum + r.duration_ms, 0),
            success_rate: executionResults.filter(r => r.status === "success").length / executionResults.length,
            actions_attempted: executionResults.length,
            actions_succeeded: executionResults.filter(r => r.status === "success").length,
            actions_failed: executionResults.filter(r => r.status === "failed").length,
            failures_recovered: recoveryPlans.filter(p => p.recovery_strategy !== "skip_and_continue").length
        };
        
        return {
            before_state: initialState,
            after_state: finalState,
            state_diff: diff,
            action_execution_timeline: timeline,
            metrics,
            projected_impact: {
                risk_reduction: 0,  // Would be calculated based on actual impact
                estimated_value: 0,
                affected_entities: []
            }
        };
    }
    
    private computeStateDiff(before: SimulationState, after: SimulationState): any[] {
        const diff: any[] = [];
        const allKeys = new Set([
            ...Object.keys(before.variables),
            ...Object.keys(after.variables)
        ]);
        
        for (const key of allKeys) {
            const beforeValue = before.variables[key];
            const afterValue = after.variables[key];
            
            let changeType: "added" | "removed" | "modified" | "unchanged";
            
            if (beforeValue === undefined && afterValue !== undefined) {
                changeType = "added";
            } else if (beforeValue !== undefined && afterValue === undefined) {
                changeType = "removed";
            } else if (beforeValue !== afterValue) {
                changeType = "modified";
            } else {
                changeType = "unchanged";
            }
            
            diff.push({
                variable: key,
                before_value: beforeValue,
                after_value: afterValue,
                change_type: changeType
            });
        }
        
        return diff;
    }
}
```

---

## THE CONTRACT ENFORCEMENT LAYER (AMCE-Inspired)

[Same as previous version — keeping the complete contract enforcement architecture with base model validation]

**Key difference:** Now validates outputs from all 14 modules, not just 4.

---

## BACKEND ARCHITECTURE (Express.js / Node.js / TypeScript)

```
backend/
├── src/
│   ├── index.ts                         # Express app entry point
│   ├── config.ts                        # Environment config
│   ├── routes/
│   │   ├── pipeline.routes.ts           # POST /api/pipeline/run
│   │   ├── contracts.routes.ts          # Contract management
│   │   ├── validations.routes.ts        # Validation history
│   │   └── outcomes.routes.ts           # Outcome visualization
│   ├── agents/
│   │   ├── multi-source-ingestion.agent.ts
│   │   ├── credibility-scorer.agent.ts
│   │   ├── noise-filter.agent.ts
│   │   ├── contradiction-detector.agent.ts
│   │   ├── insight-extraction.agent.ts
│   │   ├── temporal-analysis.agent.ts
│   │   ├── conflict-resolution.agent.ts
│   │   ├── impact-analysis.agent.ts
│   │   ├── action-chain-generator.agent.ts
│   │   └── orchestrator.ts              # Main pipeline coordinator
│   ├── contracts/
│   │   ├── registry.ts
│   │   ├── validator.ts
│   │   ├── benchmark.ts
│   │   ├── decision-gate.ts
│   │   └── definitions/
│   │       ├── multi_source_ingestion_v1.yaml
│   │       ├── contradiction_detection_v1.yaml
│   │       ├── action_chain_v1.yaml
│   │       └── ...
│   ├── simulation/
│   │   ├── chain-simulator.ts
│   │   ├── constraint-validator.ts
│   │   ├── failure-recovery.ts
│   │   └── outcome-visualizer.ts
│   ├── utils/
│   │   ├── llm-client.ts               # Multi-provider LLM client
│   │   ├── embedding.ts                # Embedding generation
│   │   ├── cosine-similarity.ts        # Vector similarity
│   │   └── helpers.ts
│   └── database/
│       ├── db.ts                       # SQLite setup
│       └── models.ts
├── package.json
├── tsconfig.json
└── .env
```

---

## EXAMPLE SCENARIO: INVENTORY SHORTAGE

**Input (5 sources simultaneously):**
1. **PDF:** Warehouse inventory report (dated 1 week ago, says "Stock: 500 units")
2. **CSV:** Sales dashboard (real-time, shows spike in demand: +30% yesterday)
3. **Email:** Supplier notification (says "Delivery delayed 3 days due to transport strike")
4. **Website:** News article about transport delays across the region
5. **Real-time feed:** Customer complaints (5 complaints about "out of stock" in last 2 hours)

**Expected Pipeline Output:**

**Module 1 - Ingestion:**
- 5 sources ingested in parallel
- Normalized to common format

**Module 2 - Credibility Scoring:**
- PDF: 45 (MEDIUM) - outdated
- CSV: 95 (HIGH) - real-time official data
- Email: 75 (HIGH) - official supplier communication
- News: 60 (MEDIUM) - reputable source but generic
- Complaints: 40 (LOW) - user-generated, not verified

**Module 3 - Noise Filtering:**
- Removed: None (all relevant)
- Flagged: PDF as potentially stale

**Module 4 - Contradiction Detection:**
- **CRITICAL contradiction detected:** PDF says "500 units" vs Complaints suggest "out of stock"

**Module 5 - Insight Extraction:**
1. "Stock level conflicting reports" (requires resolution)
2. "Demand spiked 30% in last 24 hours" (trend)
3. "Supplier delivery delayed 3 days" (risk)
4. "Customer complaints increasing" (trend)

**Module 6 - Temporal Analysis:**
- Demand: **spike pattern** (+30% in 24h)
- Complaints: **spike pattern** (5 in 2 hours vs normal 1 per day)

**Module 7 - Conflict Resolution:**
- Resolution: Trust real-time complaints + sales data over 1-week-old PDF
- Recommended value: Stock likely < 50 units
- Investigation actions: "Verify stock via warehouse database query"

**Module 8 - Impact Analysis:**
- Impact: Stockout risk within 24 hours
- Severity: CRITICAL
- Quantified: ~200 customers affected if no action taken
- Constraints: Budget limit PKR 500,000, Time limit 24 hours

**Module 9 - Action Chain (5 actions):**
1. **ACT-001: Verify stock** (database query) - Cost: 0, Time: 30 min
2. **ACT-002: Notify procurement** (email/Slack) - Cost: 0, Time: 15 min
3. **ACT-003: Place emergency order** (supplier API call) - Cost: PKR 450,000, Time: 2 hours
4. **ACT-004: Update delivery estimates** (customer notification) - Cost: PKR 5,000, Time: 1 hour
5. **ACT-005: Schedule 24h monitoring** (dashboard alert) - Cost: 0, Time: ongoing

**Module 10 - Constraint Validation:**
- ACT-001: ✓ Feasible
- ACT-002: ✓ Feasible
- ACT-003: ✓ Feasible (within budget: 450K < 500K limit)
- ACT-004: ✓ Feasible
- ACT-005: ✓ Feasible

**Module 11 - Simulation (with failure injection):**
- ACT-001: ✓ Success - Stock verified: 47 units
- ACT-002: ✓ Success - Notification sent
- ACT-003: ✗ FAILED - Supplier API timeout
- **Recovery triggered:** Retry ACT-003 (attempt 2)
- ACT-003 (retry): ✓ Success - Order placed: ORDER-12345
- ACT-004: ✓ Success - 200 customers notified
- ACT-005: ✓ Success - Monitoring scheduled

**Module 12 - Failure Recovery:**
- ACT-003 failed on first attempt
- Recovery strategy: Retry (succeeded on attempt 2)
- Rollback: Not required

**Module 13 - Outcome:**
- **Before state:** Stock: 47 units, Demand: high, No order placed, Customers unaware
- **After state:** Stock: 47 units (unchanged yet), Emergency order: ORDER-12345 (500 units arriving in 3 days), Customers notified: 200, Monitoring: Active
- **Metrics:** Total cost: PKR 455,000, Total time: 3.75 hours, Success rate: 83% (5/6 attempts)
- **Projected impact:** Stockout risk reduced 80%, Estimated value: PKR 2M revenue protected

---

## STRESS TEST SCENARIOS (CRITICAL FOR DEMO)

Implement these 5 stress tests to demonstrate robustness:

### Stress Test 1: Conflicting Values Across 3 Sources
**Setup:** Same metric appears in 3 sources with different values (500, 50, 150 units)
**Expected behavior:**
- Contradiction detector flags all 3 conflicts
- Credibility scorer ranks sources
- Conflict resolution chooses highest-credibility source
- Logs the decision reasoning

### Stress Test 2: Constraint Violation
**Setup:** Recommended action costs PKR 600,000 but budget limit is PKR 500,000
**Expected behavior:**
- Constraint validator rejects the action
- Recommended modification: "Reduce order quantity to fit budget"
- Alternative action generated

### Stress Test 3: Action Failure & Retry
**Setup:** ACT-003 (place order) fails on first attempt
**Expected behavior:**
- Failure detected
- Retry attempted (up to 3 times)
- Success on retry 2
- Full recovery logged

### Stress Test 4: Low-Credibility False Signal
**Setup:** One source (credibility: 15) claims "Stock critically low" but all other sources (credibility: 80+) say "Stock adequate"
**Expected behavior:**
- Low-credibility source down-ranked
- Insight not generated based on single low-credibility source
- Logged as "Ignored: low credibility outlier"

### Stress Test 5: Cascading Side Effect
**Setup:** Emergency order (ACT-003) triggers budget reduction which affects another planned action
**Expected behavior:**
- Budget tracking updated after each action
- Subsequent actions re-validated against new budget
- Infeasible actions flagged

---

## EVALUATION CRITERIA ALIGNMENT

| Criteria | Weight | How This System Addresses It |
|----------|--------|------------------------------|
| **Antigravity integration** | 20% | Antigravity orchestrates all 14 modules. Full trace logs show workplan, task plan, reasoning, tool calls, decisions, failures, recovery. |
| **Agentic reasoning and workflow** | 20% | 14 autonomous agents with clear decision chains. Multi-step reasoning for conflict resolution, action chain generation, failure recovery. |
| **Insight quality and contradiction handling** | 20% | Dedicated contradiction detector, credibility scorer, conflict resolution engine. Never forces false conclusions. |
| **Action chain and outcome simulation** | 15% | 3-5 interconnected actions per scenario. Full simulation with state tracking, failure injection, recovery, before/after visualization. |
| **Robustness, scalability, cost and latency** | 15% | Constraint validation, failure recovery, rollback. Cost/latency tracking per action. Stress tests demonstrate handling of failures, conflicts, violations. |
| **Innovation and UX** | 10% | AMCE contract layer unique. Clean mobile + web UI. Real-time pipeline progress. Clear contradiction resolution visualization. |

---

## DELIVERABLES CHECKLIST

- [ ] **Working prototype with mobile app (MANDATORY)**
- [ ] **Web app (optional but recommended)**
- [ ] **Demo video (3-5 minutes)** showing: input (5 sources) → contradiction detection → conflict resolution → action chain → constraint validation → simulation (with failure) → recovery → outcome
- [ ] **Antigravity trace/logs** showing: workplan, task plan, reasoning steps, tool calls, decisions, failures, recovery
- [ ] **README** with: architecture, data sources, tools/APIs, Antigravity role, assumptions, constraints, cost/latency analysis, baseline comparison, limitations

---

## FREE AI API SETUP

### Recommended Configuration

```bash
# .env file
GEMINI_API_KEY=your_free_gemini_key  # Get from ai.google.dev
GROQ_API_KEY=your_free_groq_key      # Get from console.groq.com

# Primary model (for main pipeline)
PRIMARY_MODEL_PROVIDER=gemini
PRIMARY_MODEL=gemini-1.5-flash

# Base model (for contract validation)
BASE_MODEL_PROVIDER=gemini
BASE_MODEL=gemini-1.5-pro

# Embedding model
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=text-embedding-004

# Fallback (if rate limits hit)
FALLBACK_PROVIDER=groq
FALLBACK_MODEL=llama-3.1-70b-versatile
```

### Multi-Provider LLM Client

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

class LLMClient {
    private gemini: GoogleGenerativeAI;
    private groq: Groq;
    
    constructor() {
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
    }
    
    async complete(
        prompt: string,
        provider: "gemini" | "groq" = "gemini",
        model?: string
    ): Promise<string> {
        try {
            if (provider === "gemini") {
                const modelName = model || "gemini-1.5-flash";
                const geminiModel = this.gemini.getGenerativeModel({ model: modelName });
                const result = await geminiModel.generateContent(prompt);
                return result.response.text();
            } else {
                const modelName = model || "llama-3.1-70b-versatile";
                const completion = await this.groq.chat.completions.create({
                    model: modelName,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7
                });
                return completion.choices[0].message.content || "";
            }
        } catch (error) {
            console.error(`LLM call failed for ${provider}:`, error);
            // Fallback to other provider
            if (provider === "gemini") {
                console.log("Falling back to Groq...");
                return this.complete(prompt, "groq", model);
            }
            throw error;
        }
    }
    
    async generateEmbedding(text: string): Promise<number[]> {
        const model = this.gemini.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    }
}
```

---

## CRITICAL IMPLEMENTATION NOTES

1. **Contract enforcement runs on EVERY module output** — all 14 modules must pass validation
2. **Contradiction detection is mandatory** — must be visible in demo
3. **Action chain must have 3-5 actions** — not 1, not 10
4. **Constraint validation must reject infeasible actions** — demonstrate this in UI
5. **Failure recovery must be simulated** — inject at least one failure in demo
6. **Antigravity trace must be comprehensive** — judges want to see every decision

---

**This is your complete specification. Start building immediately. Deadline: May 20, 2026.**
