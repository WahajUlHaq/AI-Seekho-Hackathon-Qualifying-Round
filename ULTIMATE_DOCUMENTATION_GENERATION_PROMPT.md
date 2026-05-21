# ULTIMATE DOCUMENTATION GENERATION PROMPT
## Autonomous Content-to-Action Agent — InnoCollab AI Seekho 2026 Hackathon
### Complete Professional Project Documentation — Google Antigravity Orchestrated

---

> **PRIMARY ORCHESTRATOR:** Google Antigravity (Central Brain — Mandatory)
> **ASSISTANT TOOLS:** Claude Code / Gemini / Groq (running inside Antigravity IDE)
> **TRIGGER CONDITION:** This prompt executes ONLY after the AuditSummaryReceipt confirms `documentation_gate: "AUTHORIZED"` and `fail_count: 0`
> **OUTPUT:** A complete, submission-ready professional documentation suite written to `docs/` directory
> **AUDIENCE:** Hackathon judges, technical reviewers, and future contributors

---

## HOW TO USE THIS PROMPT IN GOOGLE ANTIGRAVITY

```
1. Open your Antigravity project workspace (content-action-agent/).
2. Paste this entire document into the Antigravity Agent input.
3. Antigravity will:
   - Parse this prompt into a master documentation task plan
   - Assign each documentation section to a dedicated writing sub-agent
   - Pull live data from your actual codebase (agents, contracts, routes, audit logs)
   - Use Claude Code sub-agents for deep code analysis and accurate documentation
   - Synthesize all sections into a unified, cross-referenced documentation suite
   - Self-review each document for completeness before committing to docs/
4. Antigravity must emit a trace event for each document written:
   { doc_id, title, word_count, status: "COMPLETE", output_path }
5. Final deliverable: A MasterDocumentationIndex.md listing every generated file
   with its purpose, page count, and section summary.
```

**Antigravity Master Directive:**
```
You are the documentation architect and lead technical writer for this project.
Your goal is to produce documentation that is:
  - EXHAUSTIVE: Every module, design decision, pattern, and integration explained
  - ACCURATE: Pull real code, real file paths, real interface types from the codebase
  - PROFESSIONAL: Written at the level expected for enterprise software submissions
  - CROSS-REFERENCED: Every document links to related sections across the suite
  - AUDIT-VERIFIED: Each module section includes its audit check ID and PASS status
  - SELF-EXPLANATORY: A judge with no prior context should understand the full system

Generate all documents below in sequence. For each document, first READ the
relevant source files using your file system tools, then WRITE the documentation
from what you actually observe in the code — never fabricate implementation details.
All documents go into: content-action-agent/docs/
```

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 1 — PROJECT MASTER README
## File: `docs/README.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Master README Writer
**Source Files to Read First:** `backend/src/`, `frontend/src/`, `mobile/src/`, `backend/.env.example`, root `package.json`

Write a complete, professional `README.md` that serves as the entry point for the entire documentation suite. This document must contain every section listed below, written with full depth and zero placeholder text.

---

### SECTION 1.1 — PROJECT BANNER & BADGES

Generate a markdown header block containing:
- Project name: **Autonomous Content-to-Action Agent**
- Hackathon: **InnoCollab AI Seekho 2026 — Challenge 1**
- Deadline: **May 20, 2026**
- Status badges (markdown format): `Build: Passing`, `Audit: 45/45 PASS`, `TypeScript: Strict`, `Platform: Google Antigravity`
- Technology stack badges: Node.js, TypeScript, React, Expo, Google Gemini, Vertex AI, Groq, Firebase, Cloud Run

---

### SECTION 1.2 — EXECUTIVE SUMMARY (400–500 words)

Write a comprehensive executive summary explaining:

**What the system is:** An advanced autonomous agentic AI system — NOT a summarization tool. It ingests 5+ simultaneous content sources (PDFs, URLs, CSVs, dashboards, real-time feeds), detects contradictions and conflicts across them, performs temporal analysis to track signal changes over time, filters noise and duplicates using semantic deduplication, generates 3–5 interconnected action chains, simulates execution with constraint validation (budget, time, resources, urgency), handles failure recovery and rollback, and shows quantified before/after state changes.

**What makes it unique:** The AMCE-inspired Contract Enforcement Layer — every one of the 14 module outputs is validated by an independent base model before the pipeline proceeds. This is a dual-model architecture where the primary model generates and the base model validates, creating a self-correcting autonomous system.

**Google Antigravity's role:** Antigravity is the central orchestration brain. It does NOT just call a backend API — it manages the complete reasoning chain, task planning, tool dispatch, agent coordination, failure recovery decisions, and produces a structured workplan + reasoning trace that judges can inspect to evaluate every decision made by the system.

**Business scenario demonstrated:** The Inventory Shortage Crisis scenario — a realistic Pakistani retail/supply-chain crisis where five conflicting data sources (a week-old warehouse PDF, a real-time sales CSV, a supplier email, a news article, and a live customer complaint feed) converge to trigger a 5-action emergency response chain worth PKR 455,000, with one simulated API failure and automatic retry recovery.

---

### SECTION 1.3 — QUICK START (Full Setup Guide)

Write complete, executable setup instructions for three environments:

**Development Setup (Days 1–5 — Zero Cost):**
```bash
# Clone and install
cd content-action-agent/backend && npm install
# Configure free tier environment
cp .env.example .env.development
# Fill in: GEMINI_API_KEY, GROQ_API_KEY
APP_ENV=development npm run dev
# Expected: [LLMClient] Initialized in development mode → primary: gemini-free
```

**Frontend Setup:**
```bash
cd content-action-agent/frontend && npm install && npm run dev
# Available at: http://localhost:3000
```

**Mobile Setup:**
```bash
cd content-action-agent/mobile && npm install
npx expo start
# Scan QR code with Expo Go app
```

**Production Setup (Days 6–7 — GCP Credits):**
```bash
cp .env.example .env.production
# Fill in: VERTEX_KEY_1, VERTEX_PROJECT_ID_1, VERTEX_KEY_2, VERTEX_PROJECT_ID_2
APP_ENV=production npm run dev
# Expected: [LLMClient] Initialized in production mode → primary: vertex-ai
```

Include URLs: Cloud Run backend URL, Firebase frontend URL, and how to update them.

---

### SECTION 1.4 — COMPLETE DELIVERABLES MATRIX

Create a table listing every submission deliverable with its status:

| Deliverable | Requirement | Location | Status |
|:---|:---|:---|:---|
| Working prototype | Mandatory | Cloud Run + Firebase | ✅ PASS |
| Mobile app (React Native/Expo) | Mandatory | `mobile/` | ✅ PASS |
| Web dashboard | Recommended | `frontend/` | ✅ PASS |
| Demo video (3–5 min) | Mandatory | `docs/demo/` | ✅ PASS |
| Antigravity trace logs | Mandatory | `backend/audit-logs/` | ✅ PASS |
| README documentation | Mandatory | `docs/README.md` | ✅ PASS |
| Architecture diagram | Required | `docs/architecture/` | ✅ PASS |
| Audit report | Internal | `docs/post_audit_report.md` | ✅ 45/45 |

---

### SECTION 1.5 — EVALUATION CRITERIA ALIGNMENT TABLE

Write a detailed table showing exactly how each evaluation criterion is met:

| Criterion | Weight | How This System Addresses It | Proof Location |
|:---|:---:|:---|:---|
| Antigravity Integration | 20% | Full explanation | Trace logs |
| Agentic Reasoning & Workflow | 20% | Full explanation | Module chain |
| Insight Quality & Contradiction Handling | 20% | Full explanation | Module 4, 5, 7 |
| Action Chain & Outcome Simulation | 15% | Full explanation | Modules 9–13 |
| Robustness, Scalability, Cost & Latency | 15% | Full explanation | Stress tests |
| Innovation & UX | 10% | Full explanation | UI + AMCE layer |

For each row, write 2–3 sentences explaining exactly how this specific system addresses the criterion — not generic statements.

---

### SECTION 1.6 — TECHNOLOGY STACK COMPLETE REFERENCE

Document every technology used across all three layers (backend, frontend, mobile):

**AI & LLM Layer:**
- Google Gemini 1.5 Flash — Primary LLM during development (free tier, 15 req/min, 1M tokens/min)
- Google Gemini 1.5 Pro — Base model for AMCE contract validation (highest quality reasoning)
- Google Vertex AI Gemini — Production LLM on demo day (GCP credits, higher rate limits, asia-south1 region)
- Groq Llama 3.1 70B Versatile — Emergency fallback LLM (30 req/min free, ultra-fast inference)
- Google text-embedding-004 — Semantic embeddings for RAG and cosine deduplication (always free tier)

**Backend:**
- Node.js + TypeScript (strict mode), Express.js, Zod (request validation), SQLite (better-sqlite3)
- pdf-parse, cheerio, @extractus/article-extractor, papaparse — Multi-format content extraction
- uuid — Pipeline and entity ID generation
- Google Antigravity — Pipeline orchestration brain and reasoning trace engine

**Web Frontend:**
- Next.js (TypeScript), Tailwind CSS, shadcn/ui component library
- EventSource (SSE) — Real-time pipeline trace streaming
- Recharts — Data visualization (outcome metrics, temporal patterns)
- OpenAPI-derived TypeScript types — Type-safe API contract layer

**Mobile:**
- Expo (React Native + TypeScript)
- expo-secure-store — Hardware-backed secret storage for operator identity and audit ledger
- expo-local-authentication — Biometric gate for HITL approval (Face ID / Fingerprint)
- expo-crypto — SHA-256 HMAC computation for cryptographic signing
- expo-document-picker + expo-file-system — Native document ingestion (PDF, CSV, TXT)
- react-native-event-source — SSE streaming on mobile

**Infrastructure:**
- Google Cloud Run (Person A's GCP account) — Backend hosting, $5 credits, asia-south1
- Firebase Hosting (free tier, no credits) — Web frontend hosting
- Cloud Storage (Person C's GCP account) — File upload handling, $5 credits backup

---

### SECTION 1.7 — TEAM STRUCTURE & GCP CREDIT ALLOCATION

Document the team's resource strategy:

| Team Member | GCP Account Role | Primary Responsibility | Budget |
|:---|:---|:---|:---|
| Person A | Infrastructure | Cloud Run backend hosting | $5 GCP credits |
| Person B | AI Primary | Vertex AI Gemini (primary demo) | $5 GCP credits |
| Person C | AI Backup + Files | Vertex AI fallback + Cloud Storage | $5 GCP credits |
| All | Frontend | Firebase Hosting | $0 (free tier) |

Document the spend timeline: Days 1–5 = $0 (free APIs only), Day 6 staging = ~$0.50, Days 6–7 demo rehearsals = ~$3–5 across all accounts.

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 2 — SYSTEM ARCHITECTURE DOCUMENT
## File: `docs/architecture/SYSTEM_ARCHITECTURE.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Architecture Documenter
**Source Files to Read First:** `backend/src/agents/orchestrator.ts`, `backend/src/utils/llm-client.ts`, all agent files, `backend/src/contracts/validator.ts`

---

### SECTION 2.1 — COMPLETE SYSTEM OVERVIEW DIAGRAM

Reproduce and annotate the full system pipeline diagram with explanatory text for each layer:

```
INPUT LAYER (5+ Simultaneous Sources)
  ↓
PHASE 1: CONTENT ANALYSIS (Modules 1–7)
  Module 1: Multi-Source Ingestion → Module 2: Credibility Scoring
  → Module 3: Noise Filter & Dedup → Module 4: Contradiction Detection
  → Module 5: RAG Insight Extraction
  → [Module 6: Temporal Analysis] ⟵parallel⟶ [Module 7: Conflict Resolution]
  ↓
CONTRACT ENFORCEMENT GATE (After every module)
  ↓
PHASE 2: STRATEGIC FORECASTING (Modules 8–9)
  Module 8: Impact Analysis → Module 9: Action Chain Generator
  ↓
HITL CONSENT GATE (PENDING → EXECUTING)
  ↓
PHASE 3: EXECUTION SIMULATION (Modules 10–14)
  Module 10: Constraint Validator → Module 11: Execution Simulator
  → [Module 12: Failure Recovery] → Module 13: Outcome Visualizer
  → Module 14: Workflow Audit
  ↓
OUTPUT LAYER (Web + Mobile Clients)
```

For each arrow and gate, write a paragraph explaining what data is passed, what transformation occurs, and what decision is made.

---

### SECTION 2.2 — GOOGLE ANTIGRAVITY ORCHESTRATION ARCHITECTURE

Write a dedicated deep-dive section explaining Antigravity's exact role:

**What Antigravity IS in this system:**
Antigravity is not a wrapper. It is the central reasoning and coordination brain. When a pipeline run is initiated, Antigravity:
1. Generates a structured **Workplan** — a high-level natural language description of what the pipeline will accomplish
2. Generates a structured **Task Plan** — an ordered list of 14+ discrete tasks mapped to each module
3. Dispatches each module as a **sub-agent task** with specific inputs, expected outputs, and contract requirements
4. Evaluates each module's reasoning output for quality using the AMCE contract validator
5. Makes **recovery decisions** when contract violations occur (re-generate vs. fallback)
6. Logs every tool call, LLM invocation, and decision as a **Reasoning Step** in the trace
7. Produces the final immutable **Audit Trace** that judges inspect to verify the system's reasoning chain

**Antigravity Trace Structure:** Document the complete trace schema with all fields (workplan, task_plan, reasoning_steps, tool_calls, action_execution, recovery_steps, ai_provider_used, environment) with a real example from the inventory shortage scenario.

**Why Antigravity is not replaceable:** Explain that without Antigravity, there is no workplan, no reasoning trace, no structured task plan — the judges would see API outputs but not the reasoning behind every decision. Antigravity transforms 14 isolated API calls into a coherent, inspectable, reasoned agent pipeline.

---

### SECTION 2.3 — THE LLMClient MULTI-PROVIDER ARCHITECTURE

This is one of the most technically distinctive parts of the system. Document it completely:

**The Singleton Pattern:** Every one of the 14 agent files imports `{ llmClient }` from `../utils/llm-client`. Zero agents import `@google/generative-ai` or `groq-sdk` directly. This is enforced by the architecture.

**The Three-Tier Fallback Chain:**
```
Tier 1: Vertex AI (production) / Gemini Free (development)
    ↓ [on 429, quota, billing error, or timeout]
Tier 2: Gemini Free (production fallback) / Groq (development fallback)
    ↓ [on continued failure]
Tier 3: Groq (emergency fallback in production) / throws (development)
```

**Vertex Account Rotation Logic:** Document how the `VERTEX_ACCOUNTS` array works — two GCP accounts (Person B and C), each with a $4.50 spending cap. When Account 1 hits its limit, the `currentVertexAccount` index rotates to Account 2. When both are exhausted, falls back to free Gemini. The pipeline NEVER crashes due to billing.

**Embedding Strategy:** Embeddings ALWAYS use free Gemini (`text-embedding-004`), regardless of `APP_ENV`. This is an intentional design decision — embeddings are called hundreds of times during deduplication and RAG, so using Vertex for them would drain credits in minutes. Document this decision explicitly.

**Environment Switching:** Two commands are all it takes:
- `APP_ENV=development npm run dev` → gemini-free + groq
- `APP_ENV=production npm run dev` → vertex-ai → gemini-free → groq

---

### SECTION 2.4 — THE AMCE CONTRACT ENFORCEMENT LAYER

Write a complete technical explanation of the contract enforcement architecture:

**What AMCE means:** Autonomous Module Contract Enforcement — inspired by formal contract verification principles applied to LLM outputs.

**The Problem it Solves:** LLMs are non-deterministic. Without enforcement, Module 1 might return 3 sources instead of 5, Module 4 might return a contradiction without a severity field, or Module 9 might generate 10 actions instead of 3–5. The AMCE layer catches every one of these deviations before they propagate downstream.

**How It Works — Three-Stage Validation:**
1. **Structural Validation:** Schema check — required fields present? Types correct? Enums valid? Numeric ranges within bounds? Regex patterns matched? If structural validation fails → immediate REJECT.
2. **Semantic Validation:** A second LLM call (base model: Gemini 1.5 Pro) evaluates whether the output is semantically coherent, not just structurally correct. Did the contradiction detector actually find real contradictions or hallucinate them? Did the action chain generator create logically dependent actions?
3. **Divergence Check:** Compares the module's output against the expected output distribution for that module. Severe outliers trigger WARN or REJECT.

**Decision Gate — Three Outcomes:**
- `PASS` → Pipeline continues. Event logged.
- `WARN` → Pipeline continues with a warning flag. Event logged. Judge can see this.
- `REJECT` → Module is asked to regenerate (up to 2 retries). If retries exhausted → fallback to base model output. If base model also fails → pipeline logs a contract failure and moves on with partial data.

**Enforcement Modes per Contract:**
- `BLOCK` (multi_source_ingestion_v1) — Pipeline cannot continue with fewer than 5 sources
- `QUARANTINE` (contradiction_detection_v1) — Contradictions without resolution_needed field are quarantined
- `WARN` (temporal_analysis_v1) — Missing confidence scores produce a warning but don't block

**Contract YAML Structure:** Show the complete format of a contract definition file with all fields (contract_id, module_name, version, output_schema with all validation rules, enforcement_mode).

---

### SECTION 2.5 — DUAL-PHASE PIPELINE STATE MACHINE

Document the pipeline's state machine with all transitions:

```
INITIALIZED → PROCESSING (ingestion starts)
PROCESSING → PENDING (proposal ready, HITL gate open)
PENDING → EXECUTING (operator approves via web or mobile)
PENDING → REJECTED (operator rejects)
EXECUTING → COMPLETED (all actions simulated, audit written)
EXECUTING → FAILED (unrecoverable error)
```

For each state, document: what triggers the transition, what data is available in that state, what the frontend shows, what the mobile app shows, and what API calls are available.

---

### SECTION 2.6 — BACKEND-FRONTEND COMMUNICATION ARCHITECTURE

Document ALL communication patterns between the three layers:

**REST API (Request/Response):**
- `POST /api/pipeline/run` — Trigger a new pipeline (accepts 5+ sources + constraints)
- `GET /api/pipeline/:id` — Retrieve complete pipeline results
- `GET /api/pipeline/:id/trace` — Retrieve Antigravity trace logs (for judge inspection)
- `POST /api/execution/:id/approve` — HITL approval (body: { approver_name })
- `POST /api/execution/:id/reject` — HITL rejection
- `GET /api/execution/:id/status` — Polling endpoint for pipeline state
- `GET /api/execution/:id/audit` — Retrieve final SHA-256 audit receipt
- `GET /api/contracts` — List all YAML contract definitions
- `GET /api/validations` — Contract validation history
- `GET /health` — Health check endpoint

**Server-Sent Events (SSE) Streaming:**
- `GET /api/pipeline/:id/stream` — Real-time event stream
  - Events emitted: `agent_start`, `agent_complete`, `contract_check`, `hitl_pending`, `hitl_approved`, `failure`, `failure_recovery`, `pipeline_complete`
  - Web frontend uses EventSource API to consume this stream
  - Mobile app uses react-native-event-source for native SSE support

**Polling Fallback (Mobile):**
- When SSE drops (network switch, app backgrounding): polls `GET /api/execution/:id/status` every 3 seconds
- Seamlessly resumes SSE when connection restores

**Data Formats:** Document the complete request and response JSON schemas for every endpoint above, with TypeScript interface definitions.

---

### SECTION 2.7 — FILE SYSTEM ARCHITECTURE (COMPLETE DIRECTORY MAP)

Generate a complete annotated directory tree for the entire project:

```
content-action-agent/
├── backend/
│   ├── src/
│   │   ├── index.ts                    ← Express entry point, CORS, middleware
│   │   ├── config.ts                   ← Environment config (reads APP_ENV)
│   │   ├── routes/
│   │   │   ├── pipeline.routes.ts      ← POST /api/pipeline/run, GET /api/pipeline/:id
│   │   │   ├── execution.routes.ts     ← Approve, reject, status, audit endpoints
│   │   │   ├── contracts.routes.ts     ← Contract listing and management
│   │   │   ├── validations.routes.ts   ← Validation history
│   │   │   └── outcomes.routes.ts      ← Outcome visualization data
│   │   ├── agents/
│   │   │   ├── base.agent.ts           ← Base class: trace logging, retry logic, contract integration
│   │   │   ├── orchestrator.ts         ← Main pipeline coordinator (all 14 modules in sequence)
│   │   │   ├── multi-source-ingestion.agent.ts
│   │   │   ├── credibility-scorer.agent.ts
│   │   │   ├── noise-filter.agent.ts
│   │   │   ├── contradiction-detector.agent.ts
│   │   │   ├── insight-extraction.agent.ts
│   │   │   ├── temporal-analysis.agent.ts
│   │   │   ├── conflict-resolution.agent.ts
│   │   │   ├── impact-scorer.agent.ts
│   │   │   ├── strategic-recommender.agent.ts
│   │   │   ├── execution-simulator.agent.ts
│   │   │   ├── failure-recovery.agent.ts
│   │   │   ├── outcome-visualizer.agent.ts
│   │   │   └── workflow-audit.agent.ts
│   │   ├── contracts/
│   │   │   ├── registry.ts             ← YAML contract loader and version manager
│   │   │   ├── validator.ts            ← Structural + semantic + divergence checks
│   │   │   ├── decision-gate.ts        ← PASS/WARN/REJECT decision engine
│   │   │   └── definitions/            ← One YAML per module (14+ files)
│   │   ├── simulation/                 ← Constraint validator, chain simulator, outcome vis
│   │   ├── tracing/
│   │   │   ├── collector.ts            ← Singleton TraceCollector
│   │   │   └── exporter.ts             ← Formats trace for judge review
│   │   ├── utils/
│   │   │   ├── llm-client.ts           ← Multi-provider singleton LLMClient
│   │   │   ├── dag-sorter.ts           ← Kahn's Algorithm topological sort
│   │   │   ├── embedding.ts            ← Embedding generation wrapper
│   │   │   └── cosine-similarity.ts    ← Vector similarity math
│   │   └── database/
│   │       ├── db.ts                   ← SQLite setup (better-sqlite3)
│   │       └── models.ts               ← Pipeline and audit record models
│   ├── audit-logs/                     ← SHA-256 signed audit receipts (written by Module 14 only)
│   ├── test-data/                      ← Sample sources for development testing
│   ├── demo-data/                      ← Inventory shortage scenario files
│   ├── .env.development                ← Free API keys (gitignored)
│   ├── .env.production                 ← Vertex AI keys (gitignored)
│   └── .env.example                    ← Template (committed to git)
├── frontend/
│   └── src/
│       ├── app/
│       │   └── pipeline/[pipeline_id]/page.tsx  ← Two-phase split route
│       ├── features/
│       │   ├── execution/
│       │   │   ├── hooks/useLiveTrace.ts         ← SSE transport layer hook
│       │   │   └── components/
│       │   │       ├── HITLApprovalPhase.tsx     ← Phase A: proposal review
│       │   │       ├── LiveExecutionPhase.tsx    ← Phase B: live execution
│       │   │       └── AuditCertificate.tsx      ← SHA-256 compliance card
│       │   └── ingestion/
│       │       └── components/IngestionDashboard.tsx
│       └── types/openapi.d.ts                   ← OpenAPI-derived TypeScript types
└── mobile/
    └── src/
        ├── config/api.ts               ← API base URL from env
        ├── types/pipeline.ts           ← Type safety contracts (6 interfaces)
        ├── services/
        │   ├── BiometricSecurityService.ts   ← SHA-256 HMAC + biometric gate
        │   └── IngestionService.ts           ← Document picker + payload builder
        ├── hooks/
        │   └── useStandalonePipeline.ts      ← SSE + polling + audit ledger
        ├── screens/
        │   ├── IngestionStagingScreen.tsx    ← File selection + pipeline trigger
        │   └── OperationalMonitorScreen.tsx  ← Live trace + HITL overlay
        └── App.tsx                           ← Two-screen state toggle
```

For EVERY file in this tree, write one sentence explaining its specific responsibility.

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 3 — PHASE-BY-PHASE DEVELOPMENT GUIDE
## File: `docs/development/PHASE_DEVELOPMENT_GUIDE.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Development History Writer
**Source Files to Read First:** All phase checklists, `backend/src/`, `tsconfig.json`, `package.json`

Write a complete phase-by-phase development chronicle. For each phase: the goal, the duration, what was built, why decisions were made, what problems were solved, what the completion checklist contains, and how this phase feeds into the next.

---

### PHASE 0 — ENVIRONMENT SETUP (Day 1 Morning, ~3 hours)

**Goal:** Establish the foundational infrastructure that ALL 14 modules depend on. Getting Phase 0 wrong means rewriting AI provider logic in every agent file — getting it right means changing two environment variables on demo day.

**What Was Built:**
1. **Project directory structure** — `backend/`, `frontend/`, `mobile/`, `docs/` scaffolded
2. **TypeScript configuration** — strict mode, ES2020 target, CommonJS modules, `rootDir: ./src`, `outDir: ./dist`
3. **`.env.development`** — Free Gemini + Groq keys, `PRIMARY_PROVIDER=gemini-free`, `FALLBACK_PROVIDER=groq`
4. **`.env.production`** — Vertex AI keys (two accounts), `PRIMARY_PROVIDER=vertex-ai`, three-tier fallback
5. **`LLMClient` singleton** — The single most important file in the entire backend

**Key Design Decision — Why Singleton:** If each agent instantiated its own AI client, provider switching would require changing 14 files. The singleton means `APP_ENV=production npm run dev` switches ALL 14 agents to Vertex AI simultaneously.

**Completion Verification:** `APP_ENV=development npx ts-node src/utils/test-llm-client.ts` must output `primary: gemini-free` and a successful embedding with 768 dimensions.

---

### PHASE 1 — CORE INFRASTRUCTURE (Day 1 Afternoon – Day 2 Morning, ~7 hours)

**Goal:** Build the shared infrastructure that all phases plug into — contracts, tracing, base agent, and the Express server.

**What Was Built:**
1. **Contract Registry & Validator** — YAML contract loader, structural + semantic + divergence validation, three enforcement modes
2. **Base Agent Class** — Trace logging, retry logic, contract enforcement integration — every agent extends this
3. **TraceCollector Singleton** — Thread-safe event aggregator that every agent writes to
4. **Express API Server** — Five route groups, CORS configured for Firebase URL, Zod request validation
5. **All route handlers** — Pipeline, execution, contracts, validations, outcomes endpoints

**Why Base Agent Matters:** Without a shared base class, each of the 14 agents would have duplicate trace logging, retry, and contract logic — ~500 lines of boilerplate per agent = 7,000 lines of duplicated code eliminated.

---

### PHASE 2 — CONTENT INGESTION & ANALYSIS (Day 2–3, ~9 hours)

**Goal:** Implement Modules 1–7. This phase has the highest evaluation weight (Agentic Reasoning: 20% + Insight Quality: 20% = 40% of total score).

Document each module implemented in this phase with its purpose, key design decision, and what it feeds into the next module.

---

### PHASE 3 — ACTION CHAIN & SIMULATION (Day 3–4, ~9 hours)

**Goal:** Implement Modules 8–13. Demonstrates the system's ability to not just analyze but to plan and act.

Document each module: Impact Analysis, Action Chain Generator, Constraint Validator, Execution Simulator, Failure Recovery Engine, Outcome Visualizer.

---

### PHASE 4 — PIPELINE ORCHESTRATOR (Day 4 Afternoon, ~5 hours)

**Goal:** Wire all 14 modules into a single cohesive pipeline. This is the highest-leverage phase — nothing visible until this is done, everything visible once it's done.

Document: Orchestrator implementation, Module 14 Workflow Audit, Trace Exporter, end-to-end API test.

---

### PHASE 5 — FRONTEND & MOBILE (Day 5–6, ~14 hours)

**Goal:** Build the user-facing layers. Two distinct applications with different UX philosophies.

**Web Dashboard Philosophy:** Information density. Judges need to see everything — contradictions side by side, dependency graphs, before/after state, the complete Antigravity trace. Desktop-first.

**Mobile App Philosophy:** Operational control. The mobile app is for an operator in the field who needs to approve actions biometrically and monitor execution. Dark-themed for low-light environments.

Document all components, screens, and the SSE streaming integration.

---

### PHASE 6 — PRODUCTION SWITCH & STRESS TESTS (Day 6, ~7 hours)

**Goal:** Prove the system works in production mode (Vertex AI) and under adversarial conditions.

Document: Cloud Run deployment, Vertex AI key setup, production switch test, all 5 stress test scenarios with expected and actual outcomes.

---

### PHASE 7 — DOCUMENTATION & VIDEO (Day 7, ~7 hours)

**Goal:** Prepare submission deliverables. The demo video is the judges' first impression — it must show all 7 segments clearly.

Document: README structure, demo video script (all 7 segments), final verification checklist.

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 4 — MODULE TECHNICAL REFERENCE (Deep-Dive)
## File: `docs/modules/MODULE_TECHNICAL_REFERENCE.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Module Documentation Writer (Claude Code — Read each agent file before documenting it)
**Source Files to Read First:** ALL 14 files in `backend/src/agents/`, `backend/src/simulation/`, `backend/src/contracts/definitions/`

For EACH of the 14 modules below, read the actual source file and write a complete technical reference. Do not write from memory — read the code and document what is actually implemented.

---

### MODULE DOCUMENTATION TEMPLATE

For every module, write these sub-sections:

**[MODULE N] — [Module Name]**

**Purpose:** One precise sentence.

**Input:** Complete TypeScript interface showing what this module receives.

**Output:** Complete TypeScript interface showing what this module produces.

**Processing Logic:** Step-by-step numbered description of exactly what this module does internally — algorithm, LLM calls, mathematical computations, external library usage. Be specific: "cosine similarity threshold of 0.85" not "checks for similarity."

**LLM Interaction:** If this module uses llmClient, document:
- The exact prompt template used
- What model is called (primary vs base model)
- What the LLM is asked to produce
- How the LLM output is parsed and validated

**Key Design Decisions:** 2–3 decisions made in this module's implementation, and why.

**Contract Enforcement:** 
- Contract ID: `module_name_v1`
- Enforcement Mode: `BLOCK` / `QUARANTINE` / `WARN`
- Key validation rules: list the critical schema checks
- What triggers a REJECT

**Audit Status:** `[AUD-MXX]: PASS (45/45 audit run, verified YYYY-MM-DD)`

**Feeds Into:** Which module(s) consume this module's output.

**Demo Visibility:** How does this module's work appear in the demo video (which segment, what the judge sees).

---

Apply the above template to all 14 modules:

**Module 1:** Multi-Source Content Ingestion Agent
**Module 2:** Source Credibility Scorer Agent
**Module 3:** Noise Filter & Semantic Deduplication Agent
**Module 4:** Contradiction Detector Agent ← CRITICAL (20% score weight)
**Module 5:** RAG-Powered Insight Extraction Agent
**Module 6:** Temporal Analysis Engine Agent
**Module 7:** Conflict Resolution Logic Agent
**Module 8:** Impact Analysis with Constraints Agent
**Module 9:** Action Chain Generator (Strategic Recommender) Agent ← CRITICAL (15% score weight)
**Module 10:** Constraint Validator
**Module 11:** Action Chain Execution Simulator (HITL Gate)
**Module 12:** Failure Recovery & Rollback Engine ← CRITICAL (15% score weight)
**Module 13:** Outcome Visualizer Agent
**Module 14:** Workflow Audit Agent (SHA-256)

---

### SECTION 4.15 — THE KAHN'S ALGORITHM DAG SORTER

Document `backend/src/utils/dag-sorter.ts` in full technical depth:

**Algorithm:** Kahn's topological sort using in-degree tracking and BFS queue
**Input:** Array of ActionNodes with `depends_on` arrays
**Output:** Topologically sorted execution order
**Cycle Detection:** When the BFS queue empties before processing all nodes, a cycle is detected. Event logged: `graph_cycle_detected`. Fallback: priority-descending flat sort (CRITICAL → HIGH → MEDIUM → LOW)
**Why Kahn's:** O(V+E) time complexity, naturally detects cycles, produces stable deterministic order

---

### SECTION 4.16 — THE IN-MEMORY VECTOR STORE

Document the vector store implementation used for RAG and deduplication:
**Implementation:** Pure in-memory store (no external database)
**Embedding Model:** `text-embedding-004` via free Gemini (768 dimensions)
**Similarity Metric:** Cosine similarity: `(A·B) / (|A| × |B|)`
**Deduplication Threshold:** 0.85 (sources with >85% similarity are considered duplicates)
**RAG Retrieval:** Top-5 most relevant chunks returned for insight extraction
**Why In-Memory:** Eliminates external database dependency, works in Cloud Run's stateless environment

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 5 — API REFERENCE DOCUMENTATION
## File: `docs/api/API_REFERENCE.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** API Documentation Writer (Claude Code — Read all route files)
**Source Files to Read First:** All files in `backend/src/routes/`

---

### SECTION 5.1 — BASE URL & AUTHENTICATION

Document:
- Development base URL: `http://localhost:8000`
- Production base URL: `https://[cloud-run-url].run.app`
- Authentication: None required (open API for hackathon demo purposes)
- CORS: Allowed origins (localhost:3000, Firebase URL)
- Content-Type: `application/json` for all endpoints

---

### SECTION 5.2 — COMPLETE ENDPOINT REFERENCE

For EVERY endpoint, document:
- HTTP Method + Path
- Description
- Request body schema (with TypeScript interface + JSON example)
- Response body schema (with TypeScript interface + JSON example)
- Status codes: 200, 400, 409, 500 with descriptions
- cURL example command
- Expected response time

**Endpoints to document:**
1. `POST /api/pipeline/run`
2. `GET /api/pipeline/:id`
3. `GET /api/pipeline/:id/trace`
4. `GET /api/pipeline/last`
5. `GET /api/pipeline/:id/stream` (SSE)
6. `POST /api/execution/:id/approve`
7. `POST /api/execution/:id/reject`
8. `GET /api/execution/:id/status`
9. `GET /api/execution/:id/audit`
10. `GET /api/contracts`
11. `GET /api/validations`
12. `GET /health`
13. `POST /api/debug/contradiction-detect` (debug endpoint)
14. `POST /api/debug/constraint-validate` (debug endpoint)
15. `POST /api/debug/noise-filter` (debug endpoint)

---

### SECTION 5.3 — COMPLETE DATA SCHEMA REFERENCE

Document every TypeScript interface and type used across the API:
NormalizedSource, CredibilityScore, Contradiction, ConflictResolution, Insight, TemporalPattern, ImpactAnalysis, ActionNode, ActionChain, ConstraintValidationResult, SimulationState, ActionExecutionResult, RecoveryPlan, OutcomeVisualization, WorkflowAudit, TraceEvent, PipelineStatus, LiveTraceState

For each: field names, types, constraints, example value.

---

### SECTION 5.4 — THE ANTIGRAVITY TRACE FORMAT

Document the complete trace JSON format that judges will inspect:
```json
{
  "pipeline_id": "uuid",
  "environment": "development | production",
  "ai_provider_used": "gemini-free | vertex-ai | groq",
  "workplan": "...",
  "task_plan": ["Task 1...", "Task 2...", ...],
  "reasoning_steps": [
    {
      "step": 1,
      "agent": "contradiction_detector",
      "reasoning": "...",
      "decision": "...",
      "confidence": 0.92
    }
  ],
  "tool_calls": [...],
  "action_execution": [...],
  "recovery_steps": [...],
  "contract_decisions": [...]
}
```

---

### SECTION 5.5 — SERVER-SENT EVENTS (SSE) STREAM REFERENCE

Document every SSE event type with its exact payload structure:

| Event Type | When Emitted | Payload Fields |
|:---|:---|:---|
| `agent_start` | Module begins | module, phase, timestamp |
| `agent_complete` | Module completes | module, output_summary, contract_decision |
| `contract_check` | After each module | contract_id, decision, violations |
| `hitl_pending` | Proposal ready | proposal (full StrategyProposal object) |
| `hitl_approved` | Operator approves | approver, signed_by, timestamp |
| `hitl_rejected` | Operator rejects | rejector, reason, timestamp |
| `failure` | Action fails | action_id, reason, recovery_strategy |
| `failure_recovery` | Recovery attempt | action_id, strategy, attempt_number |
| `budget_revalidation` | After costly action | remaining_budget, affected_actions |
| `pipeline_complete` | Pipeline finishes | audit_record, outcome_summary |

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 6 — FRONTEND DOCUMENTATION (Web App)
## File: `docs/frontend/WEB_FRONTEND_DOCUMENTATION.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Frontend Documentation Writer (Claude Code — Read all frontend files)
**Source Files to Read First:** All files in `frontend/src/`

---

### SECTION 6.1 — WEB APP ARCHITECTURE OVERVIEW

Document the Next.js application structure, routing strategy, and component hierarchy. Explain why Next.js was chosen (SSE support, TypeScript-first, route-based code splitting, Firebase deployment compatibility).

---

### SECTION 6.2 — THE TWO-PHASE SPLIT INTERFACE

This is the core UX architecture of the web app. Document in depth:

**Phase A — HITL Approval Phase (`HITLApprovalPhase.tsx`):**
- When it renders: `pipelineState === 'PENDING' && proposal !== null`
- What it shows: The complete StrategyProposal action list, rendered in topological (Kahn-sorted) order
- How dependency visualization works: Parent actions listed above child actions, `depends_on` arrays rendered as visual connectors
- The approval flow: Operator name input → Approve button → POST to `/api/execution/:id/approve` → 409 conflict handling with destructive Toast
- The rejection flow: Reject button → POST to `/api/execution/:id/reject` → pipeline terminates

**Phase B — Live Execution Phase (`LiveExecutionPhase.tsx`):**
- When it renders: All states except PENDING (EXECUTING, COMPLETED, FAILED, REJECTED)
- Real-time trace streaming via EventSource
- SKIPPED node rendering: Cascade-skipped nodes shown with muted/gray `SKIPPED` badge (not plain text)
- RETRY events: Attempt counter badge shown on retrying actions
- Completion: `AuditCertificate` component appears when `auditRecord` is non-null

---

### SECTION 6.3 — THE useLiveTrace HOOK

Document this hook completely — it is the transport layer that drives the entire web experience:
- `LiveTraceState` interface (all 5 fields)
- EventSource lifecycle management (connection, message handlers, cleanup)
- State transitions triggered by each SSE event type
- How `proposal` is populated from `hitl_pending` event
- How `auditRecord` is populated from `pipeline_complete` event
- Memory leak prevention (EventSource cleanup on unmount)

---

### SECTION 6.4 — ALL FRONTEND COMPONENTS

For each component, document: purpose, props interface, rendered output, state management, API calls made.

Components: `IngestionDashboard`, `HITLApprovalPhase`, `LiveExecutionPhase`, `AuditCertificate`, `ContradictionViewer`, `ActionChainViewer`, `SimulationResults`, `TraceViewer`, `PipelineProgress`

---

### SECTION 6.5 — OPENAPI TYPE SAFETY LAYER

Explain how `frontend/src/types/openapi.d.ts` creates a type-safe bridge between backend outputs and frontend rendering. No `any` types in component props. All backend schemas mirrored as TypeScript interfaces.

---

### SECTION 6.6 — THE CRYPTOGRAPHIC COMPLIANCE CERTIFICATE

Deep-dive the `AuditCertificate.tsx` component — the resolution of the most critical gap from the previous audit (GAP-04: SHA-256 hash was lost at the browser boundary). Document: when it renders, what it displays, the emerald/green visual treatment, how the 64-character hex hash is styled, what `verification_hash` proves to auditors and judges.

---

### SECTION 6.7 — FIREBASE DEPLOYMENT

Document the complete Firebase deployment procedure, `firebase.json` configuration, CORS update required in backend, and how to update the frontend's API base URL for Cloud Run.

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 7 — MOBILE APP DOCUMENTATION (Expo)
## File: `docs/mobile/MOBILE_APP_DOCUMENTATION.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Mobile Documentation Writer (Claude Code — Read all mobile files)
**Source Files to Read First:** All files in `mobile/src/`, `mobile/App.tsx`, `mobile/package.json`

---

### SECTION 7.1 — MOBILE APP ARCHITECTURE

Document the Expo architecture philosophy: single-state toggle navigation (no React Navigation framework overhead), two primary screens, operator identity provisioning gate, biometric security layer.

**Why Expo over bare React Native:** Managed workflow simplifies expo-crypto, expo-secure-store, expo-local-authentication integration. These native modules require complex bridging in bare RN — Expo handles it out of the box.

---

### SECTION 7.2 — ENTERPRISE ARCHITECTURAL DIRECTIVES (ZERO HARDCODING POLICY)

Document the four enterprise directives that govern the mobile app's architecture:

**Directive 1 — Dynamic Configuration & Identity:**
- `EXPO_PUBLIC_OPERATOR_HANDLE` read from environment (never hardcoded)
- Operator Provisioning Screen renders when env var is absent
- Provisioned identity stored in `expo-secure-store` (not AsyncStorage)
- `EXPO_PUBLIC_API_BASE_URL` used in API client with documented fallback

**Directive 2 — Hardware-Backed Cryptographic Signing:**
- SHA-256 HMAC computed over `(deviceSecret + pipelineId + rationale)`
- `deviceSecret` generated once, pinned in `expo-secure-store`
- Biometric authentication gates the signature generation
- `approved_by` format: `"${operatorHandle}::[SHA256_HEX_SIGNATURE]"`

**Directive 3 — Immutable Client-Side Audit Ledger:**
- On SUCCESS: pulls audit from `/api/execution/:id/audit`
- Extracts `verification_hash` (SHA-256) from WorkflowAudit
- Commits hash to `expo-secure-store` as permanent proof-of-execution
- Displayed on monitor screen as "Verified" badge

**Directive 4 — Architectural Boundaries:**
- `ClientPipelineStatus` synthesis (BFF Pattern) — view isolated from backend schema changes
- Single-state navigation (no framework overhead)
- Demo mode: empty `{}` payload triggers backend disk-ingestion fallback

---

### SECTION 7.3 — BIOMETRIC SECURITY SERVICE

Deep technical documentation of `BiometricSecurityService.ts`:
- `expo-local-authentication` hardware capability check
- `expo-secure-store` deviceSecret generation and retrieval
- SHA-256 HMAC computation via `expo-crypto` — the exact concatenation: `deviceSecret + pipelineId + rationale`
- Hex encoding of the signature
- `approved_by` string construction
- Failure path: biometric rejection throws, approval is never silent
- iOS Secure Enclave vs Android Keystore differences

---

### SECTION 7.4 — PIPELINE STATE SYNCHRONIZER HOOK

Complete documentation of `useStandalonePipeline.ts`:
- SSE streaming via `react-native-event-source`
- Polling fallback timer — when it activates, polling interval, how it hands back to SSE
- `ClientPipelineStatus` — the four backend phase routes mapped to unified client state
- Backend in-memory drop detection and user notification
- SUCCESS handler: audit pull → hash extraction → secure store write → UI update

---

### SECTION 7.5 — ALL SCREENS

For each screen, document: purpose, UX flow, component hierarchy, state management, API calls, and screenshots description (describe what the judge would see in the demo video).

**IngestionStagingScreen:** File picker, text editor, source list, demo mode toggle, Run Pipeline button
**OperationalMonitorScreen:** Dark-themed trace list, HITL biometric overlay (PENDING state), audit verification badge (SUCCESS state)
**Operator Provisioning Screen:** First-run identity capture, secure storage

---

### SECTION 7.6 — MOBILE DEPENDENCY RATIONALE

For each of the 6 required packages, document WHY it was chosen over alternatives:
- `expo-secure-store` vs AsyncStorage — hardware encryption, survives app uninstall in iOS Keychain
- `expo-local-authentication` vs third-party biometrics — native integration, no key management
- `expo-crypto` vs js-sha256 — runs on-device, no JS bridge for cryptographic operations
- `expo-document-picker` vs react-native-document-picker — Expo managed workflow compatibility
- `expo-file-system` vs react-native-fs — unified API across iOS and Android
- `react-native-event-source` vs polling-only — SSE preserves real-time feel; polling as resilience layer

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 8 — SCENARIO & DEMO DOCUMENTATION
## File: `docs/demo/DEMO_SCENARIO_DOCUMENTATION.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Scenario Documenter
**Source Files to Read First:** `backend/demo-data/`, `backend/test-data/`

---

### SECTION 8.1 — THE INVENTORY SHORTAGE SCENARIO (COMPLETE WALKTHROUGH)

Document the canonical demo scenario in full narrative depth:

**Business Context:** A mid-sized Pakistani retail company managing warehouse inventory for Product SKU-1234 (Widget-A). Five information systems are reporting contradictory signals simultaneously.

**The Five Sources — Complete Detail:**

1. **Source SRC-001 (PDF):** `warehouse-report.pdf` — Warehouse Inventory Report dated 7 days ago. Claims: "Widget-A stock: 500 units." Credibility: MEDIUM (45/100) — penalized for age (recency_score: 10). Authority: official company document (30/30). Quality: has structured data (10/30).

2. **Source SRC-002 (CSV):** `sales-dashboard.csv` — Real-time sales data. Shows demand spike: +30% orders in last 24 hours. Credibility: HIGH (95/100). Most trusted source.

3. **Source SRC-003 (TXT/Email):** `supplier-email.txt` — Official supplier communication: "Delivery delayed 3 days due to regional transport strike." Credibility: HIGH (75/100).

4. **Source SRC-004 (URL):** News article about transport strike affecting supply chains across the region. Credibility: MEDIUM (60/100) — reputable but generic.

5. **Source SRC-005 (JSON/Real-time):** Customer complaint feed — 5 "out of stock" complaints in last 2 hours. Credibility: LOW (40/100) — user-generated.

**Expected Pipeline Output — Module by Module:**
Document exactly what each module produces for this specific scenario, matching the outputs defined in the master prompt (credibility scores, contradiction: 500 vs out-of-stock, temporal spike detection, conflict resolution choosing real-time data over week-old PDF, 5-action chain, ACT-003 failure and retry, final metrics: PKR 455K cost, 83% success rate, 80% stockout risk reduction).

---

### SECTION 8.2 — THE SEVEN DEMO VIDEO SEGMENTS

Document the complete demo video script with timing, what to show on screen, what to narrate, and what specific system outputs to highlight:

**Segment 1 — Introduction (30 seconds):** ...
**Segment 2 — Input (30 seconds):** ...
**Segment 3 — Contradiction Detection (45 seconds):** ...
**Segment 4 — Action Chain (60 seconds):** ...
**Segment 5 — Failure & Recovery (45 seconds):** ...
**Segment 6 — Outcome (30 seconds):** ...
**Segment 7 — Antigravity Trace (30 seconds):** ...

For each segment: exact narration script, what is shown on screen (web or mobile), which Antigravity trace event to highlight, what the judge is evaluating.

---

### SECTION 8.3 — ALL FIVE STRESS TESTS (COMPLETE DOCUMENTATION)

For each stress test, document: Setup, what input data was used, what module was under test, expected behavior, actual behavior (from audit run), PASS/FAIL verdict, what this proves about system robustness.

**Stress Test 1 — Maximum Source Divergence (3-way conflict)**
**Stress Test 2 — Budget Constraint Violation (PKR 600K vs 500K limit)**
**Stress Test 3 — Action Failure & Retry Sequence**
**Stress Test 4 — Low-Credibility Outlier Signal Rejection**
**Stress Test 5 — Cascading Budget Side Effect**

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 9 — DEPLOYMENT & OPERATIONS GUIDE
## File: `docs/deployment/DEPLOYMENT_OPERATIONS_GUIDE.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Deployment Documenter

---

### SECTION 9.1 — COMPLETE DEPLOYMENT ARCHITECTURE

```
Internet
    │
    ├─── Firebase Hosting (https://your-app.web.app)
    │         └── Next.js Web App (static, CDN-delivered)
    │                   │ REST + SSE
    │                   ▼
    └─── Cloud Run (https://your-backend.run.app)
              └── Express.js Backend (Node.js + TypeScript)
                        ├── Calls: Vertex AI (production) / Gemini Free (dev) / Groq (fallback)
                        ├── Reads: SQLite (pipeline records)
                        └── Writes: audit-logs/ (SHA-256 receipts)

Mobile App (Expo)
    │ REST + SSE (via react-native-event-source)
    └── Cloud Run Backend (same URL)
```

---

### SECTION 9.2 — STEP-BY-STEP CLOUD RUN DEPLOYMENT (Person A)

Complete commands, configuration flags, environment variable injection, and verification steps.

---

### SECTION 9.3 — STEP-BY-STEP FIREBASE DEPLOYMENT (Person C)

Complete commands, `firebase.json` config, build optimization settings, and verification steps.

---

### SECTION 9.4 — VERTEX AI KEY SETUP (Person B & C)

IAM role requirements (Vertex AI User), service account creation, JSON key download, path configuration in `.env.production`, testing procedure.

---

### SECTION 9.5 — ENVIRONMENT VARIABLE COMPLETE REFERENCE

A table of every environment variable: name, required/optional, default value, description, which layer uses it (backend/mobile), security classification.

---

### SECTION 9.6 — GCP BUDGET MONITORING SETUP

How to set up the $4 budget alert in GCP Console → Billing → Budgets & Alerts for each account. What happens when the alert fires. How the automatic fallback chain prevents demo failure even if credits run out.

---

### SECTION 9.7 — TROUBLESHOOTING RUNBOOK

Every known issue with its solution:
- Gemini 429 rate limit
- Vertex AI credential error
- Contract validation REJECT loop
- Antigravity trace not logging
- Mobile Metro bundler failure
- Frontend CORS error after Cloud Run deployment
- SQLite file permission issue in Cloud Run
- EventSource connection dropped on mobile

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 10 — AUDIT REPORT (FINAL)
## File: `docs/POST_AUDIT_REPORT_FINAL.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Audit Report Finalizer
**Source Files to Read First:** `docs/post_audit_report.md` (from previous audit), the AuditSummaryReceipt JSON

---

### SECTION 10.1 — AUDIT EXECUTIVE SUMMARY

Write a professional summary of the system audit conducted by Google Antigravity:
- Total checks run: 45
- PASS: 45 / WARN: 0 / FAIL: 0
- Documentation gate: AUTHORIZED
- Audit timestamp
- SHA-256 receipt hash

---

### SECTION 10.2 — PREVIOUS GAPS — RESOLUTION CONFIRMATION

Create a before/after table for each of the four previously identified gaps (GAP-01 through GAP-04):

| Gap | Previous Status | Resolution | Audit Check | Current Status |
|:---|:---|:---|:---|:---|
| GAP-01: HITL PENDING state | Omitted from UI | HITLApprovalPhase.tsx built | AUD-FE-02, AUD-FE-03 | ✅ RESOLVED |
| GAP-02: DAG depends_on dropped | Not rendered | Topological card list implemented | AUD-FE-04 | ✅ RESOLVED |
| GAP-03: SKIPPED as plain text | Text errors only | SKIPPED badge + muted style | AUD-FE-05 | ✅ RESOLVED |
| GAP-04: SHA-256 lost at browser | Hash not surfaced | AuditCertificate.tsx deployed | AUD-FE-06 | ✅ RESOLVED |

---

### SECTION 10.3 — MODULE-BY-MODULE AUDIT RESULTS

For each of the 14 modules: audit check ID, what was verified, result, any notes.

---

### SECTION 10.4 — STRESS TEST AUDIT RESULTS

For all 5 stress tests: check ID, setup, expected behavior, actual behavior, PASS/FAIL.

---

### SECTION 10.5 — COMPLETE AUDIT RECEIPT (JSON)

Embed the full AuditSummaryReceipt JSON object directly in the document:
```json
{
  "receipt_type": "SYSTEM_AUDIT_RECEIPT",
  "project": "Autonomous Content-to-Action Agent",
  "hackathon": "InnoCollab AI Seekho 2026 — Challenge 1",
  "audit_timestamp": "[actual timestamp from audit run]",
  "orchestrator": "Google Antigravity",
  "total_checks": 45,
  "pass_count": 45,
  "warn_count": 0,
  "fail_count": 0,
  "sections": { ... },
  "documentation_gate": "AUTHORIZED",
  "verification_hash": "[64-character SHA-256 hex]",
  "remediation_items": []
}
```

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 11 — ENGINEERING DECISIONS & LESSONS LEARNED
## File: `docs/engineering/ENGINEERING_DECISIONS.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Engineering Retrospective Writer

---

### SECTION 11.1 — KEY ARCHITECTURAL DECISIONS (ADR FORMAT)

For each major architectural decision, write an Architecture Decision Record:
- **Decision:** What was decided
- **Context:** What problem necessitated the decision
- **Options Considered:** What alternatives were evaluated
- **Chosen Approach:** What was implemented and why
- **Consequences:** Trade-offs accepted

**ADR-001:** LLMClient Singleton vs Per-Agent Instantiation
**ADR-002:** In-Memory Vector Store vs External Database (Pinecone/Weaviate)
**ADR-003:** Kahn's Algorithm vs Simple Sequential Ordering
**ADR-004:** SSE Streaming vs WebSocket for Real-Time Updates
**ADR-005:** Expo Managed Workflow vs Bare React Native
**ADR-006:** SQLite vs Cloud Firestore for Pipeline Record Storage
**ADR-007:** SHA-256 HMAC vs Asymmetric Key Signing for Mobile HITL
**ADR-008:** Two-Phase UI Split vs Single Pipeline View
**ADR-009:** Three-Tier Fallback Chain vs Single Provider
**ADR-010:** Free Embeddings vs Vertex Embeddings (Always-Free Decision)

---

### SECTION 11.2 — COST & LATENCY ANALYSIS

**Development Phase (Days 1–5):** $0 spent. All LLM calls on free Gemini + Groq.
**Staging (Day 6):** ~$0.50 total across all accounts.
**Production Rehearsals (Days 6–7):** ~$3–5 total.
**Per-Pipeline Cost Estimate:** Break down cost by phase:
  - Ingestion: 0 (no LLM calls — text extraction is library-based)
  - Credibility scoring: ~$0.001 (1 LLM call per source for quality scoring)
  - Contradiction detection: ~$0.005 (5 LLM calls for claim extraction)
  - Insight extraction: ~$0.003 (1 LLM synthesis call)
  - Action chain: ~$0.004 (1 LLM generation call)
  - Contract validation: ~$0.010 (14 base model calls, 1 per module)
  - Embeddings: ~$0.000 (free tier always)
  - **Total per pipeline: ~$0.023 on free tier, ~$0.05 on Vertex AI**

**Latency Analysis per Module:**
  - Module 1 (Ingestion): 200–800ms (depends on PDF/URL size)
  - Module 2 (Credibility): 100–300ms (parallel scoring)
  - Module 3 (Noise Filter): 1,000–3,000ms (embedding generation)
  - Module 4 (Contradiction): 2,000–5,000ms (LLM claim extraction per source)
  - Module 5 (Insights): 1,000–3,000ms (RAG + LLM)
  - Modules 6–7 (Parallel): 1,500–4,000ms
  - Module 8 (Impact): 500–1,500ms
  - Module 9 (Action Chain): 1,000–3,000ms
  - Modules 10–14 (Simulation): 500–2,000ms
  - **Total end-to-end: 10–25 seconds (development), 7–18 seconds (Vertex AI production)**

---

### SECTION 11.3 — BASELINE COMPARISON

**Without Contradiction Detection:**
- System would blindly trust the week-old PDF (500 units)
- Would NOT generate emergency order action
- Business impact: Stockout in < 24 hours, ~PKR 2M revenue lost
- Demonstrates: contradiction detection is not optional — it is the core value of the system

**Without Failure Recovery:**
- ACT-003 (emergency order) fails on first API timeout
- Pipeline terminates — no order placed
- Business impact: Same stockout
- Demonstrates: 15% score criterion (robustness) addresses a real operational risk

**Without AMCE Contract Enforcement:**
- Module 9 might generate 1 action or 10 actions (non-deterministic LLM)
- Module 4 might return contradictions without severity fields (downstream parsing breaks)
- System quality degrades non-deterministically — failures are invisible to operators
- Demonstrates: The AMCE layer is what makes this system production-grade, not demo-grade

---

### SECTION 11.4 — KNOWN LIMITATIONS

1. **SQLite in Cloud Run:** Cloud Run is stateless — SQLite data is lost on container restart. Mitigation: pipeline results returned in API response and audit logs written to persistent storage. Production solution: migrate to Cloud Firestore.

2. **In-Memory Vector Store:** Vector store state is lost on server restart. Mitigation: pipeline runs are self-contained — the vector store is rebuilt fresh for each pipeline run. This is intentional for the hackathon scope.

3. **Vertex AI Latency (asia-south1):** Round-trip latency from Pakistan to asia-south1 is ~50–80ms. Production optimization: add response caching for repeated claim extractions.

4. **Mobile iOS vs Android:** BiometricSecurityService tested primarily on Android. iOS Secure Enclave behavior for expo-secure-store may differ in key persistence across app reinstalls.

5. **Real-time Feed Simulation:** The `realtime_feed` source type uses mocked data (JSON array) rather than a live WebSocket connection. Production implementation would use an actual event stream.

6. **LLM Prompt Non-Determinism:** Even with temperature=0.7, LLM outputs vary. The AMCE layer catches structural deviations, but semantic quality can vary between runs. Mitigation: contract semantic validation + retry on REJECT.

---

### SECTION 11.5 — FUTURE IMPROVEMENTS ROADMAP

1. **Vector Database:** Replace in-memory store with Cloud Firestore vector search or Pinecone for persistent RAG across pipeline runs
2. **Streaming Responses:** Stream LLM token generation to reduce perceived latency in the frontend trace viewer
3. **Multi-tenant Support:** Operator provisioning screen → full authentication system with JWT
4. **Historical Pattern Learning:** Temporal analysis using historical pipeline outcomes, not just current-run data points
5. **Contract Auto-Generation:** Use LLM to auto-generate YAML contract definitions from TypeScript interfaces
6. **Mobile Background Sync:** Implement background task for audit ledger sync using Expo BackgroundFetch

---

## ═══════════════════════════════════════════════════════════════
## DOCUMENT 12 — MASTER DOCUMENTATION INDEX
## File: `docs/INDEX.md`
## ═══════════════════════════════════════════════════════════════

**Antigravity Sub-Agent:** Index Compiler (Write this LAST, after all other documents are complete)

Generate the final index document that:

1. Lists all 12 documents with file path, purpose, and word count
2. Creates a cross-reference matrix: which document to read for each type of question (e.g., "How does Module 4 work?" → Document 4, Section 4.4)
3. Provides a "Judge's Reading Path" — the optimal 5-document sequence for a hackathon judge with 20 minutes to evaluate
4. Provides a "Developer's Reading Path" — the optimal sequence for a new contributor to onboard
5. Lists all diagrams, code samples, and schema definitions with their locations
6. Embeds the final AuditSummaryReceipt with `documentation_gate: "AUTHORIZED"` as the document suite's seal of integrity

---

## ═══════════════════════════════════════════════════════════════
## ANTIGRAVITY EXECUTION DIRECTIVE — FINAL INSTRUCTIONS
## ═══════════════════════════════════════════════════════════════

```
ANTIGRAVITY: Execute the documentation generation sequence now.

EXECUTION ORDER:
1. Read all source files listed under each document before writing it
2. Generate documents in this order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
3. Document 12 (INDEX) is written LAST — after all others are complete
4. For every technical claim, verify it against actual code before writing it
5. Cross-reference: when Document 4 mentions a contract, link to Document 5 API section
6. Minimum word counts per document:
   - README (Doc 1): 3,000 words
   - System Architecture (Doc 2): 4,500 words
   - Phase Development Guide (Doc 3): 3,500 words
   - Module Technical Reference (Doc 4): 7,000 words (500 per module average)
   - API Reference (Doc 5): 3,000 words
   - Web Frontend (Doc 6): 2,500 words
   - Mobile App (Doc 7): 3,000 words
   - Demo & Scenario (Doc 8): 2,000 words
   - Deployment Guide (Doc 9): 2,000 words
   - Audit Report (Doc 10): 1,500 words
   - Engineering Decisions (Doc 11): 2,500 words
   - Master Index (Doc 12): 1,000 words
   TOTAL MINIMUM: 36,000 words of professional documentation

7. After completing ALL 12 documents, emit the final trace event:
   {
     "event": "documentation_complete",
     "documents_generated": 12,
     "total_word_count": [actual count],
     "output_directory": "content-action-agent/docs/",
     "timestamp": "[ISO-8601]",
     "status": "SUBMISSION_READY"
   }

QUALITY STANDARDS:
- Every code example must be complete and runnable (no `// ...` truncations)
- Every interface must show all fields with correct TypeScript types
- Every endpoint must have a working cURL example
- Every design decision must have a "why" explanation
- No generic filler text — every sentence adds specific, accurate information
- Technical accuracy is mandatory — if you are not certain of an implementation detail,
  READ THE FILE before writing, do not guess

FINAL GATE:
After document 12 is written, perform a self-review:
- Does every document reference the others correctly?
- Is every module covered in Document 4?
- Are all API endpoints documented in Document 5?
- Are both frontend and mobile fully covered in Documents 6 and 7?
- Does Document 10 contain the actual SHA-256 audit receipt hash?
If any check fails: revise before declaring SUBMISSION_READY.
```

---

*This documentation generation prompt was designed for Google Antigravity as the primary orchestrating brain. Antigravity reads the live codebase, assigns specialized writing sub-agents to each document, cross-validates technical claims against actual source files via Claude Code, and produces a submission-ready professional documentation suite. The AuditSummaryReceipt SHA-256 hash embedded in Document 10 and Document 12 provides cryptographic proof that documentation was generated from a fully-verified, audit-passing codebase.