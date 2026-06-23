// Delete one or more characters by id via the host RPC the app uses.
// Useful for pruning characters that are no longer part of the story.
//
// Usage:  node scripts/delete-character.mjs "<host passcode>" <id> [<id> ...]
//   (or)  HOST_PASSCODE="..." node scripts/delete-character.mjs <id> [<id> ...]
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

let args = process.argv.slice(2);
let passcode = process.env.HOST_PASSCODE;
// If the first arg isn't a UUID, treat it as the passcode.
if (args[0] && !/^[0-9a-f-]{36}$/i.test(args[0])) passcode = args.shift();
const ids = args;

if (!passcode || ids.length === 0) {
  console.error('Usage: node scripts/delete-character.mjs "<passcode>" <id> [<id> ...]');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let ok = 0;
for (const id of ids) {
  const { data, error } = await sb.rpc('host_delete_character', { p_secret: passcode, p_id: id });
  if (error) console.error(`  ✗ ${id}: ${error.message}`);
  else { ok++; console.log(`  ✓ deleted ${id} (returned ${data})`); }
}
console.log(`Deleted ${ok}/${ids.length} characters.`);
if (ok < ids.length) process.exitCode = 1;
