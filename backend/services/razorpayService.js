import "dotenv/config";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.TEST_API_KEY,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Creates a Razorpay Payment Link for recovery.
 * @param {Object} transaction - { id, amount, customer_name }
 * @param {string} message - Hinglish outreach message for the customer
 * @returns {{ payment_link_url: string, payment_link_id: string }}
 */
export async function createPaymentLink(transaction, message) {
  try {
    const amountInPaise = Math.round(Number(transaction.amount) * 100);

    const paymentLink = await razorpay.paymentLink.create({
      amount: amountInPaise,
      currency: "INR",
      reference_id: transaction.id,
      description: `Retrek Recovery — Retry your failed payment of ₹${transaction.amount}`,
      customer: {
        name: transaction.customer_name || "Customer",
      },
      notify: {
        sms: true,
        email: true,
      },
      notes: {
        transaction_id: transaction.id,
        recovery_reason: message || "Payment retry",
        source: "retrek_auto_recovery",
      },
    });

    console.log(`✅ Payment link created for ${transaction.id}: ${paymentLink.short_url}`);

    return {
      payment_link_url: paymentLink.short_url,
      payment_link_id: paymentLink.id,
    };
  } catch (error) {
    console.error(`❌ Payment link creation failed for ${transaction.id}:`, error.message);
    throw new Error(`Razorpay payment link creation failed: ${error.message}`);
  }
}
