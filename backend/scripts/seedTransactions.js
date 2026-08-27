import { supabase } from "../services/supabaseClient.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedDatabase() {
  console.log("🌱 Starting Retrek transaction seeding into Supabase...");

  const dataPath = path.join(__dirname, "../data/batch_transactions.json");
  const rawData = fs.readFileSync(dataPath, "utf-8");
  const transactions = JSON.parse(rawData);

  for (const tx of transactions) {
    const { error } = await supabase.from("transactions").upsert({
      id: tx.id,
      amount: tx.amount,
      decline_code: tx.decline_code,
      retry_count: tx.retry_count,
      past_success_count: tx.past_success_count,
      status: tx.status,
    });

    if (error) {
      console.error(`❌ Failed to seed transaction ${tx.id}:`, error.message);
    } else {
      console.log(`✅ Seeded transaction: ${tx.id} | ${tx.decline_code} | ₹${tx.amount}`);
    }
  }

  console.log("🎉 Database seeding completed successfully!");
}

seedDatabase();
