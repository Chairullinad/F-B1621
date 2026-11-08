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

async function run() {
  const { data: outlets, error } = await supabase.from('outlets').select('id, name, created_at');
  console.log('Outlets:', outlets);
  if (error) console.error('Error:', error);

  const { data: categories } = await supabase.from('categories').select('id, name, outlet_id');
  console.log('Categories count:', categories?.length, categories);

  const { data: products } = await supabase.from('products').select('id, name, outlet_id').limit(10);
  console.log('Sample products:', products);
}

run();

