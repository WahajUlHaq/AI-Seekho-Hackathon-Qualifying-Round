# Development Roadmap — Challenge 1: Content-to-Action Agent
## Using This Prompt with Google Antigravity + Claude Code

**Deadline: May 20, 2026**  
**Development Time Available: ~7 days from now (May 13 to May 20)**

---

## OVERVIEW: HOW TO USE THIS PROMPT

You have **TWO main documents**:
1. **CHALLENGE_1_COMPLETE_MASTER_PROMPT.md** — The complete technical specification
2. **THIS FILE** — Step-by-step development guide

### Your Development Setup:
- **Google Antigravity Terminal** — Your primary development environment
- **Claude Code** — AI coding assistant inside Antigravity
- **Antigravity Agents** — For orchestration, reasoning, planning
- **Free AI APIs** — Gemini, Groq (no cost during development)
- **Vertex AI** — Paid (GCP credits), used only for demo day

---

## GCP CREDITS STRATEGY

### How Credits Are Allocated Across the Team

| Participant | GCP Account Role | Service | Budget |
|-------------|-----------------|---------|--------|
| **Person A** | Infrastructure | Cloud Run (backend hosting) | $5 |
| **Person B** | AI Calls (Primary) | Vertex AI Gemini | $5 |
| **Person C** | AI Calls (Backup) + Files | Vertex AI fallback + Cloud Storage | $5 |
| **Everyone** | Frontend | Firebase Hosting (free tier — no credits needed) | $0 |

**Total usable credits: $15 across 3 accounts**

### When Credits Are Used

```
Days 1–5  (May 13–17)  →  FREE TIER ONLY  (Gemini API + Groq)   $0 spent
Day 6     (May 18)     →  STAGING test    (mix, catch bugs)      ~$0.50 spent
Days 6–7  (May 18–20)  →  VERTEX AI ON    (demo rehearsals)      ~$3–5 spent
```

> ⚠️ **Set a $4 budget alert immediately** in GCP Console → Billing → Budgets & Alerts for each account. This protects you from surprises on demo day.

### Credit Safety Net

Even when on Vertex AI (production), your LLMClient (built in Phase 0) automatically falls back to free Gemini API if credits run out mid-demo. You will never have a full pipeline failure because of billing.

---

## PHASE-BY-PHASE DEVELOPMENT PLAN

### **PHASE 0: Environment Setup (Day 1: May 13, Morning)**
**Duration: 2-3 hours**  
**Evaluation Criteria Addressed: Technical foundation for all criteria**

#### Step 0.1: Get Free AI API Keys

```bash
# 1. Get Gemini API Key (PRIMARY during development - MANDATORY)
# Visit: https://ai.google.dev/
# Click "Get API Key" → Create new key → Copy it

# 2. Get Groq API Key (FALLBACK during development - RECOMMENDED)
# Visit: https://console.groq.com
# Sign up → API Keys → Create → Copy it

# Vertex AI keys (for demo day) come from GCP Console — collect from Person B and C later
# You do NOT need Vertex AI keys on Day 1
```

#### Step 0.2: Set Up Antigravity Project Structure

**In Antigravity Terminal:**
```bash
# Create main project directory
mkdir content-action-agent
cd content-action-agent

# Create subdirectories
mkdir -p backend/src/{routes,agents,contracts,simulation,utils,database,tracing}
mkdir -p backend/src/contracts/definitions
mkdir -p frontend/src/{pages,components,hooks,utils}
mkdir -p mobile
mkdir -p docs
```

#### Step 0.3: Initialize Backend (Node.js + TypeScript)

**In Antigravity Terminal:**
```bash
cd backend
npm init -y

# Install core dependencies
npm install express cors dotenv multer uuid zod yaml js-yaml

# Install AI SDKs — all three providers
npm install @google/generative-ai groq-sdk @google-cloud/aiplatform

# Install TypeScript
npm install -D typescript ts-node nodemon @types/express @types/cors @types/multer @types/uuid

# Install content processing
npm install pdf-parse cheerio axios @extractus/article-extractor csv-parser papaparse

# Install database
npm install better-sqlite3
npm install -D @types/better-sqlite3

# Initialize TypeScript
npx tsc --init
```

#### Step 0.4: Create Environment Files

> **This is the most important setup step.** Two separate `.env` files control which AI provider the entire pipeline uses. You will never touch individual module files to switch providers — only these two files matter.

**In Antigravity Terminal:**

```bash
# --- DEVELOPMENT environment (Days 1-5, free tier) ---
cat > .env.development << 'EOF'
APP_ENV=development

# Free Gemini API (primary during development)
GEMINI_API_KEY=your_free_gemini_key_here

# Groq fallback (if Gemini rate limits hit)
GROQ_API_KEY=your_free_groq_key_here

# Provider config
PRIMARY_PROVIDER=gemini-free
FALLBACK_PROVIDER=groq
PRIMARY_MODEL=gemini-1.5-flash
BASE_MODEL=gemini-1.5-pro
EMBEDDING_MODEL=text-embedding-004
FALLBACK_MODEL=llama-3.1-70b-versatile

# Server
PORT=8000
NODE_ENV=development
EOF

# --- PRODUCTION environment (Days 6-7, GCP credits) ---
cat > .env.production << 'EOF'
APP_ENV=production

# Vertex AI — Person B's GCP account (primary on demo day)
VERTEX_KEY_1=person_b_service_account_key_json_path
VERTEX_PROJECT_ID_1=person-b-project-id
VERTEX_LOCATION=asia-south1

# Vertex AI — Person C's GCP account (secondary on demo day)
VERTEX_KEY_2=person_c_service_account_key_json_path
VERTEX_PROJECT_ID_2=person-c-project-id

# Free Gemini — safety net (if Vertex credits exhausted mid-demo)
GEMINI_API_KEY=your_free_gemini_key_here
GROQ_API_KEY=your_free_groq_key_here

# Provider config
PRIMARY_PROVIDER=vertex-ai
FALLBACK_PROVIDER=gemini-free
EMERGENCY_FALLBACK=groq
PRIMARY_MODEL=gemini-1.5-pro
BASE_MODEL=gemini-1.5-pro
EMBEDDING_MODEL=text-embedding-004

# Server
PORT=8000
NODE_ENV=production
EOF

# Paste your actual free Gemini and Groq keys into .env.development now
nano .env.development
```

**Add both files to `.gitignore` immediately:**
```bash
echo ".env.development" >> .gitignore
echo ".env.production" >> .gitignore
```

> ⚠️ `.env.production` will contain GCP service account keys. Never commit it to any repository.

**Daily usage — two commands, that's all:**
```bash
# Every day during development (Days 1-5)
APP_ENV=development npm run dev

# Demo rehearsal and demo day only (Days 6-7)
APP_ENV=production npm run dev
```

#### Step 0.5: Configure TypeScript

**Edit `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

#### Step 0.6: Build the LLMClient With Environment Switching

> **Build this before anything else.** Every one of your 14 modules calls this single class. Getting it right now means you never touch provider logic again for the rest of the 7 days.

**Create `backend/src/utils/llm-client.ts`:**

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const APP_ENV = process.env.APP_ENV || "development";

// Provider configuration per environment
const PROVIDER_CONFIG = {
  development: {
    primary: "gemini-free",
    fallback: "groq",
    emergency: null,
    model: process.env.PRIMARY_MODEL || "gemini-1.5-flash",
    baseModel: process.env.BASE_MODEL || "gemini-1.5-pro",
  },
  staging: {
    primary: "gemini-free",
    fallback: "groq",
    emergency: null,
    model: process.env.PRIMARY_MODEL || "gemini-1.5-pro",
    baseModel: process.env.BASE_MODEL || "gemini-1.5-pro",
  },
  production: {
    primary: "vertex-ai",
    fallback: "gemini-free",
    emergency: "groq",
    model: process.env.PRIMARY_MODEL || "gemini-1.5-pro",
    baseModel: process.env.BASE_MODEL || "gemini-1.5-pro",
  },
};

// Vertex key rotation across Person B and C's accounts
const VERTEX_ACCOUNTS = [
  {
    keyPath: process.env.VERTEX_KEY_1,
    projectId: process.env.VERTEX_PROJECT_ID_1,
    spent: 0,
    limit: 4.5, // stop at $4.50 to leave buffer
  },
  {
    keyPath: process.env.VERTEX_KEY_2,
    projectId: process.env.VERTEX_PROJECT_ID_2,
    spent: 0,
    limit: 4.5,
  },
];

export class LLMClient {
  private gemini: GoogleGenerativeAI;
  private groq: Groq;
  private config = PROVIDER_CONFIG[APP_ENV] || PROVIDER_CONFIG["development"];
  private currentVertexAccount = 0;

  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
    console.log(`[LLMClient] Initialized in ${APP_ENV} mode → primary: ${this.config.primary}`);
  }

  async complete(prompt: string, useBaseModel = false): Promise<string> {
    const model = useBaseModel ? this.config.baseModel : this.config.model;

    try {
      return await this.callProvider(this.config.primary, prompt, model);
    } catch (primaryError: any) {
      console.warn(`[LLMClient] Primary (${this.config.primary}) failed: ${primaryError.message}`);
      try {
        return await this.callProvider(this.config.fallback, prompt, model);
      } catch (fallbackError: any) {
        console.warn(`[LLMClient] Fallback (${this.config.fallback}) failed: ${fallbackError.message}`);
        if (this.config.emergency) {
          console.warn(`[LLMClient] Using emergency provider: ${this.config.emergency}`);
          return await this.callProvider(this.config.emergency, prompt, model);
        }
        throw fallbackError;
      }
    }
  }

  private async callProvider(provider: string, prompt: string, model: string): Promise<string> {
    switch (provider) {
      case "vertex-ai":
        return await this.callVertexAI(prompt, model);
      case "gemini-free":
        return await this.callFreeGemini(prompt, model);
      case "groq":
        return await this.callGroq(prompt);
      default:
        return await this.callFreeGemini(prompt, model);
    }
  }

  private async callVertexAI(prompt: string, model: string): Promise<string> {
    const account = VERTEX_ACCOUNTS[this.currentVertexAccount];

    if (!account || account.spent >= account.limit) {
      // Rotate to next Vertex account
      this.currentVertexAccount++;
      if (this.currentVertexAccount >= VERTEX_ACCOUNTS.length) {
        console.warn("[LLMClient] All Vertex accounts exhausted — falling back to free Gemini");
        return await this.callFreeGemini(prompt, model);
      }
      return await this.callVertexAI(prompt, model);
    }

    try {
      // Use free Gemini SDK pointed at Vertex endpoint
      // (Full Vertex AI SDK setup depends on GCP auth — adjust with Person B/C on Day 6)
      const genAI = new GoogleGenerativeAI(account.keyPath!);
      const geminiModel = genAI.getGenerativeModel({ model });
      const result = await geminiModel.generateContent(prompt);
      return result.response.text();
    } catch (error: any) {
      if (error.code === 429 || error.message?.includes("quota") || error.message?.includes("billing")) {
        console.warn(`[LLMClient] Vertex account ${this.currentVertexAccount} quota hit — rotating`);
        this.currentVertexAccount++;
        return await this.callVertexAI(prompt, model);
      }
      throw error;
    }
  }

  private async callFreeGemini(prompt: string, model: string): Promise<string> {
    const geminiModel = this.gemini.getGenerativeModel({ model });
    const result = await geminiModel.generateContent(prompt);
    return result.response.text();
  }

  private async callGroq(prompt: string): Promise<string> {
    const completion = await this.groq.chat.completions.create({
      model: process.env.FALLBACK_MODEL || "llama-3.1-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    return completion.choices[0].message.content || "";
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Embeddings always use free Gemini — no need to burn Vertex credits on these
    const model = this.gemini.getGenerativeModel({ model: process.env.EMBEDDING_MODEL || "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}

export const llmClient = new LLMClient(); // singleton — import this everywhere
```

#### Step 0.7: Test Both Environments

**Create `backend/src/utils/test-llm-client.ts`:**

```typescript
import { LLMClient } from "./llm-client";

async function testEnvironments() {
  const client = new LLMClient();

  // Test 1: Basic completion (works in both environments)
  console.log("\n--- Test 1: Basic Completion ---");
  const result = await client.complete("Say hello from " + process.env.APP_ENV + "!");
  console.log("✓ Response:", result);

  // Test 2: Fallback simulation
  console.log("\n--- Test 2: Embedding (always free tier) ---");
  const embedding = await client.generateEmbedding("test embedding");
  console.log("✓ Embedding dimensions:", embedding.length);

  // Test 3: Vertex AI (only when keys are ready — won't fail if missing)
  if (process.env.APP_ENV === "production" && process.env.VERTEX_KEY_1) {
    console.log("\n--- Test 3: Vertex AI accounts ---");
    const vertexResult = await client.complete("Confirm Vertex AI is working.");
    console.log("✓ Vertex AI response:", vertexResult);
  } else {
    console.log("\n--- Test 3: Vertex AI ---");
    console.log("⚠ Skipped (APP_ENV is not production or VERTEX_KEY_1 not set yet — this is expected on Days 1-5)");
  }

  console.log("\n✓ LLMClient ready for", process.env.APP_ENV, "environment.");
}

testEnvironments().catch(console.error);
```

**Run test (development environment):**
```bash
APP_ENV=development npx ts-node src/utils/test-llm-client.ts
```

**Expected output on Day 1:**
```
[LLMClient] Initialized in development mode → primary: gemini-free
--- Test 1: Basic Completion ---
✓ Response: Hello from development!
--- Test 2: Embedding ---
✓ Embedding dimensions: 768
--- Test 3: Vertex AI ---
⚠ Skipped (expected on Days 1-5)
✓ LLMClient ready for development environment.
```

✅ **Phase 0 Complete Checklist:**
- [ ] Gemini API key obtained and working
- [ ] Groq API key obtained and working
- [ ] `.env.development` created with free API keys
- [ ] `.env.production` template created (Vertex keys added on Day 6)
- [ ] Both `.env` files added to `.gitignore`
- [ ] `LLMClient` built with environment switching and Vertex rotation
- [ ] Test script runs successfully in development mode
- [ ] Project structure created, TypeScript configured

---

### **PHASE 1: Core Infrastructure (Day 1: Afternoon - Day 2: Morning)**
**Duration: 6-8 hours**  
**Evaluation Criteria: Antigravity Integration (20%), Technical Implementation**

#### Step 1.1: Wire LLM Client Into All Agents

> The LLMClient singleton from Phase 0 is the only import needed for AI calls across all 14 modules. Every agent prompt to Claude Code should reference this pattern:

```typescript
// Every agent file starts with this — never import AI SDKs directly
import { llmClient } from "../utils/llm-client";

// Usage inside any agent:
const response = await llmClient.complete(myPrompt);
const baseValidation = await llmClient.complete(validationPrompt, true); // useBaseModel=true
const embedding = await llmClient.generateEmbedding(text);
```

**Ask Claude Code in Antigravity Terminal:**
```
Using the master prompt at CHALLENGE_1_COMPLETE_MASTER_PROMPT.md,
the LLMClient is already built at backend/src/utils/llm-client.ts.

All agents must import the singleton: import { llmClient } from "../utils/llm-client"
Never import @google/generative-ai or groq-sdk directly in agent files.

Verify the singleton pattern works by creating a quick smoke test
that imports llmClient and calls complete() with a test prompt.
```

#### Step 1.2: Create Contract Registry and Validator

**Ask Claude Code:**
```
Implement the Contract Enforcement Layer from the master prompt:

1. Create backend/src/contracts/registry.ts
   - Load contracts from YAML files
   - Version management
   - Contract lookup by module name

2. Create backend/src/contracts/validator.ts
   - Structural validation (field presence, types, enums, ranges)
   - All validation rules from the master prompt
   - Use llmClient (imported from utils/llm-client) for semantic validation

3. Create sample contracts in backend/src/contracts/definitions/
   - multi_source_ingestion_v1.yaml
   - contradiction_detection_v1.yaml
   - action_chain_v1.yaml

Follow the exact contract schema from the master prompt.
```

**Verification:**
```bash
APP_ENV=development npx ts-node src/contracts/test-validator.ts
```

#### Step 1.3: Set Up Antigravity Agent Framework

**This is CRITICAL for 20% of your score.**

**Ask Claude Code:**
```
Create the base Antigravity agent structure at backend/src/agents/base.agent.ts

Requirements from master prompt:
- Each agent must log its reasoning to Antigravity trace
- Track tool usage, decisions, inputs, outputs
- Integrate with the contract validator
- Support retry logic for failures
- Use llmClient from "../utils/llm-client" for all LLM calls

Also create backend/src/tracing/collector.ts for aggregating all agent traces.

This trace data will be used to generate the workplan, task plan,
and decision logs required by the judges.
```

#### Step 1.4: Create Express API Server

**Ask Claude Code:**
```
Create backend/src/index.ts with Express server setup:

Routes needed:
- POST /api/pipeline/run - Main pipeline endpoint
- GET /api/pipeline/:id - Get pipeline results
- GET /api/pipeline/:id/trace - Get Antigravity trace logs
- GET /api/contracts - List all contracts
- GET /api/validations - Validation history

Include CORS, body parsing, error handling, and route logging.
```

**Start server:**
```bash
APP_ENV=development npm run dev
# Should see: "Server running on http://localhost:8000"
# Should see: "[LLMClient] Initialized in development mode → primary: gemini-free"
```

✅ **Phase 1 Complete Checklist:**
- [ ] All agents import `llmClient` singleton — no direct SDK imports in agent files
- [ ] LLM client working with Gemini free tier and Groq fallback
- [ ] Contract registry loading YAML definitions
- [ ] Validator passing all structural tests
- [ ] Base agent framework with trace logging
- [ ] Express server running and responding

---

### **PHASE 2: Content Ingestion & Analysis (Day 2: Afternoon - Day 3)**
**Duration: 8-10 hours**  
**Evaluation Criteria: Agentic Reasoning (20%), Insight Quality (20%)**

#### Step 2.1: Implement Multi-Source Ingestion (Module 1)

**Ask Claude Code:**
```
Implement backend/src/agents/multi-source-ingestion.agent.ts

From the master prompt, this agent must:
- Ingest 5+ sources in parallel (PDF, URL, CSV, JSON, real-time feed)
- Use pdf-parse for PDFs
- Use cheerio for URLs
- Use papaparse for CSVs
- Normalize all to common format
- Validate output against contract: multi_source_ingestion_v1
- Use llmClient from "../utils/llm-client" for any LLM calls

Also create test data in backend/test-data/:
- sample-report.pdf (warehouse inventory)
- sample-data.csv (sales dashboard)
- sample-email.txt (supplier notification)
- urls.json (news article URLs)
- realtime-feed.json (customer complaints)

Test with 5 simultaneous sources.
```

#### Step 2.2: Implement Credibility Scorer (Module 2)

**Ask Claude Code:**
```
Implement backend/src/agents/credibility-scorer.agent.ts

Scoring system from master prompt:
- Recency score: 0-40 points (based on timestamp)
- Authority score: 0-30 points (source type)
- Quality score: 0-30 points (citations, data, structure)
- Total: 0-100 → HIGH/MEDIUM/LOW/UNVERIFIED tiers

Include the exact scoring logic from the master prompt.
Use llmClient from "../utils/llm-client" for quality scoring.
```

#### Step 2.3: Implement Noise Filter (Module 3)

**Ask Claude Code:**
```
Implement backend/src/agents/noise-filter.agent.ts

Must include:
- Deduplication using embedding similarity (>85% = duplicate)
- Spam detection (special chars, promotional language)
- Staleness filter (recency_score = 0)
- Keep only highest-credibility source among duplicates

Use llmClient.generateEmbedding() for similarity calculation.
This always uses free Gemini embeddings regardless of APP_ENV — no credits burned here.
```

#### Step 2.4: Implement Contradiction Detector (Module 4)

**CRITICAL: This is worth 20% of your score (Insight Quality & Contradiction Handling)**

**Ask Claude Code:**
```
Implement backend/src/agents/contradiction-detector.agent.ts

This is the MOST IMPORTANT agent for the demo. From master prompt:

1. Extract factual claims from each source using llmClient.complete()
2. Group claims by topic
3. Detect contradictions:
   - Numeric (>20% difference)
   - Boolean (opposite values)
   - Categorical (different categories)
   - Temporal (different timeframes)

4. Score severity: CRITICAL/HIGH/MEDIUM/LOW

5. Output must match contract: contradiction_detection_v1

Include the exact LLM prompt from the master prompt for claim extraction.
Import llmClient from "../utils/llm-client" — do not import any AI SDK directly.
```

**Test with contradicting sources:**
```bash
APP_ENV=development npx ts-node src/agents/test-contradiction-detector.ts
# Source 1: "500 units"
# Source 2: "50 units"
# Source 3: "150 units"
# Expected: 3 contradictions detected, severity: CRITICAL
```

#### Step 2.5: Implement Conflict Resolution (Module 7)

**Ask Claude Code:**
```
Implement backend/src/agents/conflict-resolution.agent.ts

Resolution strategies from master prompt:
1. Trust most credible (if score difference > 30 points)
2. Trust most recent (if time difference > 24 hours)
3. Request clarification (if equal credibility & recency)
4. Aggregate (for slight numeric differences)
5. Flag for human review (severe conflicts)

IMPORTANT: Never force false conclusions. Generate investigation paths.

Output: ConflictResolution with investigation_actions array.
Use llmClient from "../utils/llm-client" for reasoning.
```

#### Step 2.6: Implement Insight Extraction (Module 5)

**Ask Claude Code:**
```
Implement backend/src/agents/insight-extraction.agent.ts

RAG-powered extraction:
1. Create in-memory vector store (simple cosine similarity, no external DB)
2. Chunk content (500 tokens, 100 overlap)
3. Generate embeddings using llmClient.generateEmbedding()
   (always uses free Gemini — embeddings never burn Vertex credits)
4. Retrieve top-5 relevant chunks
5. Pass to llmClient.complete() with the exact prompt from master prompt

Extract 3-7 insights:
- Trends (patterns over time)
- Risks (negative potential)
- Opportunities (positive potential)
- Contradictions (conflicting evidence - flag as REQUIRES_RESOLUTION)

Output must include: requires_resolution, contradiction_details
```

#### Step 2.7: Implement Temporal Analysis (Module 6)

**Ask Claude Code:**
```
Implement backend/src/agents/temporal-analysis.agent.ts

Detect patterns:
- Decline (decreasing over time)
- Spike (sudden sharp increase)
- Drift (gradual change)
- Anomaly (unexpected outlier)
- Stable (no significant change)

Calculate trend using linear regression on time-series data.
Detect spikes using standard deviation (>2σ from mean).

Include confidence score (R² for trend).
Use llmClient from "../utils/llm-client" for natural language explanation of patterns.
```

✅ **Phase 2 Complete Checklist:**
- [ ] 5+ sources ingested in parallel
- [ ] Credibility scores calculated correctly
- [ ] Duplicates removed based on embeddings (free Gemini)
- [ ] Contradictions detected across sources
- [ ] Conflict resolution strategies working
- [ ] Insights extracted with RAG
- [ ] Temporal patterns detected
- [ ] All modules validated against contracts
- [ ] No agent imports AI SDKs directly (all go through llmClient)

---

### **PHASE 3: Action Chain & Simulation (Day 3: Afternoon - Day 4)**
**Duration: 8-10 hours**  
**Evaluation Criteria: Action Chain Simulation (15%), Robustness (15%)**

#### Step 3.1: Implement Impact Analysis with Constraints (Module 8)

**Ask Claude Code:**
```
Implement backend/src/agents/impact-analysis.agent.ts

From master prompt, analyze impact under constraints:
- Budget limit (PKR amount)
- Time limit (hours available)
- Resource limits (API calls, compute, human hours)
- Urgency level (critical/high/medium/low)

Output: ImpactAnalysis with:
- quantified_impact (cost, time, affected_count)
- constraints_violated (which limits this violates)
- cascading_effects
- risk_if_ignored

Use llmClient from "../utils/llm-client" for all LLM reasoning.
```

#### Step 3.2: Implement Action Chain Generator (Module 9)

**CRITICAL: This demonstrates the 3-5 interconnected actions requirement**

**Ask Claude Code:**
```
Implement backend/src/agents/action-chain-generator.agent.ts

MUST generate 3-5 actions (not 1, not 10).

Action types from master prompt:
- diagnose, notify, update_system, mitigate, monitor, verify, escalate

Each action must have:
- depends_on (action_ids that must complete first)
- blocks (action_ids that wait for this)
- constraints (max_cost, max_duration, resources, api_rate_limit)
- simulatable: true/false
- failure_recovery (retry_count, fallback_action_id, rollback_required)

Build dependency graph and determine execution_order.
Use the exact LLM prompt from the master prompt.
Import llmClient from "../utils/llm-client".
```

#### Step 3.3: Implement Constraint Validator (Module 10)

**Ask Claude Code:**
```
Implement backend/src/simulation/constraint-validator.ts

For each action in the chain:
1. Check if max_cost > budget_limit → BLOCKING violation
2. Check if max_duration > time_limit → BLOCKING violation
3. Check if api_rate_limit > resource_limit → WARNING violation

Output: is_feasible, violations[], recommended_modification

If action is infeasible, suggest modification or alternative.
```

#### Step 3.4: Implement Action Chain Simulator (Module 11)

**Ask Claude Code:**
```
Implement backend/src/simulation/chain-simulator.ts

Execute actions in execution_order:
1. Check dependencies are satisfied
2. Track state before execution
3. Simulate execution based on simulation_type:
   - database_query
   - send_notification
   - place_order
   - update_dashboard
   - schedule_monitoring

4. Track state after execution
5. Log every step
6. Calculate cost and latency

IMPORTANT: Support failure injection for stress testing.
Set simulateFailures=true to randomly fail actions based on expected_success_rate.
```

#### Step 3.5: Implement Failure Recovery Engine (Module 12)

**CRITICAL: Demonstrates robustness (15% of score)**

**Ask Claude Code:**
```
Implement backend/src/simulation/failure-recovery.ts

When an action fails:
1. Check retry_count → if > 0, retry
2. Check fallback_action_id → if exists, use fallback action
3. Check rollback_required → if true, rollback to previous state
4. Otherwise, skip and continue

Log every recovery attempt.

This will be demonstrated in the demo video to show system robustness.
```

#### Step 3.6: Implement Outcome Visualizer (Module 13)

**Ask Claude Code:**
```
Implement backend/src/simulation/outcome-visualizer.ts

Generate outcome visualization:
- before_state vs after_state
- state_diff (added/removed/modified/unchanged variables)
- action_execution_timeline (with timestamps, status, cost, duration)
- metrics (total_cost, total_duration, success_rate, failures_recovered)
- projected_impact (risk_reduction, estimated_value)

This data will power the frontend visualization.
```

✅ **Phase 3 Complete Checklist:**
- [ ] Impact analysis calculates constraints
- [ ] Action chain generates 3-5 interconnected actions
- [ ] Constraint validator rejects infeasible actions
- [ ] Simulator executes actions with state tracking
- [ ] Failure injection works (randomly fails actions)
- [ ] Recovery engine retries/falls back/rolls back
- [ ] Outcome visualizer generates before/after diff

---

### **PHASE 4: Main Pipeline Orchestrator (Day 4: Afternoon)**
**Duration: 4-6 hours**  
**Evaluation Criteria: Agentic Reasoning (20%), Antigravity Integration (20%)**

#### Step 4.1: Implement Pipeline Orchestrator

**This is the CORE that ties everything together and generates Antigravity traces.**

**Ask Claude Code:**
```
Implement backend/src/agents/orchestrator.ts

This is the main pipeline from the master prompt that:
1. Runs all 14 modules in sequence
2. Validates each module output with contract enforcement
3. Logs every step to Antigravity trace
4. Handles contract violations (re-generate or fallback)
5. Returns complete pipeline result

The orchestrator must follow the exact flow from the master prompt:

Module 1 → Contract Gate → Module 2 → Contract Gate → ... → Module 14

Each contract gate decision (PASS/WARN/REJECT) must be logged.
This generates the workplan, task plan, and decision trace required by judges.

All LLM calls must go through llmClient from "../utils/llm-client".
The orchestrator itself should not import any AI SDK.
```

**Key requirement from master prompt:**
```typescript
// For each module:
const gateDecision = await this.decisionGate.evaluate(
    moduleOutput,
    contract,
    inputData
);
this.traceCollector.log(gateDecision.traceEvent);

if (gateDecision.action === "REJECT") {
    moduleOutput = gateDecision.handleRejection();  // re-generate or fallback
}
```

#### Step 4.2: Implement Trace Exporter

**Ask Claude Code:**
```
Implement backend/src/tracing/exporter.ts

Export Antigravity traces in the format judges expect:

{
  "pipeline_id": "uuid",
  "environment": "development | production",
  "ai_provider_used": "gemini-free | vertex-ai | groq",
  "workplan": "High-level plan of what the system will do",
  "task_plan": [
    "Task 1: Ingest 5 sources",
    "Task 2: Score credibility",
    ...
  ],
  "reasoning_steps": [
    {
      "step": 1,
      "agent": "contradiction_detector",
      "reasoning": "Detected numeric contradiction: 500 vs 50 units",
      "decision": "Flag for conflict resolution",
      "confidence": 0.92
    }
  ],
  "tool_calls": [
    {"tool": "gemini_llm", "provider": "gemini-free", "input": "...", "output": "..."},
    {"tool": "embedding_api", "provider": "gemini-free", "input": "...", "output": "..."}
  ],
  "action_execution": [
    {"action": "verify_stock", "status": "success", "duration_ms": 234},
    {"action": "place_order", "status": "failed", "retry": 1},
    {"action": "place_order", "status": "success", "duration_ms": 567}
  ],
  "recovery_steps": [
    "Action 'place_order' failed with API timeout",
    "Recovery strategy: retry (attempt 2/3)",
    "Retry succeeded"
  ]
}

Note: Include environment and ai_provider_used fields so judges can see
the system works across both development and production providers.
```

#### Step 4.3: Create API Route for Pipeline

**Ask Claude Code:**
```
Implement backend/src/routes/pipeline.routes.ts

POST /api/pipeline/run
Body:
{
  "sources": [
    {"type": "pdf", "content": "base64..."},
    {"type": "url", "url": "https://..."},
    {"type": "csv", "content": "..."},
    {"type": "json", "data": {...}},
    {"type": "realtime_feed", "data": [...]}
  ],
  "constraints": {
    "budget_limit": 500000,
    "time_limit_hours": 24,
    "urgency": "critical"
  }
}

Response:
{
  "pipeline_id": "uuid",
  "status": "completed",
  "insights": [...],
  "contradictions": [...],
  "action_chain": [...],
  "simulation_results": [...],
  "outcome": {...},
  "trace": {...}
}
```

**Test the full pipeline:**
```bash
APP_ENV=development npx ts-node src/utils/test-llm-client.ts   # confirm provider
curl -X POST http://localhost:8000/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d @test-data/inventory-shortage-scenario.json
```

✅ **Phase 4 Complete Checklist:**
- [ ] Orchestrator runs all 14 modules in sequence
- [ ] Contract gates validate every module output
- [ ] Trace collector logs every decision
- [ ] Trace exporter includes environment and provider fields
- [ ] API endpoint accepts 5+ sources
- [ ] Full pipeline completes end-to-end in development mode
- [ ] Test scenario produces expected output

---

### **PHASE 5: Frontend & Mobile Apps (Day 5 - Day 6)**
**Duration: 12-16 hours**  
**Evaluation Criteria: Innovation & UX (10%)**

#### Step 5.1: Set Up React Web Dashboard

**In Antigravity Terminal:**
```bash
cd ../frontend
npx create-react-app . --template typescript
npm install axios recharts react-router-dom
npm install tailwindcss @tailwindcss/typography
```

#### Step 5.2: Create Dashboard Components

**Ask Claude Code:**
```
Create the following React components in frontend/src/components/:

1. InputPanel.tsx
   - 5 file upload fields (PDF, CSV, JSON, URL input, Real-time feed textarea)
   - Constraint inputs (budget, time limit, urgency selector)
   - "Run Pipeline" button

2. PipelineProgress.tsx
   - Real-time progress bar showing which module is running
   - Each module shows: ⏳ Running → ✓ Pass / ⚠️ Warn / ✗ Reject

3. ContradictionViewer.tsx
   - Display detected contradictions
   - Show conflicting sources side-by-side
   - Show credibility scores
   - Show resolution strategy

4. ActionChainViewer.tsx
   - Display 3-5 actions as connected nodes
   - Show dependencies (arrows between actions)
   - Show constraints for each action
   - Highlight infeasible actions in red

5. SimulationResults.tsx
   - Before/After state comparison table
   - Execution timeline with status indicators
   - Cost/latency metrics (total cost, total time, success rate)

6. TraceViewer.tsx
   - Expandable tree view of Antigravity trace
   - Show workplan, task plan, reasoning steps
   - Tool calls, decisions, recovery steps
   - Show which AI provider was used (for judges)

Use Tailwind CSS for styling. Make it look professional.
```

#### Step 5.3: Deploy Frontend (Person C — Firebase Hosting, no credits needed)

```bash
# Person C runs this — Firebase free tier covers it completely
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy

# Share the Firebase URL with the team
# e.g. https://content-action-agent.web.app
```

**Update CORS in backend to allow Firebase URL:**
```typescript
app.use(cors({
  origin: [
    'http://localhost:3000',           // local dev
    'https://your-app.web.app',        // Person C's Firebase URL
  ]
}));
```

#### Step 5.4: Set Up React Native Mobile App (MANDATORY)

**In Antigravity Terminal:**
```bash
cd ../mobile
npx react-native init ContentActionAgent --template react-native-template-typescript
cd ContentActionAgent
npm install axios @react-navigation/native @react-navigation/stack
```

#### Step 5.5: Create Mobile Screens

**Ask Claude Code:**
```
Create mobile screens in mobile/src/screens/:

1. HomeScreen.tsx
   - Simple input form (paste text or URL)
   - "Analyze" button
   - Recent pipeline runs list

2. ResultsScreen.tsx
   - Scrollable cards showing:
     * Insights (with severity badges)
     * Contradictions (with resolution)
     * Action Chain (simplified view)
     * Simulation Results (before/after)

3. TraceScreen.tsx
   - Simplified trace view
   - Expandable sections for each agent

Keep the mobile UI simple and focused.
Point all API calls to Person A's Cloud Run URL (backend).
```

**Build mobile app:**
```bash
npx react-native run-android
```

✅ **Phase 5 Complete Checklist:**
- [ ] Web dashboard displays all pipeline results
- [ ] Contradiction viewer shows conflicts clearly
- [ ] Action chain shows dependency graph
- [ ] Simulation results show before/after diff
- [ ] Trace viewer displays Antigravity logs including provider info
- [ ] Frontend deployed to Firebase (Person C, no credits used)
- [ ] Mobile app runs on Android/iOS
- [ ] Mobile app points to Cloud Run backend URL

---

### **PHASE 6: Production Switch + Stress Tests (Day 6: May 18)**
**Duration: 6-8 hours**  
**Evaluation Criteria: Robustness (15%)**

#### Step 6.1: Deploy Backend to Cloud Run (Person A — May 18 Morning)

> This is the first time GCP credits are used. Person A deploys the backend so judges have a public URL.

```bash
# Person A runs this from their GCP account
gcloud run deploy content-action-agent \
  --source ./backend \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars APP_ENV=production

# Share the Cloud Run URL with the team
# e.g. https://content-action-agent-xyz.run.app
```

**Update mobile app and any hardcoded URLs to point to this Cloud Run URL.**

#### Step 6.2: Set Up Vertex AI Keys and Test Production Switch (May 18 Afternoon)

> Person B and C generate GCP service account keys and share them securely with whoever manages `.env.production`.

```bash
# Person B and C each do this in their GCP Console:
# IAM → Service Accounts → Create → Vertex AI User role → Download JSON key

# Team lead fills in .env.production with both keys:
nano .env.production
# VERTEX_KEY_1=/path/to/person_b_key.json
# VERTEX_PROJECT_ID_1=person-b-project-id
# VERTEX_KEY_2=/path/to/person_c_key.json
# VERTEX_PROJECT_ID_2=person-c-project-id

# Test production environment
APP_ENV=production npx ts-node src/utils/test-llm-client.ts
```

**Expected output when Vertex keys are ready:**
```
[LLMClient] Initialized in production mode → primary: vertex-ai
--- Test 1: Basic Completion ---
✓ Response: Hello from production!
--- Test 2: Embedding ---
✓ Embedding dimensions: 768
--- Test 3: Vertex AI accounts ---
✓ Vertex AI response: Confirmed Vertex AI is working.
✓ LLMClient ready for production environment.
```

#### Step 6.3: Run One Full Pipeline in Production Mode

> Run exactly ONE full pipeline to confirm the production switch works. Don't waste credits on multiple runs here — stress tests still run in development mode.

```bash
APP_ENV=production curl -X POST https://your-cloud-run-url/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d @demo-data/inventory-shortage-request.json
```

Confirm: trace shows `"ai_provider_used": "vertex-ai"`.

#### Step 6.4: Run Stress Tests (in Development Mode — Don't Burn Credits)

> Stress tests run in development mode. They're for verifying logic, not impressing judges with Vertex AI.

**Ask Claude Code:**
```
Create backend/test/stress-tests.ts with the 5 scenarios from master prompt:

Test 1: Conflicting Values Across 3 Sources
Test 2: Constraint Violation (PKR 600K vs 500K budget)
Test 3: Action Failure & Retry
Test 4: Low-Credibility False Signal
Test 5: Cascading Side Effect

Each test should output PASS/FAIL with details.
Run with: APP_ENV=development npm run test:stress
```

```bash
APP_ENV=development npm run test:stress
```

**Expected output:**
```
✓ Stress Test 1: Conflicting Values - PASS
✓ Stress Test 2: Constraint Violation - PASS
✓ Stress Test 3: Action Failure & Retry - PASS
✓ Stress Test 4: Low-Credibility Outlier - PASS
✓ Stress Test 5: Cascading Side Effect - PASS

All stress tests passed. System is robust.
```

#### Step 6.5: Prepare Demo Scenario

**Create the Inventory Shortage scenario:**

```bash
mkdir -p backend/demo-data
```

**Ask Claude Code:**
```
Create demo data files in backend/demo-data/:

1. warehouse-report.pdf
   Content: "Warehouse Inventory Report - Date: [1 week ago]
   Product SKU-1234: 500 units in stock"

2. sales-dashboard.csv
   Content: Date,Product,Orders,Trend
   [Today],SKU-1234,130,+30%

3. supplier-email.txt
   Content: "Delivery Update: Due to transport strike,
   your order will be delayed by 3 days."

4. news-url.txt
   Content: https://example.com/news/transport-delays

5. customer-complaints.json
   [{"timestamp": "[2 hours ago]", "message": "SKU-1234 out of stock"}, ...]
```

✅ **Phase 6 Complete Checklist:**
- [ ] Backend deployed to Cloud Run (Person A's credits)
- [ ] Vertex AI keys from Person B and C configured in `.env.production`
- [ ] Production switch tested — one full pipeline run on Vertex AI confirms ✓
- [ ] Trace output shows `"ai_provider_used": "vertex-ai"`
- [ ] All 5 stress tests passing (development mode)
- [ ] Demo scenario data created and tested

---

### **PHASE 7: Documentation & Video (Day 7: May 19-20)**
**Duration: 6-8 hours**  
**Deliverables: README, Demo Video**

#### Step 7.1: Create README.md

**Ask Claude Code:**
```
Create README.md in the project root following the deliverables requirements:

# Content-to-Action Agent — Challenge 1

## Architecture Overview
- Diagram of 14 modules
- Data flow from input to output
- Contract enforcement layer explanation

## Data Sources
- 5 input types supported
- Sample data files included
- Credibility scoring criteria

## Tools & APIs Used

### AI Providers
- Google Gemini 1.5 Flash (primary LLM — development & fallback)
- Google Gemini 1.5 Pro (base model validation & production)
- Vertex AI Gemini (demo day — GCP credits, higher rate limits)
- Groq Llama 3.1 70B (emergency fallback)
- Google text-embedding-004 (RAG embeddings — always free tier)

### Infrastructure
- Google Antigravity (orchestration)
- Cloud Run / Person A's GCP account (backend hosting)
- Firebase Hosting (frontend — free tier)
- Cloud Storage / Person C's GCP account (file uploads)

### Environment Strategy
- Development (Days 1-5): Free Gemini API + Groq — zero cost
- Production (Days 6-7): Vertex AI via GCP credits — demo-day stability
- Automatic fallback: Vertex → Free Gemini → Groq (pipeline never breaks)

## Google Antigravity Role
- Orchestrates all 14 agent modules
- Manages reasoning and planning
- Logs workplan, task plan, decisions
- Handles tool calls and action execution
- Traces recovery from failures

## Assumptions
- List any assumptions made

## Constraints
- Budget, time, resource, urgency constraints
- How they're validated and enforced

## Cost & Latency Analysis
- Average cost per pipeline run
- Average latency per module
- Total pipeline latency
- Comparison with/without contract enforcement

## Baseline Comparison
- Pipeline with vs without contradiction detection
- Pipeline with vs without failure recovery
- Impact on accuracy and robustness

## Limitations
- Known edge cases
- Future improvements

## How to Run
\`\`\`bash
# Development (free tier)
cd backend
npm install
APP_ENV=development npm run dev

# Production (Vertex AI)
APP_ENV=production npm run dev

# Frontend
cd frontend
npm install
npm start

# Mobile
cd mobile/ContentActionAgent
npm install
npx react-native run-android
\`\`\`

## Demo
- Link to demo video
- Test data location
- Expected outputs
```

#### Step 7.2: Record Demo Video (3-5 minutes)

> **Record the demo video in production mode (Vertex AI).** This is the one time it really matters.

```bash
# Before recording — confirm production is active
APP_ENV=production npm run dev
# Should show: "[LLMClient] Initialized in production mode → primary: vertex-ai"
```

**Video Structure (follow the deliverables requirements exactly):**

**Segment 1: Introduction (30 seconds)**
- "This is our Content-to-Action Agent for Challenge 1"
- "Demonstrates: multi-source ingestion, contradiction detection, action chains, failure recovery"

**Segment 2: Input (30 seconds)**
- Show 5 sources being uploaded/entered simultaneously
- Point out the different types: PDF, CSV, URL, email, complaints
- Show constraints being set: Budget PKR 500K, Time 24h, Urgency: Critical

**Segment 3: Contradiction Detection (45 seconds)**
- Pipeline runs, show real-time progress
- Highlight when contradiction detector finds: "500 units vs out-of-stock"
- Show credibility scores: PDF (45 - stale) vs Complaints (85 - recent)
- Show conflict resolution: "Trust real-time data, investigate via database query"

**Segment 4: Action Chain (60 seconds)**
- Display the 5-action chain with dependency graph
- Point out: ACT-001 (verify) → ACT-002 (notify) → ACT-003 (order) → ACT-004 (update) → ACT-005 (monitor)
- Show constraint validation: ACT-003 costs PKR 450K (within PKR 500K limit) ✓
- Start simulation

**Segment 5: Failure & Recovery (45 seconds)**
- Show ACT-003 failing: "Supplier API timeout"
- Show recovery strategy: "Retry (attempt 2/3)"
- Show retry succeeding: "Order placed: ORDER-12345"
- Highlight in Antigravity trace: decision, failure, recovery logged

**Segment 6: Outcome (30 seconds)**
- Show before/after state comparison
- Metrics: Total cost PKR 455K, Total time 3.7h, Success rate 83%
- Projected impact: Stockout risk reduced 80%, Revenue protected PKR 2M

**Segment 7: Antigravity Trace (30 seconds)**
- Open trace viewer
- Show: Workplan, Task plan, Reasoning steps, Tool calls, Recovery steps
- Point out `"ai_provider_used": "vertex-ai"` in the trace
- Close with: "All judgement criteria met"

**Total: 4 minutes 30 seconds**

**Recording tips:**
- Use screen recording software (OBS, QuickTime, etc.)
- Record at 1080p
- Use clear narration
- Show both web dashboard and mobile app
- Export as MP4

#### Step 7.3: Final Verification

**Check ALL deliverables:**
- [ ] Working prototype ✓ (backend + frontend + mobile)
- [ ] Mobile app ✓ (React Native, runs on Android/iOS)
- [ ] Web app ✓ (React, shows all visualizations)
- [ ] Demo video ✓ (3-5 minutes, shows required flow, recorded in production mode)
- [ ] Antigravity trace ✓ (workplan, task plan, reasoning, tools, failures, recovery, provider info)
- [ ] README ✓ (architecture, sources, tools, environment strategy, Antigravity role, assumptions, constraints, cost/latency, baseline, limitations)

**Check ALL evaluation criteria:**
- [ ] Antigravity integration 20% ✓ (orchestrates all modules, comprehensive traces)
- [ ] Agentic reasoning 20% ✓ (14 agents, clear decision chains, multi-step reasoning)
- [ ] Contradiction handling 20% ✓ (detector, credibility scorer, conflict resolver)
- [ ] Action chain simulation 15% ✓ (3-5 actions, state tracking, before/after)
- [ ] Robustness 15% ✓ (constraint validation, failure recovery, 5 stress tests)
- [ ] Innovation & UX 10% ✓ (AMCE contract layer, clean UI, mobile app, dual-provider architecture)

---

## USING CLAUDE CODE IN ANTIGRAVITY TERMINAL

### How to Interact with Claude Code for Each Step

**Pattern for every implementation request:**

```
Context: I'm building Challenge 1 Content-to-Action Agent.
Reference: CHALLENGE_1_COMPLETE_MASTER_PROMPT.md sections [X, Y, Z]

Task: Implement [specific module/component]

Requirements from master prompt:
1. [Specific requirement 1]
2. [Specific requirement 2]
3. [Contract validation requirement]
4. Import llmClient from "../utils/llm-client" — do NOT import AI SDKs directly

Implementation location: [file path]

Please provide:
- Complete TypeScript implementation
- Error handling
- Antigravity trace logging
- Test data/cases
- Verification steps

After implementation, I will test with:
APP_ENV=development [test command]
```

### Example Claude Code Prompts

**Example 1: Implementing Contradiction Detector**
```
Context: Building Challenge 1 Content-to-Action Agent for AI Seekho 2026 hackathon.
Reference: CHALLENGE_1_COMPLETE_MASTER_PROMPT.md, Module 4: Contradiction Detector

Task: Implement the contradiction detector agent

Requirements from master prompt:
1. Extract factual claims from sources using LLM
2. Group claims by topic
3. Detect numeric, boolean, categorical, temporal contradictions
4. Score severity: CRITICAL/HIGH/MEDIUM/LOW
5. Validate output against contract: contradiction_detection_v1
6. Log all decisions to Antigravity trace
7. Import { llmClient } from "../utils/llm-client" — do NOT use GoogleGenerativeAI directly

Implementation location: backend/src/agents/contradiction-detector.agent.ts

LLM Prompt to use (from master prompt):
[paste the exact prompt from the master prompt]

Please provide:
- Full TypeScript class implementation
- llmClient integration (not direct Gemini SDK)
- Error handling for LLM failures
- Antigravity trace event creation
- Sample test with 3 conflicting sources

After implementation, I will test with:
APP_ENV=development npx ts-node src/agents/test-contradiction-detector.ts
```

**Example 2: Creating API Route**
```
Context: Building Challenge 1 pipeline API
Reference: CHALLENGE_1_COMPLETE_MASTER_PROMPT.md, Backend Architecture section

Task: Create the main pipeline API endpoint

Requirements:
- POST /api/pipeline/run
- Accept 5+ sources in request body
- Accept constraints (budget, time, urgency)
- Call orchestrator.run()
- Return pipeline result with trace including provider info
- Handle errors gracefully

Implementation location: backend/src/routes/pipeline.routes.ts

Please provide:
- Express route handler
- Request validation using Zod
- Response formatting
- Error middleware
- cURL test command using APP_ENV=development

After implementation, I will test with:
APP_ENV=development curl -X POST http://localhost:8000/api/pipeline/run -d @test-data/request.json
```

---

## TROUBLESHOOTING GUIDE

### Common Issues & Solutions

**Issue 1: Gemini API rate limit exceeded (development)**
```
Error: 429 Too Many Requests

Solution:
The LLMClient handles this automatically — it switches to Groq fallback.
If both are rate-limited, add a delay between test runs.
Do NOT switch to Vertex AI early — save credits for demo day.
```

**Issue 2: Vertex AI auth failing (production)**
```
Error: Could not load credentials

Solution:
1. Confirm VERTEX_KEY_1 path in .env.production is absolute, not relative
2. Check service account has "Vertex AI User" role in GCP Console
3. Test with: APP_ENV=production npx ts-node src/utils/test-llm-client.ts
4. If still failing, LLMClient falls back to free Gemini automatically
```

**Issue 3: Contract validation failing**
```
Error: REJECT - Field 'insight_id' does not match regex

Solution:
1. Check contract YAML definition
2. Verify LLM output matches exact format
3. Add retry with stricter LLM prompt
4. Use base model fallback: llmClient.complete(prompt, true)
```

**Issue 4: Antigravity trace not logging**
```
Error: Trace events not appearing in output

Solution:
1. Verify TraceCollector is singleton
2. Call traceCollector.log() after each module
3. Export trace before sending response
4. Check trace exporter formatting
```

**Issue 5: Mobile app not building**
```
Error: Metro bundler failed

Solution:
1. Clear cache: npx react-native start --reset-cache
2. Rebuild: cd android && ./gradlew clean
3. Re-install dependencies: rm -rf node_modules && npm install
```

**Issue 6: Frontend CORS errors after Cloud Run deployment**
```
Error: Access-Control-Allow-Origin missing

Solution:
Update backend CORS config to include Firebase URL:
app.use(cors({ origin: ['http://localhost:3000', 'https://your-app.web.app'] }))
Redeploy to Cloud Run.
```

---

## TIME MANAGEMENT CHECKLIST

**Day 1 (May 13):** ☐ Phase 0 (env setup + LLMClient) + Phase 1 (core infra)  
**Day 2 (May 14):** ☐ Phase 2 (Modules 1-7, content analysis)  
**Day 3 (May 15):** ☐ Phase 3 (Modules 8-13, action chain & simulation)  
**Day 4 (May 16):** ☐ Phase 4 (Orchestrator + API)  
**Day 5 (May 17):** ☐ Phase 5 (Frontend + Mobile + Firebase deploy)  
**Day 6 (May 18 AM):** ☐ Cloud Run deploy (Person A's credits)  
**Day 6 (May 18 PM):** ☐ Vertex AI keys added → production switch tested → stress tests (dev mode)  
**Day 7 (May 19-20):** ☐ Phase 7 (README + Demo video in production mode)  

**Credits are first used on Day 6. Days 1-5 are completely free.**

**FINAL DEADLINE: May 20, 2026, 11:59 PM**

---

## SUCCESS CRITERIA

You will know you're ready to submit when:

✅ Backend runs without errors in both development and production modes  
✅ 5+ sources can be ingested simultaneously  
✅ Contradictions are detected and resolved  
✅ 3-5 action chain is generated  
✅ At least 1 action fails and recovers successfully  
✅ Constraint violations are caught  
✅ Before/after state shown with cost/latency  
✅ Mobile app displays results  
✅ Antigravity trace includes workplan/task plan/reasoning/recovery/provider info  
✅ README documents environment strategy and dual-provider architecture  
✅ Demo video shows complete flow recorded in production mode (Vertex AI)  
✅ All 5 stress tests pass  
✅ Firebase URL (frontend) and Cloud Run URL (backend) are publicly accessible  

**When all checkboxes are complete: SUBMIT**

Good luck! 🚀
