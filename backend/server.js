import "dotenv/config";
import express from "express";
import healthRoutes from "./routes/health.js";
import aiRoutes from "./routes/ai.js";
import transactionRoutes from "./routes/transactions.js";
import webhookRoutes from "./routes/webhooks.js";
import auditRoutes from "./routes/audit.js";
import approvalRoutes from "./routes/approvals.js";
import benchmarkRoutes from "./routes/benchmark.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Routes
app.use("/api", healthRoutes);
app.use("/ai", aiRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/dashboard", auditRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/benchmark", benchmarkRoutes);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
