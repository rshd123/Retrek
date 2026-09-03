# Retrek Backend API Endpoints

---

## 1. System & Health (Public)
- ✅ **`GET /api/health`** — `routes/health.js` — Returns system operational status, cloud LLM connectivity, and Supabase database health without requiring authentication.

---

## 2. Authentication (Public)
- ✅ **`POST /api/auth/signup`** — `routes/auth.js` — Create a new user account. Input: `{ email, username, password }`. `email` is UNIQUE; `username` can be shared across different accounts. Returns user + JWT token.
- ✅ **`POST /api/auth/login`** — `routes/auth.js` — Authenticate user. Input: `{ email, password }`. Returns user + JWT token.

## 3. Protected Endpoints (Requires Bearer token)
- ✅ **`GET /api/ai/llmTest`** (or **`GET /ai/llmTest`**) — `routes/ai.js` — Performs a live inference test ping to Groq LLM to verify model output and latency.
- ✅ **`GET /api/auth/me`** — `routes/auth.js` — Returns current logged-in user profile (`id`, `email`, `username`).
- ✅ **`GET /api/auth/users`** — `routes/auth.js` — List all users (id, email, username, created_at). No password_hash exposed.

---

## 4. Transaction Management (Protected)

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

## 5. Razorpay Execution & Webhooks (Public — called by Razorpay)
- ✅ **`POST /api/webhooks/razorpay`** — `routes/webhooks.js` — Receives Razorpay `payment_link.paid` and `payment_link.failed` webhooks. Applies idempotency locks. Auto-reprocesses failed payments through the recovery pipeline.

---

## 6. Human-in-the-Loop Approvals (Protected)
- ✅ **`GET /api/approvals/pending`** — `routes/approvals.js` — Fetches all transactions with status `PENDING_APPROVAL`, enriched with AI reasoning from audit logs.
- ✅ **`POST /api/approvals/:id/approve`** — `routes/approvals.js` — Approves a pending transaction, creates a Razorpay payment link, and updates status to `LINK_SENT`.
- ✅ **`POST /api/approvals/:id/decline`** — `routes/approvals.js` — Declines a pending transaction, stops recovery, and updates status to `STOPPED`.

---

## 7. Audit Trail & ROI Dashboard (Protected)
- ✅ **`GET /api/audit-logs/logs`** — `routes/audit.js` — Retrieves structured audit records. Supports query params: `?gate_decision=STOP_RULE&decline_code=BANK_TIMEOUT_2FA`.
- ✅ **`GET /api/dashboard/roi`** — `routes/audit.js` — Computes real-time ROI metrics: total at risk, recovered amount, recovery rate, decision counts.

---

## 8. Services
- ✅ **`aiService.js`** — AI diagnosis with ISO-8583 ontology mapping, Groq LLM inference, safe fallback.
- ✅ **`policyEngine.js`** — Deterministic safety guardrails (AUTO_EXECUTE / HUMAN_APPROVAL / STOP_RULE).
- ✅ **`razorpayService.js`** — Razorpay payment link creation.
- ✅ **`supabaseClient.js`** — Supabase PostgreSQL client initialization.
- ✅ **`authService.js`** — bcrypt password hashing + JWT token generation/verification.

---

## 9. Middleware
- ✅ **`middleware/auth.js`** — JWT auth middleware. Extracts token from `Authorization: Bearer <token>`, verifies, attaches `req.user`. Returns 401 if missing/invalid.

---

## 10. Transaction Status Flow

```
FAILED → LINK_SENT → RECOVERED
       → PENDING_APPROVAL → LINK_SENT → RECOVERED
                          → STOPPED
       → STOPPED
       → LINK_FAILED
```

---

## 11. Auth Flow

```
Signup → username + name + password → hash password (bcrypt) → save to DB → return JWT
Login  → username + password → find user → compare hash → return JWT
API call → Authorization: Bearer <token> → middleware verifies → request proceeds
```

---

## 12. Database Reset & Development Utilities

### Complete Database Reset (Public — Zero Auth Required)
- ✅ **`POST /api/reset`** (also supports **`GET`** and **`DELETE`**) — `routes/health.js`
  - **Purpose:** Wipes all transactional data (`audit_logs`, `webhook_events`, `transactions`) back to **0 rows** so you can test fresh from scratch with Thunder Client, Postman, or directly in a browser tab.
  - **Headers:** *None required* (no JWT Bearer token needed).
  - **Safety Invariant:** Preserves the `users` table so your login credentials and active sessions are not lost.
  - **Also Available Under:** `POST /api/transactions/reset` (requires Bearer token if called through transactions router).
  - **Sample Success Response (`200 OK`):**
    ```json
    {
      "success": true,
      "message": "Database reset to 0 rows. All transactional data cleared.",
      "deleted_counts": {
        "audit_logs": 20,
        "webhook_events": 2,
        "transactions": 20
      },
      "current_counts": {
        "audit_logs": 0,
        "webhook_events": 0,
        "transactions": 0
      },
      "timestamp": "2026-09-03T00:03:18.123Z"
    }
    ```

