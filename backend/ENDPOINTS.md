# Retrek Backend API Endpoints

---

## 1. System & Health
- ✅ **`GET /api/health`** — `routes/health.js` — Returns system operational status, cloud LLM connectivity, and Supabase database health.
- ✅ **`GET /ai/llmTest`** — `routes/ai.js` — Performs a test ping to the cloud LLM service to verify API key validity and inference response.

---

## 2. Transaction Management

### Seeding
- ✅ **`POST /api/transactions/seed`** — `routes/transactions.js` — Seeds 10 synthetic failed transaction scenarios into Supabase and automatically processes each one through the full real-time pipeline.

### Ingestion
- ✅ **`POST /api/transactions/ingest`** — `routes/transactions.js` — Ingests a single failed payment payload (from webhook or manual input) into the database with status `FAILED`.

### Real-Time Processing
- ✅ **`POST /api/transactions/:id/process`** — `routes/transactions.js` — Processes a single transaction through the full pipeline: AI Diagnosis → Policy Gate → Act → Audit Log.

### Retrieval
- ✅ **`GET /api/transactions`** — `routes/transactions.js` — Fetches all stored transactions with their current status.
- ✅ **`GET /api/transactions/:id`** — `routes/transactions.js` — Fetches a single transaction by ID.

---

## 3. Razorpay Execution & Webhooks
- ✅ **`POST /api/webhooks/razorpay`** — `routes/webhooks.js` — Receives Razorpay `payment_link.paid` and `payment_link.failed` webhooks. Applies idempotency locks. Auto-reprocesses failed payments through the recovery pipeline.

---

## 4. Human-in-the-Loop Approvals
- ✅ **`GET /api/approvals/pending`** — `routes/approvals.js` — Fetches all transactions with status `PENDING_APPROVAL`, enriched with AI reasoning from audit logs.
- ✅ **`POST /api/approvals/:id/approve`** — `routes/approvals.js` — Approves a pending transaction, creates a Razorpay payment link, and updates status to `LINK_SENT`.
- ✅ **`POST /api/approvals/:id/decline`** — `routes/approvals.js` — Declines a pending transaction, stops recovery, and updates status to `STOPPED`.

---

## 5. Audit Trail & ROI Dashboard
- ✅ **`GET /api/audit-logs/logs`** — `routes/audit.js` — Retrieves structured audit records. Supports query params: `?gate_decision=STOP_RULE&decline_code=BANK_TIMEOUT_2FA`.
- ✅ **`GET /api/dashboard/roi`** — `routes/audit.js` — Computes real-time ROI metrics: total at risk, recovered amount, recovery rate, decision counts.

---

## 6. Services
- ✅ **`aiService.js`** — AI diagnosis with ISO-8583 ontology mapping, Groq LLM inference, safe fallback.
- ✅ **`policyEngine.js`** — Deterministic safety guardrails (AUTO_EXECUTE / HUMAN_APPROVAL / STOP_RULE).
- ✅ **`razorpayService.js`** — Razorpay payment link creation.
- ✅ **`supabaseClient.js`** — Supabase PostgreSQL client initialization.

---

## 7. Transaction Status Flow

```
FAILED → LINK_SENT → RECOVERED
       → PENDING_APPROVAL → LINK_SENT → RECOVERED
                          → STOPPED
       → STOPPED
       → LINK_FAILED
```

---

## 8. What's Left (TODO)
- ❌ **Frontend (React + TailwindCSS)** — Not started
- ❌ **Supabase Realtime subscriptions** — Dashboard not built yet
- ❌ **Mobile PWA (Swipe-to-Approve)** — Not started
- ❌ **ngrok / webhook live integration** — Needs setup for real-time Razorpay demo
