import "dotenv/config";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

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
  const prompt = `You are Retrek AI, an enterprise revenue recovery diagnosis engine for Indian commerce.
Analyze this payment failure and return ONLY a valid JSON object matching the schema below.

Transaction Telemetry:
- Transaction ID: ${transaction.id}
- Amount: ₹${transaction.amount}
- Customer Name: ${transaction.customer_name || "Customer"}
- Gateway Decline Code: ${transaction.decline_code}
- ISO Standard: ${ontology.iso_code} (${ontology.description})
- Retry Count: ${transaction.retry_count || 0}
- Customer Past Success Orders: ${transaction.past_success_count || 0}

Required JSON Output Schema:
{
  "transaction_id": "${transaction.id}",
  "iso_code": "${ontology.iso_code}",
  "failure_category": "${ontology.category}",
  "root_cause": "<technical diagnosis of why the transaction failed>",
  "recovery_probability": <number between 0.00 and 1.00 combining failure type, past successes (+0.02 per order), and retry penalty (-0.20 per retry)>,
  "suggested_action": "AUTO_RETRY" | "MANUAL_REVIEW" | "HARD_STOP_REFUSAL",
  "customer_message_hinglish": "<empathetic, natural Hinglish recovery text for WhatsApp/SMS mentioning the customer name and amount>",
  "customer_message_english": "<polite formal English recovery text>",
  "reasoning_summary": "<concise explanation of probability and decision logic>"
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
      max_tokens: 3000,
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
    if (isNaN(prob)) prob = ontology.base_probability;
    prob = Math.max(0.00, Math.min(1.00, prob));

    return {
      transaction_id: transaction.id,
      iso_code: parsed.iso_code || ontology.iso_code,
      failure_category: parsed.failure_category || ontology.category,
      root_cause: parsed.root_cause || ontology.description,
      recovery_probability: Number(prob.toFixed(2)),
      suggested_action: parsed.suggested_action || (prob >= 0.80 ? "AUTO_RETRY" : prob >= 0.50 ? "MANUAL_REVIEW" : "HARD_STOP_REFUSAL"),
      customer_message_hinglish: parsed.customer_message_hinglish || `Hi ${transaction.customer_name || 'there'}, aapka ₹${transaction.amount} ka payment complete nahi ho paya. Niche diye link se retry karein.`,
      customer_message_english: parsed.customer_message_english || `Hello ${transaction.customer_name || 'Customer'}, your payment of ₹${transaction.amount} was unsuccessful. Please use the link below to complete your checkout.`,
      reasoning_summary: parsed.reasoning_summary || `Evaluated ${ontology.iso_code} with customer loyalty score ${transaction.past_success_count || 0}.`,
      latency_ms: latencyMs
    };
  } catch (error) {
    console.error(`AI diagnosis exception for ${transaction.id}:`, error.message);
    // Safe Zero-Risk Fallback
    return {
      transaction_id: transaction.id,
      iso_code: ontology.iso_code,
      failure_category: ontology.category,
      root_cause: ontology.description,
      recovery_probability: Number(ontology.base_probability.toFixed(2)),
      suggested_action: ontology.base_probability >= 0.80 ? "AUTO_RETRY" : "MANUAL_REVIEW",
      customer_message_hinglish: `Hi ${transaction.customer_name || 'there'}, aapka ₹${transaction.amount} ka payment complete nahi ho paya. Niche diye link se retry karein.`,
      customer_message_english: `Hello ${transaction.customer_name || 'Customer'}, your payment of ₹${transaction.amount} was unsuccessful. Please retry using the secure link.`,
      reasoning_summary: `AI service fallback mode: applied default ontology mapping for ${ontology.iso_code}.`,
      latency_ms: 0
    };
  }
}
