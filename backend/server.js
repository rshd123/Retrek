import "dotenv/config";
import express from "express";
import healthRoutes from "./routes/health.js";
import aiRoutes from "./routes/ai.js";
import transactionRoutes from "./routes/transactions.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Routes
app.use("/api", healthRoutes);
app.use("/ai", aiRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/transactions", transactionRoutes);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
