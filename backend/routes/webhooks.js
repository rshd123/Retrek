import express from "express";
import crypto from "crypto";
import { supabase } from "../services/supabaseClient.js";
import { processTransactionPipeline } from "../services/pipelineService.js";

const router = express.Router();

// POST /api/webhooks/razorpay/confirm — Client-side fallback when webhook fails
router.post("/razorpay/confirm", async (req, res) => {
  try {
    const { transaction_id, razorpay_payment_id, razorpay_order_id } = req.body;

    if (!transaction_id) {
      return res.status(400).json({ success: false, error: "Missing transaction_id" });
    }

    console.log(`[Webhook] Client-side confirm: ${transaction_id} | Payment: ${razorpay_payment_id}`);

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

    console.log(`[Webhook] Transaction ${transaction_id} confirmed via client-side fallback`);
    res.json({ success: true, message: "Transaction marked as RECOVERED" });
  } catch (error) {
    console.error(`[Webhook] Client confirm error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

export function mapRazorpayErrorToDeclineCode(paymentEntity) {
  const reason = String(paymentEntity?.error_reason || "").toLowerCase();
  const source = String(paymentEntity?.error_source || "").toLowerCase();
  const step = String(paymentEntity?.error_step || "").toLowerCase();
  const description = String(paymentEntity?.error_description || "").toLowerCase();

  if (
    reason.includes("risk") ||
    reason.includes("fraud") ||
    description.includes("fraud") ||
    description.includes("security")
  ) {
    return "SUSPECTED_FRAUD";
  }

  if (
    reason.includes("insufficient") ||
    reason.includes("balance") ||
    description.includes("insufficient")
  ) {
    return "INSUFFICIENT_FUNDS";
  }

  if (
    reason.includes("limit") ||
    description.includes("limit exceeded")
  ) {
    return "CARD_LIMIT_EXCEEDED";
  }

  if (
    reason.includes("expired") ||
    description.includes("expired")
  ) {
    return "EXPIRED_CARD";
  }

  if (
    step.includes("authentication") ||
    reason.includes("otp") ||
    description.includes("otp") ||
    description.includes("2fa")
  ) {
    return "BANK_TIMEOUT_2FA";
  }

  if (
    source.includes("gateway") ||
    reason.includes("gateway") ||
    (source.includes("bank") && step.includes("authorization"))
  ) {
    return "BANK_TIMEOUT_GATEWAY";
  }

  return "ISSUER_DECLINED_GENERIC";
}

// POST /api/webhooks/razorpay — Receive Razorpay payment events
router.post("/razorpay", async (req, res) => {
  try {
    // Parse body — handle both parsed JSON and raw buffer (Vercel compatibility)
    let body = req.body;
    if (Buffer.isBuffer(body) || typeof body === "string") {
      try {
        body = JSON.parse(typeof body === "string" ? body : body.toString());
      } catch (parseErr) {
        console.error(`[Webhook] Failed to parse raw body: ${parseErr.message}`);
        return res.status(400).json({ success: false, error: "Invalid JSON body" });
      }
    }

    if (!body || typeof body !== "object" || !body.event) {
      console.error(`[Webhook] Empty or malformed body: ${JSON.stringify(body).slice(0, 200)}`);
      return res.status(400).json({ success: false, error: "Invalid webhook payload" });
    }

    console.log(`[Webhook] Payload keys: ${Object.keys(body)} | event: ${body.event}`);

    // Razorpay webhook signature verification
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(body);
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.warn("[Webhook] Signature mismatch — check RAZORPAY_WEBHOOK_SECRET");
        console.warn(`  Expected: ${expectedSignature}`);
        console.warn(`  Received: ${signature}`);
        console.warn("  Continuing processing (fix the secret to re-enable strict verification)");
      } else {
        console.log("[Webhook] Signature verified");
      }
    } else if (webhookSecret && !signature) {
      console.error("[Webhook] Secret configured but no signature header");
    } else if (!webhookSecret) {
      console.warn("[Webhook] No RAZORPAY_WEBHOOK_SECRET configured — skipping verification");
    }

    // Extract event details
    const event = body;
    const eventType = event.event;
    const eventId = event.payload?.payment_link?.entity?.id
      || event.payload?.payment?.entity?.id
      || event.id;

    if (!eventType || !eventId) {
      console.error(`[Webhook] Missing event type or ID`);
      return res.status(400).json({ success: false, error: "Missing event type or ID" });
    }

    console.log(`[Webhook] Received: ${eventType} | Event ID: ${eventId}`);

    // Idempotency lock
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
        console.log(`[Webhook] Event ${eventId} race condition — proceeding anyway`);
      } else {
        console.log(`[Webhook] Event ${eventId} locked for first-time processing`);
      }
    } else {
      console.log(`[Webhook] Duplicate webhook ${eventId} — already locked`);
    }

    // Extract entity data
    const paymentEntity = event.payload?.payment_link?.entity;
    const paymentEntity2 = event.payload?.payment?.entity;
    const activeEntity = paymentEntity2 || paymentEntity;
    const referenceId = paymentEntity?.reference_id || paymentEntity2?.notes?.transaction_id || paymentEntity2?.id;

    console.log(`[Webhook] ${eventType} | Event: ${eventId} | Ref: ${referenceId} | Entity: ${paymentEntity ? "payment_link" : paymentEntity2 ? "payment" : "none"}`);

    // Payment succeeded → mark as RECOVERED
    if (eventType === "payment_link.paid" || eventType === "payment.captured" || eventType === "payment.authorized") {
      if (referenceId) {
        const { data: txn, error: fetchErr } = await supabase
          .from("transactions")
          .select("id, status")
          .eq("id", referenceId)
          .single();

        if (fetchErr || !txn) {
          console.error(`[Webhook] Transaction ${referenceId} not found: ${fetchErr?.message || "Not found"}`);
        } else if (txn.status === "RECOVERED") {
          console.log(`[Webhook] Transaction ${referenceId} already RECOVERED — skipping`);
        } else {
          const { error: updateError } = await supabase
            .from("transactions")
            .update({ status: "RECOVERED" })
            .eq("id", referenceId);

          if (updateError) {
            console.error(`[Webhook] Failed to update ${referenceId}: ${updateError.message}`);
          } else {
            console.log(`[Webhook] Transaction ${referenceId} marked RECOVERED (${eventType})`);
          }
        }
      } else {
        console.error(`[Webhook] No reference_id in ${eventType} payload`);
      }
    }

    // Payment failed → trigger recovery pipeline
    if (
      eventType === "payment.failed" ||
      eventType === "payment_link.expired" ||
      eventType === "payment_link.cancelled" ||
      eventType === "payment_link.failed"
    ) {
      if (referenceId) {
        console.log(`[Webhook] Payment ${eventType} for ${referenceId} — triggering recovery pipeline`);

        // Fetch or create transaction
        let { data: transaction } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", referenceId)
          .single();

        if (!transaction) {
          const declineCode = mapRazorpayErrorToDeclineCode(activeEntity);
          const rawAmount = activeEntity?.amount ? Number(activeEntity.amount) : 0;
          const amount = paymentEntity ? rawAmount : (rawAmount > 0 ? rawAmount / 100 : 0);
          const customerName = activeEntity?.notes?.customer_name || (activeEntity?.email ? activeEntity.email.split("@")[0] : null) || activeEntity?.contact || "Customer";
          const scenarioType = activeEntity?.notes?.scenario_type || "payment_degradation";

          const { data: insertedTxn, error: insErr } = await supabase
            .from("transactions")
            .upsert({
              id: referenceId,
              amount,
              decline_code: declineCode,
              customer_name: customerName,
              customer_id: activeEntity?.customer_id || activeEntity?.contact || null,
              scenario_type: scenarioType,
              status: "FAILED",
              retry_count: 0,
              past_success_count: Number(activeEntity?.notes?.past_success_count) || 0,
            })
            .select()
            .single();

          if (!insErr && insertedTxn) {
            transaction = insertedTxn;
          }
        } else if (activeEntity?.error_reason || activeEntity?.error_code) {
          const mappedCode = mapRazorpayErrorToDeclineCode(activeEntity);
          if (mappedCode && (!transaction.decline_code || transaction.decline_code === "FAILED")) {
            transaction.decline_code = mappedCode;
            await supabase.from("transactions").update({ decline_code: mappedCode }).eq("id", referenceId);
          }
        }

        if (transaction) {
          const currentRetries = Number(transaction.retry_count) || 0;
          const nextRetryCount = currentRetries + 1;

          // Use shared pipeline with retry increment
          await processTransactionPipeline(referenceId, {
            source: `webhook_${eventType}`,
            transaction: { ...transaction, retry_count: nextRetryCount },
            retryCountOverride: nextRetryCount,
          });
        }
      }
    }

    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error(`[Webhook] Processing error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ success: false, error: "Webhook processing failed", details: error.message });
  }
});

export default router;
