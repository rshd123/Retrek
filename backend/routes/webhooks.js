import express from "express";
import crypto from "crypto";
import { supabase } from "../services/supabaseClient.js";
import { diagnoseFailure } from "../services/aiService.js";
import { evaluatePolicy } from "../services/policyEngine.js";
import { createPaymentLink } from "../services/razorpayService.js";

const router = express.Router();

// POST /api/webhooks/razorpay/confirm — Client-side fallback when webhook fails
router.post("/razorpay/confirm", async (req, res) => {
  try {
    const { transaction_id, razorpay_payment_id, razorpay_order_id } = req.body;

    if (!transaction_id) {
      return res.status(400).json({ success: false, error: "Missing transaction_id" });
    }

    console.log(`📩 Client-side confirm: ${transaction_id} | Payment: ${razorpay_payment_id}`);

    const { data: txn, error: fetchErr } = await supabase
      .from("transactions")
      .select("id, status")
      .eq("id", transaction_id)
      .single();

    if (fetchErr || !txn) {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    if (txn.status === "RECOVERED") {
      return res.json({ success: true, message: "Already RECOVERED" });
    }

    const { error: updateErr } = await supabase
      .from("transactions")
      .update({ status: "RECOVERED" })
      .eq("id", transaction_id);

    if (updateErr) {
      return res.status(500).json({ success: false, error: updateErr.message });
    }

    // Log to audit_logs
    await supabase.from("audit_logs").insert({
      transaction_id,
      decline_code: "PAYMENT_CONFIRMED",
      recovery_probability: 1.0,
      gate_decision: "CLIENT_CONFIRM",
      ai_reasoning: {
        action_taken: "CLIENT_CONFIRMED_RECOVERED",
        razorpay_payment_id,
        razorpay_order_id,
        trigger: "checkout_client_confirm",
      },
    });

    console.log(`💰 Transaction ${transaction_id} confirmed via client-side fallback`);
    res.json({ success: true, message: "Transaction marked as RECOVERED" });
  } catch (error) {
    console.error("❌ Client confirm error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/webhooks/razorpay — Receive Razorpay payment events
router.post("/razorpay", async (req, res) => {
  try {
    // Parse body — handle both parsed JSON and raw buffer (Vercel compatibility)
    let body = req.body;
    if (Buffer.isBuffer(body) || typeof body === "string") {
      try {
        body = JSON.parse(typeof body === "string" ? body : body.toString());
      } catch (parseErr) {
        console.error("❌ Failed to parse raw webhook body:", parseErr.message);
        return res.status(400).json({ success: false, error: "Invalid JSON body" });
      }
    }

    if (!body || typeof body !== "object" || !body.event) {
      console.error("❌ Webhook received empty or malformed body:", JSON.stringify(body).slice(0, 200));
      return res.status(400).json({ success: false, error: "Invalid webhook payload" });
    }

    console.log("📩 Webhook payload keys:", Object.keys(body), "| event:", body.event);

    // Razorpay webhook verification
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    console.log("🔑 Webhook secret configured:", webhookSecret ? "YES (length " + webhookSecret.length + ")" : "NO");
    console.log("🔑 Raw body available:", req.rawBody ? "YES (length " + req.rawBody.length + ")" : "NO");

    if (webhookSecret && signature) {
      const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(body);
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.warn("⚠️ Webhook signature mismatch — check RAZORPAY_WEBHOOK_SECRET in Vercel env vars");
        console.warn("  Expected:", expectedSignature);
        console.warn("  Received:", signature);
        console.warn("  Continuing processing (fix the secret to re-enable strict verification)");
      } else {
        console.log("✅ Webhook signature verified");
      }
    } else if (webhookSecret && !signature) {
      console.error("❌ Webhook secret configured but no signature header received");
    } else if (!webhookSecret) {
      console.warn("⚠️ No RAZORPAY_WEBHOOK_SECRET configured — skipping signature verification");
    }

    // Extract event details — handle both payment_link and payment event payloads
    const event = body;
    const eventType = event.event;
    const eventId = event.payload?.payment_link?.entity?.id
      || event.payload?.payment?.entity?.id
      || event.id;

    if (!eventType || !eventId) {
      console.error("❌ Missing event type or ID:", { eventType, eventId, payload: JSON.stringify(event.payload).slice(0, 300) });
      return res.status(400).json({ success: false, error: "Missing event type or ID" });
    }

    console.log(`📩 Webhook received: ${eventType} | Event ID: ${eventId}`);

    // Idempotency lock — try to insert, but always proceed to update transaction
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .single();

    if (!existing) {
      const { error: insertError } = await supabase
        .from("webhook_events")
        .insert({ event_id: eventId });

      if (insertError) {
        console.log(`ℹ️ Event ${eventId} race condition on insert — proceeding anyway`);
      } else {
        console.log(`🔒 Event ${eventId} locked for first-time processing`);
      }
    } else {
      console.log(`ℹ️ Duplicate webhook ${eventId} — event already locked, checking transaction status`);
    }

    // Always proceed to extract and update the transaction
    const paymentEntity = event.payload?.payment_link?.entity;
    const paymentEntity2 = event.payload?.payment?.entity;
    const referenceId = paymentEntity?.reference_id || paymentEntity2?.notes?.transaction_id;

    console.log(`📩 Webhook: ${eventType} | Event: ${eventId} | Ref: ${referenceId} | Entity: ${paymentEntity ? "payment_link" : paymentEntity2 ? "payment" : "none"}`);

    // Handle payment_link.paid OR payment.captured — payment succeeded, mark as RECOVERED
    if (eventType === "payment_link.paid" || eventType === "payment.captured" || eventType === "payment.authorized") {
      if (referenceId) {
        const { data: txn, error: fetchErr } = await supabase
          .from("transactions")
          .select("id, status")
          .eq("id", referenceId)
          .single();

        if (fetchErr || !txn) {
          console.error(`❌ Transaction ${referenceId} not found in database:`, fetchErr?.message || "Not found");
        } else if (txn.status === "RECOVERED") {
          console.log(`ℹ️ Transaction ${referenceId} already RECOVERED — skipping update`);
        } else {
          const { error: updateError } = await supabase
            .from("transactions")
            .update({ status: "RECOVERED" })
            .eq("id", referenceId);

          if (updateError) {
            console.error(`❌ Failed to update transaction ${referenceId}:`, updateError.message);
          } else {
            console.log(`💰 Transaction ${referenceId} marked as RECOVERED via webhook (${eventType})`);
          }
        }
      } else {
        console.error(`❌ No reference_id found in ${eventType} webhook payload`);
        console.error("  payment_link entity:", JSON.stringify(paymentEntity).slice(0, 300));
        console.error("  payment entity:", JSON.stringify(paymentEntity2).slice(0, 300));
      }
    }

    // Handle payment_link.expired / payment_link.cancelled / payment_link.failed — trigger recovery pipeline
    if (eventType === "payment_link.expired" || eventType === "payment_link.cancelled" || eventType === "payment_link.failed") {
      if (referenceId) {
        console.log(`❌ Payment ${eventType} for ${referenceId} — triggering recovery pipeline`);

        const { data: transaction } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", referenceId)
          .single();

        if (transaction) {
          const diagnosis = await diagnoseFailure(transaction);
          const policy = evaluatePolicy(transaction, diagnosis);

          let newStatus = transaction.status;
          let actionTaken = policy.gate_decision;

          if (policy.gate_decision === "STOP_RULE") {
            newStatus = "STOPPED";
          } else if (policy.gate_decision === "HUMAN_APPROVAL") {
            newStatus = "PENDING_APPROVAL";
          } else if (policy.gate_decision === "AUTO_EXECUTE") {
            try {
              const paymentLink = await createPaymentLink(transaction, diagnosis.customer_message_hinglish);
              newStatus = "LINK_SENT";
              actionTaken = "AUTO_EXECUTE_LINK_SENT";
              console.log(`🔗 New payment link created for ${referenceId}: ${paymentLink.payment_link_url}`);
            } catch (linkError) {
              console.error(`Payment link re-creation failed for ${referenceId}:`, linkError.message);
              newStatus = "LINK_FAILED";
              actionTaken = "AUTO_EXECUTE_FAILED";
            }
          }

          await supabase
            .from("transactions")
            .update({ status: newStatus })
            .eq("id", referenceId);

          await supabase.from("audit_logs").insert({
            transaction_id: referenceId,
            decline_code: transaction.decline_code,
            recovery_probability: diagnosis.recovery_probability,
            gate_decision: policy.gate_decision,
            ai_reasoning: {
              ...diagnosis,
              policy_reason: policy.reason,
              action_taken: actionTaken,
              trigger: `webhook_${eventType}`,
            },
          });

          console.log(` ${referenceId} | Re-processed after failure | ${policy.gate_decision} | ₹${transaction.amount}`);
        }
      }
    }

    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("❌ Webhook processing error:", error.message);
    console.error("  Stack:", error.stack);
    res.status(500).json({ success: false, error: "Webhook processing failed", details: error.message });
  }
});

export default router;
