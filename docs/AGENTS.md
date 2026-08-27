# AGENTS.md — RETREK AGENT SYSTEM & ARCHITECTURE SPECIFICATION

> **NOTICE FOR AI CODING AGENTS (Cursor, Claude Code, Windsurf, Aider, OpenCode, Codex):**
> Read this document completely before generating, refactoring, or modifying any code in this repository. All code generated MUST strictly comply with the architecture, guardrails, and tech stack constraints detailed below.

---

## 1. Project Summary & Core Mission

- **Project Name:** Retrek
- **Category:** AI Revenue Recovery Engine & Mobile-First Financial Guardrail
- **Target Hackathons:** 
  1. **Razorpay Buildathon:** Track 3 (AI Revenue Recovery)
  2. **iQOO x Reskilll:** Track 1 (FinTech & Commerce / Mobile-First Experience)
- **Closed-Loop Lifecycle:** **Detect → Diagnose → Decide → Act → Verify → Recover**
- **Core Value Proposition:** Retrek continuously identifies failed payment transactions, uses an LLM to diagnose failure root causes, enforces deterministic safety policy guardrails, and executes bounded Razorpay test payment links while logging every step to an unalterable audit trail.

---

## 2. Non-Negotiable System Architecture Constraints

### ⚠️ SINGLE BACKEND STACK (100% Node.js)
- **Backend Environment:** Single Express.js application running inside `/backend` on **Port 5000**.
- **NO Python Microservice / Dual-Server Setup:** All AI diagnosis calls must be executed directly from Node.js using official SDKs (e.g., `groq-sdk`, `openai`, `@google/genai`). Do NOT suggest, create, or reference Python microservices, FastAPI, Flask, or separate port 8000 configurations.
- **Frontend Environment:** ReactJS + TailwindCSS running inside `/frontend` on **Port 3000**. Built mobile-first for smartphone touch interactions and desktop mirroring via iQOO Office Kit.

---

## 3. Directory Layout & Key File Responsibilities

```text
retrek/
├── .gitignore                  # Excludes node_modules, .env, and local logs
├── frontend/                   # ReactJS Mobile-First PWA (Port 3000)
│   ├── public/
│   └── src/
│       ├── components/         # SwipeApprovalCard, ROIBanner, AuditLogStream
│       ├── App.js
│       └── index.js
└── backend/                    # Single 100% Node.js Orchestrator (Port 5000)
    ├── data/
    │   └── batch_transactions.json   # 100 synthetic failed transaction records
    ├── services/
    │   ├── aiService.js        # Direct Cloud LLM API wrapper (returns structured JSON)
    │   ├── policyEngine.js     # Deterministic if/else safety guardrail logic
    │   └── razorpayService.js  # Razorpay SDK helper (creates Payment Links)
    ├── audit_trail.log         # Plain-text timestamped decision log
    ├── server.js               # Express API endpoints & Webhook listener
    ├── package.json
    └── .env                    # Central backend environment variables
|
|___ docs/
        ├── AGENTS.md                   # This file (Universal AI Memory Anchor)
        ├── context.md                   # This file (Universal AI Memory Anchor)
        ├── SOLUTION.md                   # This file (Universal AI Memory Anchor)