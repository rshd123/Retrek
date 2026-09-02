import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const tables = ["transactions", "audit_logs", "webhook_events", "users"];
  for (const t of tables) {
    const { count, error } = await supabase
      .from(t)
      .select("*", { count: "exact", head: true });
    console.log(`${t}: count=${count}, error=${error?.message || "none"}`);
  }
}

check();
