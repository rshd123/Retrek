import express from "express";
import { supabase } from "../services/supabaseClient.js";

const router = express.Router();

// GET /api/audit-logs/logs — Retrieve all audit log records
router.get("/logs", async (req, res) => {
  try {
    const { gate_decision, decline_code } = req.query;

    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (gate_decision) {
      query = query.eq("gate_decision", gate_decision);
    }
    if (decline_code) {
      query = query.eq("decline_code", decline_code);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/roi — Compute real-time ROI metrics
router.get(["/roi", "/dashboard/roi"], async (req, res) => {
  try {
    // Fetch all transactions for metrics
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("id, amount, status");

    if (txError) throw new Error(txError.message);

    // Fetch all audit logs for decision counts
    const { data: auditLogs, error: logError } = await supabase
      .from("audit_logs")
      .select("gate_decision");

    if (logError) throw new Error(logError.message);

    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const recovered = transactions.filter((tx) => tx.status === "RECOVERED");
    const totalRecovered = recovered.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const totalRevenueAtRisk = totalAmount - totalRecovered;

    const autoExecuted = auditLogs.filter((l) => l.gate_decision === "AUTO_EXECUTE").length;
    const humanPending = transactions.filter((tx) => tx.status === "PENDING_APPROVAL").length;
    const stopped = auditLogs.filter((l) => l.gate_decision === "STOP_RULE").length;
    const linkSent = transactions.filter((tx) => tx.status === "LINK_SENT").length;

    res.json({
      success: true,
      data: {
        totalTransactions,
        totalAmountAtRisk: totalAmount,
        totalRevenueAtRisk,
        totalRecovered,
        recoveryRate: totalAmount > 0 ? ((totalRecovered / totalAmount) * 100).toFixed(1) + "%" : "0%",
        autoExecuted,
        humanPending,
        stopped,
        linkSent,
        recoveredCount: recovered.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
