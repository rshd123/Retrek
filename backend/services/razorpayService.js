import "dotenv/config";

const RAZORPAY_API_KEY = process.env.TEST_API_KEY;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_BASE = "https://api.razorpay.com/v1";

/**
 * Creates a Razorpay Payment Link via REST API.
 * @param {Object} transaction - { id, amount, customer_name }
 * @param {string} message - Hinglish outreach message for the customer
 * @returns {{ payment_link_url: string, payment_link_id: string }}
 */
export async function createPaymentLink(transaction, message) {
  const amountInPaise = Math.round(Number(transaction.amount) * 100);

  const payload = {
    amount: amountInPaise,
    currency: "INR",
    description: `Retrek Recovery — Retry payment of ₹${transaction.amount}`,
    reference_id: `${transaction.id}_${Date.now()}`,
    notes: {
      transaction_id: transaction.id,
      source: "retrek_auto_recovery",
    },
  };

  const credentials = Buffer.from(`${RAZORPAY_API_KEY}:${RAZORPAY_KEY_SECRET}`).toString("base64");

  const response = await fetch(`${RAZORPAY_BASE}/payment_links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data.error?.description || JSON.stringify(data);
    console.error(`❌ Razorpay API ${response.status}: ${errMsg}`);
    throw new Error(`Razorpay API ${response.status}: ${errMsg}`);
  }

  console.log(`✅ Payment link created for ${transaction.id}: ${data.short_url || data.id}`);

  return {
    payment_link_url: data.short_url || `https://rzp.io/i/${data.id}`,
    payment_link_id: data.id,
  };
}
