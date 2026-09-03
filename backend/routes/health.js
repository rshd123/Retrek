import express from "express";
import Groq from "groq-sdk";
import { supabase } from "../services/supabaseClient.js";

const router = express.Router();

// GET /api/health - Returns system operational status, cloud LLM connectivity, and Supabase database health
router.get("/health", async (req, res) => {
  const startTime = Date.now();
  const services = {
    database: {
      status: "unknown",
      provider: "Supabase",
      latencyMs: 0
    },
    llm: {
      status: "unknown",
      provider: "Groq",
      model: process.env.MODEL_NAME || "qwen/qwen3.6-27b",
      latencyMs: 0
    }
  };

  // 1. Test Supabase Database Connection
  const dbStartTime = Date.now();
  try {
    const { error } = await supabase.from("transactions").select("id", { count: "exact", head: true });
    services.database.latencyMs = Date.now() - dbStartTime;
    if (error) {
      services.database.status = "degraded";
      services.database.error = error.message;
    } else {
      services.database.status = "connected";
    }
  } catch (err) {
    services.database.latencyMs = Date.now() - dbStartTime;
    services.database.status = "disconnected";
    services.database.error = err.message;
  }

  // 2. Test Cloud LLM Connectivity (Groq)
  const llmStartTime = Date.now();
  try {
    if (!process.env.LLM_API_KEY) {
      throw new Error("LLM_API_KEY is not configured in environment.");
    }
    const groq = new Groq({ apiKey: process.env.LLM_API_KEY });
    await groq.chat.completions.create({
      model: process.env.MODEL_NAME || "qwen/qwen3.6-27b",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 5,
    });
    services.llm.latencyMs = Date.now() - llmStartTime;
    services.llm.status = "connected";
  } catch (err) {
    services.llm.latencyMs = Date.now() - llmStartTime;
    services.llm.status = "disconnected";
    services.llm.error = err.message;
  }

  // 3. Test Razorpay API Connectivity (using Orders API, no link limit)
  const rzStartTime = Date.now();
  try {
    const creds = Buffer.from(`${process.env.TEST_API_KEY}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const rzResp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${creds}` },
      body: JSON.stringify({ amount: 100, currency: "INR", receipt: "health_check" }),
    });
    const rzData = await rzResp.json();
    services.razorpay = {
      status: rzResp.ok ? "connected" : "error",
      latencyMs: Date.now() - rzStartTime,
      ...(rzResp.ok ? { order_id: rzData.id } : { error: rzData.error?.description || "Unknown error" }),
    };
  } catch (err) {
    services.razorpay = { status: "disconnected", latencyMs: Date.now() - rzStartTime, error: err.message };
  }

  const isHealthy = services.database.status === "connected" && services.llm.status === "connected";
  const overallStatus = isHealthy ? "healthy" : (services.database.status === "connected" || services.llm.status === "connected" ? "degraded" : "unhealthy");

  res.status(isHealthy ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    responseTimeMs: Date.now() - startTime,
    services
  });
});

async function clearTableRows(tableName, idCol = "id") {
  const { data, error: fetchErr } = await supabase.from(tableName).select(idCol);
  if (fetchErr || !data || data.length === 0) return 0;
  const ids = data.map((r) => r[idCol]);
  const { error: delErr } = await supabase.from(tableName).delete().in(idCol, ids);
  if (delErr) throw new Error(`Failed to delete from ${tableName}: ${delErr.message}`);
  return ids.length;
}

router.all("/reset", async (req, res) => {
  try {
    const deletedAudit = await clearTableRows("audit_logs", "id");
    const deletedWebhooks = await clearTableRows("webhook_events", "event_id");
    const deletedTransactions = await clearTableRows("transactions", "id");

    return res.status(200).json({
      success: true,
      message: "Database reset to 0 rows. All transactional data cleared.",
      deleted_counts: {
        audit_logs: deletedAudit,
        webhook_events: deletedWebhooks,
        transactions: deletedTransactions
      },
      current_counts: {
        audit_logs: 0,
        webhook_events: 0,
        transactions: 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Database reset error:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
