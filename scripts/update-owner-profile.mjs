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
  console.log("1. Memperbarui nama di tabel profiles...");
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .update({ full_name: "Fauzi Adiadi" })
    .eq("role", "owner")
    .select("id, full_name, role");
  console.log("Profiles updated:", profiles, pErr);

  console.log("2. Memperbarui metadata user di auth.users...");
  const { data: userList, error: lErr } = await supabase.auth.admin.listUsers();
  if (userList?.users) {
    for (const u of userList.users) {
      if (u.user_metadata?.role === "owner" || u.email?.includes("owner")) {
        const { data: updatedUser, error: uErr } = await supabase.auth.admin.updateUserById(
          u.id,
          {
            user_metadata: {
              ...u.user_metadata,
              full_name: "Fauzi Adiadi",
            },
          }
        );
        console.log("Updated auth user:", u.email, updatedUser?.user?.user_metadata, uErr);
      }
    }
  }

  console.log("Selesai!");
}

run();

