import "dotenv/config";

const KEY = process.env.TEST_API_KEY;
const SECRET = process.env.RAZORPAY_KEY_SECRET;
const auth = Buffer.from(`${KEY}:${SECRET}`).toString("base64");

const res = await fetch("https://api.razorpay.com/v1/payment_links?count=100", {
  headers: { Authorization: `Basic ${auth}` },
});
const data = await res.json();
const items = data.payment_links || [];

console.log(`Found ${items.length} payment links\n`);

let cancelled = 0;
let skipped = 0;
let failed = 0;

for (const link of items) {
  if (link.status === "paid") {
    console.log(`Skipped (already paid) — ${link.id} | INR ${link.amount / 100}`);
    skipped++;
    continue;
  }

  const r = await fetch(`https://api.razorpay.com/v1/payment_links/${link.id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
  });
  if (r.ok) {
    console.log(`Cancelled — ${link.id} | INR ${link.amount / 100} | was: ${link.status}`);
    cancelled++;
  } else {
    const err = await r.text();
    console.log(`Failed (${r.status}) — ${link.id} | ${link.status} | ${err.slice(0, 120)}`);
    failed++;
  }
}

console.log(`\nDone. ${cancelled} cancelled, ${skipped} skipped (paid), ${failed} failed.`);
