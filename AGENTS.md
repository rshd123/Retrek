# AGENTS.md — Retrek Agent Context

> **Read this before generating any code.** All changes must comply with the architecture and constraints below.

---

## What Is Retrek?

An autonomous AI revenue recovery engine for failed payments. Built for **Razorpay Buildathon Track 3: AI Revenue Recovery**.

**Lifecycle:** Detect → Diagnose → Decide → Act → Verify → Recover

**Pipeline:** Failed transaction → ISO-8583 ontology mapping → Groq LLM diagnosis → 3-gate policy engine → Razorpay payment link → webhook confirmation → audit log

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Node.js, Express 5, ESM modules (`"type": "module"`) |
| Frontend | React 19, Vite, Tailwind CSS 4 |
| Database | Supabase PostgreSQL |
| AI | Groq SDK (model: `qwen/qwen3.6-27b`) |
| Payments | Razorpay Payment Links API |
| Auth | JWT (30-min expiry), bcrypt |
| Tunneling | ngrok (local webhook testing) |
| Deployment | Vercel serverless (backend routing via `vercel.json`) |

---

## Architecture Constraints

### NO Python microservices
All AI calls go through Node.js using `groq-sdk`. Do NOT suggest Python, FastAPI, Flask, or separate servers.

### AI brain, non-AI hands
`aiService.js` outputs diagnosis + probability + messages. It NEVER calls Razorpay directly.
`policyEngine.js` decides whether to execute. Only `razorpayService.js` creates payment links.

### 3-Gate Policy Engine
- **AUTO_EXECUTE** — High confidence (≥65%), low amount (<₹10k), low retries
- **HUMAN_APPROVAL** — Medium confidence (50-65%) or high amount (≥₹10k)
- **STOP_RULE** — Low confidence (<50%), max retries hit, fraud detected, or PTP date not yet due

### Scenario-Specific Overrides
Each scenario type has different retry limits and thresholds:
- payment_degradation: 3 retries
- checkout_dropoff: 3 retries
- subscription_failure: 4 retries
- b2b_receivables: 5 retries, ₹50k auto-execute limit for trusted vendors (10+ past successes)
- mandate_retry: 5 retries
- voice_recovery: 2 retries (prevent call fatigue)
- ptp_commitment: 2 retries, stops if ptp_date is in the future

---

## 7 Scenario Types

| Scenario | What It Means |
|----------|--------------|
| payment_degradation | Standard failed payment — retry with new link |
| checkout_dropoff | Customer abandoned cart — send recovery link |
| subscription_failure | Recurring payment failed — prevent service interruption |
| b2b_receivables | Overdue enterprise invoice — formal reminder |
| mandate_retry | NACH e-mandate failed — retry auto-debit |
| voice_recovery | Customer on phone — speakable recovery script |
| ptp_commitment | Promise-to-pay date arrived — send reminder |

---

## Directory Layout

```text
Retrek/
├── AGENTS.md                    # This file
├── README.md                    # Project docs, setup, API overview
├── TODO.md                      # Build plan, phases, remaining tasks
├── vercel.json                  # Vercel serverless routing
├── backend/
│   ├── server.js                # Express entry point (port 5000), starts ngrok + scheduler
│   ├── package.json             # ESM modules, Express 5, Groq, Razorpay SDKs
│   ├── services/
│   │   ├── aiService.js         # Groq LLM diagnosis, ISO ontology (16 codes), 7 scenario fallbacks
│   │   ├── policyEngine.js      # 3-gate deterministic policy, scenario-specific overrides
│   │   ├── razorpayService.js   # Razorpay payment link creation with idempotency
│   │   ├── schedulerService.js  # Mandate retry polling, PTP date checking, recovery verification
│   │   ├── authService.js       # JWT auth, bcrypt password hashing
│   │   └── supabaseClient.js    # Supabase PostgreSQL client
│   ├── routes/
│   │   ├── health.js            # GET /api/health
│   │   ├── auth.js              # POST /api/auth/signup, login
│   │   ├── transactions.js      # CRUD, seed, batch-process, scenarios endpoint
│   │   ├── ai.js                # GET /api/ai/llmTest
│   │   ├── approvals.js         # GET/POST pending approvals
│   │   ├── audit.js             # GET /api/audit-logs/logs, /api/dashboard/roi
│   │   ├── webhooks.js          # POST /api/webhooks/razorpay (HMAC + idempotency)
│   │   └── benchmark.js         # GET /api/benchmark/run, /results
│   ├── scripts/
│   │   ├── seedTransactions.js  # CLI seeder
│   │   ├── runBenchmark.js      # Automated benchmark suite
│   │   ├── checkTables.js       # DB table inspector
│   │   ├── resetAll.js          # Full data reset
│   │   └── deleteAllPaymentLinks.js
│   ├── data/
│   │   ├── batch_transactions.json  # 20 test scenarios across 7 types
│   │   └── benchmark_results.json   # Benchmark output
│   ├── public/
│   │   └── checkout.html        # Razorpay Checkout page
│   └── middleware/
│       └── auth.js              # JWT verification middleware
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Router, routes
│   │   ├── main.jsx             # Entry point
│   │   ├── components/
│   │   │   ├── ScenarioBadge.jsx    # Color-coded scenario label
│   │   │   └── TransactionsView.jsx # Transaction table with filters
│   │   ├── pages/
│   │   │   ├── Landing.jsx      # Landing page
│   │   │   ├── Login.jsx        # Login form
│   │   │   ├── Signup.jsx       # Signup form
│   │   │   ├── Dashboard.jsx    # Main dashboard layout + sidebar
│   │   │   ├── DashboardHome.jsx    # Overview cards, scenario breakdown
│   │   │   ├── TransactionsPage.jsx # Transaction list view
│   │   │   ├── ROIMetrics.jsx   # ROI charts, scenario recovery rates
│   │   │   ├── AuditTrail.jsx   # Audit log table with JSONB details
│   │   │   ├── BenchmarkPage.jsx    # Benchmark runner + results
│   │   │   ├── SystemHealth.jsx # System health checks
│   │   │   ├── IngestPage.jsx   # Manual transaction ingest form
│   │   │   └── RecoveryTracker.jsx  # PTP commitments, mandate schedule, B2B aging
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # JWT auth state management
│   │   │   └── RealtimeContext.jsx # Supabase realtime subscriptions
│   │   └── services/
│   │       ├── api.js           # Axios API client
│   │       └── supabaseClient.js # Supabase browser client
│   └── package.json
└── docs/
    ├── PROBLEM_STATEMENT.md
    ├── SOLUTION.md
    ├── AI-ENGINE-PIPELINE.md
    ├── BENCHMARK.md
    └── MEMORY.md
```

---

## Key Service Files

### aiService.js
- `ISO_ONTOLOGY_MAP` — 16 decline codes mapped to ISO-8583 codes, categories, base probabilities
- `SCENARIO_CONTEXT` — LLM prompt context per scenario (tone, language, emphasis)
- `SCENARIO_FALLBACKS` — Hinglish + English fallback messages when LLM fails
- `diagnoseFailure(transaction)` — Main function: maps decline → ontology → LLM prompt → diagnosis
- Fraud/stolen card = immediate `HARD_STOP_REFUSAL` with 0% probability

### policyEngine.js
- `SCENARIO_OVERRIDES` — Per-scenario retry limits and thresholds
- `evaluatePolicy(transaction, aiDiagnosis)` — Returns `AUTO_EXECUTE`, `HUMAN_APPROVAL`, or `STOP_RULE`
- Gates checked in order: STOP_RULE → HUMAN_APPROVAL → AUTO_EXECUTE

### schedulerService.js
- `checkMandateRetries()` — Finds mandate_retry transactions where `next_retry_at <= now`, re-runs pipeline
- `checkPTPCommitments()` — Finds ptp_commitment where `ptp_date <= now`, re-runs pipeline
- `verifyRecoveryAttempts()` — Finds LINK_SENT older than 24h, marks EXPIRED, re-diagnoses
- `startScheduler()` — Called on server boot (skipped on Vercel)

### razorpayService.js
- Creates Razorpay payment links with idempotency keys
- Never called directly by aiService.js

---

## Database Tables

```sql
users          — id, email, username, password_hash, created_at
transactions   — id, customer_name, customer_id, amount, decline_code, retry_count,
                 past_success_count, scenario_type, status, payment_link_url,
                 next_retry_at, ptp_date, created_at, updated_at
audit_logs     — id, transaction_id, decline_code, iso_code, recovery_probability,
                 gate_decision, rule_id, ai_reasoning (JSONB), customer_message,
                 execution_status, latency_ms, created_at
webhook_events — event_id (PK), event_type, payload (JSONB), processed_at
```

---

## Running

```bash
cd backend && npm install && npm run dev   # Server on :5000 (starts ngrok + scheduler)
cd frontend && npm install && npm run dev  # Frontend on :5173
```

`nodemon server.js` starts the server AND ngrok tunnel automatically.

---

## Don'ts

- Do NOT create Python microservices or FastAPI servers
- Do NOT call Razorpay APIs from aiService.js
- Do NOT skip the policy engine — every payment link creation must go through it
- Do NOT use `require()` — this is an ESM project (`"type": "module"`)
- Do NOT hardcode API keys — use `process.env.*`
- Do NOT add comments to code unless explicitly asked
