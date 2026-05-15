# Phase 1 Task List — Core Infrastructure

**Challenge 1 · Autonomous Content-to-Action Agent · AI Seekho 2026 Hackathon**
**Last updated:** May 15, 2026

---

## Step 1.1: Wire LLM Client Into All Agents

> **Goal:** Confirm the `llmClient` singleton import pattern works from agent files. No agent should ever import `@google/generative-ai` or `groq-sdk` directly.

- [ ] Create `backend/src/utils/smoke-test-singleton.ts`
  - [ ] Import `llmClient` from `"../utils/llm-client"` (same pattern agents will use)
  - [ ] Test `llmClient.complete("Hello from smoke test")` — verify string response
  - [ ] Test `llmClient.generateEmbedding("test")` — verify returns number[] with length > 0
  - [ ] Test `llmClient.complete("Validate", true)` — verify base model path (useBaseModel=true)
  - [ ] Print ✅/❌ for each check
- [ ] Add `"test:smoke"` script to `package.json`: `"cross-env APP_ENV=development npx ts-node src/utils/smoke-test-singleton.ts"`
- [ ] Run `npm run test:smoke` — all checks pass

---

## Step 1.2: Create Contract Registry and Validator

> **Goal:** Complete the AMCE Contract Enforcement Layer. Registry and Validator already exist — fill the gaps: test script, DecisionGate, and BaseAgent refactor.

### 1.2a: Create DecisionGate class
- [ ] Create `backend/src/contracts/decision-gate.ts`
  - [ ] Define `GateResult` interface: `{ action: "PASS"|"WARN"|"REJECT", errors: string[], warnings: string[], semantic_issues: string[], traceEvent }`
  - [ ] Implement `DecisionGate.evaluate(output, contract, context?)` method
    - [ ] Call `contractValidator.validate(output, contract)` for structural check
    - [ ] If structural PASS and contract has `semantic_checks`, call `contractValidator.validateSemantic()`
    - [ ] Return `GateResult` with appropriate action level
  - [ ] Build `traceEvent` object (event_type: "contract_gate", decision, confidence, errors/warnings)
  - [ ] Export `decisionGate` singleton

### 1.2b: Create Contract Validation Test Script
- [ ] Create `backend/src/contracts/test-validator.ts`
  - [ ] Test 1: Valid `multi_source_ingestion` data → expect PASS
  - [ ] Test 2: Missing required `ingestion_id` field → expect REJECT
  - [ ] Test 3: Invalid enum `source_type: "invalid"` → expect REJECT
  - [ ] Test 4: Regex mismatch `ingestion_id: "BAD-FORMAT"` → expect REJECT
  - [ ] Test 5: Valid `contradiction_detection` data → expect PASS
  - [ ] Test 6: Valid `action_chain` data → expect PASS
  - [ ] Test 7: `action_count: 6` (exceeds max:5) → expect WARN
  - [ ] Print summary: `X/7 tests passed`
- [ ] Run `npm run test:contracts` — 7/7 pass

### 1.2c: Refactor BaseAgent to use DecisionGate
- [ ] Modify `backend/src/agents/base.agent.ts`
  - [ ] Import `decisionGate` from `"../contracts/decision-gate"`
  - [ ] Replace inline contract validation logic (lines ~44–80) with `decisionGate.evaluate()` call
  - [ ] Keep same behavior: trace logging, retry on REJECT, break on PASS/WARN
  - [ ] Ensure all existing `BaseAgent` trace event structure is preserved

### 1.2d: Verify existing contracts load correctly
- [ ] Confirm all 3 YAML contracts load at server startup:
  - [ ] `multi_source_ingestion_v1.yaml` loads with correct fields/semantic_checks
  - [ ] `contradiction_detection_v1.yaml` loads with correct fields/semantic_checks  
  - [ ] `action_chain_v1.yaml` loads with correct fields/semantic_checks
- [ ] Run `npm run dev` and check console output: `[ContractRegistry] Loaded: ...` × 3

---

## Step 1.3: Set Up Antigravity Agent Framework

> **Goal:** Harden the BaseAgent and TraceCollector to fully match master prompt requirements.

### 1.3a: BaseAgent enhancements
- [ ] Add `execution_duration_ms` to `agent_complete` trace event
  - [ ] Record `Date.now()` at start of `run()`
  - [ ] Compute `duration_ms = Date.now() - startTime` before logging `agent_complete`
  - [ ] Include in trace event data
- [ ] Add retry hint forwarding
  - [ ] When REJECT triggers retry, pass a `retryHint` flag or context to `execute()` so child agents can optionally adjust their LLM prompt (e.g., use stricter formatting instructions)
  - [ ] Expose as optional `retryContext?: { attempt: number, previousErrors: string[] }` parameter on `execute()`

### 1.3b: TraceCollector enhancements
- [ ] Add `getAll(): PipelineTrace[]` method to `TraceCollector`
  - [ ] Returns all stored pipeline traces (for validation history endpoint)
- [ ] Verify event categorization:
  - [ ] `decision` events → `reasoning_steps[]` ✓
  - [ ] `llm_call` events → `tool_calls[]` ✓
  - [ ] `action_execute` events → `action_execution[]` ✓
  - [ ] `recovery` events → `recovery_steps[]` ✓

---

## Step 1.4: Create Express API Server

> **Goal:** Complete all API routes from the roadmap. Server already exists — add missing routes.

### 1.4a: Create contracts route
- [ ] Create `backend/src/routes/contracts.routes.ts`
  - [ ] `GET /` → list all loaded contracts (name, version, module, description, field count)
  - [ ] `GET /:name` → get full contract definition by name (fields, semantic_checks, everything)

### 1.4b: Create validations route
- [ ] Add validation history endpoint (either in `contracts.routes.ts` or separate `validations.routes.ts`)
  - [ ] `GET /api/validations` → list all pipeline traces showing contract_gate events
  - [ ] Return: `{ validations: [{ pipeline_id, events: [...contract_gate events] }] }`

### 1.4c: Mount new routes in server
- [ ] Modify `backend/src/index.ts`
  - [ ] Import `contractsRoutes` from `"./routes/contracts.routes"`
  - [ ] Mount: `app.use("/api/contracts", contractsRoutes)`
  - [ ] Mount: `app.use("/api/validations", validationsRoute)` (if separate file)

### 1.4d: Clean up pipeline routes
- [ ] Modify `backend/src/routes/pipeline.routes.ts`
  - [ ] Remove `GET /contracts/list` endpoint (line 59–62) — now served by `/api/contracts`
  - [ ] Keep `POST /run`, `GET /:id`, `GET /:id/trace` as-is

### 1.4e: Server startup verification
- [ ] Run `npm run dev` — confirm clean startup:
  - [ ] `[LLMClient] Initialized in development mode → primary: gemini-free`
  - [ ] `[ContractRegistry] Loaded: multi_source_ingestion v1.0`
  - [ ] `[ContractRegistry] Loaded: contradiction_detection v1.0`
  - [ ] `[ContractRegistry] Loaded: action_chain v1.0`
  - [ ] `[Server] Running on http://localhost:8000`
  - [ ] `[Server] Environment: development`

---

## Verification — Phase 1 Complete ✓

> Run all checks below. Every one must pass before moving to Phase 2.

### Test Commands
- [ ] `npm run test:smoke` → LLM singleton ✅ all checks pass
- [ ] `npm run test:contracts` → 7/7 structural validation tests pass
- [ ] `npm run dev` → server starts, 3 contracts loaded, no errors

### API Endpoint Tests
- [ ] `curl http://localhost:8000/health` → `{ status: "ok", environment: "development", provider: "gemini-free", contracts_loaded: ["multi_source_ingestion", "contradiction_detection", "action_chain"] }`
- [ ] `curl http://localhost:8000/api/contracts` → list of 3 contracts with metadata
- [ ] `curl http://localhost:8000/api/contracts/multi_source_ingestion` → full contract definition
- [ ] `curl -X POST http://localhost:8000/api/pipeline/run -H "Content-Type: application/json" -d '{"sources":[{"type":"test"}]}'` → `{ pipeline_id: "PIPE-...", status: "received" }`

### Roadmap Phase 1 Checklist (from DEVELOPMENT_ROADMAP_UPDATED.md)
- [ ] All agents import `llmClient` singleton — no direct SDK imports in agent files
- [ ] LLM client working with Gemini free tier and Groq fallback
- [ ] Contract registry loading YAML definitions
- [ ] Validator passing all structural tests
- [ ] Base agent framework with trace logging
- [ ] Express server running and responding
