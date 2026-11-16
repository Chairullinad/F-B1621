import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envText = fs.readFileSync(".env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const idx = line.indexOf("=");
  if (idx !== -1) {
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: outlets, error } = await supabase
    .from("outlets")
    .select("id, name, qris_merchant_name, qris_raw_payload, qris_enabled");
  console.log("Error:", error);
  for (const o of outlets || []) {
    console.log("=== OUTLET ===", o.name, o.id);
    console.log("Merchant:", o.qris_merchant_name);
    console.log("Enabled:", o.qris_enabled);
    console.log("Payload:", o.qris_raw_payload);
  }
}

check();
