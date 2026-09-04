import { supabase } from "./supabaseClient.js";
import { diagnoseFailure } from "./aiService.js";
import { evaluatePolicy } from "./policyEngine.js";
import { createPaymentLink } from "./razorpayService.js";

/**
 * Shared Recovery Pipeline — Single source of truth for the full lifecycle:
 * Fetch → AI Diagnosis → Policy Gate → Act → Update Status → Audit Log
 *
 * Used by: transactions.js, webhooks.js, schedulerService.js
 */

/**
 * Process a single transaction through the complete recovery pipeline.
 * @param {string} transactionId - The transaction ID to process
 * @param {Object} [options] - Optional overrides
 * @param {string} [options.source] - Source identifier for audit trail (e.g., "webhook", "scheduler", "api")
 * @param {Object} [options.transaction] - Pre-fetched transaction data (skips DB fetch if provided)
 * @param {number} [options.retryCountOverride] - Override retry_count (e.g., webhook incrementing)
 * @returns {Object} Pipeline result with full diagnosis, policy, and action details
 */
export async function processTransactionPipeline(transactionId, options = {}) {
  const { source = "api", transaction: preFetchedTx, retryCountOverride } = options;
  const pipelineStart = Date.now();

  // 1. Fetch transaction from DB (or use pre-fetched)
  let transaction = preFetchedTx;
  if (!transaction) {
    const { data, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchError || !data) {
      throw new Error(`Transaction ${transactionId} not found: ${fetchError?.message || "Not found"}`);
    }
    transaction = data;
  }

  // Apply retry count override if provided (e.g., webhook increments before calling)
  if (retryCountOverride !== undefined) {
    transaction = { ...transaction, retry_count: retryCountOverride };
  }

  // 2. AI Diagnosis (Groq LLM + ISO ontology)
  const diagnosis = await diagnoseFailure(transaction);

  // 3. Deterministic Policy Gate (no LLM calls)
  const policy = evaluatePolicy(transaction, diagnosis);

  // 4. Act based on gate decision
  let actionTaken = policy.gate_decision;
  let paymentLink = null;
  let newStatus = transaction.status;

  if (policy.gate_decision === "STOP_RULE") {
    newStatus = "STOPPED";
  } else if (policy.gate_decision === "HUMAN_APPROVAL") {
    newStatus = "PENDING_APPROVAL";
  } else if (policy.gate_decision === "AUTO_EXECUTE") {
    try {
      paymentLink = await createPaymentLink(transaction, diagnosis.customer_message_hinglish);
      newStatus = "LINK_SENT";
      actionTaken = "AUTO_EXECUTE_LINK_SENT";
    } catch (linkError) {
      console.error(`[Pipeline] Payment link creation failed for ${transactionId}: ${linkError.message}`);
      newStatus = "LINK_FAILED";
      actionTaken = "AUTO_EXECUTE_FAILED";
    }
  }

  // 5. Update transaction status in DB
  const updateFields = { status: newStatus };
  if (retryCountOverride !== undefined) {
    updateFields.retry_count = retryCountOverride;
  }
  if (paymentLink?.payment_link_url) {
    updateFields.payment_link_url = paymentLink.payment_link_url;
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update(updateFields)
    .eq("id", transactionId);

  if (updateError) {
    console.error(`[Pipeline] DB update failed for ${transactionId}: ${updateError.message}`);
    throw new Error(`Failed to update transaction status: ${updateError.message}`);
  }

  // 6. Immutable Audit Log Entry
  const { error: auditError } = await supabase.from("audit_logs").insert({
    transaction_id: transactionId,
    decline_code: transaction.decline_code,
    recovery_probability: diagnosis.recovery_probability,
    gate_decision: policy.gate_decision,
    ai_reasoning: {
      ...diagnosis,
      policy_reason: policy.reason,
      action_taken: actionTaken,
      payment_link_url: paymentLink?.payment_link_url || null,
      source,
      pipeline_latency_ms: Date.now() - pipelineStart,
    },
  });

  if (auditError) {
    console.error(`[Pipeline] Audit log insert failed for ${transactionId}: ${auditError.message}`);
  }

  const pipelineLatencyMs = Date.now() - pipelineStart;
  console.log(
    `[Pipeline] ${transactionId} | ${policy.gate_decision} | ₹${transaction.amount} | ` +
    `Prob: ${diagnosis.recovery_probability} | AI: ${diagnosis.latency_ms}ms | Pipeline: ${pipelineLatencyMs}ms | ${source}`
  );

  return {
    transaction_id: transactionId,
    amount: transaction.amount,
    decline_code: transaction.decline_code,
    scenario_type: transaction.scenario_type || "payment_degradation",
    gate_decision: policy.gate_decision,
    policy_reason: policy.reason,
    recovery_probability: diagnosis.recovery_probability,
    probability_breakdown: diagnosis.probability_breakdown,
    iso_code: diagnosis.iso_code,
    failure_category: diagnosis.failure_category,
    root_cause: diagnosis.root_cause,
    reasoning_summary: diagnosis.reasoning_summary,
    customer_message_hinglish: diagnosis.customer_message_hinglish,
    customer_message_english: diagnosis.customer_message_english,
    action_taken: actionTaken,
    payment_link_url: paymentLink?.payment_link_url || null,
    status: newStatus,
    latency_ms: {
      ai: diagnosis.latency_ms || 0,
      pipeline: pipelineLatencyMs,
    },
  };
}
