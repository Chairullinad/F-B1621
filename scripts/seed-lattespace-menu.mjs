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

// Daftar Kategori Resmi dari PDF "MENU LATTE SPACE FINAL.pdf"
const MENU_CATEGORIES = [
  { name: "Signature", sort_order: 1 },
  { name: "Klasik", sort_order: 2 },
  { name: "Non Coffee", sort_order: 3 },
  { name: "Smoothies", sort_order: 4 },
  { name: "Fish", sort_order: 5 },
  { name: "Main Course", sort_order: 6 },
  { name: "Snack", sort_order: 7 },
];

// Daftar 41 Menu Resmi dari PDF "MENU LATTE SPACE FINAL.pdf"
const MENU_ITEMS = [
  // 1. Signature
  { category: "Signature", name: "Golden Palm", price: 20000, emoji: "☕", cogs: 7000 },
  { category: "Signature", name: "Coco Verde", price: 20000, emoji: "🥥", cogs: 7000 },
  { category: "Signature", name: "Daily Latte", price: 20000, emoji: "☕", cogs: 6500 },
  { category: "Signature", name: "Fondation", price: 20000, emoji: "☕", cogs: 7000 },
  { category: "Signature", name: "Irish", price: 20000, emoji: "☕", cogs: 7000 },
  { category: "Signature", name: "Legit", price: 20000, emoji: "☕", cogs: 7000 },
  { category: "Signature", name: "Butterschotch", price: 20000, emoji: "☕", cogs: 7000 },
  { category: "Signature", name: "Salted Caramel", price: 20000, emoji: "☕", cogs: 7000 },
  { category: "Signature", name: "Montblanc", price: 20000, emoji: "🍊", cogs: 7500 },

  // 2. Klasik
  { category: "Klasik", name: "Black", price: 18000, emoji: "☕", cogs: 5000 },
  { category: "Klasik", name: "Applecano", price: 18000, emoji: "🍎", cogs: 6000 },
  { category: "Klasik", name: "Lecicano", price: 18000, emoji: "🍹", cogs: 6000 },
  { category: "Klasik", name: "Latte", price: 20000, emoji: "☕", cogs: 6500 },
  { category: "Klasik", name: "Cappucinno", price: 20000, emoji: "☕", cogs: 6500 },
  { category: "Klasik", name: "Cafe Mocca", price: 20000, emoji: "🍫", cogs: 7000 },

  // 3. Non Coffee
  { category: "Non Coffee", name: "Java Tea", price: 5000, emoji: "🍵", cogs: 1500 },
  { category: "Non Coffee", name: "Lemon Tea", price: 6000, emoji: "🍋", cogs: 2000 },
  { category: "Non Coffee", name: "Ice Cream", price: 10000, emoji: "🍨", cogs: 3500 },
  { category: "Non Coffee", name: "Leci Tea", price: 15000, emoji: "🍹", cogs: 5000 },
  { category: "Non Coffee", name: "Coklat", price: 18000, emoji: "🍫", cogs: 6000 },
  { category: "Non Coffee", name: "Matcha", price: 18000, emoji: "🍵", cogs: 6500 },
  { category: "Non Coffee", name: "Cookies N Cream", price: 18000, emoji: "🍪", cogs: 6500 },
  { category: "Non Coffee", name: "Blue Sky", price: 18000, emoji: "🧊", cogs: 5500 },

  // 4. Smoothies
  { category: "Smoothies", name: "Berry Banana", price: 18000, emoji: "🍓", cogs: 6500 },
  { category: "Smoothies", name: "Dragon Berry", price: 18000, emoji: "🥤", cogs: 6500 },
  { category: "Smoothies", name: "Dragon Banana", price: 18000, emoji: "🍌", cogs: 6500 },
  { category: "Smoothies", name: "Mix Berry", price: 18000, emoji: "🫐", cogs: 6500 },

  // 5. Fish
  { category: "Fish", name: "Belanak Goreng", price: 30000, emoji: "🐟", cogs: 12000 },
  { category: "Fish", name: "Belanak Bakar", price: 32000, emoji: "🐟", cogs: 13000 },

  // 6. Main Course
  { category: "Main Course", name: "Sawagiana", price: 25000, emoji: "🍗", cogs: 10000 },
  { category: "Main Course", name: "Katsu Steak", price: 25000, emoji: "🥩", cogs: 10000 },
  { category: "Main Course", name: "Katsu Dabu-dabu Rice", price: 25000, emoji: "🍱", cogs: 10000 },
  { category: "Main Course", name: "Steak Barbeque", price: 25000, emoji: "🥩", cogs: 10000 },
  { category: "Main Course", name: "Ayam Goreng", price: 30000, emoji: "🍗", cogs: 12000 },
  { category: "Main Course", name: "Ayam Bakar", price: 32000, emoji: "🍗", cogs: 13000 },

  // 7. Snack
  { category: "Snack", name: "Cireng", price: 12000, emoji: "🥟", cogs: 4000 },
  { category: "Snack", name: "Tahu Bakso", price: 15000, emoji: "🧆", cogs: 5000 },
  { category: "Snack", name: "French Fries", price: 15000, emoji: "🍟", cogs: 5000 },
  { category: "Snack", name: "Singkong Keju Goreng", price: 16000, emoji: "🧀", cogs: 5000 },
  { category: "Snack", name: "Getuk", price: 16000, emoji: "🍘", cogs: 5000 },
  { category: "Snack", name: "Mix Platter", price: 20000, emoji: "🍟", cogs: 7500 },
];

async function run() {
  console.log("1. Memperbarui profil outlet LATTESPACE...");
  const { error: outletErr } = await supabase
    .from("outlets")
    .update({
      name: "LATTE SPACE",
      address: "Metuk, Mojosongo, Boyolali | Reservation : 0882 0030 49722",
      receipt_footer: "Take a Break, Enjoy the Brew — Terima kasih telah berkunjung ke LATTE SPACE!",
    })
    .eq("id", OUTLET_ID);
  if (outletErr) {
    console.error("Gagal update outlet:", outletErr);
  }

  console.log("2. Menonaktifkan (soft-delete) menu & kategori dummy lama...");
  const nowIso = new Date().toISOString();

  await supabase
    .from("products")
    .update({ is_active: false, is_available: false, deleted_at: nowIso })
    .eq("outlet_id", OUTLET_ID)
    .is("deleted_at", null);

  await supabase
    .from("categories")
    .update({ is_active: false, deleted_at: nowIso })
    .eq("outlet_id", OUTLET_ID)
    .is("deleted_at", null);

  console.log("3. Memasukkan 7 Kategori Resmi LATTE SPACE...");
  const categoryMap = new Map();

  for (const cat of MENU_CATEGORIES) {
    const { data: insertedCat, error: catErr } = await supabase
      .from("categories")
      .insert({
        outlet_id: OUTLET_ID,
        name: cat.name,
        sort_order: cat.sort_order,
        is_active: true,
        deleted_at: null,
      })
      .select("id, name")
      .single();

    if (catErr) {
      console.error(`Gagal insert kategori ${cat.name}:`, catErr);
      process.exit(1);
    }
    categoryMap.set(cat.name, insertedCat.id);
    console.log(`   + Kategori [${cat.sort_order}] ${cat.name} -> ${insertedCat.id}`);
  }

  console.log("4. Memasukkan 41 Menu Resmi LATTE SPACE...");
  const productsToInsert = MENU_ITEMS.map((item) => ({
    outlet_id: OUTLET_ID,
    category_id: categoryMap.get(item.category),
    name: item.name,
    price: item.price,
    emoji: item.emoji,
    cogs_estimate: item.cogs,
    image_url: null,
    is_available: true,
    is_active: true,
    deleted_at: null,
  }));

  const { data: insertedProducts, error: prodErr } = await supabase
    .from("products")
    .insert(productsToInsert)
    .select("id, name, price, category_id");

  if (prodErr) {
    console.error("Gagal insert produk:", prodErr);
    process.exit(1);
  }

  console.log(`\nBerhasil memasukkan ${insertedProducts.length} menu ke outlet LATTE SPACE!`);
}

run();
