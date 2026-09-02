import "dotenv/config";

const RAZORPAY_API_KEY = process.env.TEST_API_KEY;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_BASE = "https://api.razorpay.com/v1";

/**
 * Creates a Razorpay Order via REST API (no payment link limit).
 * @param {Object} transaction - { id, amount, customer_name }
 * @param {string} message - Hinglish outreach message for the customer
 * @returns {{ checkout_url: string, order_id: string, amount: number }}
 */
export async function createPaymentLink(transaction, message) {
  const amountInPaise = Math.round(Number(transaction.amount) * 100);
  const credentials = Buffer.from(`${RAZORPAY_API_KEY}:${RAZORPAY_KEY_SECRET}`).toString("base64");

  // Step 1: Create Order
  const orderRes = await fetch(`${RAZORPAY_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt: `retrek_${transaction.id}`,
      notes: {
        transaction_id: transaction.id,
        source: "retrek_auto_recovery",
      },
    }),
  });

  const orderData = await orderRes.json();

  if (!orderRes.ok) {
    const errMsg = orderData.error?.description || JSON.stringify(orderData);
    console.error(`❌ Razorpay Order API ${orderRes.status}: ${errMsg}`);
    throw new Error(`Razorpay API ${orderRes.status}: ${errMsg}`);
  }

  console.log(`✅ Order created for ${transaction.id}: ${orderData.id}`);

  return {
    checkout_url: `/checkout?order_id=${orderData.id}&amount=${amountInPaise}&customer=${encodeURIComponent(transaction.customer_name || "Customer")}&transaction_id=${transaction.id}&message=${encodeURIComponent(message || "")}`,
    payment_link_url: `/checkout?order_id=${orderData.id}&amount=${amountInPaise}&customer=${encodeURIComponent(transaction.customer_name || "Customer")}&transaction_id=${transaction.id}&message=${encodeURIComponent(message || "")}`,
    payment_link_id: orderData.id,
    order_id: orderData.id,
    amount: amountInPaise,
    key_id: RAZORPAY_API_KEY,
  };
}
