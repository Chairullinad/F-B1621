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

const OUTLET_ID = "00000000-0000-0000-0000-000000001621";

async function inspect() {
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("outlet_id", OUTLET_ID)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("outlet_id", OUTLET_ID)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  console.log("=== CATEGORIES ===");
  console.log(categories);
  console.log("\n=== PRODUCTS (" + (products?.length || 0) + ") ===");
  console.log(
    products?.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category_id: p.category_id,
      deleted_at: p.deleted_at,
    }))
  );
}

inspect();
