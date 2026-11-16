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

const DEFAULT_FALLBACK_STATIC_QRIS =
  "00020101021126650014ID.CO.QRIS.WWW01189360050300000898240214123456789012340303UMI5204581253033605802ID59101621 GROUP6007JAKARTA6105101106304A1B2";

async function updateDb() {
  const { data, error } = await supabase
    .from("outlets")
    .update({
      qris_merchant_name: "LATTESPACE",
      qris_raw_payload: DEFAULT_FALLBACK_STATIC_QRIS,
    })
    .eq("id", "00000000-0000-0000-0000-000000001621");

  console.log("Updated outlet qris:", { error, data });
}

updateDb();
