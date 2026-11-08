import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const OUTLET_1_ID = '00000000-0000-0000-0000-000000001621'; // LATTESPACE
const OUTLET_2_ID = '00000000-0000-0000-0000-000000001622'; // SAIKO RAMEN

async function seed() {
  console.log('Seeding LATTESPACE & SAIKO RAMEN...');

  // 1. Update Outlet 1 -> LATTESPACE
  const o1Meta = JSON.stringify({
    description: 'Coffee, Eatery & Lounge',
    themeColor: '#3B7097',
    logoUrl: '/logo-1621.png',
    phone: '0812-1621-0001',
  });

  const { error: updErr1 } = await supabase
    .from('outlets')
    .update({
      name: 'LATTESPACE',
      address: 'Jl. Merbabu No. 16, Boyolali',
      receipt_footer: o1Meta,
      deleted_at: null,
    })
    .eq('id', OUTLET_1_ID);

  if (updErr1) console.error('Error updating LATTESPACE:', updErr1);
  else console.log('✓ Outlet 1 updated to LATTESPACE');

  // 2. Insert or Update Outlet 2 -> SAIKO RAMEN
  const o2Meta = JSON.stringify({
    description: 'Authentic Japanese Ramen & Donburi',
    themeColor: '#E11D48',
    logoUrl: '/logo-1621.png',
    phone: '0812-1621-0002',
  });

  const { data: existingO2 } = await supabase
    .from('outlets')
    .select('id')
    .eq('id', OUTLET_2_ID)
    .maybeSingle();

  if (!existingO2) {
    const { error: insErr2 } = await supabase.from('outlets').insert({
      id: OUTLET_2_ID,
      name: 'SAIKO RAMEN',
      address: 'Jl. Pandanaran No. 21, Boyolali',
      receipt_footer: o2Meta,
      order_expiry_minutes: 15,
      tax_enabled: false,
      service_enabled: false,
      price_includes_tax: false,
    });
    if (insErr2) console.error('Error creating SAIKO RAMEN:', insErr2);
    else console.log('✓ Outlet 2 created: SAIKO RAMEN');
  } else {
    await supabase.from('outlets').update({
      name: 'SAIKO RAMEN',
      address: 'Jl. Pandanaran No. 21, Boyolali',
      receipt_footer: o2Meta,
      deleted_at: null,
    }).eq('id', OUTLET_2_ID);
    console.log('✓ Outlet 2 updated: SAIKO RAMEN');
  }

  // 3. Tables for SAIKO RAMEN (Meja 1 - 10)
  const { data: existingTables } = await supabase
    .from('tables')
    .select('id')
    .eq('outlet_id', OUTLET_2_ID);

  if (!existingTables || existingTables.length === 0) {
    const tables = [];
    for (let i = 1; i <= 10; i++) {
      tables.push({
        outlet_id: OUTLET_2_ID,
        table_no: i,
        name: `Meja ${i}`,
        qr_token: `saiko_ramen_table_token_${i}_${Date.now()}_abc1621`,
        is_active: true,
      });
    }
    const { error: tblErr } = await supabase.from('tables').insert(tables);
    if (tblErr) console.error('Error inserting SAIKO RAMEN tables:', tblErr);
    else console.log('✓ 10 tables created for SAIKO RAMEN');
  }

  // 4. Categories for SAIKO RAMEN
  const saikoCategories = [
    { id: '00000000-0000-0000-0001-000000000011', name: 'Specialty Ramen Bowls', sort_order: 1 },
    { id: '00000000-0000-0000-0001-000000000012', name: 'Rice Bowls (Donburi)', sort_order: 2 },
    { id: '00000000-0000-0000-0001-000000000013', name: 'Side Dish & Appetizers', sort_order: 3 },
    { id: '00000000-0000-0000-0001-000000000014', name: 'Japanese Drinks & Ocha', sort_order: 4 },
  ];

  for (const cat of saikoCategories) {
    const { data: existCat } = await supabase.from('categories').select('id').eq('id', cat.id).maybeSingle();
    if (!existCat) {
      await supabase.from('categories').insert({
        id: cat.id,
        outlet_id: OUTLET_2_ID,
        name: cat.name,
        sort_order: cat.sort_order,
        is_active: true,
      });
    }
  }
  console.log('✓ Categories verified for SAIKO RAMEN');

  // 5. Products for SAIKO RAMEN
  const saikoProducts = [
    { id: '00000000-0000-0000-0002-000000000021', catId: saikoCategories[0].id, name: 'Shoyu Ramen Classic', price: 38000, emoji: '🍜' },
    { id: '00000000-0000-0000-0002-000000000022', catId: saikoCategories[0].id, name: 'Tori Paitan Rich Broth Ramen', price: 42000, emoji: '🍜' },
    { id: '00000000-0000-0000-0002-000000000023', catId: saikoCategories[0].id, name: 'Spicy Miso Beef Ramen', price: 45000, emoji: '🍜' },
    { id: '00000000-0000-0000-0002-000000000024', catId: saikoCategories[1].id, name: 'Gyu Donburi Sapi Panggang', price: 39000, emoji: '🍚' },
    { id: '00000000-0000-0000-0002-000000000025', catId: saikoCategories[1].id, name: 'Chicken Katsu Curry Don', price: 36000, emoji: '🍛' },
    { id: '00000000-0000-0000-0002-000000000026', catId: saikoCategories[2].id, name: 'Pan-Fried Gyoza (5 pcs)', price: 25000, emoji: '🥟' },
    { id: '00000000-0000-0000-0002-000000000027', catId: saikoCategories[2].id, name: 'Chicken Karaage Crispy', price: 27000, emoji: '🍗' },
    { id: '00000000-0000-0000-0002-000000000028', catId: saikoCategories[3].id, name: 'Cold Ocha Green Tea', price: 12000, emoji: '🍵' },
    { id: '00000000-0000-0000-0002-000000000029', catId: saikoCategories[3].id, name: 'Iced Lemon Yuzu Tea', price: 18000, emoji: '🍹' },
  ];

  for (const prod of saikoProducts) {
    const { data: existProd } = await supabase.from('products').select('id').eq('id', prod.id).maybeSingle();
    if (!existProd) {
      await supabase.from('products').insert({
        id: prod.id,
        outlet_id: OUTLET_2_ID,
        category_id: prod.catId,
        name: prod.name,
        price: prod.price,
        emoji: prod.emoji,
        is_available: true,
        is_active: true,
      });
    }
  }
  console.log('✓ Products verified for SAIKO RAMEN');

  // 6. Ingredients for SAIKO RAMEN
  const saikoIngredients = [
    { id: '00000000-0000-0000-0003-000000000021', name: 'Mie Ramen Segar', unit: 'porsi', current_stock: 45, min_stock: 15 },
    { id: '00000000-0000-0000-0003-000000000022', name: 'Kaldu Ayam Paitan', unit: 'liter', current_stock: 30, min_stock: 10 },
    { id: '00000000-0000-0000-0003-000000000023', name: 'Daging Chashu Ayam', unit: 'gram', current_stock: 3500, min_stock: 1000 },
    { id: '00000000-0000-0000-0003-000000000024', name: 'Telur Ajitsuke Tamago', unit: 'pcs', current_stock: 60, min_stock: 20 },
    { id: '00000000-0000-0000-0003-000000000025', name: 'Kulit Gyoza & Daging Cincang', unit: 'porsi', current_stock: 25, min_stock: 10 },
    { id: '00000000-0000-0000-0003-000000000026', name: 'Daun Bawang & Nori', unit: 'gram', current_stock: 1200, min_stock: 500 },
    { id: '00000000-0000-0000-0003-000000000027', name: 'Teh Hijau Ocha Powder', unit: 'gram', current_stock: 2000, min_stock: 400 },
  ];

  for (const ing of saikoIngredients) {
    const { data: existIng } = await supabase.from('ingredients').select('id').eq('id', ing.id).maybeSingle();
    if (!existIng) {
      await supabase.from('ingredients').insert({
        id: ing.id,
        outlet_id: OUTLET_2_ID,
        name: ing.name,
        unit: ing.unit,
        current_stock: ing.current_stock,
        min_stock: ing.min_stock,
        category: 'Bahan Baku Ramen',
        is_active: true,
      });
    }
  }
  console.log('✓ Ingredients verified for SAIKO RAMEN');

  // 7. BOM Recipes for SAIKO RAMEN
  const saikoRecipes = [
    { prodId: saikoProducts[0].id, ingId: saikoIngredients[0].id, qty: 1 },
    { prodId: saikoProducts[0].id, ingId: saikoIngredients[1].id, qty: 0.35 },
    { prodId: saikoProducts[0].id, ingId: saikoIngredients[2].id, qty: 60 },
    { prodId: saikoProducts[0].id, ingId: saikoIngredients[3].id, qty: 1 },
    { prodId: saikoProducts[5].id, ingId: saikoIngredients[4].id, qty: 1 },
    { prodId: saikoProducts[7].id, ingId: saikoIngredients[6].id, qty: 10 },
  ];

  for (const rec of saikoRecipes) {
    await supabase.from('product_recipes').upsert({
      outlet_id: OUTLET_2_ID,
      product_id: rec.prodId,
      ingredient_id: rec.ingId,
      qty_per_portion: rec.qty,
    }, { onConflict: 'product_id,ingredient_id' });
  }
  console.log('✓ Recipes BOM verified for SAIKO RAMEN');

  console.log('🎉 Selesai! LATTESPACE & SAIKO RAMEN sudah aktif di database!');
}

seed().catch(console.error);
