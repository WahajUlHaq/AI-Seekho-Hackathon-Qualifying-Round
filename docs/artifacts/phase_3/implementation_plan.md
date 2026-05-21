# Phase 3: Impact Analysis & Strategic Forecasting

This implementation plan details the strategy for Phase 3 (Modules 8, 9, and 10). It bridges the gap between the insights generated in Phase 2 and actionable strategic recommendations, incorporating predictive forecasting and magnitude scoring.

## User Review Required
> [!IMPORTANT]
> **Module Definition Shift**
> Note that this Phase 3 design specifically defines Module 8 as the Impact Scorer, Module 9 as the Predictive Forecaster, and Module 10 as the Strategic Recommender, which introduces a 30/60/90 day forecasting step before generating actions. Please review this alignment with the original constraint-validation architecture.

## Proposed Changes

### [NEW] `backend/src/agents/impact-scorer.agent.ts` (Module 8)
- Extends `BaseAgent`
- Maps Phase 2 `InsightExtractionOutput` to a 0-100 "Impact Magnitude Score".
- Employs weighted variables: Financial (40%), Operational (35%), Reputational (25%).
- Uses `llmClient` to synthesize unstructured insights into these weighted buckets.

### [NEW] `backend/src/agents/predictive-forecaster.agent.ts` (Module 9)
- Extends `BaseAgent`
- Consumes the temporal slopes and patterns (Decline, Spike, Drift) identified in Phase 2's Temporal Analysis Engine.
- Uses `llmClient` to extrapolate these mathematical slopes into qualitative and quantitative 30/60/90-day scenarios.
- Feeds predictions back to validate against original temporal constraints.

### [NEW] `backend/src/agents/strategic-recommender.agent.ts` (Module 10)
- Extends `BaseAgent`
- Transitions from "what happened" and "what will happen" to "what should we do."
- Consumes the Impact Score and 30/60/90-day scenarios to generate a prioritized list of action items (`StrategyProposal`).
- Actions include dependency mapping, but focus on strategic priority rather than micro-simulation.

### AMCE Contract Integration
#### [NEW] `backend/src/contracts/definitions/impact_analysis_v1.yaml`
- Schema for the 0-100 magnitude score and component weights.
#### [NEW] `backend/src/contracts/definitions/strategic_recommendation_v1.yaml`
- Schema for the prioritized action items and forecasting scenarios.

## Critical Risks
> [!WARNING]
> **Cross-Module Data Dependencies**
> 1. **Temporal Feedback Loop:** Module 9 relies heavily on accurate mathematical slopes from Phase 2. If Phase 2 temporal analysis returns "Stable" when it shouldn't, the 30/60/90 day forecasts will be invalid.
> 2. **Context Window Limits:** Module 10 must ingest the original sources, Phase 2 insights, Impact Scores, AND the Forecasts. This massive payload may exceed the reliable context window or cause LLM "lost in the middle" phenomena.
> 3. **Scoring Subjectivity:** Mapping qualitative text to a strict 0-100 Financial/Operational score requires highly rigorous LLM prompts to avoid hallucinated weights.
