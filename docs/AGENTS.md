# AGENTS.md — RETREK AGENT SYSTEM & ARCHITECTURE SPECIFICATION

> **CRITICAL NOTICE FOR AI CODING AGENTS (Cursor, Claude Code, Windsurf, Aider, OpenCode, Codex):**
> Read this document completely before generating, refactoring, or modifying any code in this repository. All code generated MUST strictly comply with the architecture, guardrails, and tech stack constraints detailed below.

---

## 1. Project Summary & Core Mission

- **Project Name:** Retrek
- **Category:** Autonomous AI Revenue Recovery Engine & Mobile-First Financial Guardrail
- **Target Hackathons:**
  1. **Razorpay Buildathon:** Track 3 (AI Revenue Recovery)
  2. **iQOO x Reskilll:** Track 1 (FinTech & Commerce / Mobile-First Experience)
- **Closed-Loop Lifecycle:** **Detect → Diagnose → Decide → Act → Verify → Recover**
- **Core Value Proposition:** Retrek continuously identifies failed payment transactions, uses an LLM to diagnose failure root causes with ISO 8583 banking ontology, enforces deterministic safety policy guardrails, and executes bounded Razorpay test payment links while logging every step to an unalterable PostgreSQL audit ledger.

---

## 2. Non-Negotiable System Architecture Constraints

### ⚠️ SINGLE BACKEND STACK (100% Node.js)
- **Backend Environment:** Single Express.js application running inside `/backend` on **Port 5000**.
- **NO Python Microservice / Dual-Server Setup:** All AI diagnosis calls must be executed directly from Node.js using official SDKs (e.g., `groq-sdk`, `openai`, `@google/genai`). Do NOT suggest, create, or reference Python microservices, FastAPI, Flask, or separate port 8000 configurations.
- **Frontend Environment:** ReactJS + TailwindCSS running inside `/frontend` on **Port 3000**. Built mobile-first for smartphone touch interactions and desktop mirroring via iQOO Office Kit.

### 🛡️ AI SAFETY & BOUNDARY CONSTRAINTS
- **AI Brain vs. Non-AI Hands:** The AI service (`aiService.js`) MUST NEVER directly invoke Razorpay APIs or create links. It outputs diagnosis, recovery probability, and drafted messages.
- **Deterministic Policy Gate:** The policy engine (`policyEngine.js`) makes all execution decisions using non-negotiable thresholds:
  - `Gate 1 (Auto-Execute)`: $P \ge 0.80$, $\text{Amount} < \text{₹}2,000$, $\text{Retries} = 0$, not fraud.
  - `Gate 2 (Human Swipe Approval)`: $\text{Amount} \ge \text{₹}10,000$ OR $0.50 \le P < 0.80$.
  - `Gate 3 (Hard Stop / Safety Refusal)`: $P < 0.50$ OR $\text{Retries} \ge 3$ OR `SUSPECTED_FRAUD` / `STOLEN_CARD`.
- **Database-Level Idempotency:** Webhooks must execute atomic inserts into `webhook_events` with `PRIMARY KEY (event_id)` to prevent duplicate recovery counting.

---

## 3. Directory Layout & File Responsibilities

```text
Retrek/
├── backend/
│   ├── data/
│   │   ├── batch_transactions.json   # Synthetic failed transaction scenarios & benchmark data
│   │   └── benchmark_results.json    # Output results from evaluation runner
│   ├── routes/
│   │   ├── health.js                 # System & LLM & Supabase health ping (/api/health)
│   │   ├── ai.js                     # AI diagnosis & LLM test routes (/api/ai/...)
│   │   ├── transactions.js           # Transaction ingestion, seeding & querying (/api/transactions/...)
│   │   ├── policy.js                 # Policy evaluation & human approval queue (/api/policy/..., /api/approvals/...)
│   │   ├── webhooks.js               # Razorpay webhook listener with idempotency locks (/api/webhooks/razorpay)
│   │   └── benchmark.js              # Batch evaluation harness endpoint (/api/benchmark/run)
│   ├── services/
│   │   ├── aiService.js              # Cloud LLM evaluator (ISO ontology, Hinglish generator, safety defaults)
│   │   ├── policyEngine.js           # Deterministic 3-gate safety rules & hard stop logic
│   │   ├── razorpayService.js        # Razorpay SDK client (bounded payment links with idempotency keys)
│   │   └── supabaseClient.js         # Supabase PostgreSQL client module
│   ├── scripts/
│   │   ├── seedTransactions.js       # Standalone CLI seeder
│   │   └── runBenchmark.js           # Automated benchmark evaluation suite
│   ├── server.js                     # Main Express server entry point (Port 5000)
│   ├── package.json
│   ├── ENDPOINTS.md                  # Comprehensive API documentation
│   └── .env                          # Central environment configuration
├── frontend/                         # ReactJS Mobile-First PWA (Port 3000)
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── SwipeApprovalCard.jsx # Tinder-style swipe card for human-in-the-loop approvals
│       │   ├── ROIBanner.jsx         # Live financial metric banner (recovered vs. at risk)
│       │   ├── AuditLogTable.jsx     # Searchable provenance ledger with ISO tags & JSONB modal
│       │   └── BenchmarkModal.jsx    # Real-time evaluation runner modal
│       ├── App.jsx
│       └── index.js
└── docs/
    ├── AGENTS.md                     # Agent system specification & instructions (This file)
    ├── AI-ENGINE-PIPELINE.md         # Cognitive AI layers, ISO ontology & Hinglish prompt spec
    ├── BENCHMARK.md                  # Evaluation suite, metrics & adversarial testing spec
    ├── MEMORY.md                     # Coding progress & database memory anchor
    ├── PROBLEM_STATEMENT.md          # Razorpay Track 3 & iQOO Track 1 requirements
    └── SOLUTION.md                   # Complete architectural submission & 5-minute pitch
```