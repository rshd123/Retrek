# Retrek

Retrek is an autonomous AI revenue recovery engine for failed payments, checkout drop-offs, subscription failures, B2B receivables, mandate retries, voice recovery, and promise-to-pay follow-ups.

The app detects failed transactions, diagnoses the likely failure reason with an LLM, applies deterministic recovery rules, creates bounded Razorpay test payment links where allowed, routes risky cases to human approval, and records every decision in Supabase for auditability.

## What It Does

- Ingests failed payment transactions manually or from webhook-like payloads.
- Maps gateway decline codes to ISO-8583-style failure categories.
- Uses Groq LLM inference to produce root-cause analysis, recovery probability, and customer recovery messages.
- Applies a deterministic policy gate before any recovery action is executed.
- Creates Razorpay payment links for approved recoverable cases.
- Handles Razorpay webhook callbacks with idempotency protection.
- Provides protected dashboards for transactions, ROI metrics, audit logs, benchmark results, system health, ingestion, and recovery tracking.
- Supports Supabase Realtime updates for transaction and audit-log changes.

## Tech Stack

- Frontend: React 19, Vite, Tailwind CSS 4, Supabase JS
- Backend: Node.js, Express 5, JWT auth, bcrypt
- Database: Supabase PostgreSQL
- AI: Groq SDK
- Payments: Razorpay Payment Links API
- Tunneling: ngrok for local Razorpay webhook testing
- Deployment target: Vercel serverless backend routing

## Repository Layout

```text
Retrek/
  backend/              Express API, services, scripts, and test data
  frontend/             React/Vite dashboard application
  docs/                 Problem statement, solution notes, benchmark notes, AI pipeline docs
  vercel.json           Vercel routing for backend/server.js
  TODO.md               Current project tasks and implementation notes
```

## Prerequisites

- Node.js 18 or newer
- npm
- Supabase project
- Groq API key
- Razorpay test account and API keys
- ngrok account token, only if testing webhooks locally

## Local Setup

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Create environment files:

```text
backend/.env
frontend/.env
```

## Backend Environment

Add these values to `backend/.env`:

```env
PORT=5000

SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key

LLM_API_KEY=your_groq_api_key
MODEL_NAME=qwen/qwen3.6-27b

TEST_API_KEY=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

JWT_SECRET=replace_with_a_strong_secret
NGROK_AUTHTOKEN=your_ngrok_authtoken
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is preferred for backend writes because it bypasses RLS.
- `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` can be used as a fallback, but writes may fail if RLS policies are not configured.
- `TEST_API_KEY` is used as the Razorpay key id in the current backend service.

## Frontend Environment

Add these values to `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

For local development, you may omit `VITE_API_URL`; Vite proxies `/api` to `http://localhost:5000`.

## Database Tables

Create the following Supabase tables before running the full pipeline:

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table transactions (
  id text primary key,
  customer_name text not null,
  customer_id text,
  amount numeric(12, 2) not null,
  decline_code text not null,
  retry_count int default 0,
  past_success_count int default 0,
  scenario_type text default 'payment_degradation',
  status text default 'FAILED',
  payment_link_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  transaction_id text references transactions(id),
  decline_code text not null,
  iso_code text,
  recovery_probability numeric(3, 2),
  gate_decision text,
  rule_id text,
  ai_reasoning jsonb not null,
  customer_message text,
  execution_status text,
  latency_ms int,
  created_at timestamptz default now()
);

create table webhook_events (
  event_id text primary key,
  event_type text,
  payload jsonb,
  processed_at timestamptz default now()
);
```

Enable Supabase Realtime for `transactions` and `audit_logs` if you want dashboard views to refresh automatically.

## Running Locally

Start the backend:

```bash
cd backend
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

## Common Workflow

1. Open the frontend at `http://localhost:5173`.
2. Sign up or log in.
3. Seed sample transactions from the Transactions page or call the seed API.
4. Run AI processing for failed transactions.
5. Review ROI, audit logs, benchmark results, and system health from the dashboard.
6. Use the Ingest page to add a custom failed transaction and process it immediately.

## Scripts

Backend:

```bash
cd backend
npm run dev
npm run tunnel
node scripts/seedTransactions.js
node scripts/runBenchmark.js
node scripts/checkTables.js
node scripts/resetAll.js
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run lint
```

## API Overview

Public endpoints:

```text
GET  /api/health
POST /api/auth/signup
POST /api/auth/login
POST /api/webhooks/razorpay
```

Protected endpoints require:

```text
Authorization: Bearer <jwt_token>
```

Protected transaction endpoints:

```text
GET  /api/transactions
GET  /api/transactions/:id
POST /api/transactions/seed
POST /api/transactions/ingest
POST /api/transactions/batch-process
POST /api/transactions/:id/process
GET  /api/transactions/scenarios
```

Protected approval endpoints:

```text
GET  /api/approvals/pending
POST /api/approvals/:id/approve
POST /api/approvals/:id/decline
```

Protected dashboard, audit, AI, and benchmark endpoints:

```text
GET /api/dashboard/roi
GET /api/audit-logs/logs
GET /api/ai/llmTest
GET /api/benchmark/run
GET /api/benchmark/results
```

See `backend/ENDPOINTS.md` for more endpoint details.

## Frontend Routes

```text
/                         Landing page
/login                    Login
/signup                   Signup
/dashboard                Dashboard overview
/dashboard/roi            ROI and metrics
/dashboard/transactions   Transactions
/dashboard/audit          Audit trail
/dashboard/benchmark      Benchmark and evaluation
/dashboard/system         System health
/dashboard/ingest         Manual transaction ingest
/dashboard/tracker        Recovery tracker
```

## Webhook Testing

For local Razorpay webhook testing:

```bash
cd backend
npm run tunnel
```

Copy the generated webhook URL into the Razorpay dashboard:

```text
https://<your-ngrok-domain>/api/webhooks/razorpay
```

The webhook route handles payment success events such as `payment_link.paid`, `payment.captured`, and `payment.authorized`, and payment-link failure events such as `payment_link.expired`, `payment_link.cancelled`, and `payment_link.failed`.

## Benchmarking

Run the benchmark through the backend script:

```bash
cd backend
node scripts/runBenchmark.js
```

Or call the API:

```bash
curl http://localhost:5000/api/benchmark/run \
  -H "Authorization: Bearer <jwt_token>"
```

Benchmark output is written to:

```text
backend/data/benchmark_results.json
```

The benchmark uses `backend/data/batch_transactions.json` and evaluates safety refusal, webhook idempotency, policy latency, audit provenance, scenario coverage, and recoverable revenue yield.

## Deployment

The included `vercel.json` routes all requests to `backend/server.js` for Vercel serverless deployment.

Before deploying, configure the same backend environment variables in Vercel. For a separate frontend deployment, configure:

```env
VITE_API_URL=https://your-backend-domain/api
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Documentation

- `docs/PROBLEM_STATEMENT.md` - challenge context and goals
- `docs/SOLUTION.md` - full submission notes
- `docs/AI-ENGINE-PIPELINE.md` - AI diagnosis and recovery pipeline details
- `docs/BENCHMARK.md` - benchmark and evaluation notes
- `docs/MEMORY.md` - project memory and progress notes
- `backend/ENDPOINTS.md` - backend API documentation
- `frontend/ROUTES.md` - frontend route notes

## Safety Notes

- The LLM only diagnoses failures and drafts messages.
- The policy engine decides whether recovery can proceed.
- Fraud, stolen-card, low-probability, and max-retry cases are stopped before payment-link creation.
- Webhook events are deduplicated through the `webhook_events` table.
- Use Razorpay test credentials unless you have reviewed the full recovery flow for production use.
