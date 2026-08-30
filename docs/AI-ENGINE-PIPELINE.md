# Retrek AI Engine Pipeline & Cognitive Specification

**The AI Engine acts strictly as "The Evaluator & Drafter."** Its responsibility is to analyze raw payment failure telemetry, map it to banking error semantics, estimate recovery viability, and draft culturally tuned outreach messages for the Deterministic Policy Engine.

To guarantee sub-second latency and zero architectural complexity, the AI Engine runs directly inside our **100% Node.js orchestrator** via official cloud LLM SDKs (Groq / OpenAI / Google Gemini).

---

## 🔄 1. End-to-End Pipeline Architecture

```text
[ Raw Transaction Payload ]
            │
            ▼
[ Step 1: Data Extraction & Normalization ]
            │ (Extracts amount, decline_code, customer history, retry_count)
            ▼
[ Step 2: ISO 8583 Error Classification & Context Injection ]
            │ (Maps bank error codes to standard financial failure semantics)
            ▼
[ Step 3: LLM Inference & Cognitive Analysis ]
            │ (Evaluates root cause, risk factors, recovery probability P_rec)
            ▼
[ Step 4: Contextual Hinglish / English Script Generation ]
            │ (Generates tailored, empathetic WhatsApp/SMS recovery message)
            ▼
[ Step 5: Provenance & JSON Schema Validation ]
            │ (Attaches model latency, token counts, rule tags, fallback safety)
            ▼
[ Step 6: Hand-off to Deterministic Policy Engine (policyEngine.js) ]
```

---

##  2. Detailed Pipeline Steps

### Step 1: Data Extraction & Normalization
When a payment failure event arrives, the orchestrator normalizes the payload into standard telemetry:
- `decline_code`: Gateway decline string (e.g., `BANK_TIMEOUT_GATEWAY`, `INSUFFICIENT_FUNDS`, `SUSPECTED_FRAUD`).
- `amount`: Financial transaction value in INR (₹).
- `retry_count`: Past recovery attempts for this transaction ($0, 1, 2, \dots$).
- `past_success_count`: Customer's historical completed orders (measures account trust/loyalty).
- `customer_name`: Name for personalized outreach.

---

### Step 2: ISO 8583 Ontology & Banking Error Mapping
The engine maps gateway-specific decline codes to standardized ISO 8583 banking specifications before prompt construction:

| Gateway Decline Code | ISO 8583 Mapping | Category | Recovery Strategy |
| :--- | :--- | :--- | :--- |
| `BANK_TIMEOUT_2FA` | **Code 91 (System Error / Issuer Timeout)** | Infrastructure / Glitch | High viability ($P \ge 0.85$); instant retry link. |
| `BANK_TIMEOUT_GATEWAY` | **Code 96 (System Malfunction)** | Gateway Glitch | High viability ($P \ge 0.85$); retry link. |
| `EXPIRED_CARD` | **Code 54 (Expired Card)** | Customer Action Required | High viability ($P \ge 0.80$); update card outreach. |
| `INSUFFICIENT_FUNDS` | **Code 51 (Insufficient Funds)** | Soft Financial Decline | Medium viability ($P \approx 0.55 - 0.70$); delayed/polite nudge. |
| `CARD_LIMIT_EXCEEDED` | **Code 61 (Exceeds Withdrawal Limit)** | Soft Financial Decline | Medium viability ($P \approx 0.60$); enterprise invoice link. |
| `SUSPECTED_FRAUD` | **Code 59 (Suspected Fraud)** | Safety-Critical / Risk | **Zero recovery viability ($P = 0.00$) $\rightarrow$ Hard Refusal.** |
| `STOLEN_CARD` | **Code 43 (Stolen Card / Pick Up)** | Safety-Critical / Risk | **Zero recovery viability ($P = 0.00$) $\rightarrow$ Hard Refusal.** |

---

### Step 3 & 4: Prompt Engineering & Structured JSON Output
The prompt enforces structured JSON output with temperature $0.2 - 0.3$ for deterministic, repeatable reasoning:

```javascript
const systemPrompt = `You are Retrek AI, an enterprise payment failure diagnosis and revenue recovery engine for Indian digital commerce.
Analyze the payment failure telemetry and output ONLY a valid JSON object matching the exact schema below.

Output Schema:
{
  "transaction_id": string,
  "iso_code": string (e.g. "ISO-8583 Code 91"),
  "failure_category": "TECHNICAL_GLITCH" | "CUSTOMER_ACTION_REQUIRED" | "SOFT_FINANCIAL_DECLINE" | "FRAUD_OR_SECURITY_RISK",
  "root_cause": string (detailed technical explanation),
  "recovery_probability": number (between 0.00 and 1.00),
  "suggested_action": "AUTO_RETRY" | "MANUAL_REVIEW" | "HARD_STOP_REFUSAL",
  "customer_message_hinglish": string (empathetic, natural Hinglish outreach for WhatsApp/SMS),
  "customer_message_english": string (formal English fallback outreach),
  "reasoning_summary": string (concise explanation of decision criteria)
}`;
```

---

### Step 5: Cognitive Evaluation Rules & Safety Boundaries

1. **Adversarial / Fraud Safety Invariant:**
   If `failure_category === "FRAUD_OR_SECURITY_RISK"` or `decline_code` contains `FRAUD`, `STOLEN`, or `BLACKLIST`, the model MUST output:
   - `recovery_probability: 0.00`
   - `suggested_action: "HARD_STOP_REFUSAL"`
   - `customer_message_hinglish: ""` (No outreach permitted)

2. **Loyalty Weighting:**
   - A customer with `past_success_count >= 5` facing `BANK_TIMEOUT_2FA` is assigned $P_{\text{rec}} \ge 0.85$.
   - A first-time customer (`past_success_count === 0`) with `INSUFFICIENT_FUNDS` is capped at $P_{\text{rec}} \le 0.45$.

3. **Retry Penalty:**
   - Each past retry applies a decay factor ($\Delta P = -0.20 \times \text{retry\_count}$).

---

### Step 6: Fallback Safety Mechanism & Hand-off to Policy Engine
If the cloud LLM times out, returns malformed JSON, or fails API validation, Node.js catches the exception and returns a **Zero-Risk Safe Default**:

```javascript
// Exception Fallback
{
  transaction_id: transaction.id,
  iso_code: "UNKNOWN",
  failure_category: "TECHNICAL_GLITCH",
  root_cause: "AI inference timeout or schema parse error",
  recovery_probability: 0.00,
  suggested_action: "HARD_STOP_REFUSAL",
  customer_message_hinglish: "",
  customer_message_english: "",
  reasoning_summary: "AI service fallback activated; safely routed to Gate 3 Stop Rule."
}
```

This guarantees that AI failures can **never** result in unauthorized payment link generation or unmonitored financial risk.
