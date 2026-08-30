import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import transactionRoutes from "./routes/transactions.js";
import webhookRoutes from "./routes/webhooks.js";
import auditRoutes from "./routes/audit.js";
import approvalRoutes from "./routes/approvals.js";
import benchmarkRoutes from "./routes/benchmark.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Public routes (no auth required)
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);

// Protected routes (JWT auth required)
app.use("/ai", requireAuth, aiRoutes);
app.use("/api/ai", requireAuth, aiRoutes);
app.use("/api/transactions", requireAuth, transactionRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/audit-logs", requireAuth, auditRoutes);
app.use("/api/dashboard", requireAuth, auditRoutes);
app.use("/api/approvals", requireAuth, approvalRoutes);
app.use("/api/benchmark", requireAuth, benchmarkRoutes);

// Export for Vercel serverless
export default app;

// Run standalone server only when not on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}
