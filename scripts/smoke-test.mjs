// One-off smoke test of the live Supabase RPC surface using the PUBLISHABLE
// (anon) key — i.e. exactly what the public site can do. Proves the access
// model works and that an attacker with the public key is correctly limited.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const ok = (m) => console.log('  ✓', m);
const bad = (m, e) => { console.error('  ✗', m, '→', e?.message ?? e); process.exitCode = 1; };

console.log('1. get_public_settings');
{
  const { data, error } = await sb.rpc('get_public_settings');
  error ? bad('settings', error) : ok(`title="${data?.[0]?.party_title}" intake_open=${data?.[0]?.intake_open}`);
}

console.log('2. submit_intake (creates a test row)');
let token;
{
  const { data, error } = await sb.rpc('submit_intake', {
    payload: {
      preferred_name: 'TEST — delete me',
      public_bio: 'smoke test row',
      roleplay_comfort: '3',
      reveal_dial: '4',
      rsvp: 'yes',
      dish_category: 'dessert',
    },
  });
  if (error) bad('submit', error); else { token = data; ok(`token=${token}`); }
}
if (!token) process.exit(1);

console.log('3. get_my_record (with token)');
{
  const { data, error } = await sb.rpc('get_my_record', { p_token: token });
  error ? bad('record', error) : ok(`name="${data?.preferred_name}" comfort=${data?.roleplay_comfort}`);
}

console.log('4. update_my_record');
{
  const { data, error } = await sb.rpc('update_my_record', { p_token: token, payload: { public_bio: 'edited ✓' } });
  error ? bad('update', error) : ok(`updated=${data}`);
}

console.log('5. get_roster (with token)');
{
  const { data, error } = await sb.rpc('get_roster', { p_token: token });
  error ? bad('roster', error) : ok(`${data?.length} guest(s) visible`);
}

console.log('6. SECURITY: direct table read must be BLOCKED');
{
  const { data, error } = await sb.from('participants').select('contact, outable_secret').limit(1);
  if (error) ok(`blocked as expected (${error.message})`);
  else if (!data?.length) ok('returned 0 rows (RLS sealed)');
  else bad('LEAK! direct table read returned data', JSON.stringify(data));
}

console.log('7. SECURITY: bad token returns nothing');
{
  const { data, error } = await sb.rpc('get_my_record', { p_token: 'not-a-real-token' });
  (!data) ? ok('bad token → null') : bad('bad token returned data', JSON.stringify(data));
}

console.log('\nDone.');
