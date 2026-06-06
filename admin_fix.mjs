/**
 * Sets ALL public.users rows to role = 'admin'.
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env to bypass RLS.
 *
 * Usage:  node admin_fix.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Read .env manually (no external deps) ──────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dir, '.env'), 'utf-8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const eq = l.indexOf('=');
      if (eq < 0) return null;
      const key = l.slice(0, eq).trim();
      let val = l.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [key, val];
    })
    .filter(Boolean)
);

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || SERVICE_KEY.includes('PASTE')) {
  console.error(
    '\n❌  Missing or placeholder SUPABASE_SERVICE_ROLE_KEY in .env\n' +
      '    → Go to https://supabase.com/dashboard/project/' +
      (env.VITE_SUPABASE_PROJECT_ID || 'YOUR_PROJECT') +
      '/settings/api\n' +
      '    → Copy the service_role secret key\n' +
      '    → Paste it in .env as SUPABASE_SERVICE_ROLE_KEY="eyJ…"\n'
  );
  process.exit(1);
}

// ── Use fetch directly against PostgREST (no npm deps needed) ──────
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function run() {
  // 1. List current users
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email,role`, { headers });
  if (!listRes.ok) {
    console.error('❌  Could not read public.users:', listRes.status, await listRes.text());
    process.exit(1);
  }
  const users = await listRes.json();
  console.log(`\n📋  Found ${users.length} user(s) in public.users:`);
  users.forEach((u) => console.log(`    ${u.email ?? '(no email)'} — role: ${u.role}`));

  // 2. Update ALL to admin
  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=neq.admin`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ role: 'admin' }),
  });

  if (!updateRes.ok) {
    console.error('❌  Failed to update roles:', updateRes.status, await updateRes.text());
    process.exit(1);
  }

  const updated = await updateRes.json();
  console.log(`\n✅  Updated ${updated.length} user(s) to role = 'admin'`);

  // 3. Verify
  const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email,role`, { headers });
  const final = await verifyRes.json();
  console.log('\n📋  Final state:');
  final.forEach((u) => console.log(`    ${u.email ?? '(no email)'} — role: ${u.role}`));
  console.log('\n🎉  Done! You can now access /admin.\n');
}

run().catch((e) => {
  console.error('❌  Unexpected error:', e);
  process.exit(1);
});
