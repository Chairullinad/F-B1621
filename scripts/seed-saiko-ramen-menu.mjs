import fs from "node:fs";
import path from "node:path";
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

const OUTLET_ID = "00000000-0000-0000-0000-000000001622"; // SAIKO RAMEN
const SRC_PHOTO_DIR = path.resolve("foto-menu/FOTO SAIKO RAMEN/BG PUTIH");
const DEST_PUBLIC_DIR = path.resolve("public/menu/saiko-ramen");

// Buat folder public/menu/saiko-ramen jika belum ada
if (!fs.existsSync(DEST_PUBLIC_DIR)) {
  fs.mkdirSync(DEST_PUBLIC_DIR, { recursive: true });
}

// Salin file foto dari foto-menu/FOTO SAIKO RAMEN/BG PUTIH ke public/menu/saiko-ramen dengan slug bersih
function copyPhoto(sourceFileName, targetSlugName) {
  if (!sourceFileName) return null;
  const srcPath = path.join(SRC_PHOTO_DIR, sourceFileName);
  if (!fs.existsSync(srcPath)) {
    console.warn(`File foto tidak ditemukan: ${srcPath}`);
    return null;
  }
  const destPath = path.join(DEST_PUBLIC_DIR, targetSlugName);
  fs.copyFileSync(srcPath, destPath);
  return `/menu/saiko-ramen/${targetSlugName}`;
}

// Daftar Kategori Resmi SAIKO RAMEN
const SAIKO_CATEGORIES = [
  { name: "Ramen", sort_order: 1 },
  { name: "Add On", sort_order: 2 },
  { name: "Side Dish", sort_order: 3 },
  { name: "Drink", sort_order: 4 },
];

// Daftar 20 Menu Resmi SAIKO RAMEN beserta mapping file fotonya
const SAIKO_ITEMS = [
  // 1. Ramen
  {
    category: "Ramen",
    name: "Tori Paitan Kaarage",
    price: 22000,
    emoji: "🍜",
    cogs: 8500,
    sourcePhoto: "Tori Paitan Kaarage.jpg",
    targetSlug: "tori-paitan-kaarage.jpg",
  },
  {
    category: "Ramen",
    name: "Tori Paitan Katsu",
    price: 22000,
    emoji: "🍜",
    cogs: 8500,
    sourcePhoto: "Tori Paitan Katsu.jpg",
    targetSlug: "tori-paitan-katsu.jpg",
  },
  {
    category: "Ramen",
    name: "Tori Paitan Beef",
    price: 25000,
    emoji: "🍜",
    cogs: 10000,
    sourcePhoto: "Tori Paitan Beef.jpg",
    targetSlug: "tori-paitan-beef.jpg",
  },
  {
    category: "Ramen",
    name: "Shoyu Beef",
    price: 23000,
    emoji: "🍜",
    cogs: 9000,
    sourcePhoto: "Shoyu Beef.jpg",
    targetSlug: "shoyu-beef.jpg",
  },
  {
    category: "Ramen",
    name: "Shoyu Kaarage",
    price: 18000,
    emoji: "🍜",
    cogs: 7000,
    sourcePhoto: "Shoyu Kaarage 2.jpg",
    targetSlug: "shoyu-kaarage.jpg",
  },
  {
    category: "Ramen",
    name: "Shoyu Katsu",
    price: 18000,
    emoji: "🍜",
    cogs: 7000,
    sourcePhoto: "Shoyu Katsu.jpg",
    targetSlug: "shoyu-katsu.jpg",
  },
  {
    category: "Ramen",
    name: "Ultimate Saikoro Ramen",
    price: 30000,
    emoji: "🥩",
    cogs: 12000,
    sourcePhoto: "Ultimate Saikoro Ramen.jpg",
    targetSlug: "ultimate-saikoro-ramen.jpg",
  },
  {
    category: "Ramen",
    name: "Extreme Saiki Ramen",
    price: 30000,
    emoji: "🌶️",
    cogs: 12000,
    sourcePhoto: "Extreme Saiki Ramen.jpg",
    targetSlug: "extreme-saiki-ramen.jpg",
  },

  // 2. Add On
  {
    category: "Add On",
    name: "Extra Beef",
    price: 15000,
    emoji: "🥩",
    cogs: 6000,
    sourcePhoto: null,
    targetSlug: null,
  },
  {
    category: "Add On",
    name: "Extra Nori (Isi 2)",
    price: 4000,
    emoji: "🍙",
    cogs: 1500,
    sourcePhoto: null,
    targetSlug: null,
  },
  {
    category: "Add On",
    name: "Extra Ajitama",
    price: 3000,
    emoji: "🥚",
    cogs: 1200,
    sourcePhoto: null,
    targetSlug: null,
  },

  // 3. Side Dish
  {
    category: "Side Dish",
    name: "Katsu",
    price: 12000,
    emoji: "🍗",
    cogs: 4500,
    sourcePhoto: "Katsu.jpg",
    targetSlug: "katsu.jpg",
  },
  {
    category: "Side Dish",
    name: "Karage",
    price: 12000,
    emoji: "🍗",
    cogs: 4500,
    sourcePhoto: "Kaarage.jpg",
    targetSlug: "karage.jpg",
  },
  {
    category: "Side Dish",
    name: "Cornribs",
    price: 12000,
    emoji: "🌽",
    cogs: 4000,
    sourcePhoto: "Cornribs.jpg",
    targetSlug: "cornribs.jpg",
  },

  // 4. Drink
  {
    category: "Drink",
    name: "Green Tea (Free Refill)",
    price: 4000,
    emoji: "🍵",
    cogs: 1000,
    sourcePhoto: "Green Tea.jpg",
    targetSlug: "green-tea.jpg",
  },
  {
    category: "Drink",
    name: "Housebland Iced Tea",
    price: 5000,
    emoji: "🍹",
    cogs: 1500,
    sourcePhoto: "Peach Tea.jpg",
    targetSlug: "housebland-iced-tea.jpg",
  },
  {
    category: "Drink",
    name: "Lemon Tea",
    price: 6000,
    emoji: "🍋",
    cogs: 2000,
    sourcePhoto: "Peach Tea.jpg",
    targetSlug: "lemon-tea.jpg",
  },
  {
    category: "Drink",
    name: "Lychee Tea",
    price: 7000,
    emoji: "🍹",
    cogs: 2500,
    sourcePhoto: "Leci Tea.jpg",
    targetSlug: "lychee-tea.jpg",
  },
  {
    category: "Drink",
    name: "Lemonade",
    price: 7000,
    emoji: "🍋",
    cogs: 2500,
    sourcePhoto: "Lemonade.jpg",
    targetSlug: "lemonade.jpg",
  },
  {
    category: "Drink",
    name: "Teh Tarik",
    price: 10000,
    emoji: "🧋",
    cogs: 3500,
    sourcePhoto: "Teh Tarik.jpg",
    targetSlug: "teh-tarik.jpg",
  },
];

async function run() {
  console.log("1. Memperbarui profil outlet SAIKO RAMEN...");
  const { error: outletErr } = await supabase
    .from("outlets")
    .update({
      name: "SAIKO RAMEN",
      receipt_footer: "Itadakimasu! — Terima kasih telah berkunjung ke SAIKO RAMEN!",
    })
    .eq("id", OUTLET_ID);
  if (outletErr) {
    console.error("Gagal update outlet:", outletErr);
  }

  console.log("2. Menonaktifkan (soft-delete) menu & kategori lama di SAIKO RAMEN...");
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

  console.log("3. Memasukkan 4 Kategori Resmi SAIKO RAMEN...");
  const categoryMap = new Map();

  for (const cat of SAIKO_CATEGORIES) {
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

  console.log("4. Menyalin foto ke public/menu/saiko-ramen & memasukkan 20 Menu SAIKO RAMEN...");
  const productsToInsert = SAIKO_ITEMS.map((item) => {
    const imageUrl = copyPhoto(item.sourcePhoto, item.targetSlug);
    if (imageUrl) {
      console.log(`   [FOTO] ${item.name} -> ${imageUrl}`);
    }
    return {
      outlet_id: OUTLET_ID,
      category_id: categoryMap.get(item.category),
      name: item.name,
      price: item.price,
      emoji: item.emoji,
      cogs_estimate: item.cogs,
      image_url: imageUrl,
      is_available: true,
      is_active: true,
      deleted_at: null,
    };
  });

  const { data: insertedProducts, error: prodErr } = await supabase
    .from("products")
    .insert(productsToInsert)
    .select("id, name, price, image_url");

  if (prodErr) {
    console.error("Gagal insert produk:", prodErr);
    process.exit(1);
  }

  console.log(`\nBerhasil memasukkan ${insertedProducts.length} menu beserta fotonya ke outlet SAIKO RAMEN!`);
}

run();
