# Deployment & Operations Guide
**Autonomous Content-to-Action Agent**

This document covers the comprehensive cloud infrastructure setup, Google Cloud Platform (GCP) configurations, deployment commands, and environmental variable mappings for the pipeline.

---

## 1. Complete Deployment Architecture

```
Internet (Global Clients)
    │
    ├─── Firebase Hosting (https://[app-name].web.app)
    │         └── Next.js Web Application (Static HTML/CSS/JS export)
    │                   │ REST + SSE (Cross-Origin HTTP)
    │                   ▼
    └─── Google Cloud Run (https://[backend-name].run.app)
              └── Express.js Node.js Container (Containerized Backend)
                        ├── Interacts: Vertex AI (Primary Demo Production) 
                        ├── Interacts: Gemini Free / Groq (Cascaded Fallbacks)
                        ├── Volatile Local: SQLite (Ephemeral pipeline state caching)
                        └── Persistent Write: audit-logs/ (SHA-256 JSON validation)

Mobile Application
    │ REST + SSE (Native React-Native-Event-Source)
    └── Google Cloud Run Backend (Identical URL Target)
```

---

## 2. Step-by-Step Cloud Run Deployment (Backend)

The Node.js Express server is built to deploy natively inside a stateless Docker container executed via Google Cloud Run under Person A's GCP account infrastructure.

**Execution Steps:**
1. Authorize the `gcloud` CLI tools:
   ```bash
   gcloud auth login
   gcloud config set project [person-a-project-id]
   ```
2. Navigate to the backend directory:
   ```bash
   cd content-action-agent/backend
   ```
3. Execute the Cloud Run deployment mapping to `asia-south1` for low-latency operations:
   ```bash
   gcloud run deploy content-action-backend \
     --source . \
     --region asia-south1 \
     --allow-unauthenticated \
     --set-env-vars APP_ENV=production,PRIMARY_PROVIDER=vertex-ai \
     --set-secrets=VERTEX_KEY_1=vertex-key-1:latest,...
   ```
4. Verification: Retrieve the `.run.app` URL and execute `curl https://[backend-url].run.app/health`. Output must yield `{"status":"ok"}`.

---

## 3. Step-by-Step Firebase Deployment (Frontend)

The Next.js application exports fully as static assets pushed globally via Firebase CDN under the unified free tier allocations.

**Execution Steps:**
1. Update Next.js build environment targets:
   ```bash
   export NEXT_PUBLIC_API_BASE_URL="https://[backend-url].run.app"
   ```
2. Initiate static build sequence:
   ```bash
   cd content-action-agent/frontend
   npm run build
   ```
3. Initialize and deploy Firebase targets:
   ```bash
   firebase login
   firebase init hosting # Select the `out/` directory as public root
   firebase deploy --only hosting
   ```
4. Verification: Load `https://[app-name].web.app` in the browser and initiate a mock ingestion payload.

---

## 4. Vertex AI Key Setup (GCP Integration)

Configuring the enterprise LLM pipelines securely via Person B and Person C's rotating GCP accounts.

1. Ensure the `Vertex AI User` IAM role is granted to the active service accounts.
2. Download the highly-secure JSON credential payloads from the IAM & Admin console.
3. Map these JSON keys locally into `.env.production` (never committed to git) mapped securely to:
   - `VERTEX_KEY_1` / `VERTEX_PROJECT_ID_1`
   - `VERTEX_KEY_2` / `VERTEX_PROJECT_ID_2`
4. The backend initializes `APP_ENV=production`, directly engaging the `LLMClient` singleton's Vertex AI configurations.

---

## 5. Environment Variable Complete Reference

| Variable Name | Required | Default | Description | Used By |
|:---|:---|:---|:---|:---|
| `APP_ENV` | Yes | `development` | Dictates core logic modes switching between free-tier APIs and Vertex AI endpoints. | Backend |
| `PRIMARY_PROVIDER` | Yes | `gemini-free` | Active LLM target (`gemini-free`, `vertex-ai`, `groq`). | Backend |
| `FALLBACK_PROVIDER` | No | `groq` | First resilience layer handling primary provider timeouts. | Backend |
| `GEMINI_API_KEY` | Yes (Dev) | - | API key connecting to Google AI Studio standard tiers. | Backend |
| `GROQ_API_KEY` | Yes (Dev) | - | Secondary API key executing Llama 3.1 ultra-fast inference. | Backend |
| `VERTEX_PROJECT_ID_1` | Yes (Prod) | - | Target GCP Project ID authorizing primary generative requests. | Backend |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `http://localhost:8000` | Points UI networking boundaries toward the explicit backend containers. | Frontend |
| `EXPO_PUBLIC_OPERATOR_HANDLE`| No | - | Secure identity string; if absent, invokes operator provisioning UI. | Mobile |
| `EXPO_PUBLIC_API_BASE_URL` | Yes | - | Directs native mobile endpoints to the Cloud Run environment. | Mobile |

---

## 6. GCP Budget Monitoring Setup

The system proactively handles tight financial thresholds to guarantee zero accidental billing overages during prolonged demo sequences.

1. Navigate to **Billing > Budgets & Alerts** in the GCP Console.
2. Create strict alerts set at **$4.00** scaling notifications across email.
3. The codebase implements soft-capping limits utilizing `VERTEX_ACCOUNTS` rotations. If Account A approaches limits, the codebase fails gracefully and the `LLMClient` index rotates automatically to Account B.
4. This ensures the demo scenario continues flawlessly unhindered by background billing halts.

---

## 7. Troubleshooting Runbook

| Known Issue | Root Cause | Resolution |
|:---|:---|:---|
| **Gemini 429 Rate Limit** | Free tier API limits (15 RPM) exceeded during dense contradiction sweeps. | Fallback array immediately intercepts routing requests via Groq API. |
| **Contract Validation REJECT loop** | Module outputting structural hallucinations breaking Zod checks. | Engine forces up to 2 regenerative LLM prompts. If failed, falls back to base model defaults seamlessly. |
| **Frontend CORS Error** | `firebase.web.app` missing from Express headers. | Add exact Firebase domain into `index.ts` CORS origin whitelist. Redeploy backend. |
| **SQLite I/O Exception** | Cloud Run ephemeral instances restarted clearing volatile DB mounts. | Hackathon acceptable logic: rely on immediate API responses rather than persistent SQLite rows. Final receipts always write successfully prior to termination. |
| **Mobile EventSource Drops** | Backgrounding OS terminates long-polling buffers. | `useStandalonePipeline.ts` automatically initializes 3-second fallback polling, rendering updates accurately despite TCP drops. |
