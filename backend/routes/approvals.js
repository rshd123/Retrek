import express from "express";
import { supabase } from "../services/supabaseClient.js";
import { createPaymentLink } from "../services/razorpayService.js";

const router = express.Router();

// GET /api/approvals/pending — Fetch all transactions awaiting human approval
router.get("/pending", async (req, res) => {
  try {
    // Get pending transactions
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("status", "PENDING_APPROVAL")
      .order("created_at", { ascending: false });

    if (txError) throw new Error(txError.message);

    // Enrich with AI reasoning from audit_logs
    const enriched = [];
    for (const tx of transactions) {
      const { data: auditLog } = await supabase
        .from("audit_logs")
        .select("ai_reasoning")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      enriched.push({
        ...tx,
        ai_reasoning: auditLog?.ai_reasoning || null,
      });
    }

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/approvals/:id/approve — Approve and send payment link
router.post("/:id/approve", async (req, res) => {
  try {
    const transactionId = req.params.id;

    // Fetch transaction
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchError || !transaction) {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    if (transaction.status !== "PENDING_APPROVAL") {
      return res.status(400).json({
        success: false,
        error: `Transaction is not pending approval. Current status: ${transaction.status}`,
      });
    }

    // Fetch the AI reasoning for the customer message
    const { data: auditLog } = await supabase
      .from("audit_logs")
      .select("ai_reasoning")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const customerMessage = auditLog?.ai_reasoning?.customer_message_hinglish || "";

    // Create payment link
    const paymentLink = await createPaymentLink(transaction, customerMessage);

    // Update transaction status
    await supabase
      .from("transactions")
      .update({ status: "LINK_SENT" })
      .eq("id", transactionId);

    // Log to audit_logs
    await supabase.from("audit_logs").insert({
      transaction_id: transactionId,
      decline_code: transaction.decline_code,
      recovery_probability: auditLog?.ai_reasoning?.recovery_probability || 0,
      gate_decision: "AUTO_EXECUTE",
      ai_reasoning: {
        ...auditLog?.ai_reasoning,
        action_taken: "HUMAN_APPROVED_LINK_SENT",
        approved_by: "human_swipe",
        payment_link_url: paymentLink.payment_link_url,
      },
    });

    res.json({
      success: true,
      message: `Transaction ${transactionId} approved and payment link sent.`,
      data: {
        transaction_id: transactionId,
        status: "LINK_SENT",
        payment_link_url: paymentLink.payment_link_url,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/approvals/:id/decline — Decline and stop recovery
router.post("/:id/decline", async (req, res) => {
  try {
    const transactionId = req.params.id;

    // Fetch transaction
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchError || !transaction) {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    if (transaction.status !== "PENDING_APPROVAL") {
      return res.status(400).json({
        success: false,
        error: `Transaction is not pending approval. Current status: ${transaction.status}`,
      });
    }

    // Update status to STOPPED
    await supabase
      .from("transactions")
      .update({ status: "STOPPED" })
      .eq("id", transactionId);

    // Fetch existing audit log for recovery probability
    const { data: auditLog } = await supabase
      .from("audit_logs")
      .select("ai_reasoning")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Log the decline
    await supabase.from("audit_logs").insert({
      transaction_id: transactionId,
      decline_code: transaction.decline_code,
      recovery_probability: auditLog?.ai_reasoning?.recovery_probability || 0,
      gate_decision: "STOP_RULE",
      ai_reasoning: {
        ...auditLog?.ai_reasoning,
        action_taken: "HUMAN_DECLINED",
        declined_by: "human_swipe",
        reason: "Human approver declined recovery for this transaction.",
      },
    });

    res.json({
      success: true,
      message: `Transaction ${transactionId} declined. Recovery stopped.`,
      data: {
        transaction_id: transactionId,
        status: "STOPPED",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
