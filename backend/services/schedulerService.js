import { supabase } from "./supabaseClient.js";
import { diagnoseFailure } from "./aiService.js";
import { evaluatePolicy } from "./policyEngine.js";
import { createPaymentLink } from "./razorpayService.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const STALE_LINK_HOURS = 24;

/**
 * Process a single transaction through the full pipeline (scheduler version).
 * Mirrors the pipeline in transactions.js but called from the scheduler.
 */
async function processTransaction(transactionId) {
  const { data: transaction, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (fetchError || !transaction) {
    throw new Error(`Transaction ${transactionId} not found: ${fetchError?.message}`);
  }

  const diagnosis = await diagnoseFailure(transaction);
  const policy = evaluatePolicy(transaction, diagnosis);

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
      console.error(`[Scheduler] Payment link failed for ${transactionId}:`, linkError.message);
      newStatus = "LINK_FAILED";
      actionTaken = "AUTO_EXECUTE_FAILED";
    }
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ status: newStatus })
    .eq("id", transactionId);

  if (updateError) {
    throw new Error(`Failed to update transaction status: ${updateError.message}`);
  }

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
      source: "scheduler",
    },
  });

  if (auditError) {
    console.error(`[Scheduler] Audit log insert failed for ${transactionId}:`, auditError.message);
  }

  return {
    transaction_id: transactionId,
    gate_decision: policy.gate_decision,
    action_taken: actionTaken,
    recovery_probability: diagnosis.recovery_probability,
  };
}

/**
 * Check mandate_retry scenarios where next_retry_at has passed.
 * Re-runs the pipeline for eligible transactions.
 */
async function checkMandateRetries() {
  const now = new Date().toISOString();
  const { data: mandates, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("scenario_type", "mandate_retry")
    .in("status", ["FAILED", "STOPPED"])
    .lte("next_retry_at", now)
    .limit(10);

  if (error) {
    console.error("[Scheduler] Mandate retry query failed:", error.message);
    return [];
  }

  const results = [];
  for (const tx of mandates || []) {
    try {
      const result = await processTransaction(tx.id);
      results.push({ ...tx, success: true, ...result });
      console.log(`[Scheduler] Mandate retry processed: ${tx.id}`);
    } catch (err) {
      results.push({ id: tx.id, success: false, error: err.message });
      console.error(`[Scheduler] Mandate retry failed for ${tx.id}:`, err.message);
    }
  }
  return results;
}

/**
 * Check ptp_commitment scenarios where ptp_date has arrived.
 * Re-runs the pipeline for eligible transactions.
 */
async function checkPTPCommitments() {
  const now = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const { data: ptps, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("scenario_type", "ptp_commitment")
    .in("status", ["FAILED", "STOPPED"])
    .lte("ptp_date", now)
    .limit(10);

  if (error) {
    console.error("[Scheduler] PTP commitment query failed:", error.message);
    return [];
  }

  const results = [];
  for (const tx of ptps || []) {
    try {
      const result = await processTransaction(tx.id);
      results.push({ ...tx, success: true, ...result });
      console.log(`[Scheduler] PTP commitment processed: ${tx.id}`);
    } catch (err) {
      results.push({ id: tx.id, success: false, error: err.message });
      console.error(`[Scheduler] PTP commitment failed for ${tx.id}:`, err.message);
    }
  }
  return results;
}

/**
 * Verify recovery attempts: find LINK_SENT older than 24h and mark as EXPIRED.
 * Re-diagnoses the transaction for a second recovery attempt.
 */
async function verifyRecoveryAttempts() {
  const cutoff = new Date(Date.now() - STALE_LINK_HOURS * 60 * 60 * 1000).toISOString();
  const { data: staleLinks, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("status", "LINK_SENT")
    .lt("created_at", cutoff)
    .limit(10);

  if (error) {
    console.error("[Scheduler] Stale link query failed:", error.message);
    return [];
  }

  const results = [];
  for (const tx of staleLinks || []) {
    try {
      // Mark as expired first
      await supabase
        .from("transactions")
        .update({ status: "EXPIRED" })
        .eq("id", tx.id);

      // Increment retry count
      const { data: current } = await supabase
        .from("transactions")
        .select("retry_count")
        .eq("id", tx.id)
        .single();

      await supabase
        .from("transactions")
        .update({ retry_count: (current?.retry_count || 0) + 1 })
        .eq("id", tx.id);

      // Re-run pipeline
      const result = await processTransaction(tx.id);
      results.push({ ...tx, success: true, ...result });
      console.log(`[Scheduler] Stale link verified and re-processed: ${tx.id}`);
    } catch (err) {
      results.push({ id: tx.id, success: false, error: err.message });
      console.error(`[Scheduler] Stale link verification failed for ${tx.id}:`, err.message);
    }
  }
  return results;
}

/**
 * Run all scheduler checks in sequence.
 */
async function runSchedulerChecks() {
  console.log("[Scheduler] Running scheduled checks...");
  const mandateResults = await checkMandateRetries();
  const ptpResults = await checkPTPCommitments();
  const staleResults = await verifyRecoveryAttempts();

  console.log(
    `[Scheduler] Complete: ${mandateResults.length} mandate retries, ` +
    `${ptpResults.length} PTP commitments, ${staleResults.length} stale links processed.`
  );

  return { mandateResults, ptpResults, staleResults };
}

/**
 * Start the scheduler on an interval loop.
 * Skipped on Vercel (serverless) — only runs on standalone Node server.
 */
export function startScheduler() {
  if (process.env.VERCEL) {
    console.log("[Scheduler] Skipped on Vercel serverless.");
    return;
  }

  console.log(`[Scheduler] Starting scheduler (interval: ${CHECK_INTERVAL_MS / 1000}s)`);

  // Run once on boot after 30s delay
  setTimeout(() => {
    runSchedulerChecks().catch((err) => {
      console.error("[Scheduler] Initial check failed:", err.message);
    });
  }, 30000);

  // Then run on interval
  setInterval(() => {
    runSchedulerChecks().catch((err) => {
      console.error("[Scheduler] Periodic check failed:", err.message);
    });
  }, CHECK_INTERVAL_MS);
}
