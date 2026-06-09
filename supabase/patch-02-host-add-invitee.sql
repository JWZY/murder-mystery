-- Patch 02 — passcode-gated host RPC for manually adding invitees.
-- Run this once in the Supabase SQL Editor after host.sql has been applied.
create or replace function host_add_invitee(p_secret text, payload jsonb)
returns participants
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  created participants%rowtype;
begin
  if not host_check(p_secret) then
    raise exception 'bad passcode';
  end if;

  insert into participants (
    preferred_name, contact, rsvp, host_notes, public_bio
  ) values (
    coalesce(payload->>'preferred_name',''),
    coalesce(payload->>'contact',''),
    coalesce(nullif(payload->>'rsvp',''),'maybe'),
    coalesce(payload->>'host_notes',''),
    coalesce(payload->>'public_bio','')
  )
  returning * into created;

  return created;
end;
$$;

revoke all on function host_add_invitee(text, jsonb) from anon, authenticated;
grant execute on function host_add_invitee(text, jsonb) to anon;
