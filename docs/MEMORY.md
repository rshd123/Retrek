# Retrek Coding Progress & Memory Anchor

> **Memory File for AI Coding Agent:**  
> This file tracks the exact backend code, database schemas, API routes, and configurations implemented so far in the Retrek project.

---

## 🟢 1. Server Architecture & Stack Status

- **Environment:** 100% Node.js Express Backend running on **Port 5000** (`/backend`).
- **Database:** Supabase PostgreSQL Project `retrek` (`hzqymcakpfcgttewyleu` in `ap-northeast-1`).
- **LLM Engine:** Groq SDK (`qwen/qwen3.6-27b` model).

---

## 🟢 2. Implemented Code & Files

### A. Environment & Configuration
- **`backend/.env`**:
  - `PORT=5000`
  - `SUPABASE_PROJECT_ID=hzqymcakpfcgttewyleu`
  - `SUPABASE_URL=https://hzqymcakpfcgttewyleu.supabase.co`
  - `SUPABASE_ANON_KEY` & `SUPABASE_PUBLISHABLE_KEY` configured.
  - `LLM_API_KEY` (Groq API Key) & `MODEL_NAME=qwen/qwen3.6-27b` configured.

### B. Core Services
- **`backend/services/supabaseClient.js`**: Initializes `@supabase/supabase-js` client module using server environment variables.
- **`backend/server.js`**: Main Express orchestrator entry point. Mounts `/api` (health), `/ai` (LLM test), and `/api/transactions` (transaction management).

### C. Completed API Routes & Endpoints

#### 1. System & Health (`backend/routes/health.js`)
- **`GET /api/health`**: Checks operational status, uptime, environment, and executes live pings to both Supabase DB and Groq LLM, returning latency timings.

#### 2. LLM Telemetry (`backend/routes/ai.js`)
- **`GET /ai/llmTest` & `GET /api/ai/llmTest`**: Performs test inference to Groq LLM, tracking latency and returning response.

#### 3. Transaction Management & Seeding (`backend/routes/transactions.js`)
- **`POST /api/transactions/seed`**: Reads `backend/data/batch_transactions.json` and upserts 10 synthetic failure scenarios into Supabase.
- **`GET /api/transactions`**: Queries Supabase DB and returns all stored transactions.
- **`GET /api/transactions/:id`**: Queries Supabase DB for a single transaction by ID.

### D. Database Tables (Applied via Supabase DDL Migration)
1. **`transactions`**: Stores payment failure telemetry (`id`, `amount`, `decline_code`, `retry_count`, `past_success_count`, `status`, `created_at`).
2. **`audit_logs`**: Stores failure diagnoses, LLM JSONB reasoning, policy gate decisions.
3. **`webhook_events`**: Stores event IDs for 2 AM duplicate webhook idempotency locks (`PRIMARY KEY (event_id)`).

### E. Datasets & Utility Scripts
- **`backend/data/batch_transactions.json`**: 10 realistic synthetic failed transaction scenarios.
- **`backend/scripts/seedTransactions.js`**: Standalone CLI script to seed Supabase database (`node scripts/seedTransactions.js`).
