// Take character drafts back into Supabase — the other half of the AI bridge.
// You draft characters with Claude Code (reading planning/world.md), save them
// as a JSON array, and this upserts each one via the same host RPC the app uses.
//
// Usage:  node scripts/import-characters.mjs drafts.json "<host passcode>"
//   (or)  HOST_PASSCODE="..." npm run import:characters -- drafts.json
//
// drafts.json is an array of character objects. Recognised keys (all optional
// except you'll usually want name + title + juice):
//   id, name, title, juice, background, act1, act2, act3, action, secret,
//   props, recommended_meets, truth_tags ([{beat,truth}]), color, x, y,
//   participant_id (cast this guest into the character)
//
// Drafts without an `id` get a fresh UUID, which is written back into the file
// so re-running is idempotent (it updates rather than duplicating).
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const file = process.argv[2];
const passcode = process.argv[3] || process.env.HOST_PASSCODE;
if (!file || !passcode) {
  console.error('Usage: npm run import:characters -- <drafts.json> "<passcode>"');
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

let drafts;
try {
  drafts = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`Could not read/parse ${file}:`, e.message);
  process.exit(1);
}
if (!Array.isArray(drafts)) {
  console.error('Expected the JSON to be an array of character objects.');
  process.exit(1);
}

const ALLOWED = new Set([
  'id', 'name', 'title', 'juice', 'background', 'act1', 'act2', 'act3',
  'action', 'secret', 'props', 'recommended_meets', 'truth_tags', 'color',
  'x', 'y', 'released', 'background_released', 'participant_id',
]);

let mintedAny = false;
let ok = 0;
for (const [i, raw] of drafts.entries()) {
  if (!raw || typeof raw !== 'object') {
    console.error(`  ✗ entry ${i} is not an object — skipped`);
    continue;
  }
  if (!raw.id) {
    raw.id = randomUUID();
    mintedAny = true;
  }
  const payload = Object.fromEntries(Object.entries(raw).filter(([k]) => ALLOWED.has(k)));
  const { data, error } = await sb.rpc('host_save_character', { p_secret: passcode, payload });
  if (error) console.error(`  ✗ ${raw.name ?? raw.id}: ${error.message}`);
  else { ok++; console.log(`  ✓ ${raw.name ?? '(unnamed)'} → ${data}`); }
}

if (mintedAny) {
  writeFileSync(file, JSON.stringify(drafts, null, 2) + '\n', 'utf8');
  console.log(`Wrote fresh UUIDs back into ${file} — re-runs will update, not duplicate.`);
}
console.log(`Imported ${ok}/${drafts.length} characters.`);
if (ok < drafts.length) process.exitCode = 1;
