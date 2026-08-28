# Retrek Coding Progress & Memory Anchor

> **Memory File for AI Coding Agents & Pair Programmers:**  
> This file tracks the exact backend code, database schemas, API routes, and configurations implemented across the Retrek project.

---

## 🟢 1. Server Architecture & Stack Status

- **Environment:** 100% Node.js Express Backend running on **Port 5000** (`/backend`).
- **Database:** Supabase PostgreSQL Project `retrek` (`hzqymcakpfcgttewyleu` in `ap-northeast-1`).
- **LLM Engine:** Groq SDK (`qwen/qwen3.6-27b` model with structured JSON mode and reasoning tag stripping).
- **Payment Gateway:** Razorpay SDK (`razorpay` npm package) in test mode (`rzp_test_...`).
- **Frontend:** ReactJS + TailwindCSS Mobile-First PWA running on **Port 3000** (`/frontend`).

---

## 🟢 2. Implemented Code & Configuration

### A. Environment & Configuration
- **`backend/.env`**: Configured with Supabase, Groq, and Razorpay test credentials.

### B. Core Services Status
- **`backend/services/supabaseClient.js`** `[✅ ACTIVE]`: Supabase PostgreSQL client module with automatic `.env` path resolution.
- **`backend/services/aiService.js`** `[✅ ACTIVE]`: Groq LLM inference, ISO-8583 banking ontology mapping, recovery probability computation, Hinglish/English message drafting, and zero-risk fallback handling.
- **`backend/services/policyEngine.js`** `[✅ ACTIVE]`: Deterministic 3-gate safety rules:
  - `Gate 1 (AUTO_EXECUTE)`: High probability, low ticket, clean history $\rightarrow$ auto payment link.
  - `Gate 2 (HUMAN_APPROVAL)`: High ticket ($\ge \text{₹}10,000$) or borderline confidence ($0.50 \le P < 0.80$) $\rightarrow$ mobile swipe card.
  - `Gate 3 (STOP_RULE / SAFETY_REFUSED)`: Low probability ($P < 0.50$), retry limit reached ($\ge 3$), or fraud/risk flags $\rightarrow$ hard refusal.

### C. Completed API Routes Status
1. **`GET /api/health`** `[✅ DONE]`: Verifies Express, Supabase PostgreSQL, and Groq LLM latency.
2. **`GET /ai/llmTest` & `GET /api/ai/llmTest`** `[✅ DONE]`: Verifies cloud LLM latency and JSON output.
3. **`POST /api/transactions/seed`** `[✅ DONE]`: Reads `backend/data/batch_transactions.json` and seeds 10 synthetic real-world failure scenarios into Supabase.
4. **`POST /api/transactions/ingest`** `[✅ DONE]`: Ingests a new payment failure payload from webhooks or synthetic generators into Supabase.
5. **`POST /api/transactions/batch-evaluate`** `[✅ DONE]`: Executes batch AI diagnosis and deterministic policy gate execution, updating statuses and writing immutable records to `audit_logs`.
6. **`GET /api/transactions`** `[✅ DONE]`: Fetches all transactions from Supabase with optional status filter and pagination.
7. **`GET /api/transactions/:id`** `[✅ DONE]`: Fetches single transaction telemetry by ID.

---

## 🟢 3. Database Schema (Supabase PostgreSQL)

```sql
-- 1. Transactions Ledger
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_id TEXT,
    amount NUMERIC(12,2) NOT NULL,
    decline_code TEXT NOT NULL,
    retry_count INT DEFAULT 0,
    past_success_count INT DEFAULT 0,
    status TEXT CHECK (status IN ('FAILED', 'PENDING_APPROVAL', 'LINK_SENT', 'RECOVERED', 'STOPPED', 'REFUSED')) DEFAULT 'FAILED',
    payment_link_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Audit Trail & Provenance Ledger
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT REFERENCES transactions(id),
    decline_code TEXT NOT NULL,
    recovery_probability NUMERIC(3,2),
    gate_decision TEXT CHECK (gate_decision IN ('AUTO_EXECUTE', 'HUMAN_APPROVAL', 'STOP_RULE', 'SAFETY_REFUSED')),
    ai_reasoning JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Webhook Idempotency Lock Table
CREATE TABLE webhook_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
