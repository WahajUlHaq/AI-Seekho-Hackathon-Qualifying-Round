# Phase 1: Workflow Diagrams

> **Challenge 1 — Autonomous Content-to-Action Agent**  
> Diagrams covering the 14-module pipeline architecture and Phase 1 core infrastructure workflows.

---

## 1. Full 14-Module Pipeline Architecture

The complete agent pipeline from content ingestion to audit logs, showing where the **AMCE Contract Enforcement Layer** intercepts every module output.

```mermaid
flowchart TB
    INPUT["📥 5+ Input Sources<br/>(PDF, URL, CSV, JSON, Real-time Feed)"]
    
    M1["Module 1<br/>Multi-Source Content Ingestion"]
    M2["Module 2<br/>Source Credibility Scorer"]
    M3["Module 3<br/>Noise Filter & Deduplication"]
    M4["Module 4<br/>Contradiction Detector"]
    M5["Module 5<br/>RAG-Powered Insight Extraction"]
    M6["Module 6<br/>Temporal Analysis Engine"]
    M7["Module 7<br/>Conflict Resolution Logic"]
    M8["Module 8<br/>Impact Analysis w/ Constraints"]
    M9["Module 9<br/>Action Chain Generator (3-5 Actions)"]
    M10["Module 10<br/>Constraint Validator"]
    M11["Module 11<br/>Action Chain Execution Simulator"]
    M12["Module 12<br/>Failure Recovery & Rollback Engine"]
    M13["Module 13<br/>Outcome Visualization"]
    M14["Module 14<br/>Agentic Workflow Trace & Audit Logs"]

    CEL{{"🛡️ AMCE Contract<br/>Enforcement Layer<br/>(After Every Module)"}}

    OUTPUT["📊 Final Output<br/>Insights + Actions + Simulation + Trace"]

    INPUT --> M1
    M1 --> CEL
    CEL --> M2
    M2 --> CEL
    CEL --> M3
    M3 --> CEL
    CEL --> M4
    M4 --> CEL
    CEL --> M5
    M5 --> CEL
    CEL --> M6
    M6 --> CEL
    CEL --> M7
    M7 --> CEL
    CEL --> M8
    M8 --> CEL
    CEL --> M9
    M9 --> CEL
    CEL --> M10
    M10 --> CEL
    CEL --> M11
    M11 --> CEL
    CEL --> M12
    M12 --> CEL
    CEL --> M13
    M13 --> CEL
    CEL --> M14
    M14 --> OUTPUT

    style INPUT fill:#4CAF50,color:#fff,stroke:#2E7D32
    style OUTPUT fill:#2196F3,color:#fff,stroke:#1565C0
    style CEL fill:#FF9800,color:#fff,stroke:#E65100
    style M1 fill:#E3F2FD,stroke:#1565C0
    style M2 fill:#E3F2FD,stroke:#1565C0
    style M3 fill:#E3F2FD,stroke:#1565C0
    style M4 fill:#FFEBEE,stroke:#C62828
    style M5 fill:#E8F5E9,stroke:#2E7D32
    style M6 fill:#E3F2FD,stroke:#1565C0
    style M7 fill:#FFEBEE,stroke:#C62828
    style M8 fill:#FFF3E0,stroke:#E65100
    style M9 fill:#FFF3E0,stroke:#E65100
    style M10 fill:#FFF3E0,stroke:#E65100
    style M11 fill:#F3E5F5,stroke:#6A1B9A
    style M12 fill:#F3E5F5,stroke:#6A1B9A
    style M13 fill:#E8F5E9,stroke:#2E7D32
    style M14 fill:#E0F7FA,stroke:#006064
```

---

## 2. AMCE Contract Enforcement — Decision Flow

Shows the internal logic of the Contract Enforcement Layer that validates every module output.

```mermaid
flowchart TD
    MO["Module Output"] --> CL["Contract Lookup<br/>(Registry)"]
    CL --> SV["Structural Validation<br/>(Field types, enums, ranges,<br/>regex, nullable, min_items)"]
    SV -->|"Structural Failures"| REJECT1["❌ REJECT<br/>(Re-generate with<br/>stricter prompt)"]
    SV -->|"Structural OK"| SEV["Semantic Validation<br/>(Base Model via LLMClient<br/>useBaseModel=true)"]
    SEV --> DS["Divergence Score<br/>(Cosine similarity between<br/>primary & base model outputs)"]
    DS -->|"Score > 0.6"| REJECT2["❌ REJECT<br/>(Use fallback output)"]
    DS -->|"Score 0.3-0.6"| WARN["⚠️ WARN<br/>(Log warning, proceed)"]
    DS -->|"Score < 0.3"| PASS["✅ PASS<br/>(Proceed to next module)"]
    
    REJECT1 --> TRACE["📝 Log to<br/>Trace Collector"]
    REJECT2 --> TRACE
    WARN --> TRACE
    PASS --> TRACE
    TRACE --> NEXT["Next Module"]

    style PASS fill:#4CAF50,color:#fff
    style WARN fill:#FF9800,color:#fff
    style REJECT1 fill:#F44336,color:#fff
    style REJECT2 fill:#F44336,color:#fff
    style TRACE fill:#9C27B0,color:#fff
    style MO fill:#E3F2FD,stroke:#1565C0
```

---

## 3. Phase 1 Core Infrastructure — Component Architecture

The four infrastructure pillars being built in Phase 1 and how they interconnect.

```mermaid
flowchart LR
    subgraph STEP1["Step 1.1: LLMClient Wiring"]
        LLC["LLMClient Singleton<br/>(utils/llm-client.ts)"]
        PROV["Provider Chain:<br/>Gemini Free → Groq → Vertex AI"]
        LLC --> PROV
    end

    subgraph STEP2["Step 1.2: AMCE Contract Layer"]
        REG["Contract Registry<br/>(contracts/registry.ts)"]
        VAL["Contract Validator<br/>(contracts/validator.ts)"]
        DG["Decision Gate<br/>(contracts/decision-gate.ts)"]
        BM["Benchmark<br/>(contracts/benchmark.ts)"]
        YAML["YAML Definitions<br/>(contracts/definitions/*.yaml)"]
        YAML --> REG
        REG --> VAL
        VAL --> DG
        BM --> DG
    end

    subgraph STEP3["Step 1.3: Agent Framework + Tracing"]
        BA["Base Agent<br/>(agents/base.agent.ts)"]
        TC["Trace Collector<br/>(tracing/collector.ts)"]
        TE["Trace Exporter<br/>(tracing/exporter.ts)"]
        BA --> TC
        TC --> TE
    end

    subgraph STEP4["Step 1.4: Express API Server"]
        IDX["Express App<br/>(index.ts)"]
        PR["Pipeline Routes<br/>POST /api/pipeline/run<br/>GET /api/pipeline/:id<br/>GET /api/pipeline/:id/trace"]
        CR["Contract Routes<br/>GET /api/contracts"]
        VR["Validation Routes<br/>GET /api/validations"]
        IDX --> PR
        IDX --> CR
        IDX --> VR
    end

    LLC -.->|"Used by"| BA
    LLC -.->|"Used by"| VAL
    LLC -.->|"Used by"| BM
    DG -.->|"Integrated in"| BA
    TC -.->|"Queried by"| PR
    REG -.->|"Queried by"| CR

    style STEP1 fill:#E8F5E9,stroke:#2E7D32
    style STEP2 fill:#FFF3E0,stroke:#E65100
    style STEP3 fill:#E0F7FA,stroke:#006064
    style STEP4 fill:#F3E5F5,stroke:#6A1B9A
```

---

## 4. Phase 1 Build Order — Dependency Graph

Shows the sequential build order with dependencies between components.

```mermaid
gantt
    title Phase 1 Build Order (6-8 hours)
    dateFormat HH:mm
    axisFormat %H:%M

    section Step 1.1 - LLMClient
    Audit agent imports           :s11, 00:00, 30m
    Fix direct SDK imports        :s12, after s11, 30m
    Create singleton smoke test   :s13, after s12, 15m

    section Step 1.2 - Contracts
    Audit registry.ts             :s21, after s13, 30m
    Audit validator.ts            :s22, after s21, 45m
    Create decision-gate.ts       :s23, after s22, 60m
    Create benchmark.ts           :s24, after s22, 45m
    Verify/create YAML defs       :s25, after s21, 30m
    Test contract validation      :s26, after s23, 15m

    section Step 1.3 - Agents/Tracing
    Audit base.agent.ts           :s31, after s23, 30m
    Audit collector.ts            :s32, after s31, 30m
    Audit exporter.ts             :s33, after s32, 30m
    Verify trace format           :s34, after s33, 15m

    section Step 1.4 - Express API
    Audit index.ts                :s41, after s34, 20m
    Audit pipeline.routes.ts      :s42, after s41, 20m
    Create contracts.routes.ts    :s43, after s42, 20m
    Create validations.routes.ts  :s44, after s43, 20m
    Integration test              :s45, after s44, 30m
```

---

## 5. Data Flow Per Pipeline Request

How a single pipeline request flows through Phase 1 infrastructure.

```mermaid
sequenceDiagram
    actor Client
    participant API as Express API
    participant Orch as Orchestrator
    participant Agent as Module Agent
    participant LLC as LLMClient
    participant CEL as Contract Gate
    participant Trace as Trace Collector

    Client->>API: POST /api/pipeline/run
    API->>Orch: orchestrator.run(sources, constraints)
    
    Note over Orch: For each of 14 modules:
    Orch->>Agent: module.execute(input)
    Agent->>LLC: llmClient.complete(prompt)
    LLC-->>Agent: LLM response
    Agent->>Trace: log(reasoning, tool_calls)
    Agent-->>Orch: moduleOutput
    
    Orch->>CEL: decisionGate.evaluate(output, contract)
    CEL->>LLC: llmClient.complete(validationPrompt, useBaseModel=true)
    LLC-->>CEL: base model validation
    CEL->>Trace: log(gate_decision)
    
    alt PASS
        CEL-->>Orch: proceed
    else REJECT
        CEL-->>Orch: re-generate / fallback
        Orch->>Agent: module.execute(input, stricterPrompt)
    end

    Note over Orch: After all 14 modules:
    Orch->>Trace: export()
    Trace-->>Orch: complete trace JSON
    Orch-->>API: pipelineResult + trace
    API-->>Client: JSON response
```

---

## 6. LLMClient Provider Fallback Chain

```mermaid
flowchart LR
    REQ["LLM Request"] --> ENV{"APP_ENV?"}
    
    ENV -->|"development"| GF["Gemini Free<br/>(gemini-1.5-flash)"]
    ENV -->|"production"| VA["Vertex AI<br/>(gemini-1.5-pro)"]
    
    GF -->|"429 Rate Limit"| GR["Groq<br/>(llama-3.1-70b)"]
    GR -->|"Fail"| ERR1["❌ Error"]
    
    VA -->|"Quota / Billing"| VA2["Vertex AI Acct 2<br/>(Person C)"]
    VA2 -->|"Quota / Billing"| GF2["Gemini Free<br/>(Safety Net)"]
    GF2 -->|"429 Rate Limit"| GR2["Groq<br/>(Emergency)"]
    GR2 -->|"Fail"| ERR2["❌ Error"]

    style GF fill:#4CAF50,color:#fff
    style VA fill:#2196F3,color:#fff
    style GR fill:#FF9800,color:#fff
    style VA2 fill:#2196F3,color:#fff
    style GF2 fill:#4CAF50,color:#fff
    style GR2 fill:#FF9800,color:#fff
    style ERR1 fill:#F44336,color:#fff
    style ERR2 fill:#F44336,color:#fff
```
