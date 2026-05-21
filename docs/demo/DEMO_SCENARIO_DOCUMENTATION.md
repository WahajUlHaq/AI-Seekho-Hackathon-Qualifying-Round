# Scenario & Demo Documentation
**Autonomous Content-to-Action Agent**

This reference dictates the precise narrative, technical execution, and robust stress testing methodologies underlying the primary hackathon demonstration sequence: **The Inventory Shortage Crisis**.

---

## 1. The Inventory Shortage Scenario (Complete Walkthrough)

**Business Context:**
A mid-sized Pakistani retail enterprise actively managing distribution warehouse inventory for Product SKU-1234 ("Widget-A"). The system is presented with five distinct, highly conflicting data streams arriving simultaneously across disparate platforms.

**The Five Conflicting Sources:**

1. **Source SRC-001 (PDF)**
   - **File:** `warehouse-report.pdf`
   - **Content:** An internal warehouse inventory report dated 7 days prior. Asserts: *"Widget-A stock: 500 units."*
   - **Calculated Metric:** Credibility: MEDIUM (45/100). Penalized for age (`recency_score`: 10). Authority: High (30/30) as an official document. Quality: Has structured data (+10).

2. **Source SRC-002 (CSV)**
   - **File:** `sales-dashboard.csv`
   - **Content:** Real-time analytics output. Highlights a massive demand anomaly: +30% orders in the last 24 hours. Inventory reads effectively zero.
   - **Calculated Metric:** Credibility: HIGH (95/100). High recency, dense structured metrics. This becomes the primary anchor source.

3. **Source SRC-003 (TXT/Email)**
   - **File:** `supplier-email.txt`
   - **Content:** Official supplier communication from logistics tracking: *"Delivery delayed 3 days due to regional transport strike."*
   - **Calculated Metric:** Credibility: HIGH (75/100).

4. **Source SRC-004 (URL)**
   - **Link:** Live news article regarding the active transport strike affecting regional trucking routes.
   - **Calculated Metric:** Credibility: MEDIUM (60/100). Reputable domain, but lacks internal company context.

5. **Source SRC-005 (JSON)**
   - **Data:** Live customer portal complaint feed showing 5 sudden "out of stock" checkout errors within the last 2 hours.
   - **Calculated Metric:** Credibility: LOW (40/100). User-generated data inherently possesses volatility.

**Pipeline Module Responses:**
- **Credibility Scorer (Mod 2):** Generates the metrics above precisely without LLM hallucinations.
- **Contradiction Detector (Mod 4):** Flags the severe divergence between the 500 units reported in `SRC-001` versus the functional zero reported in `SRC-002` and `SRC-005`. Ranks this a `CRITICAL` severity numerical contradiction.
- **Conflict Resolution (Mod 7):** Objectively evaluates the conflict. Chooses the real-time `SRC-002` (Score: 95) over the dated `SRC-001` (Score: 45) asserting a factual "Stock Out" scenario.
- **Action Chain (Mod 9):** Generates 5 discrete actions:
  - `ACT-001`: Emergency local restock order (PKR 450K, 6 hours).
  - `ACT-002`: Disable e-commerce product listing (PKR 0).
  - `ACT-003`: Send automated delay apologies to active orders.
  - `ACT-004`: Invoke secondary delivery supplier contracts.
  - `ACT-005`: Investigate initial warehouse reporting discrepancies.
- **Execution & Recovery (Mod 11 & 12):** `ACT-001` succeeds. `ACT-003` hits a simulated 503 Timeout. The recovery engine applies exponential backoff, successfully resolving on attempt 2.
- **Outcomes (Mod 13):** Displays PKR 455,000 cost, resolving 80% stockout risk, and returning an 83% simulated success rate.

---

## 2. The Seven Demo Video Segments

The primary video demo script follows these 7 segments rigidly to ensure maximum technical transparency.

| Segment | Timing | Script/Narration | Visual Target |
|:---|:---|:---|:---|
| **1. Intro** | 0:00 - 0:30 | *"Welcome. This is the Autonomous Content-to-Action agent. Today we simulate a critical retail stockout crisis across 5 conflicting data sources."* | Split screen: System Architecture diagram alongside the Next.js Dashboard on the `IngestionStagingScreen`. |
| **2. Input** | 0:30 - 1:00 | *"We ingest an outdated PDF, a live CSV, an email, news, and a JSON feed simultaneously."* | Operator explicitly hits **Run Pipeline**. Next.js screen transitions immediately to the active EventSource trace timeline. |
| **3. Contradiction** | 1:00 - 1:45 | *"Notice Module 4 detecting a CRITICAL numerical conflict between the 7-day-old PDF and the live CSV. Module 7 resolves this via credibility scoring."* | Highlight the yellow/red `ContradictionViewer` component rendering the 500 units vs zero units UI block. |
| **4. Action Chain** | 1:45 - 2:45 | *"The pipeline formulates a 5-step DAG response strategy. The pipeline pauses. The mobile operator must approve this action."* | Shift focus to the Mobile App showing the biometric approval overlay. Operator scans fingerprint. The `PENDING` state shifts to `EXECUTING`. |
| **5. Recovery** | 2:45 - 3:30 | *"During execution, Action 3 hits a simulated API timeout. Watch the Failure Recovery engine automatically invoke a backoff-retry rather than crashing."* | Dashboard focuses on the `RETRY` counter badge ticking up, ultimately resolving to a green success. |
| **6. Outcome** | 3:30 - 4:00 | *"The system confirms a final impact metric of PKR 455,000 with a drastic 80% risk reduction across operations."* | The `SimulationResults` graphical charts animate into view showing the Before/After state. |
| **7. Audit Trace** | 4:00 - 4:30 | *"Finally, Antigravity generates an immutable SHA-256 receipt for judges to audit the entire reasoning loop."* | Close-up on the emerald `AuditCertificate` rendering the 64-character hash. End video. |

---

## 3. All Five Stress Tests (Complete Documentation)

**Stress Test 1 — Maximum Source Divergence**
- **Setup:** Feeds 3 sources explicitly contradicting each other (e.g. Stock levels at 0, 500, and 1000).
- **Expected:** Module 4 logs ≥ 2 contradictions. Module 7 attempts resolution.
- **Actual:** PASS. Detected all conflicts. Resolved ties as `UNRESOLVED` requesting human investigation.

**Stress Test 2 — Budget Constraint Violation**
- **Setup:** Inputs a static action array proposing a PKR 900,000 response against a hard PKR 500,000 constraint payload.
- **Expected:** Module 10 explicitly rejects the execution.
- **Actual:** PASS. Action `ACT-OVER` receives `REJECTED` status due to `exceeds_budget_constraint` with an alternative pathway proposed.

**Stress Test 3 — Action Failure & Retry Sequence**
- **Setup:** Injects a hardcoded 503 response sequence targeting the third topological execution node.
- **Expected:** Module 12 logs a `failure_recovery` event indicating `RETRY`.
- **Actual:** PASS. Retry attempt 2 successfully clears the network exception and continues the chain.

**Stress Test 4 — Low-Credibility Outlier Signal Rejection**
- **Setup:** Feeds three High-Credibility arrays corroborating 400 stock units against a single Low-Credibility anomalous source declaring a zero-stock event.
- **Expected:** The anomaly is discarded entirely from consensus logic.
- **Actual:** PASS. Logged event confirms: `"Ignored: low credibility outlier"`.

**Stress Test 5 — Cascading Budget Side Effect**
- **Setup:** Executes an emergency action that depletes 80% of the total available constraint budget, leaving insufficient funds for the remaining 3 DAG actions.
- **Expected:** Downstream validations fail *after* the initial action succeeds.
- **Actual:** PASS. Logged a `budget_revalidation` event terminating the remaining child nodes smoothly without throwing fatal application errors.
