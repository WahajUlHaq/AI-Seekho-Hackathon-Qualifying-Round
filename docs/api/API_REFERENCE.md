# API Reference Documentation
**Autonomous Content-to-Action Agent**

This document comprehensively outlines the REST API structure, exact JSON schemas, SSE transport boundaries, and Antigravity-specific trace objects utilized across the ecosystem.

---

## 1. Base URL & Authentication

- **Development Base URL:** `http://localhost:8000`
- **Production Base URL:** `https://[cloud-run-url].run.app`
- **Authentication:** Unauthenticated/Open API specifically architected to facilitate hackathon demo review.
- **CORS Configuration:** Strictly allows requests emitting from `localhost:3000` and designated `Firebase Hosting` origins.
- **Headers:** `Content-Type: application/json` strictly enforced globally across POST boundaries.

---

## 2. Complete Endpoint Reference

### 2.1 Trigger Pipeline
**`POST /api/pipeline/run`**
Initiates a new pipeline execution across 14 modules.
- **Request Schema:**
  ```json
  {
    "sources": [
      {
        "source_id": "SRC-001",
        "source_type": "pdf",
        "content": "base64_string",
        "metadata": { "timestamp": "2026-05-21T10:00:00Z" }
      }
    ],
    "constraints": { "budget": 500000, "time_hours": 48, "urgency": "HIGH" }
  }
  ```
- **Response Schema:**
  ```json
  {
    "pipeline_id": "8b52f6d0-...",
    "status": "PROCESSING",
    "message": "Pipeline initialized successfully."
  }
  ```
- **cURL:** `curl -X POST http://localhost:8000/api/pipeline/run -H "Content-Type: application/json" -d @test-data.json`
- **Expected Latency:** 200ms-400ms (Immediately hands off logic to background worker).

### 2.2 Retrieve Pipeline
**`GET /api/pipeline/:id`**
Retrieves the raw final JSON structural outputs of the analytical modules.
- **Response:** `200 OK` (Full JSON Pipeline payload).

### 2.3 Retrieve Trace
**`GET /api/pipeline/:id/trace`**
Fetches the granular Antigravity intelligence trace containing all reasoning steps and tool calls.
- **Response:** `200 OK` (See Trace JSON section below).

### 2.4 Server-Sent Events (SSE) Stream
**`GET /api/pipeline/:id/stream`**
Establishes a persistent unilateral HTTP connection streaming application state.
- **Response:** `200 OK` (Content-Type: `text/event-stream`).

### 2.5 HITL Approval
**`POST /api/execution/:id/approve`**
Advances state from `PENDING` into `EXECUTING`.
- **Request:** `{"approver_name": "Op-Alex-89"}`
- **Response:** `200 OK`
- **Error:** `409 Conflict` (If state is not PENDING).

### 2.6 Contract History
**`GET /api/contracts`**
Returns list of all active AMCE YAML constraints protecting the modules.

### 2.7 Debug Endpoints
- **`POST /api/debug/contradiction-detect`**
- **`POST /api/debug/constraint-validate`**
- *Usage:* Designed exclusively for stress-tests bypassing primary ingest queues.

---

## 3. Data Schema Reference

**NormalizedSource**
```typescript
interface NormalizedSource {
  source_id: string;
  source_type: string;
  raw_text: string;
  timestamp: string;
}
```

**StrategyProposal**
```typescript
interface StrategyProposal {
  proposal_id: string;
  actions: ActionNode[];
  created_at: string;
}
interface ActionNode {
  action_id: string;
  title: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  depends_on: string[];
  estimated_cost: number;
}
```

**WorkflowAudit**
```typescript
interface WorkflowAudit {
  audit_id: string;
  verification_hash: string; // 64-character SHA-256 string
  signature_block: { approver: string, timestamp: string };
  finalized_status: 'PASS' | 'FAIL' | 'PARTIAL';
}
```

---

## 4. The Antigravity Trace Format

This structured artifact provides total transparency regarding the system's autonomic reasoning. Judges inspect this payload to verify execution validity.

```json
{
  "pipeline_id": "8b52f6d0-a3bc-4f76-9c40-3b8a1c9e8d1a",
  "environment": "production",
  "ai_provider_used": "vertex-ai",
  "workplan": "Resolve acute inventory shortage...",
  "task_plan": [
    "Task 1: Execute Multi-Source Ingestion",
    "Task 2: Execute Credibility Scoring..."
  ],
  "reasoning_steps": [
    {
      "step": 4,
      "agent": "contradiction_detector",
      "reasoning": "Detected 90% numeric divergence between PDF SRC-001 (500 units) and CSV SRC-002 (Out of stock).",
      "decision": "Flagging as CRITICAL severity contradiction requiring resolution.",
      "confidence": 0.98
    }
  ],
  "tool_calls": [
    {
      "tool": "InMemoryVectorStore.search",
      "parameters": { "query": "stock units", "top_k": 5 }
    }
  ],
  "action_execution": [
    { "action_id": "ACT-001", "status": "COMPLETED", "cost": 450000 }
  ],
  "recovery_steps": [
    {
      "action_id": "ACT-003",
      "strategy": "RETRY",
      "attempt": 1,
      "reason": "Simulated 503 Gateway Timeout"
    }
  ],
  "contract_decisions": [
    {
      "module": "strategic_recommender",
      "decision": "PASS",
      "violations": []
    }
  ]
}
```

---

## 5. Server-Sent Events (SSE) Stream Reference

All events utilize standard W3C `text/event-stream` schema formatting.

| Event Type | When Emitted | Payload Fields |
|:---|:---|:---|
| `agent_start` | Module begins logic. | `module`, `phase`, `timestamp` |
| `agent_complete` | Module completes output formatting. | `module`, `output_summary`, `contract_decision` |
| `contract_check` | Triggered by AMCE validator. | `contract_id`, `decision`, `violations` |
| `hitl_pending` | Action chain formulated and ready for review. | `proposal` (full StrategyProposal object) |
| `hitl_approved` | Operator authorizes execution. | `approver`, `signed_by`, `timestamp` |
| `hitl_rejected` | Operator permanently halts action. | `rejector`, `reason`, `timestamp` |
| `failure` | Explicit HTTP/Simulated failure logged. | `action_id`, `reason`, `recovery_strategy` |
| `failure_recovery` | Engine attempts internal mitigation. | `action_id`, `strategy`, `attempt_number` |
| `budget_revalidation` | After successful transaction affects constraint limits. | `remaining_budget`, `affected_actions` |
| `pipeline_complete` | Final module finishes. | `audit_record`, `outcome_summary` |
