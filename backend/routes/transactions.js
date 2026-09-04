import express from "express";
import { supabase } from "../services/supabaseClient.js";
import { processTransactionPipeline } from "../services/pipelineService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function mapActionToStatus(actionTaken) {
  if (!actionTaken) return null;
  const action = actionTaken.toUpperCase();
  if (action.includes("LINK_SENT")) return "LINK_SENT";
  if (action.includes("FAILED")) return "LINK_FAILED";
  if (action.includes("AUTO_EXECUTE")) return "LINK_SENT";
  if (action.includes("HUMAN_APPROVAL") || action.includes("PENDING")) return "PENDING_APPROVAL";
  if (action.includes("STOP")) return "STOPPED";
  return null;
}

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

// POST /api/transactions/seed — Seed synthetic data into DB
router.post("/seed", async (req, res) => {
  try {
    const dataPath = path.join(__dirname, "../data/batch_transactions.json");

    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({
        success: false,
        error: "batch_transactions.json file not found in backend/data/",
      });
    }

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const transactions = JSON.parse(rawData);

    const seededIds = [];
    for (const tx of transactions) {
      const { error } = await supabase.from("transactions").upsert({
        id: tx.id,
        amount: tx.amount,
        decline_code: tx.decline_code,
        retry_count: tx.retry_count,
        past_success_count: tx.past_success_count,
        status: tx.status || "FAILED",
        customer_name: tx.customer_name,
        scenario_type: tx.scenario_type || "payment_degradation",
      });

      if (error) {
        throw new Error(`Failed to seed transaction ${tx.id}: ${error.message}`);
      }
      seededIds.push(tx.id);
    }

    res.json({
      success: true,
      message: `Seeded ${seededIds.length} transactions.`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/transactions/ingest — Ingest a single failed payment payload
router.post("/ingest", async (req, res) => {
  try {
    const { id, amount, decline_code, customer_name, retry_count, past_success_count, scenario_type } = req.body;

    if (!id || amount === undefined || !decline_code) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: id, amount, decline_code",
      });
    }

    const { data, error } = await supabase
      .from("transactions")
      .upsert({
        id,
        amount,
        decline_code,
        retry_count: retry_count || 0,
        past_success_count: past_success_count || 0,
        status: "FAILED",
        customer_name: customer_name || "Customer",
        scenario_type: scenario_type || "payment_degradation",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to ingest transaction: ${error.message}`);
    }

    res.status(201).json({
      success: true,
      message: `Transaction ${id} ingested successfully.`,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/transactions/batch-process — Process all FAILED transactions through AI pipeline
router.post("/batch-process", async (req, res) => {
  try {
    const { data: failedTransactions, error } = await supabase
      .from("transactions")
      .select("id")
      .eq("status", "FAILED");

    if (error) throw new Error(error.message);

    if (!failedTransactions || failedTransactions.length === 0) {
      return res.json({
        success: true,
        message: "No unprocessed FAILED transactions found.",
        processed_count: 0,
        results: [],
      });
    }

    const results = [];
    for (const tx of failedTransactions) {
      try {
        const result = await processTransactionPipeline(tx.id, { source: "api/batch" });
        results.push({ id: tx.id, success: true, ...result });
      } catch (err) {
        results.push({ id: tx.id, success: false, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} transactions through autonomous AI recovery pipeline.`,
      processed_count: results.length,
      results,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/transactions/:id/process — Process a single transaction through the full pipeline
router.post("/:id/process", async (req, res) => {
  try {
    const result = await processTransactionPipeline(req.params.id, { source: "api/single" });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/transactions/scenarios — Breakdown by scenario_type
router.get("/scenarios", async (req, res) => {
  try {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("id, amount, scenario_type, status")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const scenarioMap = {};
    for (const tx of transactions) {
      const type = tx.scenario_type || "payment_degradation";
      if (!scenarioMap[type]) {
        scenarioMap[type] = { type, count: 0, total_amount: 0, recovered_count: 0, recovered_amount: 0 };
      }
      scenarioMap[type].count++;
      scenarioMap[type].total_amount += Number(tx.amount) || 0;
      if (["LINK_SENT", "PAID"].includes(tx.status)) {
        scenarioMap[type].recovered_count++;
        scenarioMap[type].recovered_amount += Number(tx.amount) || 0;
      }
    }

    const scenarios = Object.values(scenarioMap).sort((a, b) => b.count - a.count);
    const totalCount = transactions.length;
    const totalRecovered = scenarios.reduce((sum, s) => sum + s.recovered_count, 0);
    const totalAmount = scenarios.reduce((sum, s) => sum + s.total_amount, 0);
    const recoveredAmount = scenarios.reduce((sum, s) => sum + s.recovered_amount, 0);

    res.json({
      success: true,
      data: {
        scenarios,
        summary: {
          total_transactions: totalCount,
          total_recovered: totalRecovered,
          total_amount: totalAmount,
          recovered_amount: recoveredAmount,
          recovery_rate: totalCount > 0 ? Number(((totalRecovered / totalCount) * 100).toFixed(1)) : 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/transactions — Fetch all transactions enriched with latest AI diagnosis
router.get("/", async (req, res) => {
  try {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch latest audit log for each transaction
    const enriched = await Promise.all(
      transactions.map(async (tx) => {
        const { data: auditLog } = await supabase
          .from("audit_logs")
          .select("ai_reasoning, gate_decision, recovery_probability, created_at")
          .eq("transaction_id", tx.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Use audit log status as fallback if DB update was blocked by RLS
        // But if DB status is terminal (RECOVERED, STOPPED), always use DB status
        const dbStatus = tx.status;
        const isTerminal = dbStatus === "RECOVERED" || dbStatus === "STOPPED";
        const resolvedStatus = isTerminal
          ? dbStatus
          : (auditLog?.ai_reasoning?.action_taken
            ? mapActionToStatus(auditLog.ai_reasoning.action_taken)
            : dbStatus);

        return {
          ...tx,
          status: resolvedStatus,
          gate_decision: auditLog?.gate_decision || null,
          recovery_probability: auditLog?.recovery_probability ?? null,
          ai_reasoning: auditLog?.ai_reasoning || null,
          root_cause: auditLog?.ai_reasoning?.root_cause || null,
          customer_message_hinglish: auditLog?.ai_reasoning?.customer_message_hinglish || null,
          customer_message_english: auditLog?.ai_reasoning?.customer_message_english || null,
          policy_reason: auditLog?.ai_reasoning?.policy_reason || null,
          iso_code: auditLog?.ai_reasoning?.iso_code || null,
          payment_link_url: tx.payment_link_url || auditLog?.ai_reasoning?.payment_link_url || null,
        };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/transactions/:id — Fetch a single transaction enriched with AI diagnosis
router.get("/:id", async (req, res) => {
  try {
    const { data: tx, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw new Error(error.message);
    if (!tx) return res.status(404).json({ success: false, error: "Transaction not found" });

    const { data: auditLog } = await supabase
      .from("audit_logs")
      .select("ai_reasoning, gate_decision, recovery_probability, created_at")
      .eq("transaction_id", tx.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const dbStatus = tx.status;
    const isTerminal = dbStatus === "RECOVERED" || dbStatus === "STOPPED";
    const enriched = {
      ...tx,
      status: isTerminal
        ? dbStatus
        : (auditLog?.ai_reasoning?.action_taken
          ? mapActionToStatus(auditLog.ai_reasoning.action_taken) || dbStatus
          : dbStatus),
      gate_decision: auditLog?.gate_decision || null,
      recovery_probability: auditLog?.recovery_probability ?? null,
      ai_reasoning: auditLog?.ai_reasoning || null,
      root_cause: auditLog?.ai_reasoning?.root_cause || null,
      customer_message_hinglish: auditLog?.ai_reasoning?.customer_message_hinglish || null,
      customer_message_english: auditLog?.ai_reasoning?.customer_message_english || null,
      policy_reason: auditLog?.ai_reasoning?.policy_reason || null,
      iso_code: auditLog?.ai_reasoning?.iso_code || null,
      payment_link_url: tx.payment_link_url || auditLog?.ai_reasoning?.payment_link_url || null,
    };

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
