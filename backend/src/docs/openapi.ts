import { OpenAPIV3 } from "openapi-types";

const ACT_ID_PATTERN = "^ACT-[A-Z0-9]{6}$";
const AUD_ID_PATTERN = "^AUD-[A-Z0-9]{8}$";
const ING_ID_PATTERN = "^ING-[A-Z0-9]{8}$";
const PIPE_ID_PATTERN = "^PIPE-[A-Z0-9]{8}$";
const SHA256_PATTERN = "^[a-f0-9]{64}$";

const schemas: Record<string, OpenAPIV3.SchemaObject> = {
    ApprovalState: {
        type: "string",
        enum: ["PENDING", "EXECUTING", "REJECTED", "COMPLETED"],
        description:
            "State machine for the HITL approval gate. Only PENDING -> EXECUTING is reachable via POST /api/execution/:id/approve (atomic check-and-set).",
        example: "PENDING",
    },

    Priority: {
        type: "string",
        enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
        example: "HIGH",
    },

    ProposedAction: {
        type: "object",
        required: ["action_id", "title", "description", "priority", "depends_on"],
        properties: {
            action_id: { type: "string", pattern: ACT_ID_PATTERN, example: "ACT-9F3X2B" },
            title: { type: "string", example: "Roll out feature flag to 5% cohort" },
            description: {
                type: "string",
                example: "Gradual rollout to validate latency impact under production load.",
            },
            priority: { $ref: "#/components/schemas/Priority" },
            depends_on: {
                type: "array",
                items: { type: "string", pattern: ACT_ID_PATTERN },
                example: ["ACT-A1B2C3"],
            },
        },
    },

    StrategyProposal: {
        type: "object",
        required: ["proposedActions", "rationale", "overall_priority"],
        properties: {
            proposedActions: {
                type: "array",
                items: { $ref: "#/components/schemas/ProposedAction" },
            },
            rationale: {
                type: "string",
                description: "Must reference at least one forecast horizon (30/60/90-day).",
                example:
                    "Within the 30-day horizon, projected user-reported latency dominates risk; staged rollout mitigates blast radius.",
            },
            overall_priority: { $ref: "#/components/schemas/Priority" },
        },
    },

    PipelineApprovalRecord: {
        type: "object",
        required: ["pipeline_id", "state", "proposed_at", "proposal"],
        description:
            "Canonical 200 payload of GET /api/execution/:id/pending. Mirrors src/stores/pipeline-approval.store.ts.",
        properties: {
            pipeline_id: { type: "string", pattern: PIPE_ID_PATTERN, example: "PIPE-7K2A9F31" },
            state: { $ref: "#/components/schemas/ApprovalState" },
            proposed_at: { type: "string", format: "date-time", example: "2026-05-16T14:22:08.114Z" },
            approved_at: {
                type: "string",
                format: "date-time",
                nullable: true,
                example: "2026-05-16T14:25:01.902Z",
            },
            approved_by: { type: "string", nullable: true, example: "alex.chen" },
            rejected_at: {
                type: "string",
                format: "date-time",
                nullable: true,
                example: "2026-05-16T14:24:30.114Z",
            },
            rejected_by: { type: "string", nullable: true, example: "alex.chen" },
            rejection_reason: { type: "string", nullable: true, example: "Risk too high for current freeze." },
            proposal: { $ref: "#/components/schemas/StrategyProposal" },
        },
    },

    ApproveRequest: {
        type: "object",
        required: ["approved_by"],
        properties: {
            approved_by: {
                type: "string",
                minLength: 1,
                description:
                    "Human approver signature name (operator handle). Trimmed; empty string yields 400.",
                example: "alex.chen",
            },
        },
    },

    ApproveResponse: {
        type: "object",
        required: ["pipeline_id", "state", "approved_by", "approved_at"],
        properties: {
            pipeline_id: { type: "string", pattern: PIPE_ID_PATTERN, example: "PIPE-7K2A9F31" },
            state: { $ref: "#/components/schemas/ApprovalState" },
            approved_by: { type: "string", example: "alex.chen" },
            approved_at: { type: "string", format: "date-time", example: "2026-05-16T14:25:01.902Z" },
        },
    },

    RejectRequest: {
        type: "object",
        required: ["rejected_by"],
        properties: {
            rejected_by: {
                type: "string",
                minLength: 1,
                description: "Human rejector signature name (operator handle). Trimmed; empty string yields 400.",
                example: "alex.chen",
            },
            reason: {
                type: "string",
                description: "Optional free-text justification, surfaced on the FE rejection banner and the trace event.",
                example: "Risk too high for current freeze.",
            },
        },
    },

    RejectResponse: {
        type: "object",
        required: ["pipeline_id", "state", "rejected_by", "rejected_at"],
        properties: {
            pipeline_id: { type: "string", pattern: PIPE_ID_PATTERN, example: "PIPE-7K2A9F31" },
            state: { $ref: "#/components/schemas/ApprovalState" },
            rejected_by: { type: "string", example: "alex.chen" },
            rejected_at: { type: "string", format: "date-time", example: "2026-05-16T14:24:30.114Z" },
            rejection_reason: { type: "string", nullable: true, example: "Risk too high for current freeze." },
        },
    },

    ErrorEnvelope: {
        type: "object",
        required: ["error"],
        properties: {
            error: { type: "string", example: "Pipeline PIPE-7K2A9F31 is EXECUTING, not PENDING" },
            pipeline_id: { type: "string", pattern: PIPE_ID_PATTERN, nullable: true },
            current_state: { $ref: "#/components/schemas/ApprovalState" },
        },
    },

    // === AMCE Contract Components (Phase 4 — Modules 11..14) ===

    ExecutionResult: {
        type: "object",
        required: ["action_id", "status", "latency_ms"],
        properties: {
            action_id: { type: "string", pattern: ACT_ID_PATTERN, example: "ACT-9F3X2B" },
            status: {
                type: "string",
                enum: ["SUCCESS", "FAILED", "SKIPPED"],
                example: "SUCCESS",
            },
            latency_ms: { type: "number", minimum: 0, example: 412 },
            error_message: { type: "string", nullable: true, example: "Upstream 5xx" },
            output_summary: {
                type: "string",
                nullable: true,
                example: "Flag activated for cohort=tier-1",
            },
        },
    },

    ActionChain: {
        type: "object",
        description:
            "Module 11 (action_chain_v1) — unified execution result for the HITL-approved, topologically-sorted action chain.",
        required: [
            "pipelineId",
            "overall_status",
            "approval_timestamp",
            "total_execution_ms",
            "execution_results",
        ],
        properties: {
            pipelineId: { type: "string", pattern: PIPE_ID_PATTERN, example: "PIPE-7K2A9F31" },
            overall_status: {
                type: "string",
                enum: ["SUCCESS", "PARTIAL_SUCCESS", "FAILED"],
                description:
                    "SUCCESS only if every execution_results.status === SUCCESS; FAILED only if no result is SUCCESS; otherwise PARTIAL_SUCCESS.",
                example: "PARTIAL_SUCCESS",
            },
            approved_by: { type: "string", nullable: true, example: "alex.chen" },
            approval_timestamp: {
                type: "string",
                format: "date-time",
                example: "2026-05-16T14:25:01.902Z",
            },
            total_execution_ms: { type: "number", minimum: 0, example: 2871 },
            execution_results: {
                type: "array",
                items: { $ref: "#/components/schemas/ExecutionResult" },
            },
        },
    },

    RecoveryPlanEntry: {
        type: "object",
        required: ["intercepted_action_id", "applied_strategy", "mitigation_status", "rationale"],
        properties: {
            intercepted_action_id: { type: "string", pattern: ACT_ID_PATTERN, example: "ACT-9F3X2B" },
            applied_strategy: {
                type: "string",
                enum: ["RETRY", "FALLBACK", "SKIP"],
                example: "RETRY",
            },
            mitigation_status: {
                type: "string",
                enum: ["PROPOSED", "BLOCKED", "RESOLVED"],
                example: "RESOLVED",
            },
            rationale: {
                type: "string",
                example: "Transient 503; exponential backoff cleared on second attempt.",
            },
        },
    },

    FailureRecovery: {
        type: "object",
        description:
            "Module 12 (failure_recovery_v1) — recovery strategies mapped onto FAILED upstream actions, with cascaded skips.",
        required: ["pipelineId", "recovery_plan", "cascaded_skips"],
        properties: {
            pipelineId: { type: "string", pattern: PIPE_ID_PATTERN, example: "PIPE-7K2A9F31" },
            recovery_plan: {
                type: "array",
                items: { $ref: "#/components/schemas/RecoveryPlanEntry" },
            },
            cascaded_skips: {
                type: "array",
                items: { type: "string", pattern: ACT_ID_PATTERN },
                example: ["ACT-DEAD01"],
            },
        },
    },

    OutcomeVisualization: {
        type: "object",
        description:
            "Module 13 (outcome_visualization_v1) — quantitative before/after deltas and qualitative impact projection.",
        required: [
            "pipelineId",
            "total_cost",
            "projected_risk_reduction",
            "simulated_latency_saved",
            "before_state_summary",
            "after_state_summary",
            "qualitative_diff",
        ],
        properties: {
            pipelineId: { type: "string", pattern: PIPE_ID_PATTERN, example: "PIPE-7K2A9F31" },
            total_cost: { type: "number", minimum: 0, example: 142.5 },
            projected_risk_reduction: {
                type: "number",
                minimum: 0,
                maximum: 100,
                description: "Inclusive percent reduction in projected incident risk.",
                example: 37.2,
            },
            simulated_latency_saved: {
                type: "number",
                description: "Milliseconds saved on the critical path under the simulated chain.",
                example: 184,
            },
            before_state_summary: {
                type: "string",
                example: "P95 latency 1820ms; 2 actions in degraded state.",
            },
            after_state_summary: {
                type: "string",
                example: "P95 latency 1636ms; all critical actions SUCCESS.",
            },
            qualitative_diff: {
                type: "string",
                description: "Must reference at least one ACT- action_id from the execution chain.",
                example:
                    "ACT-9F3X2B reduced cold-start latency; ACT-A1B2C3 narrowed the affected cohort.",
            },
        },
    },

    SignatureBlock: {
        type: "object",
        required: ["approver", "pipeline_id", "signed_at"],
        properties: {
            approver: { type: "string", example: "alex.chen" },
            pipeline_id: { type: "string", pattern: PIPE_ID_PATTERN, example: "PIPE-7K2A9F31" },
            signed_at: { type: "string", format: "date-time", example: "2026-05-16T14:25:01.902Z" },
        },
    },

    EventSummary: {
        type: "object",
        description:
            "Numeric counters of pipeline-trace events. Must include the five canonical keys at minimum.",
        required: [
            "agent_start",
            "agent_complete",
            "action_start",
            "action_complete",
            "contract_gate",
        ],
        properties: {
            agent_start: { type: "integer", minimum: 0, example: 14 },
            agent_complete: { type: "integer", minimum: 0, example: 14 },
            action_start: { type: "integer", minimum: 0, example: 6 },
            action_complete: { type: "integer", minimum: 0, example: 5 },
            contract_gate: { type: "integer", minimum: 0, example: 14 },
        },
        additionalProperties: { type: "integer", minimum: 0 },
    },

    WorkflowAudit: {
        type: "object",
        description:
            "Module 14 (workflow_audit_v1) — consolidated compliance receipt with SHA-256 verification hash.",
        required: [
            "pipelineId",
            "audit_id",
            "generated_at",
            "finalized_status",
            "signature_block",
            "verification_hash",
            "event_summary",
        ],
        properties: {
            pipelineId: { type: "string", pattern: PIPE_ID_PATTERN, example: "PIPE-7K2A9F31" },
            audit_id: { type: "string", pattern: AUD_ID_PATTERN, example: "AUD-9F3X2B7K" },
            generated_at: {
                type: "string",
                format: "date-time",
                example: "2026-05-16T14:25:09.741Z",
            },
            finalized_status: {
                type: "string",
                enum: ["APPROVED_PASSED", "APPROVED_PARTIAL", "APPROVED_FAILED", "REJECTED"],
                description:
                    "Mirrors upstream ActionChain.overall_status (SUCCESS->APPROVED_PASSED, PARTIAL_SUCCESS->APPROVED_PARTIAL, FAILED->APPROVED_FAILED).",
                example: "APPROVED_PARTIAL",
            },
            signature_block: { $ref: "#/components/schemas/SignatureBlock" },
            verification_hash: {
                type: "string",
                pattern: SHA256_PATTERN,
                description: "Lowercase 64-char hex SHA-256 digest covering the canonical receipt body.",
                example:
                    "a3f1c4e9b27d80516fb24ce8d1972a4c3e0bff62a9d7a1c4519b8e7a3c0d6e9f",
            },
            event_summary: { $ref: "#/components/schemas/EventSummary" },
        },
    },

    MultiSourceIngestionSource: {
        type: "object",
        required: ["source_id", "source_type", "content", "ingested_at"],
        properties: {
            source_id: { type: "string", example: "SRC-001" },
            source_type: {
                type: "string",
                enum: ["pdf", "url", "csv", "txt", "json", "realtime_feed"],
                example: "url",
            },
            content: { type: "string", example: "https://example.com/incident-report" },
            credibility_tier: {
                type: "string",
                enum: ["HIGH", "MEDIUM", "LOW", "UNVERIFIED"],
                example: "HIGH",
            },
            ingested_at: {
                type: "string",
                format: "date-time",
                example: "2026-05-16T14:21:42.001Z",
            },
        },
    },

    MultiSourceIngestion: {
        type: "object",
        description:
            "Ingestion contract (multi_source_ingestion_v1) — upstream context fed into POST /api/pipeline/run.",
        required: ["ingestion_id", "timestamp", "sources_processed", "sources"],
        properties: {
            ingestion_id: { type: "string", pattern: ING_ID_PATTERN, example: "ING-7K2A9F31" },
            timestamp: { type: "string", format: "date-time" },
            sources_processed: { type: "number", minimum: 1, maximum: 20, example: 3 },
            sources: {
                type: "array",
                items: { $ref: "#/components/schemas/MultiSourceIngestionSource" },
            },
        },
    },

    ContractDefinition: {
        type: "object",
        description:
            "Generic YAML contract shape returned by GET /api/contracts/:name. Field semantics vary per contract.",
        required: ["name", "version", "module", "description", "fields"],
        properties: {
            name: { type: "string", example: "action_chain_v1" },
            version: { type: "string", example: "1.0" },
            module: { type: "string", example: "ExecutionSimulatorAgent" },
            description: { type: "string" },
            fields: { type: "object", additionalProperties: true },
            semantic_checks: { type: "array", items: { type: "string" } },
        },
        additionalProperties: true,
    },

    ContractSummary: {
        type: "object",
        required: ["name", "version", "module", "description", "field_count"],
        properties: {
            name: { type: "string", example: "action_chain_v1" },
            version: { type: "string", example: "1.0" },
            module: { type: "string", example: "ExecutionSimulatorAgent" },
            description: { type: "string" },
            field_count: { type: "integer", minimum: 0, example: 6 },
        },
    },

    TraceEvent: {
        type: "object",
        required: ["event_id", "pipeline_id", "timestamp", "event_type", "agent", "message"],
        properties: {
            event_id: { type: "string", format: "uuid" },
            pipeline_id: { type: "string", pattern: PIPE_ID_PATTERN },
            timestamp: { type: "string", format: "date-time" },
            event_type: {
                type: "string",
                enum: [
                    "agent_start",
                    "agent_complete",
                    "llm_call",
                    "contract_gate",
                    "action_execute",
                    "failure",
                    "ingestion_error",
                    "recovery",
                    "decision",
                    "action_start",
                    "action_complete",
                    "graph_cycle_detected",
                    "hitl_pending",
                    "hitl_approved",
                    "hitl_rejected",
                    "thinking",
                ],
            },
            agent: { type: "string", example: "StrategicRecommenderAgent" },
            message: { type: "string" },
            data: { type: "object", additionalProperties: true },
            decision: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            provider: { type: "string", example: "gemini-free" },
            latency_ms: { type: "number", minimum: 0 },
        },
    },

    ForecastPoint: {
        type: "object",
        required: ["timestamp", "value", "is_extrapolation"],
        properties: {
            timestamp: { type: "string", format: "date-time" },
            value: { type: "number" },
            is_extrapolation: {
                type: "boolean",
                description: "True beyond the current cursor (predicted region).",
            },
        },
    },

    ContradictionRecord: {
        type: "object",
        required: ["source_id", "timestamp", "raw_claim", "baseline_context", "conflict_rationale"],
        properties: {
            source_id: { type: "string", example: "SRC-001" },
            timestamp: { type: "string", format: "date-time" },
            raw_claim: { type: "string" },
            baseline_context: { type: "string" },
            conflict_rationale: { type: "string" },
        },
    },

    PipelineAnalytics: {
        type: "object",
        required: ["extrapolation_unreliable", "forecast_data", "contradictions"],
        description:
            "AMCE-judged analytics payload returned by GET /api/pipeline/:id/analytics. forecast_data carries 30 historical + 60 predicted points.",
        properties: {
            extrapolation_unreliable: { type: "boolean" },
            forecast_data: {
                type: "array",
                items: { $ref: "#/components/schemas/ForecastPoint" },
            },
            contradictions: {
                type: "array",
                items: { $ref: "#/components/schemas/ContradictionRecord" },
            },
        },
    },

    PipelineTrace: {
        type: "object",
        description:
            "Full pipeline trace returned by GET /api/pipeline/:id and /api/pipeline/:id/trace. Mirrors src/tracing/collector.ts.",
        required: [
            "pipeline_id",
            "environment",
            "ai_provider_used",
            "started_at",
            "workplan",
            "task_plan",
            "reasoning_steps",
            "tool_calls",
            "action_execution",
            "recovery_steps",
            "events",
        ],
        properties: {
            pipeline_id: { type: "string", pattern: PIPE_ID_PATTERN },
            environment: { type: "string", example: "development" },
            ai_provider_used: { type: "string", example: "gemini-free" },
            started_at: { type: "string", format: "date-time" },
            completed_at: { type: "string", format: "date-time", nullable: true },
            workplan: { type: "string" },
            task_plan: { type: "array", items: { type: "string" } },
            reasoning_steps: {
                type: "array",
                items: {
                    type: "object",
                    required: ["step", "agent", "reasoning", "decision", "confidence"],
                    properties: {
                        step: { type: "integer", minimum: 1 },
                        agent: { type: "string" },
                        reasoning: { type: "string" },
                        decision: { type: "string" },
                        confidence: { type: "number", minimum: 0, maximum: 1 },
                    },
                },
            },
            tool_calls: {
                type: "array",
                items: {
                    type: "object",
                    required: ["tool", "provider", "input_summary", "output_summary", "latency_ms"],
                    properties: {
                        tool: { type: "string" },
                        provider: { type: "string" },
                        input_summary: { type: "string" },
                        output_summary: { type: "string" },
                        latency_ms: { type: "number", minimum: 0 },
                    },
                },
            },
            action_execution: {
                type: "array",
                items: { $ref: "#/components/schemas/TraceEvent" },
            },
            recovery_steps: { type: "array", items: { type: "string" } },
            events: { type: "array", items: { $ref: "#/components/schemas/TraceEvent" } },
        },
    },

    PipelineRunRequest: {
        type: "object",
        description:
            "Submitting `sources` is OPTIONAL. The full 14-module flow ingests autonomously from local disk + the realtime feed adapter; sources are only used by the legacy analytics-pool flow that populates the secondary forecast/contradiction panels.",
        properties: {
            sources: {
                type: "array",
                minItems: 0,
                items: { $ref: "#/components/schemas/MultiSourceIngestionSource" },
            },
            constraints: {
                type: "object",
                additionalProperties: true,
                example: {
                    max_actions: 10,
                    forbidden_action_types: ["IRREVERSIBLE_DELETE"],
                },
            },
        },
    },

    PipelineRunResponse: {
        type: "object",
        required: ["pipeline_id", "status"],
        properties: {
            pipeline_id: { type: "string", pattern: PIPE_ID_PATTERN, example: "PIPE-7K2A9F31" },
            status: { type: "string", example: "received" },
            message: { type: "string" },
            sources_received: { type: "integer", minimum: 0 },
            constraints_received: { type: "object", additionalProperties: true },
        },
    },

    HealthResponse: {
        type: "object",
        required: ["status", "environment", "provider", "contracts_loaded", "timestamp"],
        properties: {
            status: { type: "string", example: "ok" },
            environment: { type: "string", example: "development" },
            provider: { type: "string", example: "gemini-free" },
            contracts_loaded: { type: "array", items: { type: "string" } },
            timestamp: { type: "string", format: "date-time" },
        },
    },

    ValidationsResponse: {
        type: "object",
        required: ["validations"],
        properties: {
            validations: {
                type: "array",
                items: {
                    type: "object",
                    required: ["pipeline_id", "events"],
                    properties: {
                        pipeline_id: { type: "string", pattern: PIPE_ID_PATTERN },
                        events: { type: "array", items: { $ref: "#/components/schemas/TraceEvent" } },
                    },
                },
            },
        },
    },
};

const pipelineIdParam: OpenAPIV3.ParameterObject = {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string", pattern: PIPE_ID_PATTERN },
    example: "PIPE-7K2A9F31",
    description: "Pipeline identifier returned by POST /api/pipeline/run.",
};

export const openApiSpec: OpenAPIV3.Document = {
    openapi: "3.0.3",
    info: {
        title: "Autonomous Content-to-Action Agent — Backend API",
        version: "0.5.0",
        description:
            "Phase 5 documentation surface. Exposes ingestion, pipeline trace, HITL execution gate, contract registry, and AMCE (Modules 11..14) contract shapes. All endpoints are read-only except POST /api/pipeline/run and POST /api/execution/:id/approve.",
    },
    servers: [
        { url: "http://localhost:8000", description: "Local dev server" },
    ],
    tags: [
        { name: "Health", description: "Liveness + environment probe." },
        { name: "Pipeline", description: "Ingestion entrypoint and pipeline trace inspection." },
        { name: "Execution (HITL)", description: "Human-in-the-loop approval gate. State machine: PENDING -> EXECUTING -> COMPLETED|REJECTED." },
        { name: "Contracts", description: "YAML contract registry browse." },
        { name: "Validations", description: "Cross-pipeline contract_gate event analytics." },
    ],
    paths: {
        "/health": {
            get: {
                tags: ["Health"],
                summary: "Liveness + environment + loaded contracts.",
                responses: {
                    "200": {
                        description: "OK",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/HealthResponse" },
                            },
                        },
                    },
                },
            },
        },

        "/api/pipeline/run": {
            post: {
                tags: ["Pipeline"],
                summary: "Submit a multi-source pipeline run.",
                description:
                    "Accepts one or more ingestion sources plus optional constraints, allocates a pipeline_id (PIPE-XXXXXXXX), and (Phase 4+) routes the request to the orchestrator. The current handler returns a synchronous stub envelope; trace/HITL state is observable via the other endpoints once the orchestrator runs.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/PipelineRunRequest" },
                            examples: {
                                singleUrl: {
                                    summary: "Single URL source",
                                    value: {
                                        sources: [
                                            {
                                                source_id: "SRC-001",
                                                source_type: "url",
                                                content: "https://example.com/incident-2026-05-15",
                                                ingested_at: "2026-05-16T14:21:42.001Z",
                                            },
                                        ],
                                        constraints: { max_actions: 5 },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Run accepted (stub envelope while orchestrator is wired).",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/PipelineRunResponse" },
                            },
                        },
                    },
                    "400": {
                        description: "sources array missing or empty.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                                example: { error: "sources array is required and must not be empty" },
                            },
                        },
                    },
                    "500": {
                        description: "Unhandled server error.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                            },
                        },
                    },
                },
            },
        },

        "/api/pipeline/{id}": {
            get: {
                tags: ["Pipeline"],
                summary: "Full pipeline trace.",
                parameters: [pipelineIdParam],
                responses: {
                    "200": {
                        description: "Pipeline trace.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/PipelineTrace" },
                            },
                        },
                    },
                    "404": {
                        description: "Pipeline id not found.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                                example: { error: "Pipeline not found" },
                            },
                        },
                    },
                },
            },
        },

        "/api/pipeline/{id}/trace": {
            get: {
                tags: ["Pipeline"],
                summary: "Antigravity trace export (judge-facing).",
                description: "Identical shape to GET /api/pipeline/:id; provided as a stable export alias.",
                parameters: [pipelineIdParam],
                responses: {
                    "200": {
                        description: "Pipeline trace export.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/PipelineTrace" },
                            },
                        },
                    },
                    "404": {
                        description: "Pipeline trace not found.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                            },
                        },
                    },
                },
            },
        },

        "/api/pipeline/{id}/stream": {
            get: {
                tags: ["Pipeline"],
                summary: "Server-Sent Events stream of pipeline TraceEvent frames.",
                description:
                    "Long-lived text/event-stream connection. Each `data:` frame is a JSON-serialized TraceEvent. Emits an `end` event when the trace is finalized. Heartbeat comments keep the connection alive while the pipeline is starting.",
                parameters: [pipelineIdParam],
                responses: {
                    "200": {
                        description: "Event stream open. Frames are TraceEvent JSON objects.",
                        content: {
                            "text/event-stream": {
                                schema: { $ref: "#/components/schemas/TraceEvent" },
                            },
                        },
                    },
                },
            },
        },

        "/api/pipeline/{id}/analytics": {
            get: {
                tags: ["Pipeline"],
                summary: "Compiled analytics for a pipeline.",
                description:
                    "404 while the multi-agent pool is still synthesizing; 200 once the AMCE-judged PipelineAnalytics record lands in the cache.",
                parameters: [pipelineIdParam],
                responses: {
                    "200": {
                        description: "Analytics ready.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/PipelineAnalytics" },
                            },
                        },
                    },
                    "404": {
                        description: "Sub-agents still processing.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                            },
                        },
                    },
                },
            },
        },

        "/api/contracts": {
            get: {
                tags: ["Contracts"],
                summary: "List all loaded YAML contracts (summary).",
                responses: {
                    "200": {
                        description: "Loaded contracts.",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["contracts"],
                                    properties: {
                                        contracts: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/ContractSummary" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },

        "/api/contracts/{name}": {
            get: {
                tags: ["Contracts"],
                summary: "Full contract definition by name.",
                parameters: [
                    {
                        name: "name",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                        example: "action_chain_v1",
                        description: "Contract slug, e.g. action_chain_v1 or workflow_audit_v1.",
                    },
                ],
                responses: {
                    "200": {
                        description: "Contract definition.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ContractDefinition" },
                            },
                        },
                    },
                    "404": {
                        description: "Contract not found.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                                example: { error: "Contract not found: foo_v1" },
                            },
                        },
                    },
                },
            },
        },

        "/api/validations": {
            get: {
                tags: ["Validations"],
                summary: "All contract_gate events grouped by pipeline.",
                responses: {
                    "200": {
                        description: "Validation events.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ValidationsResponse" },
                            },
                        },
                    },
                },
            },
        },

        "/api/execution/{id}/pending": {
            get: {
                tags: ["Execution (HITL)"],
                summary: "Inspect a pipeline blocked at the HITL approval gate.",
                description:
                    "Returns the full PipelineApprovalRecord when the pipeline is in state PENDING. If the pipeline exists but has already transitioned (EXECUTING/REJECTED/COMPLETED), the gate is closed and the endpoint responds 409 with the current state — this is the strict state-machine invariant enforced by pipelineApprovalStore.",
                parameters: [pipelineIdParam],
                responses: {
                    "200": {
                        description: "Pipeline is PENDING — proposal payload returned for the approval card.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/PipelineApprovalRecord" },
                                example: {
                                    pipeline_id: "PIPE-7K2A9F31",
                                    state: "PENDING",
                                    proposed_at: "2026-05-16T14:22:08.114Z",
                                    proposal: {
                                        proposedActions: [
                                            {
                                                action_id: "ACT-9F3X2B",
                                                title: "Roll out feature flag to 5% cohort",
                                                description:
                                                    "Gradual rollout to validate latency under prod load.",
                                                priority: "HIGH",
                                                depends_on: [],
                                            },
                                        ],
                                        rationale:
                                            "Within the 30-day horizon, projected latency dominates risk.",
                                        overall_priority: "HIGH",
                                    },
                                },
                            },
                        },
                    },
                    "404": {
                        description: "Pipeline id unknown.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                                example: { error: "Pipeline not found" },
                            },
                        },
                    },
                    "409": {
                        description: "Pipeline exists but is not in PENDING state.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                                example: {
                                    error: "Pipeline is EXECUTING, not PENDING",
                                    pipeline_id: "PIPE-7K2A9F31",
                                    current_state: "EXECUTING",
                                },
                            },
                        },
                    },
                },
            },
        },

        "/api/execution/{id}/approve": {
            post: {
                tags: ["Execution (HITL)"],
                summary: "Approve a PENDING pipeline (atomic PENDING -> EXECUTING).",
                description:
                    "Atomic check-and-set: only a pipeline in state PENDING can transition to EXECUTING. Concurrent approval attempts on the same pipeline serialize through the in-memory store; the loser receives 409. The request body must include a non-empty approver signature name (`approved_by`); the value is recorded on the PipelineApprovalRecord and surfaces in the downstream WorkflowAudit signature_block.",
                parameters: [pipelineIdParam],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ApproveRequest" },
                            examples: {
                                operator: {
                                    summary: "Operator signature",
                                    value: { approved_by: "alex.chen" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Approved — pipeline activated for execution.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ApproveResponse" },
                                example: {
                                    pipeline_id: "PIPE-7K2A9F31",
                                    state: "EXECUTING",
                                    approved_by: "alex.chen",
                                    approved_at: "2026-05-16T14:25:01.902Z",
                                },
                            },
                        },
                    },
                    "400": {
                        description: "Missing or empty `approved_by`.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                                example: {
                                    error: "approved_by (non-empty string) required in body",
                                },
                            },
                        },
                    },
                    "404": {
                        description: "Pipeline id unknown.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                                example: {
                                    error: "Pipeline PIPE-7K2A9F31 not found",
                                    pipeline_id: "PIPE-7K2A9F31",
                                },
                            },
                        },
                    },
                    "409": {
                        description:
                            "Atomic concurrency lock — pipeline is not PENDING (e.g. already EXECUTING due to a prior approve, or REJECTED/COMPLETED).",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                                example: {
                                    error: "Pipeline PIPE-7K2A9F31 is EXECUTING, not PENDING",
                                    pipeline_id: "PIPE-7K2A9F31",
                                },
                            },
                        },
                    },
                },
            },
        },

        "/api/execution/{id}/reject": {
            post: {
                tags: ["Execution (HITL)"],
                summary: "Reject a PENDING pipeline (atomic PENDING -> REJECTED).",
                description:
                    "Atomic check-and-set: only a pipeline in state PENDING can transition to REJECTED. Symmetric with /approve; records `rejected_by` and an optional `reason` on the PipelineApprovalRecord, emits a `hitl_rejected` trace event, and discards the cached M11-M14 execution context.",
                parameters: [pipelineIdParam],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/RejectRequest" },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Rejected — pipeline transitioned to REJECTED.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/RejectResponse" },
                            },
                        },
                    },
                    "400": {
                        description: "Missing or empty `rejected_by`.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                            },
                        },
                    },
                    "404": {
                        description: "Pipeline id unknown.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                            },
                        },
                    },
                    "409": {
                        description: "Atomic concurrency lock — pipeline is not PENDING.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                            },
                        },
                    },
                },
            },
        },

        "/api/execution/{id}/chain": {
            get: {
                tags: ["Execution (HITL)"],
                summary: "M11 ActionChain for a post-approval pipeline.",
                description:
                    "404 while the M11 ExecutionSimulator is still running; 200 once the topologically-sorted action chain has finished executing.",
                parameters: [pipelineIdParam],
                responses: {
                    "200": {
                        description: "Action chain ready.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ActionChain" },
                            },
                        },
                    },
                    "404": {
                        description: "Chain not yet available.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                            },
                        },
                    },
                },
            },
        },

        "/api/execution/{id}/recovery": {
            get: {
                tags: ["Execution (HITL)"],
                summary: "M12 FailureRecovery plan for a post-approval pipeline.",
                parameters: [pipelineIdParam],
                responses: {
                    "200": {
                        description: "Recovery plan ready.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/FailureRecovery" },
                            },
                        },
                    },
                    "404": {
                        description: "Recovery not yet available.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                            },
                        },
                    },
                },
            },
        },

        "/api/execution/{id}/outcome": {
            get: {
                tags: ["Execution (HITL)"],
                summary: "M13 OutcomeVisualization for a post-approval pipeline.",
                parameters: [pipelineIdParam],
                responses: {
                    "200": {
                        description: "Outcome ready.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/OutcomeVisualization" },
                            },
                        },
                    },
                    "404": {
                        description: "Outcome not yet available.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                            },
                        },
                    },
                },
            },
        },

        "/api/execution/{id}/audit": {
            get: {
                tags: ["Execution (HITL)"],
                summary: "M14 WorkflowAudit (compliance receipt) for a post-approval pipeline.",
                description:
                    "Returns the immutable receipt with the SHA-256 verification_hash. The hash is computed over the canonical-key-sorted JSON of {pipelineId, audit_id, generated_at, finalized_status, signature_block, event_summary} and can be reconstructed client-side for tamper detection.",
                parameters: [pipelineIdParam],
                responses: {
                    "200": {
                        description: "Audit ready.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/WorkflowAudit" },
                            },
                        },
                    },
                    "404": {
                        description: "Audit not yet available.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
                            },
                        },
                    },
                },
            },
        },
    },
    components: {
        schemas: schemas as Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject>,
    },
};
