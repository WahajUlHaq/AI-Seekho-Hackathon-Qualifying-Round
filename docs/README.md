# Autonomous Content-to-Action Agent
**InnoCollab AI Seekho 2026 — Challenge 1**

> **Deadline:** May 20, 2026

![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)
![Audit Status](https://img.shields.io/badge/Audit-45%2F45%20PASS-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![Platform](https://img.shields.io/badge/Platform-Google%20Antigravity-orange)

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Expo](https://img.shields.io/badge/Expo-Latest-black)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-blueviolet)
![Vertex AI](https://img.shields.io/badge/Cloud-Vertex%20AI-blue)
![Firebase](https://img.shields.io/badge/Hosting-Firebase-yellow)
![Cloud Run](https://img.shields.io/badge/Backend-Cloud%20Run-blue)

---

## 1. Executive Summary

The **Autonomous Content-to-Action Agent** is an advanced autonomous agentic AI system designed to proactively manage crises by translating unstructured, multi-modal data streams into concrete, verifiable, and executable operational action chains. **This is NOT a summarization tool.** Instead of merely synthesizing text, this system actively monitors operational inputs, synthesizes insights, plans strategic remediation steps, and executes them within simulated constraints while managing recovery and failure scenarios.

The architecture robustly ingests up to five simultaneous content sources spanning distinct modalities (PDF reports, web URLs, CSV logs, unstructured emails, and real-time JSON feeds). It actively filters noise, detects factual contradictions across those sources, resolves conflicts, and leverages a robust temporal analysis engine to track signal shifts. This rich context is then synthesized to generate 3–5 interconnected action chains. Every proposed action chain is evaluated against budget constraints, time availability, resources, and urgency levels before entering the execution simulator—which simulates live API invocations, handles dynamic failures, and manages automatic retries and cascade-skipping in failure-recovery pathways.

What fundamentally sets this system apart is the **AMCE (Autonomous Module Contract Enforcement)** layer. Rather than depending on raw, non-deterministic outputs from a single LLM layer, every one of the 14 internal modules uses a dual-model verification architecture. The primary generative model crafts the output, while an independent base model evaluates and verifies the contract's structural, semantic, and divergence criteria before permitting the pipeline to proceed. This establishes a deeply self-correcting autonomous framework.

At the core of the system sits **Google Antigravity**, acting as the central orchestration brain. Antigravity goes beyond functioning as a simple API wrapper; it meticulously manages the entire reasoning chain, task planning, and tool dispatch. Antigravity dynamically coordinates the sub-agents and orchestrates failure recovery decisions, producing a highly structured and auditable reasoning trace for every decision. This provides unparalleled transparency into the agent's autonomous behavior, allowing human operators and judges to transparently inspect every logic branch.

The effectiveness of this architecture is demonstrated through the **Inventory Shortage Crisis** scenario—a realistic Pakistani retail and supply-chain use case. In this scenario, five deeply conflicting data sources (a week-old warehouse PDF claiming ample stock, a real-time CSV highlighting a demand spike, an email confirming a transport strike, corroborating news articles, and active customer complaints) converge. The system autonomously determines the factual reality, triggering a 5-action emergency response chain worth PKR 455,000, recovering from a simulated API failure with automatic retry logic, and resolving the crisis.

---

## 2. Quick Start (Full Setup Guide)

### Development Setup (Days 1–5 — Zero Cost)
To run the environment in development using free-tier API endpoints:

```bash
# Clone the repository and navigate to the backend
cd content-action-agent/backend
npm install

# Configure the free tier environment
cp .env.example .env.development

# Open .env.development and fill in your free tier keys:
# GEMINI_API_KEY=your_gemini_key
# GROQ_API_KEY=your_groq_key
# PRIMARY_PROVIDER=gemini-free
# FALLBACK_PROVIDER=groq

# Launch the backend
APP_ENV=development npm run dev

# You should see the console output:
# [LLMClient] Initialized in development mode → primary: gemini-free
```

### Frontend Setup
To run the Next.js Web Dashboard:

```bash
cd content-action-agent/frontend
npm install
npm run dev

# The dashboard will be available at: http://localhost:3000
```

### Mobile Setup
To run the Expo Mobile Application for operators:

```bash
cd content-action-agent/mobile
npm install
npx expo start

# Scan the generated QR code with the Expo Go app on your iOS or Android device.
```

### Production Setup (Days 6–7 — GCP Credits)
To run the system in production using Vertex AI endpoints:

```bash
cd content-action-agent/backend
cp .env.example .env.production

# Fill in your Vertex AI GCP credentials in .env.production:
# VERTEX_KEY_1=your_key
# VERTEX_PROJECT_ID_1=project_id_1
# VERTEX_KEY_2=your_second_key
# VERTEX_PROJECT_ID_2=project_id_2
# PRIMARY_PROVIDER=vertex-ai

APP_ENV=production npm run dev

# You should see the console output:
# [LLMClient] Initialized in production mode → primary: vertex-ai
```

**Production URLs:**
- Cloud Run Backend URL: `https://your-backend.run.app`
- Firebase Frontend URL: `https://your-app.web.app`

---

## 3. Complete Deliverables Matrix

Every requested deliverable for the Hackathon has been comprehensively completed and verified.

| Deliverable | Requirement | Location | Status |
|:---|:---|:---|:---|
| Working prototype | Mandatory | Cloud Run + Firebase | ✅ PASS |
| Mobile app (React Native/Expo) | Mandatory | `mobile/` | ✅ PASS |
| Web dashboard | Recommended | `frontend/` | ✅ PASS |
| Demo video (3–5 min) | Mandatory | `docs/demo/` | ✅ PASS |
| Antigravity trace logs | Mandatory | `backend/audit-logs/` | ✅ PASS |
| README documentation | Mandatory | `docs/README.md` | ✅ PASS |
| Architecture diagram | Required | `docs/architecture/` | ✅ PASS |
| Audit report | Internal | `docs/POST_AUDIT_REPORT_FINAL.md` | ✅ 45/45 |

---

## 4. Evaluation Criteria Alignment Table

This system was deliberately architected around the core scoring parameters to ensure every technical capability directly fulfills an evaluation criteria.

| Criterion | Weight | How This System Addresses It | Proof Location |
|:---|:---:|:---|:---|
| **Antigravity Integration** | 20% | Antigravity is the foundational orchestration brain driving the 14-module agentic chain, executing a structured task plan, logging decisions through deep reasoning traces, and managing fallback routines rather than serving as a basic endpoint proxy. | `backend/audit-logs/` (Trace logs) |
| **Agentic Reasoning & Workflow** | 20% | The pipeline employs autonomous multi-stage progression: ingesting files, verifying semantic credibility, deduplicating, detecting contradictions, synthesizing context, and outputting execution graphs via an inspectable 14-module step workflow. | `backend/src/agents/` (Module chain) |
| **Insight Quality & Contradiction Handling** | 20% | Dedicated contradiction detection, temporal analysis, and conflict resolution modules explicitly cross-reference inputs (e.g. week-old reports vs live feeds) to establish accurate context and highlight factual mismatches before strategic generation. | `backend/src/agents/contradiction-detector.agent.ts` (Modules 4, 5, 7) |
| **Action Chain & Outcome Simulation** | 15% | The Strategic Recommender forms logical DAG execution chains evaluated by the Constraint Validator and simulated for real-world failures, incorporating recovery rollbacks and cascade skipping to simulate operational resilience. | `backend/src/simulation/` (Modules 9–13) |
| **Robustness, Scalability, Cost & Latency** | 15% | Stress-tested against diverging sources, cascading failure chains, and budget restrictions. The system utilizes multi-account GCP rotation for LLM billing and free embeddings to drastically cut operational latency and API overhead cost. | `docs/demo/DEMO_SCENARIO_DOCUMENTATION.md` (Stress tests) |
| **Innovation & UX** | 10% | Features a split-phase live trace Next.js UI, cryptographic compliance receipts, AMCE contract enforcement layer for data structuring, and a biometric-secured Mobile App explicitly designed for real-world operational operators. | `frontend/src/` & `mobile/src/` (UI + AMCE layer) |

---

## 5. Technology Stack Complete Reference

### AI & LLM Layer
- **Google Gemini 1.5 Flash:** Primary LLM utilized during the rapid development phase, leveraging its generous free tier (15 req/min, 1M tokens/min) for initial pipeline prototyping.
- **Google Gemini 1.5 Pro:** Assigned as the fundamental base model exclusively for AMCE contract validation, providing the deepest semantic reasoning capability required for strict module output enforcement.
- **Google Vertex AI Gemini:** Designated as the official production LLM for demo-day execution. Consumes allocated GCP credits, offering enhanced enterprise rate limits and localized performance via the `asia-south1` region.
- **Groq Llama 3.1 70B Versatile:** Serves as an ultra-fast, robust emergency fallback LLM (utilizing its 30 req/min free limit), ensuring the pipeline survives temporary service degradation of primary models.
- **Google text-embedding-004:** The standard provider for generating semantic embeddings critical for the InMemoryVectorStore's RAG and cosine similarity deduplication, permanently remaining on the free tier to minimize operational costs.

### Backend Infrastructure
- **Core Runtime:** Node.js + TypeScript enforcing rigorous strict-mode compilation.
- **Framework & Data Layer:** Express.js powers the REST and SSE API layers; Zod ensures strict schema request validation; SQLite (via better-sqlite3) maintains local state persistence.
- **Ingestion Parsers:** Integration with `pdf-parse`, `cheerio`, `@extractus/article-extractor`, and `papaparse` allows robust multi-format content extraction out-of-the-box.
- **Identity & Identification:** Uses `uuid` library for universally unique pipeline, trace, and entity ID generation.
- **Orchestration:** Google Antigravity serves as the intelligent orchestration brain and deep reasoning trace generation engine.

### Web Frontend Dashboard
- **Framework & Language:** Next.js utilizing TypeScript, styled with Tailwind CSS, and structured via the robust `shadcn/ui` accessible component library.
- **Data Streaming:** `EventSource` (Server-Sent Events) integration for ultra-low latency real-time pipeline trace streaming without WebSocket overhead.
- **Data Visualization:** `Recharts` implementation for cleanly displaying complex outcome metrics and temporal anomaly patterns.
- **Contract Boundary:** OpenAPI-derived TypeScript interfaces establish a strictly type-safe API contract layer between backend and frontend.

### Mobile App (Expo / React Native)
- **Framework:** Expo managed workflow providing seamless access to complex native modules via React Native and TypeScript.
- **Hardware Integration:**
  - `expo-secure-store`: Provides hardware-backed encrypted secret storage, protecting operator identity keys and the immutable local audit ledger.
  - `expo-local-authentication`: Implements biometric gates (Face ID, Touch ID, Android Biometrics) enforcing non-repudiation for HITL approvals.
  - `expo-crypto`: Executes low-level native SHA-256 HMAC computations for cryptographic identity signing without relying on JS-bridges.
  - `expo-document-picker` & `expo-file-system`: Native handlers for robust localized document ingestion (PDF, CSV, TXT).
  - `react-native-event-source`: Native implementation handling robust SSE streaming direct to the mobile client.

### Cloud Infrastructure & Deployment
- **Backend Hosting:** Google Cloud Run, deployed under Person A's GCP account using a $5 credit allowance deployed in the `asia-south1` region for low latency.
- **Web Frontend Hosting:** Firebase Hosting providing a fast global CDN layer utilizing the free tier allocation (0 credit consumption).
- **Blob Storage:** Google Cloud Storage managed under Person C's GCP account to handle robust multi-modal file uploads with a secondary $5 credit allowance.

---

## 6. Team Structure & GCP Credit Allocation

A strict resource strategy was implemented to maximize Hackathon evaluation metrics while meticulously avoiding unexpected infrastructure bills across the team's accounts.

| Team Member | GCP Account Role | Primary Responsibility | Budget |
|:---|:---|:---|:---|
| **Person A** | Infrastructure | Primary Cloud Run backend container hosting and network configurations. | $5 GCP credits |
| **Person B** | AI Primary | Vertex AI Gemini execution (Main demo orchestration capabilities). | $5 GCP credits |
| **Person C** | AI Backup + Files | Vertex AI fallback rotation capabilities + Cloud Storage blob management. | $5 GCP credits |
| **All Members** | Frontend Delivery | Unified Firebase Hosting deployment (Frontend application availability). | $0 (Free Tier) |

**Cost & Spend Timeline Execution:**
- **Days 1–5:** $0 total expenditure. Engineering heavily relied on free API proxies and local emulator infrastructure.
- **Day 6 (Staging):** ~$0.50 utilized to finalize staging pipelines and perform preliminary stress-tests.
- **Days 6–7 (Rehearsals & Demo):** Estimated ~$3.00 to $5.00 total across all cumulative accounts to support comprehensive demonstration recording and stress-test confirmations.
