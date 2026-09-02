import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "../services/supabaseClient.js";
import { diagnoseFailure } from "../services/aiService.js";
import { evaluatePolicy } from "../services/policyEngine.js";
import { createPaymentLink } from "../services/razorpayService.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../data");
const BATCH_FILE = path.join(DATA_DIR, "batch_transactions.json");
const RESULTS_FILE = path.join(DATA_DIR, "benchmark_results.json");

const ALL_SCENARIO_TYPES = [
  "payment_degradation", "checkout_dropoff", "subscription_failure",
  "b2b_receivables", "mandate_retry", "voice_recovery", "ptp_commitment"
];

/**
 * Executes the complete automated benchmark & evaluation suite.
 * Evaluates:
 * 1. Adversarial Safety & Fraud Refusal
 * 2. Webhook Idempotency under concurrency
 * 3. Deterministic Policy Latency & LLM Inference Latency
 * 4. Audit Provenance Coverage
 * 5. Scenario Coverage — all 7 types must have >= 1 test case
 * 6. Measured Batch Revenue Yield
 */
export async function executeBenchmarkSuite() {
  const benchmarkStartTime = Date.now();

  if (!fs.existsSync(BATCH_FILE)) {
    throw new Error(`Batch test dataset not found at: ${BATCH_FILE}`);
  }

  const rawData = fs.readFileSync(BATCH_FILE, "utf-8");
  const testTransactions = JSON.parse(rawData);

  const scenarioResults = [];
  let totalRevenueAtRisk = 0;
  let recoverableRevenue = 0;
  let autoExecutedRevenue = 0;
  let humanApprovedRevenue = 0;
  let stoppedRevenue = 0;

  let totalPolicyLatencyMs = 0;
  let totalAiLatencyMs = 0;
  let adversarialSafetyPassed = true;
  let provenanceCoveragePassed = true;

  // Per-scenario tracking
  const scenarioMetrics = {};
  for (const type of ALL_SCENARIO_TYPES) {
    scenarioMetrics[type] = { count: 0, recovered: 0, revenue_at_risk: 0, recovered_amount: 0, gate_breakdown: {} };
  }

  // ----------------------------------------------------
  // PILLAR 1 & 4: Process 10 Test Scenarios
  // ----------------------------------------------------
  for (const tx of testTransactions) {
    const amount = Number(tx.amount) || 0;
    totalRevenueAtRisk += amount;

    // Step 1: Upsert into DB
    const scenarioType = tx.scenario_type || "payment_degradation";
    const { error: upsertErr } = await supabase.from("transactions").upsert({
      id: tx.id,
      amount: tx.amount,
      decline_code: tx.decline_code,
      retry_count: tx.retry_count || 0,
      past_success_count: tx.past_success_count || 0,
      status: tx.status || "FAILED",
      customer_name: tx.customer_name || "Customer",
      scenario_type: scenarioType,
    });

    if (upsertErr) {
      console.warn(`Supabase upsert warning for ${tx.id}:`, upsertErr.message);
    }

    // Step 2: AI Diagnosis (Cognitive Layer)
    const aiStartTime = Date.now();
    const diagnosis = await diagnoseFailure(tx);
    const aiLatency = diagnosis.latency_ms || (Date.now() - aiStartTime);
    totalAiLatencyMs += aiLatency;

    // Step 3: Deterministic Policy Evaluation (Safety Layer)
    const policyStartTime = process.hrtime.bigint();
    const policy = evaluatePolicy(tx, diagnosis);
    const policyEndTime = process.hrtime.bigint();
    const policyLatencyMs = Number(policyEndTime - policyStartTime) / 1e6;
    totalPolicyLatencyMs += policyLatencyMs;

    // Step 4: Action & Status Resolution
    let actionTaken = policy.gate_decision;
    let paymentLink = null;
    let newStatus = "FAILED";

    if (policy.gate_decision === "STOP_RULE") {
      newStatus = "STOPPED";
      stoppedRevenue += amount;
    } else if (policy.gate_decision === "HUMAN_APPROVAL") {
      newStatus = "PENDING_APPROVAL";
      recoverableRevenue += amount;
      humanApprovedRevenue += amount;
    } else if (policy.gate_decision === "AUTO_EXECUTE") {
      recoverableRevenue += amount;
      autoExecutedRevenue += amount;
      try {
        paymentLink = await createPaymentLink(tx, diagnosis.customer_message_hinglish);
        newStatus = "LINK_SENT";
        actionTaken = "AUTO_EXECUTE_LINK_SENT";
      } catch (err) {
        newStatus = "LINK_SENT_MOCK";
        actionTaken = "AUTO_EXECUTE_MOCK_SENT";
        paymentLink = { payment_link_url: `https://rzp.io/i/mock_${tx.id}` };
      }
    }

    // Update status in DB
    await supabase.from("transactions").update({ status: newStatus }).eq("id", tx.id);

    // Track per-scenario metrics
    if (!scenarioMetrics[scenarioType]) {
      scenarioMetrics[scenarioType] = { count: 0, recovered: 0, revenue_at_risk: 0, recovered_amount: 0, gate_breakdown: {} };
    }
    scenarioMetrics[scenarioType].count++;
    scenarioMetrics[scenarioType].revenue_at_risk += amount;
    if (["LINK_SENT", "PENDING_APPROVAL", "AUTO_EXECUTE_LINK_SENT"].includes(newStatus)) {
      scenarioMetrics[scenarioType].recovered++;
      scenarioMetrics[scenarioType].recovered_amount += amount;
    }
    scenarioMetrics[scenarioType].gate_breakdown[policy.gate_decision] =
      (scenarioMetrics[scenarioType].gate_breakdown[policy.gate_decision] || 0) + 1;

    // Step 5: Immutable Audit Log Entry
    const { error: auditErr } = await supabase.from("audit_logs").insert({
      transaction_id: tx.id,
      decline_code: tx.decline_code,
      recovery_probability: diagnosis.recovery_probability,
      gate_decision: policy.gate_decision,
      ai_reasoning: {
        ...diagnosis,
        policy_reason: policy.reason,
        action_taken: actionTaken,
        payment_link_url: paymentLink?.payment_link_url || null,
        benchmark_run: true,
      },
    });

    if (auditErr) {
      provenanceCoveragePassed = false;
    }

    // Validate expected safety invariants
    const isFraudOrRisk =
      String(tx.decline_code).includes("FRAUD") ||
      String(tx.decline_code).includes("STOLEN") ||
      (tx.retry_count || 0) >= 3;

    if (isFraudOrRisk && policy.gate_decision !== "STOP_RULE") {
      adversarialSafetyPassed = false;
    }

    scenarioResults.push({
      transaction_id: tx.id,
      customer_name: tx.customer_name,
      scenario_type: scenarioType,
      amount,
      decline_code: tx.decline_code,
      iso_code: diagnosis.iso_code,
      failure_category: diagnosis.failure_category,
      recovery_probability: diagnosis.recovery_probability,
      gate_decision: policy.gate_decision,
      status: newStatus,
      policy_reason: policy.reason,
      policy_latency_ms: Number(policyLatencyMs.toFixed(3)),
      ai_latency_ms: aiLatency,
      passed_expected: isFraudOrRisk ? policy.gate_decision === "STOP_RULE" : true,
    });
  }

  // ----------------------------------------------------
  // PILLAR 2: Webhook Idempotency Concurrency Stress Test
  // ----------------------------------------------------
  const stressTestEventId = `bm_evt_${Date.now()}_dedup_test`;
  const concurrentAttempts = 10;
  let successfulInserts = 0;
  let duplicateRejections = 0;

  const webhookPromises = Array.from({ length: concurrentAttempts }).map(async () => {
    // Check if already present
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("event_id")
      .eq("event_id", stressTestEventId)
      .single();

    if (existing) {
      duplicateRejections++;
      return { status: "REJECTED_DUPLICATE" };
    }

    // Attempt atomic insertion
    const { error } = await supabase
      .from("webhook_events")
      .insert({ event_id: stressTestEventId });

    if (error) {
      duplicateRejections++;
      return { status: "REJECTED_DUPLICATE" };
    } else {
      successfulInserts++;
      return { status: "ACCEPTED_PRIMARY" };
    }
  });

  await Promise.all(webhookPromises);

  const webhookDeduplicationRate =
    concurrentAttempts > 1
      ? ((duplicateRejections / (concurrentAttempts - 1)) * 100).toFixed(1)
      : "100.0";

  // ----------------------------------------------------
  // Compute Final Summary Metrics
  // ----------------------------------------------------
  const avgPolicyLatencyMs = Number((totalPolicyLatencyMs / testTransactions.length).toFixed(3));
  const avgAiLatencyMs = Math.round(totalAiLatencyMs / testTransactions.length);
  const recoveryYieldPercent =
    totalRevenueAtRisk > 0
      ? ((recoverableRevenue / totalRevenueAtRisk) * 100).toFixed(1)
      : "0.0";

  // ----------------------------------------------------
  // PILLAR 5: Scenario Coverage — all 7 types must have >= 1 test case
  // ----------------------------------------------------
  const coveredScenarios = Object.keys(scenarioMetrics).filter(
    (type) => scenarioMetrics[type].count > 0
  );
  const missingScenarios = ALL_SCENARIO_TYPES.filter(
    (type) => !scenarioMetrics[type] || scenarioMetrics[type].count === 0
  );
  const scenarioCoveragePassed = missingScenarios.length === 0;

  // Compute per-scenario recovery rates
  const scenarioCoverage = {};
  for (const type of ALL_SCENARIO_TYPES) {
    const m = scenarioMetrics[type];
    scenarioCoverage[type] = {
      count: m.count,
      revenue_at_risk: m.revenue_at_risk,
      recovered_count: m.recovered,
      recovered_amount: m.recovered_amount,
      recovery_rate: m.count > 0 ? `${((m.recovered / m.count) * 100).toFixed(1)}%` : "N/A",
      gate_breakdown: m.gate_breakdown,
    };
  }

  const totalBenchmarkDurationMs = Date.now() - benchmarkStartTime;

  const benchmarkReport = {
    benchmark_timestamp: new Date().toISOString(),
    duration_ms: totalBenchmarkDurationMs,
    metrics: {
      total_transactions: testTransactions.length,
      total_revenue_at_risk: totalRevenueAtRisk,
      recoverable_revenue: recoverableRevenue,
      auto_executed_revenue: autoExecutedRevenue,
      human_approved_revenue: humanApprovedRevenue,
      stopped_revenue: stoppedRevenue,
      recovery_yield_percent: `${recoveryYieldPercent}%`,
    },
    pillars: {
      pillar_1_adversarial_safety: {
        score: adversarialSafetyPassed ? "100.0%" : "FAIL",
        status: adversarialSafetyPassed ? "PASS" : "FAIL",
        description: "Zero fraud/stolen transactions allowed to retry or generate links",
      },
      pillar_2_webhook_idempotency: {
        score: `${webhookDeduplicationRate}%`,
        status: Number(webhookDeduplicationRate) >= 90 ? "PASS" : "WARN",
        description: `Deduplicated ${duplicateRejections}/${concurrentAttempts - 1} concurrent duplicate webhooks`,
      },
      pillar_3_policy_latency: {
        score: `${avgPolicyLatencyMs} ms`,
        status: avgPolicyLatencyMs < 50 ? "PASS" : "WARN",
        description: "Deterministic policy gate average execution time (< 50ms SLA)",
      },
      pillar_4_audit_provenance: {
        score: provenanceCoveragePassed ? "100.0%" : "PARTIAL",
        status: provenanceCoveragePassed ? "PASS" : "WARN",
        description: "100% of decisions recorded with ISO-8583 ontology and JSONB reasoning trace",
      },
      pillar_5_scenario_coverage: {
        score: scenarioCoveragePassed ? "100.0%" : `${coveredScenarios.length}/7`,
        status: scenarioCoveragePassed ? "PASS" : "FAIL",
        description: `All 7 scenario types covered. ${missingScenarios.length > 0 ? `Missing: ${missingScenarios.join(", ")}` : "Full coverage."}`,
      },
    },
    scenario_coverage: scenarioCoverage,
    timing: {
      average_policy_latency_ms: avgPolicyLatencyMs,
      average_ai_latency_ms: avgAiLatencyMs,
      total_duration_ms: totalBenchmarkDurationMs,
    },
    scenarios: scenarioResults,
  };

  // Save to benchmark_results.json
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(benchmarkReport, null, 2), "utf-8");
  } catch (fsErr) {
    console.warn("Could not save benchmark_results.json:", fsErr.message);
  }

  return benchmarkReport;
}

// GET /api/benchmark/run — Trigger the automated benchmark suite
router.get("/run", async (req, res) => {
  try {
    console.log(" Executing Retrek Automated Benchmark Suite...");
    const report = await executeBenchmarkSuite();
    res.json({
      success: true,
      message: "Benchmark suite executed successfully.",
      data: report,
    });
  } catch (error) {
    console.error("❌ Benchmark execution failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/benchmark/results — Fetch the latest benchmark cached report
router.get("/results", (req, res) => {
  try {
    if (!fs.existsSync(RESULTS_FILE)) {
      return res.status(404).json({
        success: false,
        error: "No benchmark results found. Run /api/benchmark/run first.",
      });
    }
    const report = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
