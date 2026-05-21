# Engineering Decisions & Lessons Learned
**Autonomous Content-to-Action Agent**

This document serves as the formal retrospective, outlining the fundamental Architecture Decision Records (ADRs), cost/latency dynamics, and baseline analytical comparisons justifying why the system was constructed in this exact manner.

---

## 1. Key Architectural Decisions (ADR Format)

### ADR-001: LLMClient Singleton vs Per-Agent Instantiation
- **Context:** 14 discrete agents require generative capabilities. Hardcoding `new GoogleGenerativeAI()` across 14 files creates massive configuration drift and blocks easy enterprise vendor rotation.
- **Decision:** Implemented a unified `llm-client.ts` singleton exposing abstracted `.complete()` methods.
- **Consequences:** We successfully rotate between Gemini, Vertex, and Groq purely via a single `.env` file without altering backend business logic. We accepted the minor overhead of routing all prompts through a single central bottleneck.

### ADR-002: In-Memory Vector Store vs External Database
- **Context:** The system requires vector search (RAG) to find data intersections rapidly (Module 3 & 5).
- **Decision:** Built `InMemoryVectorStore.ts` using native cosine similarity math rather than deploying Pinecone or Weaviate.
- **Consequences:** Pipeline operations are completely stateless. The store builds itself dynamically per API request and evaporates on completion. This perfectly suits hackathon scopes but prohibits historical cross-pipeline RAG queries.

### ADR-003: Kahn's Algorithm vs Simple Sequential Ordering
- **Context:** Action Chains must execute in topological order (e.g., "Check budget" must happen before "Purchase").
- **Decision:** Applied Kahn’s Algorithm in `dag-sorter.ts` to map `depends_on` arrays into strict linear execution queues.
- **Consequences:** Eliminates race conditions entirely during the simulation phase. Requires Module 9 (LLM) to flawlessly generate acyclic graphs (enforced by AMCE constraints).

### ADR-004: SSE Streaming vs WebSocket
- **Context:** The Web and Mobile UIs require millisecond updates as the 14 agents transition state.
- **Decision:** Selected `EventSource` (Server-Sent Events) over `Socket.io`.
- **Consequences:** SSE is unidirectional (Server → Client). This fits the trace-publishing paradigm perfectly, requiring significantly less network handshaking overhead compared to duplex WebSockets. Mobile required `react-native-event-source` to maintain native compatibility.

### ADR-005: SQLite vs Cloud Firestore
- **Context:** Pipeline state must be queried dynamically by polling clients if SSE drops.
- **Decision:** Utilized `better-sqlite3` strictly for ultra-low latency local development.
- **Consequences:** When deployed to Cloud Run, SQLite data vanishes upon container termination. We mitigated this by ensuring the crucial final SHA-256 Audit outputs write to persistent `audit-logs/` mounts rather than the DB.

### ADR-006: Expo Managed Workflow vs Bare React Native
- **Context:** The Mobile app needs Face ID and encrypted storage capabilities natively.
- **Decision:** Strictly utilized Expo.
- **Consequences:** Avoided 10+ hours of debugging brittle Android/iOS native bridging files. Allowed instantaneous testing across physical devices via QR codes.

### ADR-007: SHA-256 HMAC vs Asymmetric Key Signing
- **Context:** Operators must securely "sign" their execution approval on mobile.
- **Decision:** Utilized native OS-level SHA-256 concatenation hashing utilizing `expo-crypto` over heavy RSA asymmetric key generation.
- **Consequences:** Significantly faster execution at the slight trade-off of requiring the `deviceSecret` to remain pinned securely on the operator's device rather than implementing public/private key server exchanges.

---

## 2. Cost & Latency Analysis

### Infrastructure Financial Breakdown
- **Development Phase (Days 1–5):** $0.00 spent. All invocations strictly mapped to Gemini API free tiers (15 RPM) and Groq Llama 3.1.
- **Staging Run (Day 6):** ~$0.50 accumulated confirming Vertex AI authorization and GCP Secret mappings.
- **Production Rehearsals (Days 6–7):** ~$3.00 – $5.00 total across Person B and Person C accounts.

### Per-Pipeline Simulated Cost Calculation
- Ingestion (M1): `$0.00` (Local PDF/Regex parsing)
- Credibility Scoring (M2): `$0.001` (Parallel context analysis)
- Contradiction Engine (M4): `$0.005` (5 discrete LLM extractions)
- Insight Extraction (M5): `$0.003` (Heavy RAG prompt synthesis)
- Action Chain Generator (M9): `$0.004` (Complex DAG formatting constraints)
- AMCE Validation (Across 14 Modules): `$0.010` (Base Model execution overhead)
- Embeddings (M3): `$0.000` (Permanently anchored to free tier)
- **Total Operational Cost:** ~**$0.023** on free models, ~**$0.05** strictly on Vertex AI per pipeline execution.

### Latency Mapping Profile
*Latency values fluctuate based on payload density.*
- **Phase 1 (Ingestion & Analysis):** ~4,000ms – 8,000ms. (Bottleneck: M4 Contradiction Extraction).
- **Phase 2 (Strategic Mapping):** ~1,500ms – 3,000ms. (Bottleneck: M9 DAG formatting).
- **Phase 3 (Simulation):** ~500ms – 2,000ms.
- **Total Expected End-to-End Latency:** 10–25 seconds (Free-Tier Dev), **7–18 seconds (Vertex AI Production)**.

---

## 3. Baseline Comparisons (Why The System Is Necessary)

To explicitly prove value, we must analyze how the enterprise functions *without* these specific architectural elements.

### Without Contradiction Detection (M4)
- **The Scenario:** The system ingests the week-old PDF claiming 500 units alongside the live CSV claiming 0 units.
- **Failure State:** Without M4, a standard RAG system blindly averages facts, or randomly hallucinate a median (e.g. 250 units).
- **Business Impact:** The system fails to trigger the emergency Action Chain, resulting in a devastating stockout costing ~PKR 2M in lost revenue. M4 proves that highlighting conflict is vastly superior to forcing consensus.

### Without Failure Recovery (M12)
- **The Scenario:** The Action Chain triggers a local supplier API which drops packets returning a 503 error.
- **Failure State:** The standard pipeline halts, throwing a fatal exception to the user. No actions are completed.
- **Business Impact:** M12 intercepts the fault, pauses 1,000ms, and retries successfully. The 15% robustness constraint explicitly saves the operation from network volatility.

### Without AMCE Contract Enforcement
- **The Scenario:** Module 9 is told to output 3-5 actions in an array. The generative LLM decides to output 10 actions wrapped in markdown backticks.
- **Failure State:** Module 10 (Constraint Validator) cannot parse markdown; the server throws `JSON.parse` errors and crashes.
- **Business Impact:** AMCE forces the LLM to cleanly regenerate valid JSON, making the system enterprise-ready instead of functioning as a brittle tech demo.

---

## 4. Known Limitations

1. **Cloud Run Statelessness:** SQLite writes are ephemeral across container restarts. While pipeline traces respond securely via API and static JSON writes, deeply historical analytical searches aren't viable yet.
2. **Vertex AI Geographical Latency:** The round-trip ping from localized Pakistani testing networks to `asia-south1` imposes a baseline ~50-80ms penalty atop standard LLM generation times.
3. **Mocked Live Feeds:** Source 5 (`realtime_feed`) currently leverages localized JSON mocks mimicking WebSocket customer complaints to maintain demo consistency.
4. **LLM Non-Determinism:** Even at temperature=0.7, semantic variance exists. While AMCE catches structural breaking changes perfectly, linguistic nuances in "Action Summaries" shift per run.

---

## 5. Future Improvements Roadmap

- **Persistent Vector DB:** Migrating from the InMemory model to Pinecone or Cloud Firestore Vector Search to allow cross-pipeline organizational memory.
- **Token Streaming:** Implementing direct stream-to-client token generation to drastically reduce Time-To-First-Byte (TTFB) inside the Next.js UI arrays.
- **Multi-Tenant JWT Auth:** Replacing the Operator Provisioning basic keys with full JWT OAuth schemas scaling across a massive corporate enterprise.
- **Automated Contract Generation:** Pointing the LLM directly at the TypeScript schema `.d.ts` files to auto-generate the AMCE YAML constraints dynamically rather than maintaining them manually.
