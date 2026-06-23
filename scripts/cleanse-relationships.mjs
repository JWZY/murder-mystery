// One-off cleanse: delete EVERY relationship edge in the DB. The only edges
// that ever existed were speculative (host-drafted), and relationship
// brainstorming now lives in a disposable local page — not the live canvas.
// Players never submitted relationships, so this can't destroy submitted info.
//
// Usage:  node scripts/cleanse-relationships.mjs "<host passcode>"
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const passcode = process.argv[2] || process.env.HOST_PASSCODE;
if (!passcode) {
  console.error('Usage: node scripts/cleanse-relationships.mjs "<passcode>"');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { data: world, error } = await sb.rpc('host_bootstrap', { p_secret: passcode });
if (error) { console.error('host_bootstrap failed:', error.message); process.exit(1); }

const rels = world.relationships ?? [];
if (!rels.length) { console.log('No relationships to delete.'); process.exit(0); }

let ok = 0;
for (const r of rels) {
  const { error: delErr } = await sb.rpc('host_delete_relationship', { p_secret: passcode, p_id: r.id });
  if (delErr) console.error(`  ✗ ${r.id}: ${delErr.message}`);
  else { ok++; console.log(`  ✓ deleted ${r.id}`); }
}
console.log(`Deleted ${ok}/${rels.length} relationships.`);
if (ok < rels.length) process.exitCode = 1;
