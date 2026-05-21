# Web Frontend Documentation (Next.js)
**Autonomous Content-to-Action Agent**

This reference dictates the fundamental UX behavior and strict component implementation across the React-based Next.js Web Application providing the dense analytical transparency demanded by hackathon judges.

---

## 1. Web App Architecture Overview

The web dashboard exclusively employs **Next.js (React 18)** paired with **TypeScript** and **Tailwind CSS**. Next.js was intentionally selected to natively support HTTP streaming requests out-of-the-box via its robust Node APIs, facilitating complex Server-Sent Events (SSE) pipelines without relying on heavy WebSocket wrappers. 
All complex internal states are strongly coupled with OpenAPI-derived TypeScript interfaces imported strictly from the backend schemas, ensuring complete compile-time validation.

---

## 2. The Two-Phase Split Interface (`page.tsx`)

The foundational user experience restricts data visibility around a core state boundary dictating whether an operator is "reviewing" or "executing".

### Phase A — HITL Approval Phase (`HITLApprovalPhase.tsx`)
- **Render Condition:** Executes when `pipelineState === 'PENDING'` and the `proposal` object is hydrated.
- **Topological Layout:** Discards standard grid lists, generating a hierarchical action-card array ordered rigorously via Kahn's sort algorithm. Upstream parent dependencies map visually down towards child nodes utilizing the `depends_on` array string markers.
- **Approval Flow:** Exposes an interactive text prompt requesting an Operator Name. Upon typing a valid string, clicking `Approve` dispatches a `POST` network transaction. Captures `409 Conflict` backend validations by triggering a strictly red, destructive `shadcn/ui` Toast notification.
- **Rejection Flow:** Selecting `Reject` terminates the transaction instantly, mutating state away from PENDING.

### Phase B — Live Execution Phase (`LiveExecutionPhase.tsx`)
- **Render Condition:** Prevails across all subsequent states post-approval (`EXECUTING`, `COMPLETED`, `FAILED`).
- **Dynamic Updates:** Maps the streaming SSE array into scrolling trace lines.
- **SKIPPED Node Visuals:** Listens specifically for `upstream_failure` context fields; overrides standard card rendering entirely with heavy gray backgrounds and large `SKIPPED` notification badges.
- **RETRY Visuals:** Attaches dynamically updating attempt counters reflecting immediate mitigation loops.

---

## 3. The `useLiveTrace` Hook

The structural backbone managing internal react reactivity connected to raw EventSource feeds.

**LiveTraceState Definition:**
```typescript
export interface LiveTraceState {
  events: TraceEvent[];
  status: LiveTraceStatus;
  pipelineState: 'PENDING' | 'EXECUTING' | 'REJECTED' | 'COMPLETED' | 'idle';
  proposal: components['schemas']['StrategyProposal'] | null;
  auditRecord: components['schemas']['WorkflowAudit'] | null;
}
```

**Lifecycle Control:**
- Instantiates a raw DOM `EventSource` connection on component mount explicitly against `/api/pipeline/:id/stream`.
- Maps incoming `message` events against explicit case statements transitioning the internal `pipelineState`.
- Extracts complex nested JSON payloads from the `hitl_pending` event explicitly assigning them to the `proposal` object.
- Invokes `.close()` natively within the `useEffect` cleanup return function, actively terminating network buffers on unmount protecting against React memory leaks.

---

## 4. Frontend Component Highlights

- **`HITLApprovalPhase`:** Manages topological UI rendering passing down to `ActionChainViewer`.
- **`ActionChainViewer`:** Paints `ActionNode` interfaces rendering dependency strings.
- **`LiveExecutionPhase`:** Primary UI wrapper handling the streaming timeline.
- **`TraceViewer`:** Scrolling viewport tracking individual array elements parsed from `TraceEvent[]`.
- **`ContradictionViewer`:** Highly specific UI highlighting conflicting assertions side-by-side using intense yellow/red warning colors based on `severity`.

---

## 5. OpenAPI Type Safety Layer

Located in `frontend/src/types/openapi.d.ts`. Rather than redefining backend payload structures manually—which inherently invites catastrophic typing regressions—the codebase programmatically integrates the backend schemas via OpenAPI generators. This ensures that a schema change in the `BaseAgent` on the backend immediately throws a TypeScript compile error inside the React Component prop types. Zero `any` types exist inside the codebase component parameters.

---

## 6. The Cryptographic Compliance Certificate (`AuditCertificate.tsx`)

Resolving `GAP-04` from legacy iterations, this component directly handles the non-repudiation cryptographic seal. 

**Behavior:**
Renders exclusively when the state hits `COMPLETED` and the `auditRecord` contains valid objects. It utilizes a striking emerald/green visual motif denoting successful compliance checks.

**Rendering Specs:**
Displays the full 64-character SHA-256 hexadecimal `verification_hash`. Applies strict `break-all` and `font-mono` Tailwind classes ensuring the heavy cryptographic string wraps perfectly inside card layouts without overflowing boundaries on smaller desktop viewports. This explicit display proves to judges that the audit ledger has successfully closed the execution block immutably.

---

## 7. Firebase Deployment Operations

The frontend strictly compiles into static outputs utilizing Next.js built-in static exports or standard Next build configurations compatible with Firebase Hosting.

1. Updates `firebase.json` routing configurations forcing all non-static paths to route through `index.html` preventing 404 behavior on refresh.
2. Injects `NEXT_PUBLIC_API_BASE_URL` directly during the build step, securely pointing HTTP requests towards the Cloud Run backend URL (`https://your-backend.run.app`) rather than defaulting to `localhost`.
3. Necessitates that the backend CORS array specifically whitelists the resulting `https://your-app.web.app` Firebase endpoint.
