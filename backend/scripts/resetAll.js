import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deleteAllFromTable(tableName) {
  // Use a broad filter to grab all rows, then delete by IDs
  const { data, error: fetchErr } = await supabase
    .from(tableName)
    .select("id");

  if (fetchErr) {
    // Table might use a different PK (e.g. event_id for webhook_events)
    const { data: d2, error: fetchErr2 } = await supabase
      .from(tableName)
      .select("event_id");
    if (fetchErr2) {
      console.error(`  Could not read ${tableName}: ${fetchErr2.message}`);
      return 0;
    }
    if (d2 && d2.length > 0) {
      const ids = d2.map((r) => r.event_id);
      const { error } = await supabase.from(tableName).delete().in("event_id", ids);
      if (error) {
        console.error(`  Failed to delete from ${tableName}: ${error.message}`);
        return 0;
      }
      return ids.length;
    }
    return 0;
  }

  if (!data || data.length === 0) return 0;

  const ids = data.map((r) => r.id);
  const { error } = await supabase.from(tableName).delete().in("id", ids);
  if (error) {
    console.error(`  Failed to delete from ${tableName}: ${error.message}`);
    return 0;
  }
  return ids.length;
}

async function resetAll() {
  console.log("=== Clearing all tables (users preserved) ===\n");

  const tables = ["audit_logs", "webhook_events", "transactions"];

  for (const table of tables) {
    const deleted = await deleteAllFromTable(table);
    console.log(`  ${table}: deleted ${deleted} rows`);
  }

  console.log("\n=== Done. All transactional data cleared. ===");
}

resetAll();
