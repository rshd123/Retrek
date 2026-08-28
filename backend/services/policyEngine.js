/**
 * Deterministic Policy Engine — Safety guardrails for Retrek recovery actions.
 * The AI recommends. This engine decides. Non-negotiable rules, no LLM calls.
 */

/**
 * Evaluates a transaction + AI diagnosis against deterministic safety rules.
 * @param {Object} transaction - { id, amount, decline_code, retry_count, past_success_count, status }
 * @param {Object} aiDiagnosis - { recovery_probability, failure_category, suggested_action, ... }
 * @returns {{ gate_decision: "AUTO_EXECUTE" | "HUMAN_APPROVAL" | "STOP_RULE", reason: string }}
 */
export function evaluatePolicy(transaction, aiDiagnosis) {
  const amount = Number(transaction.amount) || 0;
  const retryCount = Number(transaction.retry_count) || 0;
  const probability = Number(aiDiagnosis.recovery_probability) ?? 0;
  const category = (aiDiagnosis.failure_category || "").toUpperCase();
  const suggested = (aiDiagnosis.suggested_action || "").toUpperCase();

  // Gate 3: STOP RULE — hard stop conditions (checked first)
  if (probability < 0.50) {
    return {
      gate_decision: "STOP_RULE",
      reason: `Recovery probability ${(probability * 100).toFixed(0)}% is below 50% threshold. Stopping recovery to prevent customer spam.`,
    };
  }

  if (retryCount >= 3) {
    return {
      gate_decision: "STOP_RULE",
      reason: `Retry count ${retryCount} has reached the maximum limit of 3 attempts. Stopping recovery.`,
    };
  }

  if (category === "FRAUD_OR_SECURITY_RISK" || suggested === "HARD_STOP_REFUSAL") {
    return {
      gate_decision: "STOP_RULE",
      reason: `Transaction flagged as ${category} or hard stop refusal. Zero-tolerance fraud policy activated.`,
    };
  }

  // Gate 2: HUMAN APPROVAL — high-value or medium-confidence cases
  if (amount >= 10000) {
    return {
      gate_decision: "HUMAN_APPROVAL",
      reason: `Amount ₹${amount.toLocaleString("en-IN")} exceeds ₹10,000 threshold. Requires human swipe approval.`,
    };
  }

  if (probability >= 0.50 && probability < 0.80) {
    return {
      gate_decision: "HUMAN_APPROVAL",
      reason: `Recovery probability ${(probability * 100).toFixed(0)}% is in the medium-confidence range (50-80%). Requires human review.`,
    };
  }

  if (suggested === "MANUAL_REVIEW") {
    return {
      gate_decision: "HUMAN_APPROVAL",
      reason: `AI recommended manual review. Queued for human swipe approval.`,
    };
  }

  // Gate 1: AUTO EXECUTE — high-confidence, low-value, safe to retry
  return {
    gate_decision: "AUTO_EXECUTE",
    reason: `Recovery probability ${(probability * 100).toFixed(0)}%, amount ₹${amount.toLocaleString("en-IN")}, retry count ${retryCount}. All safety thresholds passed. Auto-executing recovery.`,
  };
}
