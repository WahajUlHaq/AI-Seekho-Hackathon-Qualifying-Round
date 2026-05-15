# Phase 1 Workflow Diagrams — Core Infrastructure

**Challenge 1 · Autonomous Content-to-Action Agent · AI Seekho 2026 Hackathon**

---

## 1. Phase 1 Component Dependency Graph

Shows how the 6 core components interconnect. Every future module (Phase 2–4) plugs into `BaseAgent` and inherits all infrastructure automatically.

```mermaid
graph TD
    subgraph ENV["Environment Layer"]
        ENV_DEV[".env.development<br/>GEMINI_API_KEY, GROQ_API_KEY<br/>PRIMARY_PROVIDER=gemini-free"]
        ENV_PROD[".env.production<br/>VERTEX_KEY_1, VERTEX_KEY_2<br/>PRIMARY_PROVIDER=vertex-ai"]
    end

    subgraph UTILS["Utility Layer"]
        LLM["LLMClient Singleton<br/><b>llm-client.ts</b><br/>• complete(prompt, useBaseModel?)<br/>• generateEmbedding(text)<br/>• Provider failover chain"]
    end

    subgraph CONTRACTS["Contract Enforcement Layer (AMCE)"]
        CR["ContractRegistry<br/><b>registry.ts</b><br/>• loadAll(dir) → YAML parse<br/>• get(name) → Contract<br/>• list() → string[]"]
        CV["ContractValidator<br/><b>validator.ts</b><br/>• validate(data, contract)<br/>• validateSemantic(data, contract)"]
        DG["DecisionGate<br/><b>decision-gate.ts</b><br/>• evaluate(output, contract)<br/>→ PASS / WARN / REJECT"]
        YAML1["multi_source_ingestion_v1.yaml"]
        YAML2["contradiction_detection_v1.yaml"]
        YAML3["action_chain_v1.yaml"]
    end

    subgraph AGENTS["Agent Framework"]
        BA["BaseAgent&lt;TInput, TOutput&gt;<br/><b>base.agent.ts</b><br/>• run(input) → output<br/>• abstract execute(input)<br/>• llmComplete() / llmEmbed()<br/>• logDecision()"]
    end

    subgraph TRACING["Tracing Layer"]
        TC["TraceCollector<br/><b>collector.ts</b><br/>• initPipeline(id, workplan, tasks)<br/>• log(id, event)<br/>• finalizePipeline(id)"]
    end

    subgraph SERVER["Express Server"]
        SRV["index.ts<br/>• CORS, JSON body (50MB)<br/>• Health check /health<br/>• Contract loading on startup"]
        PR["pipeline.routes.ts<br/>• POST /api/pipeline/run<br/>• GET /api/pipeline/:id<br/>• GET /api/pipeline/:id/trace"]
        CRR["contracts.routes.ts<br/>• GET /api/contracts<br/>• GET /api/validations"]
    end

    ENV_DEV & ENV_PROD --> LLM
    LLM --> BA
    YAML1 & YAML2 & YAML3 --> CR
    CR --> CV
    CV --> DG
    DG --> BA
    TC --> BA
    BA --> PR
    CR --> SRV
    CR --> CRR
    TC --> CRR

    style ENV fill:#264653,color:#fff
    style UTILS fill:#2a9d8f,color:#fff
    style CONTRACTS fill:#e76f51,color:#fff
    style AGENTS fill:#457b9d,color:#fff
    style TRACING fill:#e9c46a,color:#000
    style SERVER fill:#1d3557,color:#fff
```

---

## 2. AMCE Contract Enforcement — Decision Flow

This flow runs **after every module's `execute()` call**. It's the core of the AMCE-inspired layer from the master prompt.

```mermaid
flowchart TD
    A["Module execute() returns output"]
    B["ContractRegistry.get(contractName)"]
    C{"Contract<br/>found?"}
    D["ContractValidator.validate(output, contract)"]
    E{"Structural<br/>result?"}
    F["Structural PASS ✅"]
    G["Structural REJECT ❌<br/>(missing fields, bad types,<br/>regex mismatch, enum violation)"]
    H["ContractValidator.validateSemantic()"]
    I{"Semantic<br/>result?"}
    J["Decision Gate → PASS ✅<br/>Proceed to next module"]
    K["Decision Gate → WARN ⚠️<br/>Log warning, proceed"]
    L["Decision Gate → REJECT ❌"]
    M{"attempt <br/>< maxRetries?"}
    N["Re-generate output<br/>(base model hint via trace)"]
    O["Accept with errors logged<br/>(last resort fallback)"]
    P["Log contract_gate event<br/>to TraceCollector"]
    Q["Skip validation<br/>No contract for this module"]

    A --> B --> C
    C -- "Yes" --> D --> E
    C -- "No" --> Q --> P
    E -- "All fields valid" --> F --> H --> I
    E -- "Errors found" --> G --> L
    I -- "All semantic checks pass" --> J --> P
    I -- "Warnings only" --> K --> P
    I -- "Semantic fail" --> L
    L --> M
    M -- "Yes" --> N --> A
    M -- "No" --> O --> P

    style J fill:#2d6a4f,color:#fff
    style K fill:#e9c46a,color:#000
    style L fill:#d62828,color:#fff
    style G fill:#d62828,color:#fff
    style P fill:#264653,color:#fff
    style Q fill:#6c757d,color:#fff
```

---

## 3. BaseAgent Execution Lifecycle

Sequence diagram showing exactly what happens when a module's `run()` is called.

```mermaid
sequenceDiagram
    participant Caller as Orchestrator / Test
    participant BA as BaseAgent.run()
    participant Impl as Module.execute()
    participant CR as ContractRegistry
    participant CV as ContractValidator
    participant TC as TraceCollector
    participant LLM as LLMClient

    Caller->>BA: run(input)
    BA->>TC: log("agent_start", agentName)

    loop attempt = 1 to maxRetries
        BA->>Impl: execute(input)
        Note over Impl: Module-specific logic<br/>Uses this.llmComplete()<br/>and this.llmEmbed()
        Impl-->>BA: output

        BA->>CR: get(contractName)
        CR-->>BA: contract (or undefined)

        alt Contract exists
            BA->>CV: validate(output, contract)
            CV-->>BA: ValidationResult {level, errors, warnings}

            BA->>TC: log("contract_gate", decision, errors)

            alt level = PASS or WARN
                Note over BA: Break loop — output accepted
            else level = REJECT and attempts remain
                BA->>TC: log("recovery", "Retrying with base model")
                Note over BA: Continue loop → retry execute()
            else level = REJECT and no attempts remain
                Note over BA: Break loop — accept with errors
            end
        else No contract
            Note over BA: Break loop — no validation
        end
    end

    BA->>TC: log("agent_complete", validation_level)
    BA-->>Caller: output

    Note over TC: Trace now contains:<br/>• agent_start event<br/>• 1+ contract_gate events<br/>• 0+ recovery events<br/>• 1 agent_complete event<br/>• N llm_call events (from execute)
```

---

## 4. LLM Call Routing Flow

Shows how every `llmClient.complete()` call routes through the provider failover chain.

```mermaid
flowchart LR
    AGENT["Agent calls<br/>llmClient.complete(prompt)"]

    subgraph DEV["Development Mode"]
        G1["Primary: Gemini 1.5 Flash<br/>(free tier)"]
        G2["Fallback: Groq Llama 3.3<br/>(free tier)"]
    end

    subgraph PROD["Production Mode"]
        V1["Primary: Vertex AI<br/>(Person B credits)"]
        V2["Vertex AI<br/>(Person C credits)"]
        G3["Emergency: Free Gemini"]
        G4["Last Resort: Groq"]
    end

    AGENT -->|"APP_ENV=development"| G1
    G1 -->|"429 / error"| G2
    G2 -->|"error"| FAIL1["Throw error<br/>(no emergency in dev)"]

    AGENT -->|"APP_ENV=production"| V1
    V1 -->|"quota / error"| V2
    V2 -->|"quota / error"| G3
    G3 -->|"rate limit"| G4
    G4 -->|"error"| FAIL2["Throw error"]

    EMBED["Agent calls<br/>llmClient.generateEmbedding()"]
    GEMINI_EMB["Always: Free Gemini<br/>gemini-embedding-001<br/>(never uses Vertex credits)"]
    EMBED --> GEMINI_EMB

    style AGENT fill:#264653,color:#fff
    style EMBED fill:#264653,color:#fff
    style G1 fill:#2a9d8f,color:#fff
    style V1 fill:#457b9d,color:#fff
    style GEMINI_EMB fill:#2a9d8f,color:#fff
    style FAIL1 fill:#d62828,color:#fff
    style FAIL2 fill:#d62828,color:#fff
```

---

## 5. Phase 1 File Map — Status

```
backend/src/
├── utils/
│   ├── llm-client.ts              ✅ LLMClient singleton (Gemini → Groq → Vertex)
│   ├── test-llm-client.ts         ✅ Environment test (dev/prod)
│   └── smoke-test-singleton.ts    ❌ NEW — Singleton import pattern smoke test
│
├── contracts/
│   ├── registry.ts                ✅ YAML loader, get(), getRequired(), list()
│   ├── validator.ts               ✅ Structural + semantic validation
│   ├── decision-gate.ts           ❌ NEW — Standalone PASS/WARN/REJECT gate
│   ├── test-validator.ts          ❌ NEW — 7 structural validation tests
│   └── definitions/
│       ├── multi_source_ingestion_v1.yaml   ✅ 
│       ├── contradiction_detection_v1.yaml  ✅ 
│       └── action_chain_v1.yaml             ✅ 
│
├── agents/
│   └── base.agent.ts              ✅ Abstract BaseAgent with trace + contract loop
│                                   ⚠️ MODIFY — refactor to use DecisionGate
│
├── tracing/
│   └── collector.ts               ✅ TraceCollector (events, reasoning, tools, recovery)
│                                   ⚠️ MODIFY — add getAll() method
│
├── routes/
│   ├── pipeline.routes.ts         ⚠️ STUB — POST /run returns stub, GET routes work
│   └── contracts.routes.ts        ❌ NEW — GET /api/contracts, GET /api/validations
│
└── index.ts                       ✅ Express server, health check, CORS, contract loading
                                   ⚠️ MODIFY — mount new contracts route
```

**Legend:** ✅ Complete · ⚠️ Needs modification · ❌ Needs creation
