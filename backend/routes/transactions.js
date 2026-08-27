import express from "express";
import { supabase } from "../services/supabaseClient.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// POST /api/transactions/seed - Seeds or resets synthetic failed transaction scenarios in Supabase from batch_transactions.json
router.post("/seed", async (req, res) => {
  try {
    const dataPath = path.join(__dirname, "../data/batch_transactions.json");
    
    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({
        success: false,
        error: "batch_transactions.json file not found in backend/data/"
      });
    }

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const transactions = JSON.parse(rawData);

    const seededRecords = [];
    for (const tx of transactions) {
      const { data, error } = await supabase
        .from("transactions")
        .upsert({
          id: tx.id,
          amount: tx.amount,
          decline_code: tx.decline_code,
          retry_count: tx.retry_count,
          past_success_count: tx.past_success_count,
          status: tx.status || "FAILED"
        })
        .select();

      if (error) {
        throw new Error(`Failed to upsert transaction ${tx.id}: ${error.message}`);
      }
      if (data && data[0]) {
        seededRecords.push(data[0]);
      }
    }

    res.json({
      success: true,
      message: `Successfully seeded ${seededRecords.length} synthetic transaction scenarios into Supabase.`,
      count: seededRecords.length,
      data: seededRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
