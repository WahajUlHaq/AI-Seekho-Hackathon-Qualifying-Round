# Phase 1: Task List — Core Infrastructure

> **Phase:** 1 of 7 | **Duration:** 6–8 hours | **Priority:** Foundation (blocks all other phases)

---

## Step 1.1 — LLMClient Singleton Wiring

- [ ] **1.1.1** Audit all 11 agent files in `backend/src/agents/` for direct AI SDK imports
  - Scan for `import { GoogleGenerativeAI }`, `import Groq`, `from "@google/generative-ai"`, `from "groq-sdk"`
  - Files to check: `multi-source-ingestion.agent.ts`, `credibility-scorer.agent.ts`, `noise-filter.agent.ts`, `contradiction-detector.agent.ts`, `insight-extraction.agent.ts`, `temporal-analysis.agent.ts`, `conflict-resolution.agent.ts`, `impact-analysis.agent.ts`, `action-chain-generator.agent.ts`, `orchestrator.ts`, `base.agent.ts`
  - ✅ Acceptance: `grep -r "from.*@google/generative-ai\|from.*groq-sdk" backend/src/agents/` returns 0 results

- [ ] **1.1.2** Replace any direct SDK imports with `import { llmClient } from "../utils/llm-client"`
  - Update usage patterns: `llmClient.complete(prompt)` for primary model, `llmClient.complete(prompt, true)` for base model
  - Update embedding calls: `llmClient.generateEmbedding(text)`
  - ✅ Acceptance: All agents compile without errors

- [ ] **1.1.3** Create smoke test `backend/src/utils/test-singleton-smoke.ts`
  - Import `llmClient` singleton
  - Call `llmClient.complete("Hello from singleton test")` 
  - Call `llmClient.generateEmbedding("test embedding")`
  - Verify singleton instance is shared (same object reference)
  - ✅ Acceptance: `APP_ENV=development npx ts-node src/utils/test-singleton-smoke.ts` passes

---

## Step 1.2 — AMCE Contract Enforcement Layer

- [ ] **1.2.1** Audit `backend/src/contracts/registry.ts`
  - Verify: Loads YAML files from `definitions/` directory using `js-yaml`
  - Verify: Version management (parses `_v1`, `_v2` suffixes)
  - Verify: `getContract(moduleName: string)` method returns correct contract
  - Verify: `listContracts()` method returns all loaded contracts
  - Fix any gaps found
  - ✅ Acceptance: Registry loads all YAML files and returns contracts by name

- [ ] **1.2.2** Audit `backend/src/contracts/validator.ts`
  - Verify: Structural validation — field presence, types, enums, ranges, regex, nullable, min_items, min_length
  - Verify: Semantic validation using `llmClient.complete(prompt, true)` (base model)
  - Verify: Returns `{ isValid, violations[], warnings[] }` structure
  - Verify: Handles all validation rules from master prompt (lines 309–334, 667–683)
  - Fix any gaps found
  - ✅ Acceptance: Validator correctly validates sample module outputs against contract schemas

- [ ] **1.2.3** Create `backend/src/contracts/decision-gate.ts` *(NEW FILE)*
  - Implement `DecisionGate` class
  - Method: `evaluate(moduleOutput, contract, inputData) → { action: PASS|WARN|REJECT, traceEvent }`
  - Logic: structural failures → REJECT; semantic divergence > 0.6 → REJECT; divergence 0.3–0.6 → WARN; else → PASS
  - Generate `TraceEvent` for every decision
  - Handle REJECT: return `handleRejection()` method for re-generation/fallback
  - ✅ Acceptance: Decision gate correctly classifies test outputs as PASS/WARN/REJECT

- [ ] **1.2.4** Create `backend/src/contracts/benchmark.ts` *(NEW FILE)*
  - Implement `BenchmarkComparator` class
  - Method: `compare(moduleOutput, originalInput, prompt) → divergenceScore`
  - Calls base model via `llmClient.complete(prompt, true)` with same input
  - Computes divergence using cosine similarity between primary and base model outputs
  - Returns score 0.0–1.0
  - ✅ Acceptance: Benchmark returns meaningful divergence scores for identical vs. different outputs

- [ ] **1.2.5** Verify/create `backend/src/contracts/definitions/multi_source_ingestion_v1.yaml`
  - Must match master prompt spec exactly (contract_id, module_name, version, output_schema with min_items: 5, source_type enum, regex for timestamp)
  - enforcement_mode: "BLOCK"
  - ✅ Acceptance: YAML parses correctly and validator uses it successfully

- [ ] **1.2.6** Verify/create `backend/src/contracts/definitions/contradiction_detection_v1.yaml`
  - Must match master prompt spec (contradiction_id, severity enum, resolution_needed boolean)
  - enforcement_mode: "QUARANTINE"
  - ✅ Acceptance: YAML parses correctly

- [ ] **1.2.7** Verify/create `backend/src/contracts/definitions/action_chain_v1.yaml`
  - Must include: actions array (min 3, max 5), action_type enum (7 values), execution_order array
  - enforcement_mode: "BLOCK"
  - ✅ Acceptance: YAML parses correctly

- [ ] **1.2.8** Create test script `backend/src/contracts/test-decision-gate.ts`
  - Test PASS case: valid output matching contract
  - Test WARN case: semantically divergent output
  - Test REJECT case: structurally invalid output (missing fields)
  - Verify trace events are generated for each case
  - ✅ Acceptance: `APP_ENV=development npx ts-node src/contracts/test-decision-gate.ts` passes all 3 cases

---

## Step 1.3 — Base Agent Framework + Trace Collector

- [ ] **1.3.1** Audit `backend/src/agents/base.agent.ts`
  - Verify: Imports `llmClient` from `../utils/llm-client` (not AI SDKs directly)
  - Verify: `execute(input)` method with trace logging
  - Verify: Logs reasoning, tool_usage, decisions, inputs, outputs to TraceCollector
  - Verify: Integrates with DecisionGate for contract validation after execution
  - Verify: Retry logic (configurable `maxRetries`, exponential backoff)
  - Verify: Error handling with fallback behavior
  - Verify: Timing/latency tracking (`startTime`, `endTime`, `durationMs`)
  - Fix any gaps found
  - ✅ Acceptance: Base agent can be extended by module agents with full trace logging

- [ ] **1.3.2** Audit `backend/src/tracing/collector.ts`
  - Verify: Singleton pattern
  - Verify: Stores workplan, task_plan, reasoning_steps[], tool_calls[], decisions[], failures[], recovery_steps[]
  - Verify: `log(traceEvent)` method appends events
  - Verify: `export()` method returns complete trace object
  - Verify: `reset()` method for new pipeline runs
  - Fix any gaps found
  - ✅ Acceptance: Collector accumulates events and exports them in correct structure

- [ ] **1.3.3** Audit `backend/src/tracing/exporter.ts`
  - Verify: Exports JSON with all required fields:
    - `pipeline_id`, `environment`, `ai_provider_used`
    - `workplan`, `task_plan[]`, `reasoning_steps[]`
    - `tool_calls[]`, `action_execution[]`, `recovery_steps[]`
  - Verify: `environment` reflects actual `APP_ENV` value
  - Verify: `ai_provider_used` reflects which provider was actually called
  - Fix any gaps found
  - ✅ Acceptance: Exported JSON includes `environment` and `ai_provider_used` fields (mandatory for judges)

- [ ] **1.3.4** Ensure TraceCollector is properly imported and used in `base.agent.ts`
  - Verify the collector singleton is injected into every agent execution
  - ✅ Acceptance: Agent execution automatically creates trace events

- [ ] **1.3.5** Create integration test for trace flow
  - Create a mock agent extending BaseAgent
  - Execute it with sample input
  - Verify TraceCollector captured: reasoning, tool_calls, decision (PASS/WARN/REJECT), timing
  - Export trace and verify JSON structure
  - ✅ Acceptance: End-to-end trace flow works from agent execution to JSON export

---

## Step 1.4 — Express API Server

- [ ] **1.4.1** Audit `backend/src/index.ts`
  - Verify: CORS configured for `localhost:3000` + Firebase URL placeholder
  - Verify: `express.json({ limit: '50mb' })` for PDF base64 uploads
  - Verify: All route groups registered (pipeline, contracts, validations)
  - Verify: Global error handling middleware
  - Verify: Request logging middleware
  - Verify: Startup log shows LLMClient environment
  - Fix any gaps found
  - ✅ Acceptance: Server starts with `APP_ENV=development npm run dev` and logs correct environment

- [ ] **1.4.2** Audit `backend/src/routes/pipeline.routes.ts`
  - Verify: `POST /api/pipeline/run` — accepts sources[] + constraints body
  - Verify: `GET /api/pipeline/:id` — returns pipeline results
  - Verify: `GET /api/pipeline/:id/trace` — returns trace logs
  - Verify: Request validation (at minimum: sources array must have ≥5 items)
  - Fix any gaps found
  - ✅ Acceptance: All 3 endpoints respond correctly

- [ ] **1.4.3** Create `backend/src/routes/contracts.routes.ts` *(NEW FILE)*
  - `GET /api/contracts` — returns list of all loaded contract definitions
  - `GET /api/contracts/:id` — returns specific contract by ID
  - Wire to Contract Registry
  - ✅ Acceptance: `curl http://localhost:8000/api/contracts` returns array of contracts

- [ ] **1.4.4** Create `backend/src/routes/validations.routes.ts` *(NEW FILE)*
  - `GET /api/validations` — returns validation history
  - `GET /api/validations/:pipelineId` — returns validations for specific pipeline
  - ✅ Acceptance: Endpoint responds with empty array initially

- [ ] **1.4.5** Register new routes in `index.ts`
  - Import and mount `contracts.routes.ts` at `/api/contracts`
  - Import and mount `validations.routes.ts` at `/api/validations`
  - ✅ Acceptance: All 5 route groups respond

- [ ] **1.4.6** Add `npm run dev` script to `package.json` if missing
  - Script: `"dev": "nodemon --exec npx ts-node src/index.ts"`
  - Verify nodemon/ts-node are in devDependencies
  - ✅ Acceptance: `APP_ENV=development npm run dev` starts server with hot reload

---

## Verification & Testing

- [ ] **V.1** Run LLMClient singleton smoke test
  - Command: `APP_ENV=development npx ts-node src/utils/test-singleton-smoke.ts`
  - Expected: Response from Gemini + embedding dimensions logged

- [ ] **V.2** Run contract validation test
  - Command: `APP_ENV=development npx ts-node src/contracts/test-decision-gate.ts`
  - Expected: PASS, WARN, and REJECT cases all handled correctly

- [ ] **V.3** Run Express server and test all endpoints
  - Start: `APP_ENV=development npm run dev`
  - Test: `curl http://localhost:8000/api/contracts` → returns contracts
  - Test: `curl http://localhost:8000/api/validations` → returns empty array
  - Test: `curl http://localhost:8000/api/pipeline/test-id` → returns 404 or empty result

- [ ] **V.4** Verify no direct AI SDK imports in agent files
  - Command: `grep -r "from.*@google/generative-ai" backend/src/agents/` → 0 results
  - Command: `grep -r "from.*groq-sdk" backend/src/agents/` → 0 results

- [ ] **V.5** Verify Phase 1 completion checklist (from Development Roadmap)
  - [ ] All agents import `llmClient` singleton — no direct SDK imports
  - [ ] LLM client working with Gemini free tier and Groq fallback
  - [ ] Contract registry loading YAML definitions
  - [ ] Validator passing all structural tests
  - [ ] Base agent framework with trace logging
  - [ ] Express server running and responding

---

## Summary

| Section | Tasks | New Files | Audit Files |
|---------|-------|-----------|-------------|
| Step 1.1 — LLMClient | 3 | 1 (smoke test) | 11 (all agents) |
| Step 1.2 — Contracts | 8 | 3 (decision-gate, benchmark, test) | 2 (registry, validator) + 3 YAMLs |
| Step 1.3 — Tracing | 5 | 1 (integration test) | 3 (base.agent, collector, exporter) |
| Step 1.4 — Express API | 6 | 2 (contracts routes, validations routes) | 2 (index, pipeline routes) |
| Verification | 5 | — | — |
| **Total** | **27** | **7** | **21** |
