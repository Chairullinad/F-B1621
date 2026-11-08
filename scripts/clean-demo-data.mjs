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

async function cleanDemoData() {
  console.log("=== Membersihkan & Merampingkan Data Demo untuk Presentasi ===");

  // 1. Kosongkan seluruh transaksi demo lama agar omzet mulai dari Rp 0
  await supabase.from("refunds").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("accounting_journals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("stock_movements").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("waste_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("- Transaksi, Pembayaran, Jurnal, dan Mutasi Stok berhasil di-reset ke Rp 0.");

  // 2. Untuk setiap cabang aktif, sisakan 3 produk contoh & 3 bahan baku inti agar rapi saat demo input
  const { data: outlets } = await supabase
    .from("outlets")
    .select("id, name")
    .is("deleted_at", null);

  for (const outlet of outlets ?? []) {
    // Produk: urutkan dan sisakan 3 produk pertama
    const { data: prods } = await supabase
      .from("products")
      .select("id, name")
      .eq("outlet_id", outlet.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (prods && prods.length > 3) {
      const toRemoveIds = prods.slice(3).map((p) => p.id);
      await supabase.from("product_recipes").delete().in("product_id", toRemoveIds);
      await supabase.from("products").delete().in("id", toRemoveIds);
      console.log(`- [${outlet.name}] Merampingkan produk dari ${prods.length} menjadi 3 menu contoh.`);
    }

    // Bahan Baku: sisakan 3 bahan baku pertama
    const { data: ings } = await supabase
      .from("ingredients")
      .select("id, name")
      .eq("outlet_id", outlet.id)
      .order("created_at", { ascending: true });

    if (ings && ings.length > 3) {
      const toRemoveIngIds = ings.slice(3).map((i) => i.id);
      await supabase.from("product_recipes").delete().in("ingredient_id", toRemoveIngIds);
      await supabase.from("ingredients").delete().in("id", toRemoveIngIds);
      console.log(`- [${outlet.name}] Merampingkan bahan baku dari ${ings.length} menjadi 3 bahan inti.`);
    }

    // Meja: aktifkan Meja 1..15 saja agar dropdown meja ringkas saat demo
    await supabase
      .from("tables")
      .update({ is_active: true })
      .eq("outlet_id", outlet.id)
      .lte("table_no", 15);
    await supabase
      .from("tables")
      .update({ is_active: false })
      .eq("outlet_id", outlet.id)
      .gt("table_no", 15);
  }

  console.log("=== Selesai! Database bersih & siap untuk input saat presentasi ===");
}

cleanDemoData();
