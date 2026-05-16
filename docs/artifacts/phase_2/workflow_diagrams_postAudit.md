```mermaid
flowchart TD
    subgraph Infrastructure [Shared Infrastructure]
        VSI[VectorStore Interface]
        FAI[FeedAdapter Interface]
        SDI[SourceDocument Interface]
        IMV[InMemoryVectorStore]
        MRF[MockRealtimeFeedAdapter]
        ADC[Authority Domains Config]
        ATC[Agent Thresholds Config]
    end

    subgraph Data Sources
        A1[PDF/Report]
        A2[Website/Article]
        A3[CSV/JSON]
        A4[Dashboard Data]
        A5[Real-time Feed]
    end

    subgraph Phase 2: Content Ingestion & Analysis
        Ingestion[Module 1: Multi-Source Ingestion<br>Parallel processing & Normalization]
        CredScorer[Module 2: Credibility Scorer<br>Recency, Authority & Quality]
        NoiseFilter[Module 3: Noise Filter & Deduplication<br>Similarity >85%, Spam, Stale Check]
        Contradiction[Module 4: Contradiction Detector<br>Cross-source conflict analysis]
        Resolution[Module 7: Conflict Resolution Logic<br>Heuristics & Investigation paths]
        Temporal[Module 6: Temporal Analysis Engine<br>Detect Spikes, Declines, Drifts, Anomalies]
        RAG[Module 5: RAG-Powered Insight Extraction<br>Synthesis of Trends, Risks, Opportunities]
    end

    %% Flow logic
    A1 --> Ingestion
    A2 --> Ingestion
    A3 --> Ingestion
    A4 --> Ingestion
    A5 --> Ingestion

    Ingestion -->|MultiSourceIngestionOutput| CredScorer
    CredScorer -->|CredibilityScorerOutput| NoiseFilter
    NoiseFilter -->|NoiseFilterOutput| Contradiction
    NoiseFilter -->|NoiseFilterOutput| Temporal
    NoiseFilter -->|NoiseFilterOutput| RAG
    
    Contradiction -->|ContradictionDetectorOutput| Resolution
    Resolution -->|ConflictResolutionOutput| RAG
    Temporal -->|TemporalAnalysisOutput| RAG

    %% Outputs going to Phase 3
    RAG -->|InsightExtractionOutput| Output[To Phase 3: Module 8 Impact Analysis]

    classDef module fill:#f9f,stroke:#333,stroke-width:2px;
    classDef infra fill:#bbf,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5;
    
    class Ingestion,CredScorer,NoiseFilter,Contradiction,Resolution,Temporal,RAG module;
    class VSI,FAI,SDI,IMV,MRF,ADC,ATC infra;
```