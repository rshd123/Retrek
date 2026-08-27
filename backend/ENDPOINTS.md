# Retrek Backend API Endpoints

This document specifies all REST API endpoints provided by the Retrek 100% Node.js backend orchestrator (`Port 5000`).

---

## 1. System & Health
- **`GET /api/health`**: Returns system operational status, cloud LLM connectivity, and Supabase database health.
- **`GET /ai/llmTest`**: Performs a test ping to the cloud LLM service (Groq/OpenAI) to verify API key validity and inference response.

---

## 2. Transaction Ingestion & Seeding
- **`POST /api/transactions/seed`**: Seeds or resets the 10 synthetic failed transaction scenarios directly into the Supabase database.
- **`GET /api/transactions`**: Fetches all ingested failed transaction records along with their current recovery statuses.
- **`GET /api/transactions/:id`**: Fetches full failure telemetry, customer details, and retry history for a specific transaction.
- **`POST /api/transactions/ingest`**: Ingests a new failed payment payload from webhooks or synthetic logs into the database.
- **`POST /api/transactions/batch-evaluate`**: Triggers batch AI diagnosis and policy gate execution across all synthetic transaction records.

---

## 3. AI Diagnosis Engine
- **`POST /api/ai/diagnose`**: Analyzes failure telemetry with an LLM and outputs a structured JSON diagnosis, recovery probability score, and Hinglish outreach text.

---

## 4. Deterministic Policy Engine & Approvals
- **`POST /api/policy/evaluate`**: Passes an AI diagnosis through rule-based safety gates (`AUTO_EXECUTE`, `HUMAN_APPROVAL`, `STOP_RULE`).
- **`GET /api/approvals/pending`**: Fetches all transactions currently queued for human swipe approval on the mobile PWA.
- **`POST /api/approvals/:id/approve`**: Processes a manual swipe-to-approve action from the approver to trigger recovery link generation.
- **`POST /api/approvals/:id/decline`**: Processes a manual swipe-to-decline action to permanently terminate recovery for a transaction.

---

## 5. Razorpay Execution & Webhooks
- **`POST /api/recovery/send-link`**: Calls the Razorpay SDK to create and send a bounded payment link (`https://rzp.io/i/test_...`) to the customer.
- **`POST /api/webhooks/razorpay`**: Receives Razorpay `payment_link.paid` webhooks and applies idempotency locks to confirm recovered revenue without double-counting.

---

## 6. ROI Dashboard & Audit Logging
- **`GET /api/audit-logs`**: Retrieves structured, searchable audit records detailing every failure code, AI reasoning card, and policy decision.
- **`GET /api/dashboard/roi`**: Computes real-time ROI metrics including total revenue at risk, total recovered amount (₹), and intervention success counts.
