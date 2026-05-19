# Initial Implementation Plan: Phase 2 - Intelligence & Decision Agents

## 1. Antigravity Orchestration for Phase 2
During Phase 2, the Google Antigravity Central Orchestrator drives the Intelligence (Phase C) and Decision Making (Phase D) pipelines. Antigravity retains absolute control over the execution loop, invoking backend modules strictly as isolated tools.
- **Phase C Routing (M5 → M6):** Antigravity explicitly routes the pipeline such that Module 5 (Insight Extraction) reads its context from `state.resolvedFacts` FIRST. This guarantees the insights are generated from conflict-free truth established in Phase 1, rather than raw, conflicting sources. Antigravity then invokes Module 6 for temporal pattern analysis.
- **Phase D Routing (M8 → M9):** Antigravity routes the synthesized insights into Module 8 to model constraint tradeoffs and compute quantified impact. Finally, it invokes Module 9 to generate the executable action chain. 

## 2. Strict AMCE Contract Enforcement (BLOCK + BASE MODEL)
In Phase 2, the AMCE layer scales its enforcement strategy to protect against AI hallucinations during complex generation tasks. 
- **Modules 5 and 9 (BLOCK + BASE MODEL):** The AMCE layer applies rigorous Base Model validation (utilizing Gemini 1.5 Pro) on the RAG insights and the generated action chain. If the generated output is structurally flawed or logically unsound, the AMCE gate triggers a strict BLOCK state, forcing Antigravity to re-prompt the LLM or fall back to the base model output.
- **Modules 6 and 8 (ALERT_ONLY):** These modules continue to use fast, deterministic Zod structural validation without incurring additional LLM costs.

## 3. V2 Enterprise Patterns Highlight
- **Ephemeral Vector Store (M5):** A per-pipeline-run, in-memory vector database is instantiated. It utilizes the pre-serialized tabular chunks from Phase 1 to completely prevent tabular RAG hallucinations. The store is destroyed after the pipeline completes to prevent cross-run contamination.
- **Multi-Query Retrieval (M5):** Instead of a generic single embedding search, M5 utilizes 5 distinct, domain-specific supply chain questions to retrieve up to 25 unique chunks.
- **Topological Sort Validation (M9):** Antigravity validates the dependency graph of the generated action chain using a topological sort. This mathematically ensures there are no circular dependencies and no orphan references before the chain is passed to the execution simulator.

## 4. Trace Logger Telemetry
Every action executed by Antigravity in this phase will strictly append the following explicit telemetry to the Antigravity Trace Log:
- `timestamp`, `step`, `tool_called`, `reasoning`, `status`, `rollback_action`
- `latency_ms` and `cost`
- **Explicit Reasoning Payload:** The 5 mandated rubric categories (`workplan_formulation`, `task_execution`, `tool_calls`, `constraint_evaluation`, `failure_recovery`).
