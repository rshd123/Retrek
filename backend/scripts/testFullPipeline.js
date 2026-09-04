import { supabase } from "../services/supabaseClient.js";
import { processTransactionPipeline } from "../services/pipelineService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BATCH_FILE = path.join(__dirname, "../data/batch_transactions.json");

const EXPECTED_GATE_DECISIONS = {
  pay_Kx9281a: "AUTO_EXECUTE",   // Low ticket, 2FA timeout, 0 retries → Gate 1
  pay_Tx4820b: "HUMAN_APPROVAL", // ₹15k ≥ ₹10k threshold → Gate 2
  pay_Mx1029c: "HUMAN_APPROVAL", // Insufficient funds, 60% base, retry penalty → medium confidence
  pay_Fx3910d: "STOP_RULE",      // SUSPECTED_FRAUD → zero-tolerance
  pay_Rx7721e: "STOP_RULE",      // 3 retries = maxRetries(3) for payment_degradation
  pay_Ex8823f: "AUTO_EXECUTE",   // Expired card, loyal customer (12 past), high base
  pay_Lx5432g: "HUMAN_APPROVAL", // ₹28.5k ≥ ₹10k → Gate 2
  pay_Nx9011h: "AUTO_EXECUTE",   // Gateway down, high base (0.90), micro-amount
  pay_Ox6754i: "HUMAN_APPROVAL", // Generic decline, 1 retry, medium confidence
  pay_Bx1122j: "AUTO_EXECUTE",   // Micro-transaction, high base (0.92)
  pay_Co1001a: "AUTO_EXECUTE",   // Checkout dropoff, loyal, high base
  pay_Co1002b: "HUMAN_APPROVAL", // ₹12k ≥ ₹10k → Gate 2
  pay_Su2001a: "HUMAN_APPROVAL", // Insufficient funds, 1 retry → medium
  pay_Su2002b: "AUTO_EXECUTE",   // Expired card, 12 past successes, high base
  pay_B2B3001a: "HUMAN_APPROVAL", // ₹45k ≥ ₹10k (or ₹50k for trusted) → Gate 2
  pay_B2B3002b: "HUMAN_APPROVAL", // ₹28k ≥ ₹10k → Gate 2
  pay_Md4001a: "AUTO_EXECUTE",   // Mandate, 2FA timeout, 0 retries
  pay_Md4002b: "HUMAN_APPROVAL", // Mandate, 2 retries, medium confidence
  pay_Vo5001a: "AUTO_EXECUTE",   // Voice recovery, gateway timeout, 0 retries
  pay_Pt6001a: "HUMAN_APPROVAL", // PTP, 1 retry, medium confidence
};

function printHeader(text) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${text}`);
  console.log(`${"=".repeat(70)}`);
}

function printResult(tx, result, expected) {
  const gateMatch = result.gate_decision === expected ? "✓" : "✗";
  const hasRootCause = result.root_cause ? "✓" : "✗";
  const hasMessage = result.customer_message_hinglish ? "✓" : "✗";
  const hasISO = result.iso_code ? "✓" : "✗";
  const hasAudit = result.latency_ms?.pipeline > 0 ? "✓" : "✗";

  console.log(
    `  ${gateMatch} ${tx.id.padEnd(14)} | ` +
    `${result.gate_decision.padEnd(15)} | ` +
    `₹${String(result.amount).padStart(7)} | ` +
    `Prob: ${String(result.recovery_probability).padEnd(5)} | ` +
    `Root: ${hasRootCause} | Msg: ${hasMessage} | ISO: ${hasISO} | Audit: ${hasAudit}`
  );
}

async function runTest() {
  printHeader("RETREK END-TO-END PIPELINE TEST");

  // 1. Load test data
  if (!fs.existsSync(BATCH_FILE)) {
    console.error("batch_transactions.json not found");
    process.exit(1);
  }
  const testTransactions = JSON.parse(fs.readFileSync(BATCH_FILE, "utf-8"));
  console.log(`  Loaded ${testTransactions.length} test transactions\n`);

  // 2. Upsert into DB
  printHeader("STEP 1: SEEDING TRANSACTIONS");
  let seeded = 0;
  for (const tx of testTransactions) {
    const { error } = await supabase.from("transactions").upsert({
      id: tx.id,
      amount: tx.amount,
      decline_code: tx.decline_code,
      retry_count: tx.retry_count || 0,
      past_success_count: tx.past_success_count || 0,
      status: tx.status || "FAILED",
      customer_name: tx.customer_name || "Customer",
      scenario_type: tx.scenario_type || "payment_degradation",
    });
    if (error) {
      console.error(`  ✗ Failed to seed ${tx.id}: ${error.message}`);
    } else {
      seeded++;
    }
  }
  console.log(`  Seeded ${seeded}/${testTransactions.length} transactions`);

  // 3. Process each through full pipeline
  printHeader("STEP 2: PROCESSING THROUGH AI PIPELINE");
  console.log("  Gate Match | Transaction ID  | Gate Decision     | Amount   | Probability | Fields\n");

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const tx of testTransactions) {
    try {
      const result = await processTransactionPipeline(tx.id, { source: "e2e_test" });
      const expected = EXPECTED_GATE_DECISIONS[tx.id];
      const match = result.gate_decision === expected;

      if (match) passed++;
      else failed++;

      printResult(tx, result, expected);
      results.push({ id: tx.id, success: true, ...result, expected_gate: expected, gate_match: match });
    } catch (err) {
      failed++;
      results.push({ id: tx.id, success: false, error: err.message, expected_gate: EXPECTED_GATE_DECISIONS[tx.id] });
      console.log(`  ✗ ${tx.id} | ERROR: ${err.message}`);
    }
  }

  // 4. Verify audit logs
  printHeader("STEP 3: VERIFYING AUDIT LOGS");
  let auditCount = 0;
  let auditWithAIReasoning = 0;
  let auditWithISOCode = 0;

  for (const tx of testTransactions) {
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("ai_reasoning, gate_decision, recovery_probability, decline_code")
      .eq("transaction_id", tx.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (logs && logs.length > 0) {
      auditCount++;
      const log = logs[0];
      if (log.ai_reasoning?.root_cause) auditWithAIReasoning++;
      if (log.ai_reasoning?.iso_code) auditWithISOCode++;
    }
  }

  console.log(`  Audit logs found: ${auditCount}/${testTransactions.length}`);
  console.log(`  Logs with AI reasoning: ${auditWithAIReasoning}/${auditCount}`);
  console.log(`  Logs with ISO code: ${auditWithISOCode}/${auditCount}`);

  // 5. Verify transaction statuses
  printHeader("STEP 4: VERIFYING TRANSACTION STATUSES");
  const statusCounts = {};
  for (const tx of testTransactions) {
    const { data } = await supabase
      .from("transactions")
      .select("status")
      .eq("id", tx.id)
      .single();
    const status = data?.status || "UNKNOWN";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(20)}: ${count}`);
  }

  // 6. Verify fraud safety invariant
  printHeader("STEP 5: ADVERSARIAL SAFETY CHECK");
  const fraudResults = results.filter(r => {
    const tx = testTransactions.find(t => t.id === r.id);
    return tx?.decline_code?.includes("FRAUD") || tx?.decline_code?.includes("STOLEN");
  });
  const fraudAllStopped = fraudResults.every(r => r.gate_decision === "STOP_RULE");
  console.log(`  Fraud/stolen transactions: ${fraudResults.length}`);
  console.log(`  All stopped by policy: ${fraudAllStopped ? "✓ PASS" : "✗ FAIL"}`);

  // 7. Summary
  printHeader("SUMMARY");
  const totalAmount = testTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const autoExecuted = results.filter(r => r.gate_decision === "AUTO_EXECUTE");
  const humanApproved = results.filter(r => r.gate_decision === "HUMAN_APPROVAL");
  const stopped = results.filter(r => r.gate_decision === "STOP_RULE");
  const autoExecAmount = autoExecuted.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const humanAppAmount = humanApproved.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  console.log(`  Total transactions: ${testTransactions.length}`);
  console.log(`  Pipeline processed: ${results.filter(r => r.success).length}`);
  console.log(`  Gate match: ${passed}/${testTransactions.length} (${((passed / testTransactions.length) * 100).toFixed(0)}%)`);
  console.log(`  Revenue at risk: ₹${totalAmount.toLocaleString("en-IN")}`);
  console.log(`  Auto-executed (links created): ${autoExecuted.length} (₹${autoExecAmount.toLocaleString("en-IN")})`);
  console.log(`  Human approval queue: ${humanApproved.length} (₹${humanAppAmount.toLocaleString("en-IN")})`);
  console.log(`  Stopped (fraud/retries): ${stopped.length}`);
  console.log(`  Audit coverage: ${auditCount}/${testTransactions.length}`);
  console.log(`  AI reasoning in audit: ${auditWithAIReasoning}/${auditCount}`);
  console.log(`  Fraud safety: ${fraudAllStopped ? "PASS" : "FAIL"}`);

  const allPassed = passed === testTransactions.length && fraudAllStopped && auditCount === testTransactions.length;
  console.log(`\n  Overall: ${allPassed ? "✓ ALL TESTS PASSED" : "✗ SOME TESTS FAILED"}`);
  console.log(`${"=".repeat(70)}\n`);

  // Save results
  const reportFile = path.join(__dirname, "../data/e2e_test_results.json");
  fs.writeFileSync(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: testTransactions.length,
      processed: results.filter(r => r.success).length,
      gate_match: passed,
      gate_mismatch: failed,
      auto_executed: autoExecuted.length,
      human_approved: humanApproved.length,
      stopped: stopped.length,
      audit_coverage: auditCount,
      fraud_safety: fraudAllStopped,
      all_passed: allPassed,
    },
    results,
  }, null, 2));

  process.exit(allPassed ? 0 : 1);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
