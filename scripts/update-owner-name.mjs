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

async function run() {
  console.log("1. Memperbarui nama Owner menjadi Fauzi Adiadi...");
  const { data: users, error: uErr } = await supabase
    .from("users")
    .update({ full_name: "Fauzi Adiadi" })
    .eq("role", "owner")
    .select("id, full_name, role");
  console.log("Users updated:", users, uErr);

  console.log("2. Memeriksa data outlets...");
  const { data: outlets, error: oErr } = await supabase
    .from("outlets")
    .select("id, name, qris_merchant_name, qris_raw_payload");
  console.log("Current outlets:", outlets, oErr);

  for (const o of outlets || []) {
    const updates = {};
    if (o.name && o.name.toLowerCase().includes("nusantara")) {
      updates.name = "1621 GROUP";
    }
    if (
      o.qris_merchant_name &&
      o.qris_merchant_name.toLowerCase().includes("nusantara")
    ) {
      updates.qris_merchant_name = "1621 GROUP";
    }
    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from("outlets")
        .update(updates)
        .eq("id", o.id);
      console.log("Updated outlet", o.id, updates, upErr);
    }
  }

  console.log("Selesai!");
}

run();

