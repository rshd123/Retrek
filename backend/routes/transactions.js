import express from "express";
import { supabase } from "../services/supabaseClient.js";
import { diagnoseFailure } from "../services/aiService.js";
import { evaluatePolicy } from "../services/policyEngine.js";
import { createPaymentLink } from "../services/razorpayService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process a single transaction through the full real-time pipeline:
 * AI Diagnosis → Policy Gate → Act → Audit Log
 */
async function processTransaction(transactionId) {
  // 1. Fetch transaction from DB
  const { data: transaction, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (fetchError || !transaction) {
    throw new Error(`Transaction ${transactionId} not found: ${fetchError?.message}`);
  }

  // 2. AI Diagnosis
  const diagnosis = await diagnoseFailure(transaction);

  // 3. Policy Gate
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
      console.error(`Payment link failed for ${transactionId}:`, linkError.message);
      newStatus = "LINK_FAILED";
      actionTaken = "AUTO_EXECUTE_FAILED";
    }
  }

  // 5. Update transaction status in DB
  await supabase
    .from("transactions")
    .update({ status: newStatus })
    .eq("id", transactionId);

  // 6. Log to audit_logs
  await supabase.from("audit_logs").insert({
    transaction_id: transactionId,
    decline_code: transaction.decline_code,
    recovery_probability: diagnosis.recovery_probability,
    gate_decision: policy.gate_decision,
    ai_reasoning: {
      ...diagnosis,
      policy_reason: policy.reason,
      action_taken: actionTaken,
      payment_link_url: paymentLink?.payment_link_url || null,
    },
  });

  console.log(
    `📋 ${transactionId} | ${policy.gate_decision} | ₹${transaction.amount} | Prob: ${diagnosis.recovery_probability} | ${policy.reason}`
  );

  return {
    transaction_id: transactionId,
    amount: transaction.amount,
    decline_code: transaction.decline_code,
    gate_decision: policy.gate_decision,
    policy_reason: policy.reason,
    recovery_probability: diagnosis.recovery_probability,
    root_cause: diagnosis.root_cause,
    customer_message_hinglish: diagnosis.customer_message_hinglish,
    customer_message_english: diagnosis.customer_message_english,
    action_taken: actionTaken,
    payment_link_url: paymentLink?.payment_link_url || null,
    status: newStatus,
  };
}

// POST /api/transactions/seed — Seed synthetic data and process each transaction
router.post("/seed", async (req, res) => {
  try {
    const dataPath = path.join(__dirname, "../data/batch_transactions.json");

    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({
        success: false,
        error: "batch_transactions.json file not found in backend/data/",
      });
    }

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const transactions = JSON.parse(rawData);

    // Step 1: Seed all transactions into DB
    const seededIds = [];
    for (const tx of transactions) {
      const { error } = await supabase.from("transactions").upsert({
        id: tx.id,
        amount: tx.amount,
        decline_code: tx.decline_code,
        retry_count: tx.retry_count,
        past_success_count: tx.past_success_count,
        status: tx.status || "FAILED",
        customer_name: tx.customer_name,
      });

      if (error) {
        throw new Error(`Failed to seed transaction ${tx.id}: ${error.message}`);
      }
      seededIds.push(tx.id);
    }

    // Step 2: Process each transaction through the real-time pipeline
    const results = [];
    for (const txId of seededIds) {
      try {
        const result = await processTransaction(txId);
        results.push(result);
      } catch (processError) {
        console.error(`Processing failed for ${txId}:`, processError.message);
        results.push({
          transaction_id: txId,
          error: processError.message,
        });
      }
    }

    // Summarize decisions
    const summary = {
      total: results.length,
      auto_execute: results.filter((r) => r.gate_decision === "AUTO_EXECUTE").length,
      human_approval: results.filter((r) => r.gate_decision === "HUMAN_APPROVAL").length,
      stopped: results.filter((r) => r.gate_decision === "STOP_RULE").length,
      failed: results.filter((r) => r.error).length,
    };

    res.json({
      success: true,
      message: `Seeded and processed ${seededIds.length} transactions.`,
      summary,
      results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/transactions/ingest — Ingest a single failed payment payload
router.post("/ingest", async (req, res) => {
  try {
    const { id, amount, decline_code, customer_name, retry_count, past_success_count } = req.body;

    if (!id || amount === undefined || !decline_code) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: id, amount, decline_code",
      });
    }

    const { data, error } = await supabase
      .from("transactions")
      .upsert({
        id,
        amount,
        decline_code,
        retry_count: retry_count || 0,
        past_success_count: past_success_count || 0,
        status: "FAILED",
        customer_name: customer_name || "Customer",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to ingest transaction: ${error.message}`);
    }

    res.status(201).json({
      success: true,
      message: `Transaction ${id} ingested successfully.`,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/transactions/:id/process — Process a single transaction through the full pipeline
router.post("/:id/process", async (req, res) => {
  try {
    const result = await processTransaction(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/transactions — Fetch all transactions
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/transactions/:id — Fetch a single transaction
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ success: false, error: "Transaction not found" });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
