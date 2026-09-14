import "dotenv/config";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
try {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
} catch {
  // In Vercel serverless, rely on process.env
}

const groq = new Groq({ apiKey: process.env.LLM_API_KEY });

// Standard ISO-8583 banking ontology mapping
export const ISO_ONTOLOGY_MAP = {
  BANK_TIMEOUT_2FA: {
    iso_code: "ISO-8583 Code 91",
    category: "TECHNICAL_GLITCH",
    base_probability: 0.88,
    description: "System Error / Issuer 2FA Gateway Timeout"
  },
  BANK_TIMEOUT_GATEWAY: {
    iso_code: "ISO-8583 Code 96",
    category: "TECHNICAL_GLITCH",
    base_probability: 0.85,
    description: "Bank Switch Gateway Malfunction / Timeout"
  },
  PAYMENT_GATEWAY_DOWN: {
    iso_code: "ISO-8583 Code 96",
    category: "TECHNICAL_GLITCH",
    base_probability: 0.90,
    description: "Acquiring Gateway Temporary Interruption"
  },
  MICRO_TRANSACTION_FAILED: {
    iso_code: "ISO-8583 Code 91",
    category: "TECHNICAL_GLITCH",
    base_probability: 0.92,
    description: "Micro-payment session timeout"
  },
  EXPIRED_CARD: {
    iso_code: "ISO-8583 Code 54",
    category: "CUSTOMER_ACTION_REQUIRED",
    base_probability: 0.82,
    description: "Expired Card - Requires customer to update payment method"
  },
  INSUFFICIENT_FUNDS: {
    iso_code: "ISO-8583 Code 51",
    category: "SOFT_FINANCIAL_DECLINE",
    base_probability: 0.60,
    description: "Insufficient Funds in customer account"
  },
  CARD_LIMIT_EXCEEDED: {
    iso_code: "ISO-8583 Code 61",
    category: "SOFT_FINANCIAL_DECLINE",
    base_probability: 0.65,
    description: "Card or Daily Transaction Limit Exceeded"
  },
  ISSUER_DECLINED_GENERIC: {
    iso_code: "ISO-8583 Code 05",
    category: "SOFT_FINANCIAL_DECLINE",
    base_probability: 0.55,
    description: "Generic Do Not Honor from card issuer"
  },
  SUSPECTED_FRAUD: {
    iso_code: "ISO-8583 Code 59",
    category: "FRAUD_OR_SECURITY_RISK",
    base_probability: 0.00,
    description: "Suspected Fraud / Risk Anomaly detected"
  },
  STOLEN_CARD: {
    iso_code: "ISO-8583 Code 43",
    category: "FRAUD_OR_SECURITY_RISK",
    base_probability: 0.00,
    description: "Stolen Card / Pick Up flag from network"
  },
  CHECKOUT_ABANDONED: {
    iso_code: "ISO-8583 Code 05",
    category: "CUSTOMER_ACTION_REQUIRED",
    base_probability: 0.75,
    description: "Checkout abandoned before payment completion"
  },
  SUBSCRIPTION_PAYMENT_FAILED: {
    iso_code: "ISO-8583 Code 51",
    category: "SOFT_FINANCIAL_DECLINE",
    base_probability: 0.65,
    description: "Recurring subscription payment failed"
  },
  INVOICE_OVERDUE: {
    iso_code: "ISO-8583 Code 05",
    category: "SOFT_FINANCIAL_DECLINE",
    base_probability: 0.70,
    description: "B2B invoice payment overdue"
  },
  MANDATE_ACTIVATION_FAILED: {
    iso_code: "ISO-8583 Code 91",
    category: "TECHNICAL_GLITCH",
    base_probability: 0.80,
    description: "NACH e-mandate activation or debit failed"
  },
  VOICE_RECOVERY_INITIATED: {
    iso_code: "ISO-8583 Code 96",
    category: "TECHNICAL_GLITCH",
    base_probability: 0.82,
    description: "Voice channel payment recovery in progress"
  },
  PTP_COMMITMENT_BREACH: {
    iso_code: "ISO-8583 Code 51",
    category: "SOFT_FINANCIAL_DECLINE",
    base_probability: 0.55,
    description: "Customer promise-to-pay commitment not fulfilled"
  }
};

// Scenario-specific context for LLM prompt
const SCENARIO_CONTEXT = {
  checkout_dropoff: "This is a CHECKOUT DROP-OFF case: the customer abandoned their cart mid-payment. Emphasize urgency and one-click recovery. The customer was interested but dropped off — make re-engagement easy.",
  subscription_failure: "This is a SUBSCRIPTION FAILURE case: a recurring payment failed and the customer's service may be interrupted. Emphasize service continuity and minimal disruption.",
  b2b_receivables: "This is a B2B RECEIVABLES case: an enterprise invoice is overdue. Use FORMAL English tone. Reference invoice settlement and business relationship. No casual Hinglish.",
  mandate_retry: "This is a MANDATE RETRY case: a NACH e-mandate or recurring auto-debit failed at the bank level. Use technical language about mandate reactivation and scheduled retry.",
  voice_recovery: "This is a VOICE RECOVERY case: the customer is on an IVR or voice call. Generate a conversational, speakable script suitable for read-back over phone. Keep sentences short and natural.",
  ptp_commitment: "This is a PROMISE-TO-PAY case: the customer previously committed to paying on a specific date. Reference their prior commitment politely and provide the payment link."
};

/**
 * Validates LLM JSON response against the required schema.
 * Returns a sanitized diagnosis object or null if validation fails.
 */
function validateLLMDiagnosis(parsed, transaction, ontology, fallbacks) {
  if (!parsed || typeof parsed !== "object") return null;

  const requiredStringFields = ["root_cause", "customer_message_hinglish", "customer_message_english", "reasoning_summary"];
  for (const field of requiredStringFields) {
    if (typeof parsed[field] !== "string" || parsed[field].trim().length === 0) {
      console.warn(`[AI Validation] Missing or invalid field: ${field}`);
      return null;
    }
  }

  const validActions = ["AUTO_RETRY", "MANUAL_REVIEW", "HARD_STOP_REFUSAL"];
  if (!validActions.includes(parsed.suggested_action)) {
    console.warn(`[AI Validation] Invalid suggested_action: ${parsed.suggested_action}`);
    return null;
  }

  let prob = Number(parsed.recovery_probability);
  if (isNaN(prob)) prob = fallbacks.calculatedBaseline;
  prob = Math.max(0.00, Math.min(1.00, prob));

  return {
    transaction_id: transaction.id,
    iso_code: parsed.iso_code || ontology.iso_code,
    failure_category: parsed.failure_category || ontology.category,
    root_cause: parsed.root_cause,
    recovery_probability: Number(prob.toFixed(2)),
    probability_breakdown: parsed.probability_breakdown || {
      base_probability: ontology.base_probability,
      loyalty_boost: fallbacks.loyaltyBoost,
      retry_penalty: fallbacks.retryPenalty,
      ticket_adjustment: fallbacks.ticketAdjustment,
      final_probability: Number(prob.toFixed(2))
    },
    suggested_action: parsed.suggested_action,
    customer_message_hinglish: parsed.customer_message_hinglish,
    customer_message_english: parsed.customer_message_english,
    reasoning_summary: parsed.reasoning_summary,
  };
}

/**
 * Diagnoses a payment failure using LLM inference with ISO ontology mapping,
 * computing recovery probability, root-cause categorization, and culturally tuned Hinglish messaging.
 *
 * NO FALLBACKS — throws on any API or validation error.
 */
export async function diagnoseFailure(transaction) {
  const declineKey = String(transaction.decline_code || "").toUpperCase().trim();
  const ontology = ISO_ONTOLOGY_MAP[declineKey] || {
    iso_code: "ISO-8583 Code 05",
    category: "SOFT_FINANCIAL_DECLINE",
    base_probability: 0.50,
    description: "Generic Gateway Decline"
  };

  // Immediate Safety Invariant: Zero tolerance for fraud or stolen cards
  if (
    ontology.category === "FRAUD_OR_SECURITY_RISK" ||
    declineKey.includes("FRAUD") ||
    declineKey.includes("STOLEN") ||
    declineKey.includes("BLACKLIST")
  ) {
    return {
      transaction_id: transaction.id,
      iso_code: ontology.iso_code,
      failure_category: "FRAUD_OR_SECURITY_RISK",
      root_cause: "High-risk fraud indicator or stolen card flag detected by security rules.",
      recovery_probability: 0.00,
      suggested_action: "HARD_STOP_REFUSAL",
      customer_message_hinglish: "",
      customer_message_english: "",
      reasoning_summary: "Deterministic safety invariant triggered: 0% recovery viability to prevent chargebacks and fraud.",
      ai_source: "deterministic_invariant"
    };
  }

  if (!process.env.LLM_API_KEY) {
    throw new Error("[AI] LLM_API_KEY is not set in environment. Cannot run AI diagnosis.");
  }

  // LLM Prompt Construction
  const scenarioType = transaction.scenario_type || "payment_degradation";
  const scenarioCtx = SCENARIO_CONTEXT[scenarioType] || SCENARIO_CONTEXT.payment_degradation;

  const pastSuccessCount = Number(transaction.past_success_count) || 0;
  const retryCount = Number(transaction.retry_count) || 0;
  const amount = Number(transaction.amount) || 0;

  const loyaltyBoost = Math.min(0.20, Number((pastSuccessCount * 0.03).toFixed(2)));
  const retryPenalty = Number((retryCount * 0.15).toFixed(2));
  const ticketAdjustment = amount < 1000 ? 0.05 : amount >= 30000 ? -0.10 : amount >= 10000 ? -0.05 : 0.00;
  const calculatedBaseline = Number(Math.max(0.00, Math.min(1.00, ontology.base_probability + loyaltyBoost - retryPenalty + ticketAdjustment)).toFixed(2));

  const prompt = `You are Retrek AI, an enterprise revenue recovery diagnosis engine for Indian commerce.
Analyze this payment failure and return ONLY a valid JSON object matching the schema below.

Transaction Telemetry:
- Transaction ID: ${transaction.id}
- Amount: ₹${transaction.amount}
- Customer Name: ${transaction.customer_name || "Customer"}
- Scenario Type: ${scenarioType}
- Gateway Decline Code: ${transaction.decline_code}
- ISO Standard: ${ontology.iso_code} (${ontology.description})
- Retry Count: ${retryCount}
- Customer Past Success Orders: ${pastSuccessCount}

Actuarial Weighting Guidelines:
- Base ISO Probability (P_base): ${ontology.base_probability}
- Customer Past Successes (${pastSuccessCount} orders): Loyalty Boost +${loyaltyBoost}
- Retry Count (${retryCount} attempts): Retry Penalty -${retryPenalty}
- Amount Friction (₹${amount}): Ticket Sensitivity ${ticketAdjustment >= 0 ? "+" + ticketAdjustment : ticketAdjustment}
- Expected Actuarial Recovery Probability: ~${calculatedBaseline} (adjust slightly based on scenario context, but maintain mathematical rigor).

Scenario Context: ${scenarioCtx}

Required JSON Output Schema:
{
  "transaction_id": "${transaction.id}",
  "iso_code": "${ontology.iso_code}",
  "failure_category": "${ontology.category}",
  "root_cause": "<deep technical diagnosis of why the transaction failed in this specific business context>",
  "recovery_probability": <number between 0.00 and 1.00 applying the actuarial weighting>,
  "probability_breakdown": {
    "base_probability": ${ontology.base_probability},
    "loyalty_boost": ${loyaltyBoost},
    "retry_penalty": ${retryPenalty},
    "ticket_adjustment": ${ticketAdjustment},
    "final_probability": <number between 0.00 and 1.00>
  },
  "suggested_action": "AUTO_RETRY" | "MANUAL_REVIEW" | "HARD_STOP_REFUSAL",
  "customer_message_hinglish": "<empathetic, natural Hinglish recovery text matching the scenario above, mentioning customer name and amount>",
  "customer_message_english": "<polite formal English recovery text matching the scenario above>",
  "reasoning_summary": "<explicit mathematical and behavioral rationale: state how Base P was modified by loyalty (+${loyaltyBoost}), retry fatigue (-${retryPenalty}), and ticket sensitivity (${ticketAdjustment})>"
}

Output ONLY valid JSON, no markdown formatting.`;

  const startTime = Date.now();
  const response = await groq.chat.completions.create({
    model: process.env.MODEL_NAME || "openai/gpt-oss-20b",
    messages: [
      {
        role: "system",
        content: "You are Retrek AI, an expert payment failure diagnosis engine. Output ONLY a valid JSON object matching the requested schema."
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 2000,
  });

  const latencyMs = Date.now() - startTime;
  let content = response.choices[0]?.message?.content?.trim() || "";

  if (!content) {
    throw new Error("[AI] LLM returned empty response. API may be down or model returned no content.");
  }

  // Strip <think>...</think> tags or unclosed <think> blocks emitted by reasoning models
  content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim();

  // Clean potential markdown code fences
  if (content.includes("```")) {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      content = match[1].trim();
    }
  }

  // Extract the JSON object substring between { and }
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    content = content.substring(firstBrace, lastBrace + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (parseErr) {
    throw new Error(`[AI] Failed to parse LLM JSON response: ${parseErr.message}. Raw content: ${content.substring(0, 200)}`);
  }

  // Strict schema validation
  const validated = validateLLMDiagnosis(parsed, transaction, ontology, {
    calculatedBaseline, loyaltyBoost, retryPenalty, ticketAdjustment
  });

  if (!validated) {
    throw new Error(`[AI] LLM response failed schema validation for ${transaction.id}. Parsed: ${JSON.stringify(parsed).substring(0, 300)}`);
  }

  console.log(`[AI] LLM diagnosis validated for ${transaction.id}: prob=${validated.recovery_probability}, action=${validated.suggested_action}, latency=${latencyMs}ms`);
  return { ...validated, latency_ms: latencyMs, ai_source: "llm" };
}
