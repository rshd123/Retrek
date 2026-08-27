import "dotenv/config";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.LLM_API_KEY });

export async function analyzeTransaction(transaction) {
  const prompt = `You are a payment fraud analyst for Retrek (Indian e-commerce).
Analyze this transaction and return ONLY valid JSON with:
- "risk_level": "low" | "medium" | "high"
- "risk_score": 0-100
- "flags": array of risk flags
- "recommendation": "approve" | "review" | "block"
- "reason": brief explanation

Transaction:
- ID: ${transaction.id}
- Amount: ₹${transaction.amount}
- Customer: ${transaction.customer_name} (${transaction.customer_id})
- Method: ${transaction.method}
- Status: ${transaction.status}
- Description: ${transaction.description}

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await groq.chat.completions.create({
      model: process.env.MODEL_NAME || "qwen/qwen3.6-27b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();
    return JSON.parse(content);
  } catch (error) {
    console.error(`AI analysis failed for ${transaction.id}:`, error.message);
    return {
      risk_level: "medium",
      risk_score: 50,
      flags: ["AI_UNAVAILABLE"],
      recommendation: "review",
      reason: "AI service unavailable, defaulting to manual review",
    };
  }
}

export async function batchAnalyze(transactions) {
  const results = [];
  for (const txn of transactions) {
    const analysis = await analyzeTransaction(txn);
    results.push({ ...txn, analysis });
  }
  return results;
}
