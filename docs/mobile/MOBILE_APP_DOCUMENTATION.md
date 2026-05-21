# Mobile App Documentation (Expo / React Native)
**Autonomous Content-to-Action Agent**

This document encompasses the technical deployment, structural philosophy, and native architectural components of the dedicated mobile operator application.

---

## 1. Mobile App Architecture Philosophy

The Expo Mobile application diverges heavily from standard CRUD app archetypes. It acts explicitly as a highly-secure operational remote-control enforcing non-repudiation through biometric gates.

**Navigation Paradigm:** 
Completely bypasses heavy navigation frameworks (like React Navigation). Instead, it employs a highly performant **single-state toggle architecture**. The `App.tsx` file maintains a singular state boolean defining rendering contexts, oscillating instantaneously between the `IngestionStagingScreen` and the `OperationalMonitorScreen`. 

**Why Expo Managed Workflow?**
Integrating complex hardware dependencies—specifically `expo-crypto`, `expo-secure-store`, and `expo-local-authentication`—requires profound native bridging configurations in bare React Native which frequently degrade iOS/Android parity. Expo handles these integrations automatically, delivering seamless hardware compliance.

---

## 2. Enterprise Architectural Directives (Zero Hardcoding Policy)

The mobile ecosystem complies strictly with 4 enterprise architectural directives:

### Directive 1 — Dynamic Configuration & Identity
Hardcoded configuration strings are strictly prohibited.
- `EXPO_PUBLIC_OPERATOR_HANDLE` is processed actively via the `.env` context.
- If undefined, the application intercepts the bootstrap process, rendering a first-time **Operator Provisioning Screen**.
- Captured credentials are mathematically encrypted and persisted securely via `expo-secure-store`.
- The `EXPO_PUBLIC_API_BASE_URL` manages network targeting with distinct production fallbacks.

### Directive 2 — Hardware-Backed Cryptographic Signing
- Employs native logic to calculate a **SHA-256 HMAC**.
- Input vectors are tightly concatenated: `(deviceSecret + pipelineId + rationale)`.
- The `deviceSecret` serves as a permanently pinned secret generated once during app provisioning.
- Most critically, the system invokes the OS-level **Biometric Authentication Gate** blocking signature generation until a face/fingerprint validation succeeds.
- Outputs the finalized payload format: `"${operatorHandle}::[SHA256_HEX_SIGNATURE]"`.

### Directive 3 — Immutable Client-Side Audit Ledger
- Following a pipeline `SUCCESS` termination, the application natively requests the cryptographic `/api/execution/:id/audit` endpoint.
- Extracts the SHA-256 `verification_hash`.
- Commits this hash to `expo-secure-store`. This operates as an immutable local ledger confirming proof-of-execution on the actual operating device, completely independent of the server's own SQLite history.

### Directive 4 — Architectural Boundaries
- Enforces a strong BFF (Backend-for-Frontend) layer mapping complex backend sub-states (Processing, Ingesting) into unified `ClientPipelineStatus` strings ensuring backend structural refactors do not break mobile layout states.

---

## 3. Biometric Security Service Deep-Dive

**File: `BiometricSecurityService.ts`**
- Operates primarily async utilizing robust internal try/catch boundaries.
- Executes `expo-local-authentication` capability tests assuring the underlying hardware supports biometric scans (preventing crashes on unsupported legacy models).
- Fails securely. A biometric rejection (or cancellation) triggers a thrown Error within the Promise logic block. It actively avoids returning silent nulls, forcing the UI layer to capture the error and abort HTTP network calls cleanly.
- Distinct variations exist implicitly via the OS: iOS leverages Secure Enclave key generation whereas Android utilizes Keystore parameters.

---

## 4. Pipeline State Synchronizer Hook

**File: `useStandalonePipeline.ts`**
- Bypasses raw `EventSource` web APIs (unsupported natively in RN) utilizing `react-native-event-source` for compatible chunk parsing.
- Contains a sophisticated **Polling Fallback** mechanism. If mobile cellular networking degrades causing SSE connection aborts, a `setInterval` triggers polling `GET /api/execution/:id/status` dynamically every 3 seconds. Once the native socket restores functionality, polling automatically suspends, balancing real-time speed with degraded-network stability.

---

## 5. Screen & UX Definitions

**IngestionStagingScreen.tsx**
- Facilitates initiating test protocols. Integrates OS-level `expo-document-picker` opening native file browsers targeting local PDFs/CSVs. Includes an empty-payload demo toggle generating explicit disk-ingestion fallbacks.

**OperationalMonitorScreen.tsx**
- Implements a stark, specialized dark-mode layout minimizing light emissions reflecting real-world operational environments.
- During the `PENDING` event, it aggressively overlays the biometric approval card. Once verified, the interface transitions to an intense scrolling trace list before culminating in the large green `Verified` badge confirming the extracted SHA-256 seal.

**Operator Provisioning Screen**
- Clean identity ingestion view validating string length inputs before locking the application to the operator.

---

## 6. Mobile Dependency Rationale

- **`expo-secure-store`:** Selected over `AsyncStorage` because it leverages hardware encryption limits (iOS Keychain) surviving app re-installs.
- **`expo-local-authentication`:** Chosen over third-party plugins guaranteeing official Expo OS integration without fragmented key managers.
- **`expo-crypto`:** Chosen over `js-sha256` libraries executing mathematical proofs cleanly at the native device level bypassing JS thread blockage.
- **`expo-document-picker` / `expo-file-system`:** Standardized libraries bridging both iOS and Android natively eliminating 90% of file management boilerplate.
- **`react-native-event-source`:** Required explicitly for native SSE preservation ensuring UI states feel real-time while maintaining memory-efficient parsing boundaries.
