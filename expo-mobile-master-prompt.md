================================================================================
MASTER GENERATION PROMPT: SELF-CONTAINED EXPO CONTROL CLIENT FOR AGENTIC BACKEND
================================================================================

OBJECTIVE:
You are an Elite Mobile Systems Architect. We are building a completely standalone, production-ready Mobile Application from scratch using Expo (React Native) and TypeScript. This application serves as the EXCLUSIVE primary interface for our autonomous agentic backend orchestration engine. It must independently handle the full pipeline lifecycle: staging multi-format payloads, executing runs, streaming real-time agent lifecycle events, validating the Human-in-the-Loop (HITL) cryptographic gate via biometrics, and displaying the final audit results.

---

### 🚀 STEP 1: SCAFFOLDING & DEPENDENCY COMPLIANCE
Initialize a clean Expo workspace using the blank TypeScript template and install native system dependencies for networking, file ingestion, storage, and secure biometrics:

cmd: npx create-expo-app@latest --template blank-typescript .
cmd: npx expo install expo-secure-store expo-local-authentication expo-crypto expo-document-picker expo-file-system react-native-event-source

---

### 📂 STEP 2: INDEPENDENT CODE ARCHITECTURE & CORNERSTONE MODULES

Generate the full filesystem layout and populate it with the production modules detailed below:

1. DATA INGESTION & PICKER LAYER: `src/services/IngestionService.ts`
   - Implement an independent document loading system using `expo-document-picker`.
   - Read local files (PDF, CSV, TXT) via `expo-file-system` and convert them into raw string contents.
   - Build a payload assembler that compiles selections into the type-safe `RawSource[]` matrix, directly dispatching to the `POST /api/pipeline/run` gateway endpoint.

2. TYPE SAFETY CONTRACTS BOUNDARY: `src/types/pipeline.ts`
   - Define exact interfaces mirror-matched to the backend YAML constraints: PipelineStatus ('INITIALIZED'|'PROCESSING'|'PENDING'|'EXECUTING'|'SUCCESS'|'FAILED'), SourceType ('PDF'|'CSV'|'TXT'|'URL'), RawSource, ActionNode, StrategyProposal, and TraceEvent schemas.

3. HARDWARE ENCLAVE BIOMETRICS INTERFACE: `src/services/BiometricSecurityService.ts`
   - Verify device local authentication hardware flags (`expo-local-authentication`).
   - Generate and isolate an asymmetric Elliptic Curve private key in the iOS/Android Secure Enclave via `expo-secure-store`.
   - Implement a cryptographic signing engine that takes the backend's `pipeline_id` + `rationale` and outputs a hex-encoded signature token to pass the HITL approval webhook block.

4. MULTI-CHANNEL CLIENT STATE SYNCHRONIZER: `src/hooks/useStandalonePipeline.ts`
   - Manage the initialization dispatch sequence. Once a run is triggered, establish a direct stream connection using `react-native-event-source` against `/api/pipeline/:id/stream`.
   - Implement an automated fallback polling routine using a decoupled timer hook. If mobile network coverage switches, drops frames, or encounters backgrounding, poll `/api/execution/:id/status` to maintain data sync.
   - Intercept backend in-memory drops or server resets cleanly, providing clear interface notifications if state lookup fails.

5. HIGH-DENSITY STANDALONE VIEWPORTS:
   - `src/screens/IngestionStagingScreen.tsx`: View to select native files, edit text snippets, and initiate the full orchestration pipeline.
   - `src/screens/OperationalMonitorScreen.tsx`: High-performance dark-themed view mapping out the real-time streaming trace entries. Displays an interactive action card overlay when status hits 'PENDING', forcing biometric authentication to release the post-approval pipeline execution worker loop.

---

### 🏁 STEP 3: QUALITY ASSURANCE MATRIX
- Ensure no implicit 'any' types exist. All asynchronous actions must be guarded behind strict error catch wrappers.
- Provide a clean entry point in App.tsx that wires these two primary views together via a simple state toggle or basic stack layout.

Execute the standalone codebase generation loop now.
================================================================================