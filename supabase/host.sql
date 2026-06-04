-- ════════════════════════════════════════════════════════════════════════
--  Host access layer — passcode-gated RPCs for the planning app
-- ════════════════════════════════════════════════════════════════════════
--
--  The participant site uses the publishable key, which (by design) cannot read
--  anyone's private answers. The HOST needs to read everything to cast and write
--  the story. Rather than ship a master key in the static site, the host proves
--  itself with a passcode checked server-side. Tables stay sealed; only these
--  SECURITY DEFINER functions can reach the data, and only with the passcode.
--
--  SETUP: edit the passcode on the last line of this file, then run the whole
--  file once in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

-- Single-row table holding the bcrypt hash of the host passcode. RLS sealed.
create table if not exists host_config (
  id          boolean primary key default true check (id),
  secret_hash text not null
);
alter table host_config enable row level security;  -- no anon policies → sealed

-- Verify a passcode against the stored hash.
create or replace function host_check(p_secret text)
returns boolean
language sql security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from host_config
    where id and secret_hash = extensions.crypt(p_secret, secret_hash)
  );
$$;

-- Return EVERY participant with ALL columns (host eyes only).
create or replace function host_participants(p_secret text)
returns setof participants
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not host_check(p_secret) then
    raise exception 'bad passcode';
  end if;
  return query select * from participants order by created_at;
end;
$$;

-- Delete a participant (e.g. the smoke-test row, or a withdrawal).
create or replace function host_delete_participant(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;
  delete from participants where id = p_id;
  return true;
end;
$$;

revoke all on function host_check(text)                       from anon, authenticated;
revoke all on function host_participants(text)               from anon, authenticated;
revoke all on function host_delete_participant(text, uuid)   from anon, authenticated;
grant execute on function host_check(text)                   to anon;
grant execute on function host_participants(text)            to anon;
grant execute on function host_delete_participant(text, uuid) to anon;

-- ════════════════════════════════════════════════════════════════════════
--  ⬇⬇⬇  EDIT THIS: pick your host passcode, then run the whole file.  ⬇⬇⬇
-- ════════════════════════════════════════════════════════════════════════
insert into host_config (id, secret_hash)
values (true, extensions.crypt('Campmindtastehow2020!', extensions.gen_salt('bf')))
on conflict (id) do update set secret_hash = excluded.secret_hash;
