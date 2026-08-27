# Retrek AI Engine Pipeline

**The AI Engine acts strictly as "The Evaluator."** Its job is not to execute payment links or call financial APIs, but to analyze raw data and output structured intelligence for the Node.js Policy Engine. 

To ensure zero inter-server latency and a streamlined architecture, the AI Engine runs entirely within our unified 100% Node.js backend via cloud LLM SDKs (e.g., Groq or OpenAI).

---

## 🔄 End-to-End Pipeline Overview

```text
[ Raw Transaction Payload ] 
            │
            ▼
[ Step 1: Data Fetching & Extraction ]
            │ (Extracts amount, decline_code, customer history)
            ▼
[ Step 2: Prompt Construction & Injection ]
            │ (Packs transaction into JSON-mode prompt template)
            ▼
[ Step 3: LLM Inference & Semantic Reasoning ]
            │ (Analyzes error semantics, bank behavior, risk factors)
            ▼
[ Step 4: Structured JSON Output & Parsing ]
            │ (Returns recovery_probability, root_cause, customer_message)
            ▼
[ Step 5: Hand-off to Deterministic Policy Engine ]
```

---

## 📋 Detailed Pipeline Steps

### Step 1: Data Fetching & Payload Extraction
The process begins when a failed payment event is triggered. The raw transaction record contains metadata that the backend normalizes before feeding it to the AI.

#### Extracted Variables for AI Reasoning:
- `decline_code`: Identifies technical vs. financial issues (e.g., `BANK_TIMEOUT_GATEWAY` vs. `INSUFFICIENT_FUNDS`).
- `amount`: The financial risk value.
- `retry_count`: Number of times recovery has already been attempted.
- `past_success_count`: Customer reliability score (distinguishes active buyers from abandoned accounts).

---

### Step 2: Prompt Engineering & System Context
Inside `/backend/services/aiService.js`, Node.js takes the normalized JSON and dynamically inserts it into a structured prompt. To guarantee that the LLM does not hallucinate extra text, the prompt uses Structured JSON Schema enforcement.

> **System Role:**  
> You are Retrek AI, an expert payment failure diagnosis engine for commerce. You analyze payment failure telemetry and determine recovery viability.
>
> **Instructions:**  
> 1. Analyze the transaction payload provided below.
> 2. Determine the exact `root_cause`.
> 3. Calculate a `recovery_probability` score constrained between `0.0` and `1.0`.
> 4. Draft a polite, standard English `customer_message` for merchant outreach (e.g., WhatsApp/SMS).
> 5. Output **ONLY** a valid JSON object matching the exact schema. Do not include markdown formatting or commentary.

---

### Step 3: LLM Inference & Semantic Reasoning
The LLM evaluates the payload across three cognitive layers:

1. **Failure Code Classification:** The AI maps cryptic bank error codes to operational realities (e.g., `BANK_TIMEOUT` implies temporary infrastructure failure; `SUSPECTED_FRAUD` implies zero recovery chance).
2. **Probability Weighting:** The model combines past customer behavior with decline codes to compute the recovery probability score ($P_{\text{recovery}}$).
3. **Outreach Scripting:** The AI generates dynamic, polite English text adapted for customer outreach.

---

### Step 4: Structured JSON Output & Parsing
The LLM returns a structured JSON payload back to Node.js:

```json
{
  "transaction_id": "pay_Kx9281a",
  "recovery_probability": 0.88,
  "root_cause": "Issuer bank 2FA gateway timeout",
  "suggested_action": "SEND_PAYMENT_LINK",
  "customer_message": "Hello Rahul, your payment of ₹12,500 failed due to a bank timeout. Please tap the link to retry your checkout."
}
```

Node.js executes `JSON.parse()` on the response. If the AI outputs an invalid response, a fallback rule catches the exception, logging a default recovery score of `0.00` to prevent unsafe actions.

---

### Step 5: Hand-off to Policy Engine (`policyEngine.js`)
Once parsed, the JSON object is passed to the Node.js Policy Engine, where deterministic, non-negotiable safety rules take over:

```javascript
// Node.js deterministic check based on AI output
if (aiDiagnosis.recovery_probability < 0.50 || transaction.retry_count >= 3) {
    // GATE 3: STOP RULE -> Terminate recovery
} else if (transaction.amount >= 10000 || aiDiagnosis.recovery_probability < 0.80) {
    // GATE 2: HUMAN APPROVAL -> Push to Mobile PWA for Swipe Approval
} else {
    // GATE 1: AUTO EXECUTE -> Trigger Razorpay Payment Link API
}
```

Every decision made in this step is permanently written to `/backend/audit_trail.log` for full explainability.
