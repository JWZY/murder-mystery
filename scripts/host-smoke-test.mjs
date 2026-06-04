// Smoke test for the HOST RPC surface (host.sql + casting.sql).
// Usage:  node scripts/host-smoke-test.mjs "<your host passcode>"
//   (or)  HOST_PASSCODE="..." node scripts/host-smoke-test.mjs
//
// Uses the PUBLISHABLE key + your passcode — exactly what the host UI does.
// It creates a throwaway character, releases/unreleases it, then deletes it.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const passcode = process.argv[2] || process.env.HOST_PASSCODE;
if (!passcode) {
  console.error('Pass your host passcode: node scripts/host-smoke-test.mjs "<passcode>"');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const ok = (m) => console.log('  ✓', m);
const bad = (m, e) => { console.error('  ✗', m, '→', e?.message ?? e); process.exitCode = 1; };

console.log('1. host_check (good + bad passcode)');
{
  const good = await sb.rpc('host_check', { p_secret: passcode });
  good.error ? bad('host_check', good.error) : (good.data ? ok('valid passcode accepted') : bad('valid passcode REJECTED — wrong passcode?'));
  const wrong = await sb.rpc('host_check', { p_secret: passcode + '-nope' });
  (!wrong.data) ? ok('wrong passcode rejected') : bad('wrong passcode ACCEPTED (!)');
}

console.log('2. host_bootstrap (the host world)');
let world;
{
  const { data, error } = await sb.rpc('host_bootstrap', { p_secret: passcode });
  if (error) { bad('bootstrap (did you run casting.sql?)', error); process.exit(1); }
  world = data;
  ok(`${data.participants.length} participants · ${data.characters.length} characters · settings ${data.settings ? 'ok' : 'MISSING'}`);
}

console.log('3. host_save_character (create throwaway)');
let cid;
{
  const { data, error } = await sb.rpc('host_save_character', {
    p_secret: passcode,
    payload: { name: 'SMOKE — delete me', title: 'test', truth_tags: [{ beat: 'act1', truth: 'x' }] },
  });
  error ? bad('create', error) : (cid = data, ok(`created ${data}`));
}
if (!cid) process.exit(1);

console.log('4. SECURITY: a released card is NOT leaked without a token');
{
  // Without a valid participant token, get_my_character must return nothing even
  // for a released character. (We can't easily link without a token here, so we
  // just confirm a bad token yields null.)
  const { data } = await sb.rpc('get_my_character', { p_token: 'not-a-real-token' });
  (!data) ? ok('bad token → null') : bad('LEAK', JSON.stringify(data));
}

console.log('5. host_save_character (update + release toggle)');
{
  const up = await sb.rpc('host_save_character', { p_secret: passcode, payload: { id: cid, released: true } });
  up.error ? bad('release', up.error) : ok('released');
  const down = await sb.rpc('host_save_character', { p_secret: passcode, payload: { id: cid, released: false } });
  down.error ? bad('un-release', down.error) : ok('un-released');
}

console.log('6. SECURITY: write RPC refuses a bad passcode');
{
  const { error } = await sb.rpc('host_save_character', { p_secret: 'wrong', payload: { name: 'hax' } });
  error ? ok(`blocked (${error.message})`) : bad('bad passcode was allowed to write (!)');
}

console.log('7. host_delete_character (cleanup)');
{
  const { error } = await sb.rpc('host_delete_character', { p_secret: passcode, p_id: cid });
  error ? bad('delete', error) : ok('cleaned up throwaway character');
}

console.log('\nDone.');
