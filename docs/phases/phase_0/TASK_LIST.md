# Task List: Phase 0 - Environment Setup

- [ ] **1. Initialize Antigravity Trace Logger Engine**
  - [ ] Create the `backend/src/tracing` module if not present in the existing base.
  - [ ] Implement the structured logging schema enforcing the required properties: `step`, `tool_called`, `reasoning`, `status`, and `rollback_action`.
  - [ ] Bind the Antigravity central orchestrator to output trace logs to `logs/antigravity_trace.log`.

- [ ] **2. Establish AMCE Contract Enforcement for Phase 0**
  - [ ] Define the Phase 0 environment schema contract (e.g., `multi_source_ingestion_v1.yaml` or similar config contracts).
  - [ ] Implement the `Decision Gate` (PASS/WARN/REJECT) specifically for `.env` parsing and dependency checks.

- [ ] **3. Environment & Credentials Validation Tasks**
  - [ ] Refactor existing environment loaders to be callable as tools by the Antigravity Brain.
  - [ ] Create validation routines for primary AI Keys (Gemini) and fallback AI Keys (Groq).
  - [ ] Ensure `.env.development` and `.env.production` are strictly parsed and segregated.

- [ ] **4. Directory & Dependency Refactoring**
  - [ ] Verify existing backend modules align with the required architecture (`routes`, `agents`, `contracts`, `simulation`, `utils`, `database`).
  - [ ] Implement an Antigravity tool to programmatically verify that all packages (e.g., `zod`, `better-sqlite3`, `groq-sdk`, `@google/generative-ai`) are installed and resolve successfully.

- [ ] **5. Failure Recovery & Validation Testing**
  - [ ] Write a test script simulating a missing primary API key to verify the AMCE issues a `REJECT` and Antigravity triggers a fallback to the secondary provider.
  - [ ] Test the execution rollback mechanism (e.g., reverting state variables on a simulated critical failure).
  - [ ] Validate trace outputs: Manually parse `logs/antigravity_trace.log` to definitively confirm the `step`, `tool_called`, `reasoning`, and `status` fields are correctly logged during both success and failure test scenarios.
