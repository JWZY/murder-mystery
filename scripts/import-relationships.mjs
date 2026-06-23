// Take relationship-edge drafts back into Supabase — the relationship half of the
// AI bridge (import-characters.mjs handles characters). You draft edges with Claude
// Code (reading planning/world.md for character ids), save them as a JSON array,
// and this upserts each one via the same host RPC the app uses.
//
// Usage:  node scripts/import-relationships.mjs edges.json "<host passcode>"
//   (or)  HOST_PASSCODE="..." npm run import:relationships -- edges.json
//
// edges.json is an array of edge objects:
//   { id?, from_char, to_char, label }
// - from_char / to_char are character ids (the `id:` lines in world.md).
// - label is how `from_char` relates to `to_char` (directed).
//
// Edges without an `id` get a fresh UUID, written back into the file so re-running
// is idempotent (updates rather than duplicating).
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const file = process.argv[2];
const passcode = process.argv[3] || process.env.HOST_PASSCODE;
if (!file || !passcode) {
  console.error('Usage: npm run import:relationships -- <edges.json> "<passcode>"');
  console.error('   (or set HOST_PASSCODE and pass just the file)');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let edges;
try {
  edges = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`Could not read/parse ${file}:`, e.message);
  process.exit(1);
}
if (!Array.isArray(edges)) {
  console.error('Expected the JSON to be an array of edge objects.');
  process.exit(1);
}

const ALLOWED = new Set(['id', 'from_char', 'to_char', 'label']);

let mintedAny = false;
let ok = 0;
for (const [i, raw] of edges.entries()) {
  if (!raw || typeof raw !== 'object') {
    console.error(`  ✗ entry ${i} is not an object — skipped`);
    continue;
  }
  if (!raw.from_char || !raw.to_char) {
    console.error(`  ✗ entry ${i} missing from_char/to_char — skipped`);
    continue;
  }
  if (!raw.id) {
    raw.id = randomUUID();
    mintedAny = true;
  }
  const payload = Object.fromEntries(Object.entries(raw).filter(([k]) => ALLOWED.has(k)));
  const { data, error } = await sb.rpc('host_save_relationship', { p_secret: passcode, payload });
  if (error) console.error(`  ✗ ${raw.from_char} → ${raw.to_char}: ${error.message}`);
  else { ok++; console.log(`  ✓ ${raw.from_char} → ${raw.to_char} → ${data}`); }
}

if (mintedAny) {
  writeFileSync(file, JSON.stringify(edges, null, 2) + '\n', 'utf8');
  console.log(`Wrote fresh UUIDs back into ${file} — re-runs will update, not duplicate.`);
}
console.log(`Imported ${ok}/${edges.length} relationships.`);
if (ok < edges.length) process.exitCode = 1;
