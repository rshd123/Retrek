# Retrek — AI Revenue Recovery Agent
### Razorpay Buildathon (Track 3) × iQOO Track 1 Submission

---

## 1. Problem Statement Alignment

Track 3 asks for a closed-loop AI agent that can recover failed payments automatically, while staying within strict safety limits. Retrek follows the full required lifecycle — **Detect → Diagnose → Decide → Act → Verify → Recover** — and is built as a unified system powered by a 100% Node.js orchestrator and Supabase PostgreSQL for real-time state, audit logging, and webhook idempotency.

---

## 2. Architecture Overview

When a payment fails, Retrek's architecture executes in five distinct layers:

1. **Detect (Ingestion):** Failed transaction events are stored in the Supabase PostgreSQL `transactions` table.
2. **Diagnose (AI Evaluator):** Node.js calls cloud LLM APIs (Groq/OpenAI) to analyze error telemetry, outputting structured JSON with a root cause and a `recovery_probability` score ($0.00 - 1.00$).
3. **Decide (Policy Engine):** A deterministic, non-AI policy engine reads the diagnosis and applies non-negotiable safety rules (Gate 1: Auto-Execute, Gate 2: Human Approval, Gate 3: Stop Rule).
4. **Act & Verify (Execution & Webhooks):** Approved actions trigger Razorpay Payment Links API (`rzp_test_...`). Payment completion triggers a Razorpay webhook (`payment_link.paid`) back to Node.js.
5. **Recover & Sync (Supabase Realtime):** Confirmed payments update the Supabase DB, which instantly broadcasts real-time recovery metrics to the React ROI Dashboard and Mobile PWA via WebSockets.

The key design decision: **The AI never touches money directly.** It only recommends. A separate, predictable rule-based policy gate backed by Supabase database locks makes the final call.

---

## 3. Core Safety Guardrails

- **AI Boundary:** The AI's job is strictly limited to failure diagnosis and outreach drafting — it cannot trigger financial APIs independently. Every action passes through a deterministic policy gate first.
- **Stopping Rules:** Recovery attempts terminate automatically if `retry_count >= 3` or if the AI's `recovery_probability < 0.50`, ensuring customers are never spammed.
- **Transaction Amount Caps:** Per-transaction recovery amounts are capped via static configuration rules rather than dynamic AI output.
- **Global Daily Ceiling:** A daily financial ceiling limits total automated recovery volume, acting as an automatic system kill-switch.
- **Human-in-the-Loop Gate:** High-value transactions ($\ge \text{₹}10,000$) or medium-confidence cases ($0.50 \le P < 0.80$) require explicit physical human approval via the Mobile PWA swipe card.

---

## 4. Resilience — "What Broke at 2 AM & How We Fixed It"

**Duplicate Webhook Race Conditions:**  
During high-concurrency testing, Razorpay sandbox webhooks fired duplicate `payment_link.paid` events within milliseconds. Naive handling would double-count recovered revenue on the dashboard.  
*The Supabase Fix:* Retrek enforces DB-level idempotency using a Supabase `webhook_events` table with a `PRIMARY KEY (event_id)`. When a webhook arrives at `/api/webhooks/razorpay`, Node.js executes an atomic `INSERT`. If the event ID already exists, PostgreSQL throws a unique constraint violation, dropping duplicate execution instantly and acknowledging receipt with `200 OK`.

**Duplicate Payment Link Creation:**  
If a network retry causes the backend to re-trigger a recovery link, Retrek generates a unique idempotency key built from `transaction_id + retry_count` stored in Supabase's `recovery_actions` table, preventing duplicate Razorpay link generation.

**AI Gateway Fallbacks:**  
If the cloud LLM times out or returns malformed JSON, Node.js catches the exception and applies a default recovery probability score of `0.00`, defaulting safely to Gate 3 (Stop Rule) to prevent unsafe automated retries.

---

## 5. Explainable AI

Instead of presenting a raw confidence score, Retrek displays the complete cognitive reasoning behind each recommendation — detailing the technical failure code (e.g., issuer 2FA gateway timeout), historical success patterns for that decline code, and the generated outreach script. Alongside this, the system displays the policy gate's exact decision criteria. This transforms complex LLM telemetry into an intuitive, transparent card for human approvers.

---

## 6. Hinglish Customer Messaging

The problem statement explicitly highlights customer outreach in Hinglish. Retrek's prompt template enforces structured output generating short, empathetic, non-pushy outreach scripts in Hinglish by default (with standard English fallback), optimized for SMS/WhatsApp recovery links.

---

## 7. Audit Trail (Supabase PostgreSQL + JSONB)

Every decision—whether auto-executed, queued for human swipe, or stopped—is logged in real-time to a Supabase PostgreSQL `audit_logs` table:

```sql
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    decline_code TEXT NOT NULL,
    recovery_probability NUMERIC(3,2),
    gate_decision TEXT CHECK (gate_decision IN ('AUTO_EXECUTE', 'HUMAN_APPROVAL', 'STOP_RULE')),
    ai_reasoning JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Because `ai_reasoning` is stored as PostgreSQL `JSONB`, the frontend dashboard offers instant SQL-indexed searching and multi-parameter filtering (e.g., filter by decline code, gate decision, or amount) without complex search engine overhead.

---

## 8. ROI Dashboard & Realtime Metrics

Powered by **Supabase Realtime Subscriptions**, the React dashboard updates instantly whenever payments are verified:
- **Total Revenue at Risk Identified (₹)**
- **Interventions Safely Executed vs. Stopped**
- **Total Measured Money Recovered (₹)**

WebSockets push DB changes to the dashboard instantly, demonstrating live cash recovery without requiring polling or manual page refreshes.

---

## 9. Mobile-First Human Approval (iQOO Track Synergy)

For transactions requiring human oversight, Retrek provides a mobile-first PWA featuring interactive **Swipe-to-Approve Touch Cards**:
- Approvers view failure diagnostics, AI reasoning, and message previews on their smartphone.
- Swiping right writes an `APPROVED` status directly to Supabase.
- Thanks to Supabase Realtime, the desktop dashboard and backend Node.js orchestrator instantly sync the approval and dispatch the Razorpay Payment Link.
- Demoed on an **iQOO smartphone** mirrored to a laptop via **iQOO Office Kit**, this satisfies both Razorpay Track 3 (Human-in-the-Loop) and iQOO Track 1 (Mobile-First Experience).

---

## 10. What Was Deliberately Left Out — and Why

- **Complex Microservices:** Avoided multi-language microservice setups (e.g., Python FastAPI + Node) in favor of a 100% Node.js orchestrator + Supabase backend for zero latency and easy judging evaluation.
- **Unconstrained AI Execution:** Direct financial API access was deliberately withheld from the LLM to enforce 100% deterministic safety.
- **Over-engineered Offline Storage:** PWA offline caching was omitted to keep real-time Supabase state sync crisp and reliable during live judging demos.

---

## 11. Five-Minute Pitch Structure

1. **Problem Hook (0:00 - 0:45):** Highlight invisible revenue leakage in payment declines ($355 SaaS case study).
2. **Architecture & Safety Gates (0:45 - 1:45):** Explain the separation of "Brain" (LLM Evaluator) and "Hands" (Node.js Policy Engine + Supabase).
3. **Live Demo (1:45 - 3:30):** Trigger a synthetic failure $\rightarrow$ show LLM Hinglish diagnosis $\rightarrow$ perform live Swipe-to-Approve on iQOO smartphone mirrored via iQOO Office Kit $\rightarrow$ trigger Razorpay test link $\rightarrow$ show live Supabase Realtime dashboard update.
4. **2 AM Resilience Story (3:30 - 4:15):** Explain how Supabase `PRIMARY KEY` unique constraints prevent duplicate webhook double-counting.
5. **ROI & Closing (4:15 - 5:00):** Show total measured revenue recovered across batch data and summarize Retrek's production readiness.

---

## 12. Mapping to Judging Criteria

- **Closed-Loop Lifecycle:** Complete end-to-end implementation (Detect $\rightarrow$ Diagnose $\rightarrow$ Decide $\rightarrow$ Act $\rightarrow$ Verify $\rightarrow$ Recover).
- **Safety & Guardrails:** Bounded policy gates, human swipe approval, and stopping rules.
- **Resilience:** Database-level idempotency key handling for duplicate Razorpay webhooks.
- **Auditability:** PostgreSQL JSONB structured audit trail.
- **Measured Value:** Live ROI dashboard backed by Supabase Realtime.