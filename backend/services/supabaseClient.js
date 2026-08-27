import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Warning: SUPABASE_URL or SUPABASE_ANON_KEY missing in backend/.env");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
