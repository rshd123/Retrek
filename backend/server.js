import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "./middleware/auth.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import transactionRoutes from "./routes/transactions.js";
import webhookRoutes from "./routes/webhooks.js";
import auditRoutes from "./routes/audit.js";
import approvalRoutes from "./routes/approvals.js";
import benchmarkRoutes from "./routes/benchmark.js";
import { startScheduler } from "./services/schedulerService.js";
import ngrok from "@ngrok/ngrok";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

// Public routes (no auth required)
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);

// Checkout page — serves Razorpay Checkout.js with order details
app.get("/checkout", (req, res) => {
  const { order_id, amount, customer, transaction_id, message } = req.query;
  if (!order_id || !amount) {
    return res.status(400).send("Missing order_id or amount");
  }

  const checkoutPath = path.join(__dirname, "public", "checkout.html");
  let html = fs.readFileSync(checkoutPath, "utf-8");

  // Inject Razorpay key ID
  html = html.replace("__RAZORPAY_KEY_ID__", process.env.TEST_API_KEY || "");

  // Inject query params as hidden defaults
  html = html.replace("</body>", `
    <script>
      // Override params from server injection
      window.__SERVER_PARAMS__ = ${JSON.stringify({ order_id, amount, customer, transaction_id, message: message || "" })};
    </script>
  </body>`);

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// Protected routes (JWT auth required)
app.use("/ai", requireAuth, aiRoutes);
app.use("/api/ai", requireAuth, aiRoutes);
app.use("/api/transactions", requireAuth, transactionRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/audit-logs", requireAuth, auditRoutes);
app.use("/api/dashboard", requireAuth, auditRoutes);
app.use("/api/approvals", requireAuth, approvalRoutes);
app.use("/api/benchmark", requireAuth, benchmarkRoutes);

// Export for Vercel serverless and tunnel.js
export default app;

// Run standalone server only when not on Vercel and not imported by tunnel.js
const isMainModule = process.argv[1] &&
  (process.argv[1].endsWith("server.js") || process.argv[1].endsWith("server"));

if (!process.env.VERCEL && isMainModule) {
  app.listen(PORT, async () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    startScheduler();

    // Start ngrok tunnel
    try {
      const listener = await ngrok.forward({
        addr: PORT,
        authtoken: process.env.NGROK_AUTHTOKEN,
        domain: "dentist-donator-resisting.ngrok-free.dev",
      });
      console.log("");
      console.log("========================================");
      console.log("  ngrok tunnel established!");
      console.log("========================================");
      console.log(`  Local:   http://localhost:${PORT}`);
      console.log(`  Public:  ${listener.url()}`);
      console.log("");
      console.log("  Razorpay Webhook URL:");
      console.log(`  ${listener.url()}/api/webhooks/razorpay`);
      console.log("========================================");
    } catch (err) {
      console.error("ngrok tunnel failed:", err.message);
    }
  });
}
