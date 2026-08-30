`# Retrek � Project Roadmap & Remaining TODOs

> **Track Focus:** Razorpay Buildathon (Track 3 � AI Revenue Recovery) � iQOO Track 1 (Mobile-First Experience)  
> **Architecture:** 100% Node.js Express Backend (`/backend`) + ReactJS / TailwindCSS Frontend (`/frontend`) + Supabase PostgreSQL + Groq LLM + Razorpay SDK

---

## ?? Table of Contents
1. [Backend Fixes & Route Polish](#1-backend-fixes--route-polish)
2. [Frontend Pages & Core Components](#2-frontend-pages--core-components)
3. [Realtime Synchronization (Supabase WebSocket)](#3-realtime-synchronization-supabase-websocket)
4. [Live Webhook & Gateway Integration](#4-live-webhook--gateway-integration)
5. [End-to-End Testing & Verification Checklist](#5-end-to-end-testing--verification-checklist)

---

## 1. Backend Fixes & Route Polish

- [x] **Fix Route Mounting Bug for `/api/dashboard/roi`**
  - **File:** `backend/routes/audit.js` & `backend/server.js`
  - **Issue:** `routes/audit.js` defines `router.get("/dashboard/roi")` while `server.js` mounts it at `app.use("/api/dashboard", ...)` resulting in `/api/dashboard/dashboard/roi`.
  - **Task:** Update route definition in `routes/audit.js` to `router.get("/roi", ...)` so it properly matches `GET /api/dashboard/roi`.
- [x] **Align Public vs. Protected Endpoints**
  - **File:** `backend/server.js` & `backend/routes/ai.js`
  - **Task:** Ensure `GET /api/health` remains public for uptime checks, while `GET /api/ai/llmTest` requires auth (or provide a public health ping version).
- [x] **Batch Processing Endpoint**
  - **File:** `backend/routes/transactions.js`
  - **Task:** Add `POST /api/transactions/batch-process` to trigger AI diagnosis & policy evaluation for all unprocessed `FAILED` transactions at once.

---

## 2. Frontend Pages & Core Components

- [x] **Wire `TransactionsView.jsx` into `TransactionsPage.jsx`**
  - **File:** `frontend/src/pages/TransactionsPage.jsx`
  - **Task:** Replace the static table in `TransactionsPage.jsx` with the rich `TransactionsView.jsx` component to enable searching, status filtering, transaction inspection modal, and direct AI recovery triggers.
- [x] **Build ROI & Analytics View (`ROIMetrics.jsx`)**
  - **File:** `frontend/src/pages/ROIMetrics.jsx`
  - **Features:**
    - Revenue recovery funnel: Total At Risk vs. Recovered vs. Stopped.
    - Policy Gate Distribution chart: Gate 1 (Auto-Execute) vs. Gate 2 (Human Approval) vs. Gate 3 (Stop Rule).
    - Recovery rate timeline and average latency metrics (Policy Engine <50ms vs. LLM inference).
- [x] **Build Audit Trail & Provenance Ledger (`AuditTrail.jsx`)**
  - **File:** `frontend/src/pages/AuditTrail.jsx`
  - **Features:**
    - Searchable table of all audit records from `GET /api/audit-logs/logs`.
    - Filters by gate decision (`AUTO_EXECUTE`, `HUMAN_APPROVAL`, `STOP_RULE`) and decline code.
    - Expandable modal showing full immutable JSONB `ai_reasoning` trace (model latency, ISO ontology mapping, prompt token telemetry).
- [x] **Build Benchmark & Evaluation Runner View (`BenchmarkPage.jsx`)**
  - **Route:** `/dashboard/benchmark`
  - **Features:**
    - "Run Live Benchmark" button that triggers `GET /api/benchmark/run`.
    - Live display of the 4 Evaluation Pillars:
      1. Adversarial Safety & Fraud Refusal Rate (100% Target).
      2. Webhook Deduplication & Idempotency Rate (100% Target).
      3. Policy Evaluation Latency (<50ms SLA).
      4. Audit Provenance Coverage (100%).
    - Batch scenario breakdown table showing each test case result.
- [x] **Build System Health & Diagnostics View (`SystemHealth.jsx`)**
  - **Route:** `/dashboard/system`
  - **Features:**
    - Live connection indicator for Supabase Database and Groq LLM inference (`qwen/qwen3.6-27b`).
    - Latency ping graphs and API configuration validator.
- [ ] **Build Manual Transaction Ingestion Modal / Form (`/dashboard/ingest`)**
  - **Features:**
    - Form to manually input failed transaction telemetry (Amount, Decline Code, Customer Name, Retry Count) to test real-time AI diagnosis.

---

## 3. Realtime Synchronization (Supabase WebSocket)

- [ ] **Configure Supabase Realtime Client in Frontend**
  - **File:** `frontend/src/services/supabaseClient.js` (or context hook)
  - **Task:** Initialize Supabase client in the frontend using anonymous public credentials.
- [ ] **Subscribe to Database Changes**
  - **Channels:**
    - `public:transactions` (`INSERT`, `UPDATE`) ? Automatically updates Dashboard metrics, Transaction table, and Approvals queue without page refresh.
    - `public:audit_logs` (`INSERT`) ? Streams new audit entries in real time to the Audit Trail.

---

## 4. Live Webhook & Gateway Integration

- [ ] **ngrok / Webhook Tunneling Configuration**
  - **Task:** Create an npm script (`npm run tunnel`) or helper documentation to expose `http://localhost:5000/api/webhooks/razorpay` to the internet.
- [ ] **Razorpay Dashboard Webhook Registration**
  - **Events to Subscribe:**
    - `payment_link.paid` ? Triggers atomic DB lock and sets status to `RECOVERED`.
    - `payment_link.failed` ? Re-triggers AI diagnosis and dunning retry sequencer.
- [ ] **Webhook Signature Verification Validation**
  - **File:** `backend/routes/webhooks.js`
  - **Task:** Verify HMAC SHA256 signature against `RAZORPAY_WEBHOOK_SECRET`.

---

## 5. End-to-End Testing & Verification Checklist

- [ ] **Authentication Flow:** User signup ? login ? token persistence ? protected route access ? logout.
- [ ] **Seeding & Pipeline Execution:** Seed 10 scenarios ? AI diagnoses root cause ? Policy engine enforces gates ? Razorpay links generated for Gate 1 ? Gate 2 items appear in Approvals Queue.
- [ ] **Human-in-the-Loop Approval:** Swipe/Click Approve on high-ticket transaction ? Razorpay link created ? status changes to `LINK_SENT`.
- [ ] **Adversarial Fraud Refusal:** Ingest `SUSPECTED_FRAUD` / `STOLEN_CARD` transaction ? verify 0 payment links created and immediate routing to `STOP_RULE`.
- [ ] **Concurrency Webhook Idempotency:** Fire 10 simultaneous webhook events ? verify exactly 1 succeeds and 9 are rejected via PostgreSQL primary key lock.
- [ ] **Benchmark Suite Execution:** Execute `node backend/scripts/runBenchmark.js` and verify all tests pass with full provenance.