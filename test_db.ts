import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function testDB() {
  const tables = ['users', 'transactions', 'orders', 'topup_requests', 'services', 'packages', 'app_settings'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    console.log(`Table ${table}:`, { data: data?.length || 0, error: error?.message, code: error?.code });
  }
}
testDB();
