/**
 * Deterministic Policy Engine — Safety guardrails for Retrek recovery actions.
 * The AI recommends. This engine decides. Non-negotiable rules, no LLM calls.
 */

// Scenario-specific policy overrides
const SCENARIO_OVERRIDES = {
  b2b_receivables: {
    autoExecuteLimit: 50000,
    maxRetries: 5,
    description: "B2B receivables: raised auto-execute limit to ₹50,000 for trusted vendors"
  },
  subscription_failure: {
    maxRetries: 4,
    description: "Subscription: extended retry limit to 4 for service continuity"
  },
  mandate_retry: {
    maxRetries: 5,
    description: "Mandate retry: extended retry limit to 5 for NACH reactivation"
  },
  checkout_dropoff: {
    maxRetries: 3,
    description: "Checkout drop-off: standard retry limit"
  },
  voice_recovery: {
    maxRetries: 2,
    description: "Voice recovery: reduced retry limit to prevent call fatigue"
  },
  ptp_commitment: {
    maxRetries: 2,
    description: "PTP: reduced retry limit, commitment-based follow-up"
  },
  payment_degradation: {
    maxRetries: 3,
    description: "Payment degradation: standard retry limit"
  }
};

/**
 * Evaluates a transaction + AI diagnosis against deterministic safety rules.
 * @param {Object} transaction - { id, amount, decline_code, retry_count, past_success_count, status, scenario_type, ptp_date }
 * @param {Object} aiDiagnosis - { recovery_probability, failure_category, suggested_action, ... }
 * @returns {{ gate_decision: "AUTO_EXECUTE" | "HUMAN_APPROVAL" | "STOP_RULE", reason: string, scenario_type: string }}
 */
export function evaluatePolicy(transaction, aiDiagnosis) {
  const amount = Number(transaction.amount) || 0;
  const retryCount = Number(transaction.retry_count) || 0;
  const probability = Number(aiDiagnosis.recovery_probability) ?? 0;
  const category = (aiDiagnosis.failure_category || "").toUpperCase();
  const suggested = (aiDiagnosis.suggested_action || "").toUpperCase();
  const scenarioType = transaction.scenario_type || "payment_degradation";
  const pastSuccessCount = Number(transaction.past_success_count) || 0;
  const overrides = SCENARIO_OVERRIDES[scenarioType] || SCENARIO_OVERRIDES.payment_degradation;

  // Gate 3: STOP RULE — hard stop conditions (checked first)
  if (probability < 0.50) {
    return {
      gate_decision: "STOP_RULE",
      reason: `Recovery probability ${(probability * 100).toFixed(0)}% is below 50% threshold. Stopping recovery to prevent customer spam.`,
      scenario_type: scenarioType,
    };
  }

  if (retryCount >= overrides.maxRetries) {
    return {
      gate_decision: "STOP_RULE",
      reason: `Retry count ${retryCount} has reached the maximum limit of ${overrides.maxRetries} attempts (${overrides.description}). Stopping recovery.`,
      scenario_type: scenarioType,
    };
  }

  if (category === "FRAUD_OR_SECURITY_RISK" || suggested === "HARD_STOP_REFUSAL") {
    return {
      gate_decision: "STOP_RULE",
      reason: `Transaction flagged as ${category} or hard stop refusal. Zero-tolerance fraud policy activated.`,
      scenario_type: scenarioType,
    };
  }

  // PTP commitment: if ptp_date is in the future, stop (not yet due)
  if (scenarioType === "ptp_commitment" && transaction.ptp_date) {
    const ptpDate = new Date(transaction.ptp_date);
    const now = new Date();
    if (ptpDate > now) {
      return {
        gate_decision: "STOP_RULE",
        reason: `Promise-to-pay date ${transaction.ptp_date} is in the future. Recovery not yet due.`,
        scenario_type: scenarioType,
      };
    }
  }

  // Gate 2: HUMAN APPROVAL — high-value or medium-confidence cases
  const autoExecuteLimit = (scenarioType === "b2b_receivables" && pastSuccessCount >= 10)
    ? overrides.autoExecuteLimit
    : 10000;

  if (amount >= autoExecuteLimit) {
    return {
      gate_decision: "HUMAN_APPROVAL",
      reason: `Amount ₹${amount.toLocaleString("en-IN")} exceeds ${scenarioType === "b2b_receivables" && pastSuccessCount >= 10 ? "₹50,000" : "₹10,000"} threshold. Requires human swipe approval.`,
      scenario_type: scenarioType,
    };
  }

  if (probability >= 0.50 && probability < 0.65) {
    return {
      gate_decision: "HUMAN_APPROVAL",
      reason: `Recovery probability ${(probability * 100).toFixed(0)}% is in the medium-confidence range (50-65%). Requires human review.`,
      scenario_type: scenarioType,
    };
  }

  if (suggested === "MANUAL_REVIEW") {
    return {
      gate_decision: "HUMAN_APPROVAL",
      reason: `AI recommended manual review. Queued for human swipe approval.`,
      scenario_type: scenarioType,
    };
  }

  // Gate 1: AUTO EXECUTE — high-confidence, low-value, safe to retry
  return {
    gate_decision: "AUTO_EXECUTE",
    reason: `Recovery probability ${(probability * 100).toFixed(0)}%, amount ₹${amount.toLocaleString("en-IN")}, retry count ${retryCount}/${overrides.maxRetries}. All safety thresholds passed. Auto-executing recovery.`,
    scenario_type: scenarioType,
  };
}
