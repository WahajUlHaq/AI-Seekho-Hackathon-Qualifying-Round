# Workflow Diagrams — Content-to-Action Agent

**Challenge 1 · AI Seekho 2026 Hackathon**

---

## 1. Full Pipeline Data Flow

```mermaid
flowchart TD
    subgraph INPUTS["📥 5+ Simultaneous Sources"]
        PDF["PDF Report<br/>📄 pdf-parse"]
        URL["Website/Article<br/>🌐 cheerio"]
        CSV["CSV/JSON Data<br/>📊 papaparse"]
        DASH["Dashboard Table<br/>📋 JSON.parse"]
        FEED["Real-time Feed<br/>⚡ EventEmitter"]
    end

    subgraph ANALYSIS["🔍 Content Analysis Pipeline"]
        M1["Module 1<br/>Multi-Source Ingestion<br/><i>Parallel via Promise.all</i>"]
        M2["Module 2<br/>Credibility Scorer<br/><i>0-100 score → tier</i>"]
        M3["Module 3<br/>Noise Filter & Dedup<br/><i>85% similarity threshold</i>"]
        M4["Module 4<br/>Contradiction Detector<br/><i>numeric/bool/cat/temporal</i>"]
        M5["Module 5<br/>RAG Insight Extraction<br/><i>3-7 insights</i>"]
        M6["Module 6<br/>Temporal Analysis<br/><i>decline/spike/drift/anomaly</i>"]
        M7["Module 7<br/>Conflict Resolution<br/><i>5 strategies</i>"]
    end

    subgraph ACTION["⚡ Action & Simulation"]
        M8["Module 8<br/>Impact Analysis<br/><i>constraints check</i>"]
        M9["Module 9<br/>Action Chain Generator<br/><i>3-5 actions DAG</i>"]
        M10["Module 10<br/>Constraint Validator<br/><i>budget/time/resource</i>"]
        M11["Module 11<br/>Chain Simulator<br/><i>state tracking</i>"]
        M12["Module 12<br/>Failure Recovery<br/><i>retry/fallback/rollback</i>"]
        M13["Module 13<br/>Outcome Visualizer<br/><i>before/after diff</i>"]
    end

    subgraph OUTPUT["📊 Output"]
        M14["Module 14<br/>Trace & Audit Log"]
        RESULT["Pipeline Result<br/>insights + contradictions<br/>action_chain + simulation<br/>outcome + trace"]
    end

    AMCE{{"🛡️ AMCE Contract Gate<br/>PASS / WARN / REJECT"}}

    PDF & URL & CSV & DASH & FEED --> M1
    M1 --> AMCE --> M2 --> AMCE --> M3 --> AMCE --> M4
    M4 --> AMCE --> M5 --> AMCE --> M6 --> AMCE --> M7
    M7 --> AMCE --> M8 --> AMCE --> M9 --> AMCE
    AMCE --> M10 --> M11 --> M12 --> M13
    M13 --> M14 --> RESULT

    style AMCE fill:#ff6b35,color:#fff,stroke:#e55100,stroke-width:2px
    style RESULT fill:#2d6a4f,color:#fff,stroke:#1b4332
    style M4 fill:#d62828,color:#fff,stroke:#9d0208
    style M9 fill:#457b9d,color:#fff,stroke:#1d3557
    style M12 fill:#e76f51,color:#fff,stroke:#f4a261
```

---

## 2. AMCE Contract Enforcement Flow

```mermaid
flowchart TD
    A["Module Output"]
    B["Structural Validation<br/>(types, regex, enum, ranges, required)"]
    C{"All fields<br/>valid?"}
    D["Semantic Validation<br/>(LLM base model check)"]
    E{"Semantic<br/>pass?"}
    F["PASS ✅<br/>Proceed to next module"]
    G["WARN ⚠️<br/>Log warning, proceed"]
    H["REJECT ❌"]
    I{"Attempts<br/>< max?"}
    J["Re-generate with<br/>base model"]
    K["Use fallback value<br/>or skip"]
    L["Log to Trace<br/>(decision, confidence, data)"]

    A --> B --> C
    C -- "Yes" --> D --> E
    C -- "No" --> H
    E -- "Yes" --> F
    E -- "Warnings only" --> G
    E -- "Fail" --> H
    H --> I
    I -- "Yes" --> J --> A
    I -- "No" --> K
    F --> L
    G --> L
    K --> L

    style F fill:#2d6a4f,color:#fff
    style G fill:#e9c46a,color:#000
    style H fill:#d62828,color:#fff
    style L fill:#264653,color:#fff
```

---

## 3. Action Chain Simulation Lifecycle

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant M9 as Action Chain Generator
    participant M10 as Constraint Validator
    participant M11 as Chain Simulator
    participant M12 as Failure Recovery
    participant M13 as Outcome Visualizer

    O->>M9: Generate 3-5 actions from insights
    M9-->>O: ActionChain (dependency graph)

    O->>M10: Validate each action against constraints
    M10-->>O: ConstraintValidationResult[]

    Note over M10: Budget > limit → BLOCKING<br/>Time > limit → BLOCKING<br/>API rate > limit → WARNING

    alt Has blocking violations
        O->>M9: Re-generate with modified constraints
    end

    O->>M11: Simulate chain (initial state)
    loop For each action in execution_order
        M11->>M11: Check dependencies met
        alt Dependencies not met
            M11->>M11: Skip action
        else Dependencies met
            M11->>M11: Execute simulation
            alt Random failure (simulateFailures=true)
                M11->>M12: Handle failure
                M12->>M12: Check retry_count > 0?
                alt Retry available
                    M12-->>M11: Retry action
                else Fallback exists
                    M12-->>M11: Use fallback action
                else Rollback required
                    M12-->>M11: Rollback to previous state
                else No recovery
                    M12-->>M11: Skip and continue
                end
            else Success
                M11->>M11: Update state
            end
        end
    end
    M11-->>O: ActionExecutionResult[]

    O->>M13: Generate outcome visualization
    M13-->>O: OutcomeVisualization (diff, timeline, metrics)
```

---

## 4. LLM Provider Failover Cascade

```mermaid
flowchart LR
    subgraph DEV["Development (Days 1-5) — $0"]
        P1_D["Primary:<br/>Gemini 1.5 Flash<br/>(free)"]
        F1_D["Fallback:<br/>Groq Llama 3.1<br/>(free)"]
    end

    subgraph PROD["Production (Days 6-7) — GCP Credits"]
        P1_P["Primary:<br/>Vertex AI Gemini Pro<br/>(Person B credits)"]
        F1_P["Fallback:<br/>Vertex AI Gemini Pro<br/>(Person C credits)"]
        F2_P["Emergency:<br/>Free Gemini API"]
        F3_P["Last Resort:<br/>Groq Llama 3.1"]
    end

    P1_D -- "429 / quota" --> F1_D
    P1_P -- "quota hit" --> F1_P
    F1_P -- "quota hit" --> F2_P
    F2_P -- "rate limit" --> F3_P

    subgraph EMBED["Embeddings (always free)"]
        EMB["Gemini text-embedding-004<br/>Never uses Vertex credits"]
    end

    style P1_D fill:#2d6a4f,color:#fff
    style P1_P fill:#457b9d,color:#fff
    style F3_P fill:#e76f51,color:#fff
    style EMB fill:#264653,color:#fff
```

---

## 5. Evaluation Criteria Mapping

```mermaid
pie title Evaluation Score Distribution by Module Group
    "Antigravity Integration (20%)" : 20
    "Agentic Reasoning (20%)" : 20
    "Insight Quality & Contradiction (20%)" : 20
    "Action Chain Simulation (15%)" : 15
    "Robustness (15%)" : 15
    "Innovation & UX (10%)" : 10
```

| Criteria (Weight) | Mapped Modules | Key Evidence |
|---|---|---|
| **Antigravity Integration (20%)** | Module 14, Orchestrator, BaseAgent | Comprehensive trace: workplan, task plan, reasoning, tool calls, decisions, recovery |
| **Agentic Reasoning (20%)** | All 14 modules via BaseAgent | Multi-step reasoning chains, LLM decision logging, contract gate decisions |
| **Insight Quality (20%)** | Modules 2, 4, 5, 6, 7 | Credibility scoring, contradiction detection, RAG extraction, temporal patterns, conflict resolution |
| **Action Chain Simulation (15%)** | Modules 8, 9, 10, 11 | 3-5 interconnected actions, dependency graph, state tracking, before/after |
| **Robustness (15%)** | Modules 10, 11, 12, AMCE | Constraint validation, failure injection, retry/fallback/rollback, 5 stress tests |
| **Innovation & UX (10%)** | AMCE layer, Frontend, Mobile | Contract enforcement unique, clean UI, mobile app, dual-provider architecture |

---

## 6. Development Timeline (Adjusted for Current Date)

```mermaid
gantt
    title Development Schedule (May 13-20)
    dateFormat YYYY-MM-DD

    section Phase 0-1 (✅ Done)
    Env Setup + LLM Client           :done, p0, 2026-05-13, 1d
    Core Infra (contracts, agents)    :done, p1, 2026-05-14, 1d

    section Phase 2 (🔴 In Progress)
    Modules 1-7 (Analysis Pipeline)   :active, p2, 2026-05-15, 1d

    section Phase 3
    Modules 8-13 (Action + Sim)       :p3, 2026-05-16, 1d

    section Phase 4
    Orchestrator + API                :p4, 2026-05-17, 0.5d

    section Phase 5
    Frontend + Mobile                 :p5, after p4, 1d

    section Phase 6
    Cloud Run + Stress Tests          :p6, 2026-05-18, 1d

    section Phase 7
    README + Demo Video               :p7, 2026-05-19, 1.5d

    section Deadline
    Submit                            :milestone, 2026-05-20, 0d
```

---

## 7. Backend File Structure (Target State)

```
backend/
├── src/
│   ├── index.ts                              ✅ Express entry point
│   ├── agents/
│   │   ├── base.agent.ts                     ✅ Abstract agent with trace + contract
│   │   ├── multi-source-ingestion.agent.ts   ❌ Module 1
│   │   ├── credibility-scorer.agent.ts       ❌ Module 2
│   │   ├── noise-filter.agent.ts             ❌ Module 3
│   │   ├── contradiction-detector.agent.ts   ❌ Module 4
│   │   ├── insight-extraction.agent.ts       ❌ Module 5
│   │   ├── temporal-analysis.agent.ts        ❌ Module 6
│   │   ├── conflict-resolution.agent.ts      ❌ Module 7
│   │   ├── impact-analysis.agent.ts          ❌ Module 8
│   │   ├── action-chain-generator.agent.ts   ❌ Module 9
│   │   └── orchestrator.ts                   ❌ Pipeline coordinator
│   ├── contracts/
│   │   ├── registry.ts                       ✅ YAML contract loader
│   │   ├── validator.ts                      ✅ Structural + semantic validation
│   │   └── definitions/
│   │       ├── multi_source_ingestion_v1.yaml    ✅
│   │       ├── contradiction_detection_v1.yaml   ✅
│   │       ├── action_chain_v1.yaml              ✅
│   │       └── [8 more contracts]                ❌
│   ├── simulation/
│   │   ├── constraint-validator.ts           ❌ Module 10
│   │   ├── chain-simulator.ts                ❌ Module 11
│   │   ├── failure-recovery.ts               ❌ Module 12
│   │   └── outcome-visualizer.ts             ❌ Module 13
│   ├── tracing/
│   │   ├── collector.ts                      ✅ Trace event aggregator
│   │   └── exporter.ts                       ❌ Module 14
│   ├── utils/
│   │   ├── llm-client.ts                     ✅ Multi-provider singleton
│   │   ├── test-llm-client.ts                ✅ Environment test
│   │   ├── cosine-similarity.ts              ❌ Vector math
│   │   └── embedding.ts                      ❌ Batch embeddings
│   ├── routes/
│   │   ├── pipeline.routes.ts                ⚠️ Stub → needs full impl
│   │   └── contracts.routes.ts               ❌
│   └── database/
│       └── db.ts                             ❌ SQLite (optional)
├── test-data/                                ❌ 5 sample source files
├── demo-data/                                ❌ Inventory shortage scenario
├── test/
│   └── stress-tests.ts                       ❌ 5 stress test scenarios
├── package.json                              ✅
├── tsconfig.json                             ✅
├── .env.development                          ✅
└── .env.production                           ✅
```

**Legend:** ✅ Done · ⚠️ Partial · ❌ Not started
