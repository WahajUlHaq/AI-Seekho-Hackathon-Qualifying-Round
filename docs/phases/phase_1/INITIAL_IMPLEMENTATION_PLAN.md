# Initial Implementation Plan: Phase 1 - Core Agents

## 1. Antigravity Orchestration for Phase 1
During Phase 1, the Google Antigravity Central Orchestrator assumes full routing control over the Data Preparation (Phase A) and Conflict Analysis (Phase B) pipelines. 
- **Phase A Routing (M1 → M2 → M3):** Antigravity routes 5 distinct source types into Module 1 in parallel. Following successful ingestion, the pipeline sequentially routes through Module 2 for credibility scoring and Module 3 for noise filtration.
- **Phase B Routing (M4 → M7):** Crucially adhering to the V2 architecture, Antigravity forces conflict detection and resolution *before* insight extraction. It routes filtered sources to Module 4 to normalize claims and detect contradictions, then immediately to Module 7 to securely resolve them and mutate the global state.

## 2. Selective AMCE Contract Validation (V2 Spec)
In accordance with the `MASTER_PROMPT_V2.md` specifications, the Automated Module Contract Enforcement (AMCE) layer operates in a selective efficiency mode during Phase 1:
- **ALERT_ONLY / QUARANTINE Mode:** Modules 1, 2, 3, 4, and 7 do **not** trigger expensive Gemini 1.5 Pro base model evaluations. 
- **Zod Structural Validation:** Instead, the AMCE gates for these modules strictly apply fast, deterministic Zod schema validations. If a module outputs malformed data (e.g., M4 returning a contradiction without a severity flag), AMCE issues a QUARANTINE or REJECT signal, prompting Antigravity to log the failure and trigger a programmatic retry without incurring LLM costs.

## 3. V2 Enterprise Patterns Highlight
Phase 1 implements several mission-critical V2 enterprise patterns that Antigravity will trace:
- **`Promise.allSettled` Circuit Breaker (M1):** Prevents a single corrupt PDF or timed-out URL from crashing the entire multi-source ingestion pipeline.
- **Tabular-to-Text Serialization (M1):** Converts CSV/JSON rows into natural language sentences *before* embedding, completely eliminating tabular hallucination in downstream RAG.
- **Claim Normalization Bridge (M4):** Translates raw unstructured text and structured CSV rows into a canonical schema (`{topic, entity, value, unit}`) to allow cross-format contradiction detection.
- **State Mutation & `resolvedFacts` (M7):** Instead of passing raw conflicting sources downstream, M7 deterministically mutates `PipelineState.resolvedFacts`. All subsequent modules (Phase C onward) strictly read from this resolved truth map.
