import express from "express";
import crypto from "crypto";
import { supabase } from "../services/supabaseClient.js";
import { diagnoseFailure } from "../services/aiService.js";
import { evaluatePolicy } from "../services/policyEngine.js";
import { createPaymentLink } from "../services/razorpayService.js";

const router = express.Router();

// POST /api/webhooks/razorpay — Receive Razorpay payment events
router.post("/razorpay", async (req, res) => {
  try {
    const body = req.body;

    // Razorpay webhook verification
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(body))
        .digest("hex");

      if (signature !== expectedSignature) {
        console.warn("⚠️ Webhook signature mismatch — possible tampering");
        return res.status(400).json({ success: false, error: "Invalid signature" });
      }
    }

    // Extract event details
    const event = body;
    const eventType = event.event;
    const eventId = event.payload?.payment_link?.entity?.id || event.id;

    if (!eventType || !eventId) {
      return res.status(400).json({ success: false, error: "Missing event type or ID" });
    }

    console.log(`📩 Webhook received: ${eventType} | Event ID: ${eventId}`);

    // Idempotency check — has this event been processed before?
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .single();

    if (existing) {
      console.log(`ℹ️ Duplicate webhook ${eventId} — already processed, returning 200 OK`);
      return res.status(200).json({ success: true, message: "Already processed" });
    }

    // Insert event to lock idempotency
    const { error: insertError } = await supabase
      .from("webhook_events")
      .insert({ event_id: eventId });

    if (insertError) {
      // Race condition — another request already inserted this event
      console.log(`ℹ️ Race condition on ${eventId} — another request handled it`);
      return res.status(200).json({ success: true, message: "Already processed" });
    }

    const paymentEntity = event.payload?.payment_link?.entity;
    const referenceId = paymentEntity?.reference_id; // Our transaction ID

    // Handle payment_link.paid — payment succeeded, mark as RECOVERED
    if (eventType === "payment_link.paid") {
      if (referenceId) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ status: "RECOVERED" })
          .eq("id", referenceId);

        if (updateError) {
          console.error(`Failed to update transaction ${referenceId}:`, updateError.message);
        } else {
          console.log(`💰 Transaction ${referenceId} marked as RECOVERED via webhook`);
        }
      }
    }

    // Handle payment_link.expired / payment_link.cancelled — payment failed, trigger recovery pipeline
    if (eventType === "payment_link.expired" || eventType === "payment_link.cancelled") {
      if (referenceId) {
        console.log(`❌ Payment ${eventType} for ${referenceId} — triggering recovery pipeline`);

        // Fetch the transaction
        const { data: transaction } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", referenceId)
          .single();

        if (transaction) {
          // Re-run the pipeline: AI diagnosis → Policy gate → Action
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

          // Update transaction status
          await supabase
            .from("transactions")
            .update({ status: newStatus })
            .eq("id", referenceId);

          // Log to audit trail
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
    console.error("Webhook processing error:", error.message);
    // Always return 200 to Razorpay to prevent retries for processing errors
    res.status(200).json({ success: true, message: "Webhook acknowledged" });
  }
});

export default router;
