# Retrek — Build Plan

> Track 3: AI Revenue Recovery · Razorpay Buildathon  
> Source: https://razorpay.com/buildathon/

---

## What's Built

- ISO-8583 ontology (10 decline codes) + Groq LLM diagnosis
- 3-gate policy engine (Auto-Execute / Human Approval / Stop Rule)
- Razorpay payment link creation + webhook handler (HMAC + idempotency)
- Auth (JWT 30-min), realtime Supabase, audit trail (full JSONB provenance)
- Benchmark suite (4 pillars), 10 test scenarios
- Dashboard, Transactions, ROI, Audit Trail, Benchmark, System Health, Ingest pages

## What's Missing (7 hackathon directions, only 1 fully built)

---

## Phase 1 — Database Schema

Add columns to `transactions` table:

```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS scenario_type TEXT DEFAULT 'payment_degradation';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ptp_date DATE;
```

- [x] Run migration via Supabase SQL editor (manual — MCP permission denied)

---

## Phase 2 — Expand Seed Data (10 → 20 scenarios)

Replace `backend/data/batch_transactions.json` with 20 scenarios covering all 7 types.

| # | scenario_type | decline_code | Amount | Customer | Expected Gate |
|---|---|---|---|---|---|
| 1 | payment_degradation | BANK_TIMEOUT_2FA | ₹2,499 | Rahul Sharma | AUTO_EXECUTE |
| 2 | payment_degradation | BANK_TIMEOUT_GATEWAY | ₹15,000 | Priya Patel | HUMAN_APPROVAL |
| 3 | payment_degradation | INSUFFICIENT_FUNDS | ₹4,500 | Aditya Verma | HUMAN_APPROVAL |
| 4 | payment_degradation | SUSPECTED_FRAUD | ₹8,999 | Vikram Singh | STOP_RULE |
| 5 | payment_degradation | BANK_TIMEOUT_2FA | ₹1,999 | Ananya Iyer | STOP_RULE |
| 6 | payment_degradation | EXPIRED_CARD | ₹3,200 | Neha Gupta | AUTO_EXECUTE |
| 7 | payment_degradation | CARD_LIMIT_EXCEEDED | ₹28,500 | Rohan Mehta | HUMAN_APPROVAL |
| 8 | payment_degradation | PAYMENT_GATEWAY_DOWN | ₹499 | Siddharth Rao | AUTO_EXECUTE |
| 9 | payment_degradation | ISSUER_DECLINED_GENERIC | ₹12,500 | Kavita Desai | HUMAN_APPROVAL |
| 10 | payment_degradation | MICRO_TRANSACTION_FAILED | ₹9 | Arjun Nair | AUTO_EXECUTE |
| 11 | checkout_dropoff | CHECKOUT_ABANDONED | ₹4,999 | Meera Joshi | AUTO_EXECUTE |
| 12 | checkout_dropoff | CHECKOUT_ABANDONED | ₹12,000 | Karthik Menon | HUMAN_APPROVAL |
| 13 | subscription_failure | INSUFFICIENT_FUNDS | ₹999 | Sanya Reddy | HUMAN_APPROVAL |
| 14 | subscription_failure | EXPIRED_CARD | ₹2,499 | Tushar Bhatt | AUTO_EXECUTE |
| 15 | b2b_receivables | ISSUER_DECLINED_GENERIC | ₹45,000 | InfoCorp Ltd | HUMAN_APPROVAL |
| 16 | b2b_receivables | CARD_LIMIT_EXCEEDED | ₹28,000 | TechServe Pvt | HUMAN_APPROVAL |
| 17 | mandate_retry | BANK_TIMEOUT_2FA | ₹2,500 | Deepak Nair | AUTO_EXECUTE |
| 18 | mandate_retry | INSUFFICIENT_FUNDS | ₹1,800 | Pooja Sinha | HUMAN_APPROVAL |
| 19 | voice_recovery | BANK_TIMEOUT_GATEWAY | ₹1,999 | Amit Verma | AUTO_EXECUTE |
| 20 | ptp_commitment | INSUFFICIENT_FUNDS | ₹3,500 | Rekha Menon | HUMAN_APPROVAL |

- [x] Write new `batch_transactions.json`

---

## Phase 3 — Backend: Scenario-Aware AI Service

Modify `backend/services/aiService.js`:

- [x] Add 7 new decline codes to `ISO_ONTOLOGY_MAP`:
  - `CHECKOUT_ABANDONED` → ISO Code 05, category CUSTOMER_ACTION_REQUIRED, P=0.75
  - `SUBSCRIPTION_PAYMENT_FAILED` → ISO Code 51, category SOFT_FINANCIAL_DECLINE, P=0.65
  - `INVOICE_OVERDUE` → ISO Code 05, category SOFT_FINANCIAL_DECLINE, P=0.70
  - `MANDATE_ACTIVATION_FAILED` → ISO Code 91, category TECHNICAL_GLITCH, P=0.80
  - `VOICE_RECOVERY_INITIATED` → ISO Code 96, category TECHNICAL_GLITCH, P=0.82
  - `PTP_COMMITMENT_BREACH` → ISO Code 51, category SOFT_FINANCIAL_DECLINE, P=0.55

- [x] Update LLM prompt to include `scenario_type` and tailor output:
  - checkout_dropoff → emphasize urgency, one-click recovery
  - subscription_failure → emphasize service continuity
  - b2b_receivables → formal tone, invoice reference
  - mandate_retry → technical NACH retry language
  - voice_recovery → conversational IVR-style script
  - ptp_commitment → reminder of prior commitment

- [x] Add scenario-specific fallback Hinglish/English messages (used only when LLM fails)
- [x] Fix catch block fallback to use scenario-aware messages (lines 292-293 still use old generic)

---

## Phase 4 — Backend: Scenario-Aware Policy Engine

Modify `backend/services/policyEngine.js`:

- [x] B2B receivables: raise auto-execute limit to ₹50,000 if past_success_count >= 10
- [x] Subscription failures: reduce retry penalty to -0.10 per retry (vs -0.20)
- [x] Mandate retries: allow up to 5 retries (vs standard 3)
- [x] PTP commitments: if `ptp_date` is in the future, return STOP_RULE (not yet due)
- [x] Return `scenario_type` in the gate decision object

---

## Phase 5 — Backend: Transaction Routes + Scenarios Endpoint

Modify `backend/routes/transactions.js`:

- [x] Accept `scenario_type` in `/ingest` endpoint
- [x] Pass `scenario_type` through `processTransaction()`
- [x] Add `GET /api/transactions/scenarios` — returns breakdown by scenario_type with counts and recovered amounts

---

## Phase 6 — Backend: Scheduler (Verify + Recover Stages)

Create `backend/services/schedulerService.js`:

- [x] `checkMandateRetries()` — find `scenario_type=mandate_retry` where `next_retry_at <= now`, re-run pipeline
- [x] `checkPTPCommitments()` — find `scenario_type=ptp_commitment` where `ptp_date <= now`, re-run pipeline
- [x] `verifyRecoveryAttempts()` — find `LINK_SENT` older than 24h, mark EXPIRED, re-diagnose
- [x] Export `startScheduler()` function

Modify `backend/server.js`:

- [x] Import and call `startScheduler()` on boot (skip on Vercel)

---

## Phase 7 — Backend: Benchmark Expansion

Modify `backend/routes/benchmark.js`:

- [x] Add per-scenario-type metrics to benchmark report
- [x] Add 5th evaluation pillar: "Scenario Coverage" — all 7 types must have >= 1 test case
- [x] Add scenario-specific recovery rates

---

## Phase 8 — Frontend: ScenarioBadge Component

Create `frontend/src/components/ScenarioBadge.jsx`:

- [x] Reusable badge with color + label per scenario_type
- [x] Colors: payment_degradation=blue, checkout_dropoff=orange, subscription_failure=purple, b2b_receivables=teal, mandate_retry=indigo, voice_recovery=pink, ptp_commitment=amber

---

## Phase 9 — Frontend: TransactionsView Scenario Column

Modify `frontend/src/components/TransactionsView.jsx`:

- [x] Add `scenario_type` column to data table
- [x] Add scenario-type filter pills (alongside existing status filters)
- [x] Show ScenarioBadge in each row

---

## Phase 10 — Frontend: DashboardHome Scenario Breakdown

Modify `frontend/src/pages/DashboardHome.jsx`:

- [x] Add 7 mini-cards showing count per scenario type
- [x] Fetch from `/api/transactions/scenarios`

---

## Phase 11 — Frontend: ROIMetrics Scenario Distribution

Modify `frontend/src/pages/ROIMetrics.jsx`:

- [x] Add scenario-type recovery rate breakdown (bar chart or table)

---

## Phase 12 — Frontend: IngestPage Scenario Type

Modify `frontend/src/pages/IngestPage.jsx`:

- [x] Add `scenario_type` dropdown
- [x] Auto-suggest decline_code when scenario_type is selected

---

## Phase 13 — Frontend: Recovery Tracker Page

Create `frontend/src/pages/RecoveryTracker.jsx`:

- [x] PTP commitments table (customer, amount, ptp_date, status)
- [x] Mandate retry schedule (customer, amount, next_retry_at, retry_count)
- [x] B2B receivables aging (current / 30-day / 60-day / 90-day buckets)

Modify `frontend/src/pages/Dashboard.jsx`:

- [x] Add "Recovery Tracker" sidebar item

Modify `frontend/src/services/api.js`:

- [x] Add `getScenarioStats()`, `getRecoveryTracker()`

---

## Phase 14 — Test Everything

- [ ] Run SQL migration manually
- [ ] Seed all 20 scenarios
- [ ] Batch-process → verify all get AI diagnosis
- [ ] Verify gate decisions match expected per scenario type
- [ ] Verify audit trail has all 7 types
- [ ] Run benchmark → verify all 5 pillars pass
- [ ] Test Recovery Tracker page shows PTP/mandate/B2B data
- [ ] Test fraud refusal works for all scenario types
- [ ] Fix any issues

---

## Phase 15 — Pitch Prep

- [ ] Ensure public GitHub repo is ready
- [ ] Write 5-minute pitch script (Hook → Architecture → Demo → Safety → Benchmark)
- [ ] Record pitch video
