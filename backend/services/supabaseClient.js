import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory (local dev) or rely on Vercel env vars
try {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
} catch {
  // In Vercel serverless, .env doesn't exist — env vars are in process.env
}

const supabaseUrl = process.env.SUPABASE_URL;

// Server-side: prefer service_role key (bypasses RLS), fallback to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Warning: SUPABASE_URL or SUPABASE_KEY missing");
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("✅ Using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)");
} else {
  console.warn("⚠️ No SUPABASE_SERVICE_ROLE_KEY — DB writes may fail due to RLS.");
}

export const supabase = createClient(supabaseUrl || "", supabaseKey || "");
