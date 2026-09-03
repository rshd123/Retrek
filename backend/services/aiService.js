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

// Scenario-specific fallback messages
const SCENARIO_FALLBACKS = {
  checkout_dropoff: {
    hinglish: (name, amt) => `Hi ${name}, aapka checkout adhura reh gaya hai (₹${amt}). Niche diye link se ek click mein payment complete karein!`,
    english: (name, amt) => `Hello ${name}, your checkout for ₹${amt} is incomplete. Complete your purchase now with the secure link below.`
  },
  subscription_failure: {
    hinglish: (name, amt) => `Hi ${name}, aapka ₹${amt} ka subscription payment fail ho gaya hai. Link se retry karein taaki aapki service na ruke.`,
    english: (name, amt) => `Hello ${name}, your subscription payment of ₹${amt} failed. Please retry now to avoid service interruption.`
  },
  b2b_receivables: {
    hinglish: (name, amt) => `Dear ${name}, this is a reminder for your overdue invoice settlement of ₹${amt}. Please process the payment at your earliest convenience using the link below.`,
    english: (name, amt) => `Dear ${name}, your invoice of ₹${amt} is overdue. Please settle the outstanding amount using the payment link below.`
  },
  mandate_retry: {
    hinglish: (name, amt) => `Hi ${name}, aapka e-mandate payment (₹${amt}) bank side se fail hua hai. Niche diye link se retry karein ya next retry ka wait karein.`,
    english: (name, amt) => `Hello ${name}, your e-mandate payment of ₹${amt} failed at the bank. Please retry using the link or wait for the next scheduled attempt.`
  },
  voice_recovery: {
    hinglish: (name, amt) => `Namaste ${name}, hum Retrek se bol rahe hain. Aapka ₹${amt} ka payment nahi ho paya. Kya aap abhi link se payment kar sakte hain?`,
    english: (name, amt) => `Hello ${name}, this is Retrek calling about your failed payment of ₹${amt}. Would you like to complete the payment now using the link we'll send you?`
  },
  ptp_commitment: {
    hinglish: (name, amt) => `Hi ${name}, aapne kal payment karne ka promise kiya tha (₹${amt}). Aaj ka din aa gaya hai — link se complete karein.`,
    english: (name, amt) => `Hello ${name}, as per your promise-to-pay commitment, your payment of ₹${amt} is now due. Please complete it using the link below.`
  },
  payment_degradation: {
    hinglish: (name, amt) => `Hi ${name}, aapka ₹${amt} ka payment complete nahi ho paya. Niche diye link se retry karein.`,
    english: (name, amt) => `Hello ${name}, your payment of ₹${amt} was unsuccessful. Please use the link below to complete your checkout.`
  }
};

/**
 * Diagnoses a payment failure using LLM inference with ISO ontology mapping,
 * computing recovery probability, root-cause categorization, and culturally tuned Hinglish messaging.
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
      reasoning_summary: "Deterministic safety invariant triggered: 0% recovery viability to prevent chargebacks and fraud."
    };
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

  try {
    const startTime = Date.now();
    const response = await groq.chat.completions.create({
      model: process.env.MODEL_NAME || "qwen/qwen3.6-27b",
      messages: [
        {
          role: "system",
          content: "You are Retrek AI, an expert payment failure diagnosis engine. Output ONLY a valid JSON object matching the requested schema."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const latencyMs = Date.now() - startTime;
    let content = response.choices[0]?.message?.content?.trim() || "{}";
    
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

    const parsed = JSON.parse(content);

    // Sanitize and bound recovery_probability
    let prob = Number(parsed.recovery_probability);
    if (isNaN(prob)) prob = calculatedBaseline;
    prob = Math.max(0.00, Math.min(1.00, prob));

    const breakdown = parsed.probability_breakdown || {
      base_probability: ontology.base_probability,
      loyalty_boost: loyaltyBoost,
      retry_penalty: retryPenalty,
      ticket_adjustment: ticketAdjustment,
      final_probability: Number(prob.toFixed(2))
    };

    return {
      transaction_id: transaction.id,
      iso_code: parsed.iso_code || ontology.iso_code,
      failure_category: parsed.failure_category || ontology.category,
      root_cause: parsed.root_cause || ontology.description,
      recovery_probability: Number(prob.toFixed(2)),
      probability_breakdown: breakdown,
      suggested_action: parsed.suggested_action || (prob >= 0.65 ? "AUTO_RETRY" : prob >= 0.50 ? "MANUAL_REVIEW" : "HARD_STOP_REFUSAL"),
      customer_message_hinglish: parsed.customer_message_hinglish || SCENARIO_FALLBACKS[scenarioType]?.hinglish(transaction.customer_name || 'there', transaction.amount) || SCENARIO_FALLBACKS.payment_degradation.hinglish(transaction.customer_name || 'there', transaction.amount),
      customer_message_english: parsed.customer_message_english || SCENARIO_FALLBACKS[scenarioType]?.english(transaction.customer_name || 'Customer', transaction.amount) || SCENARIO_FALLBACKS.payment_degradation.english(transaction.customer_name || 'Customer', transaction.amount),
      reasoning_summary: parsed.reasoning_summary || `Multi-factor actuarial assessment: Base ${ontology.base_probability} (${ontology.iso_code}) + Loyalty +${loyaltyBoost} (${pastSuccessCount} orders) - Retries -${retryPenalty} + Ticket Adj ${ticketAdjustment} = ${prob.toFixed(2)}.`,
      latency_ms: latencyMs
    };
  } catch (error) {
    console.error(`AI diagnosis exception for ${transaction.id}:`, error.message);
    // Safe Multi-Factor Fallback
    return {
      transaction_id: transaction.id,
      iso_code: ontology.iso_code,
      failure_category: ontology.category,
      root_cause: ontology.description,
      recovery_probability: calculatedBaseline,
      probability_breakdown: {
        base_probability: ontology.base_probability,
        loyalty_boost: loyaltyBoost,
        retry_penalty: retryPenalty,
        ticket_adjustment: ticketAdjustment,
        final_probability: calculatedBaseline
      },
      suggested_action: calculatedBaseline >= 0.65 ? "AUTO_RETRY" : calculatedBaseline >= 0.50 ? "MANUAL_REVIEW" : "HARD_STOP_REFUSAL",
      customer_message_hinglish: SCENARIO_FALLBACKS[scenarioType]?.hinglish(transaction.customer_name || 'there', transaction.amount) || SCENARIO_FALLBACKS.payment_degradation.hinglish(transaction.customer_name || 'there', transaction.amount),
      customer_message_english: SCENARIO_FALLBACKS[scenarioType]?.english(transaction.customer_name || 'Customer', transaction.amount) || SCENARIO_FALLBACKS.payment_degradation.english(transaction.customer_name || 'Customer', transaction.amount),
      reasoning_summary: `Multi-factor actuarial assessment: Base ${ontology.base_probability} (${ontology.iso_code}) + Loyalty +${loyaltyBoost} (${pastSuccessCount} orders) - Retries -${retryPenalty} + Ticket Adj ${ticketAdjustment} = ${calculatedBaseline}.`,
      latency_ms: 0
    };
  }
}
