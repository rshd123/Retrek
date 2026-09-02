import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const r = await s.from("transactions").select("id,status").eq("id","pay_Pt6001a").single();
console.log("BEFORE:", JSON.stringify(r));

const u = await s.from("transactions").update({status:"RECOVERED"}).eq("id","pay_Pt6001a");
console.log("UPDATE result:", JSON.stringify(u));

const a = await s.from("transactions").select("id,status").eq("id","pay_Pt6001a").single();
console.log("AFTER:", JSON.stringify(a));

process.exit(0);
