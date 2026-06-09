-- Patch 03 — passcode-gated host RPC for editing guest-list rows.
-- Run this once in the Supabase SQL Editor after host.sql has been applied.
create or replace function host_update_participant(p_secret text, p_id uuid, payload jsonb)
returns participants
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  updated participants%rowtype;
begin
  if not host_check(p_secret) then
    raise exception 'bad passcode';
  end if;

  update participants set
    preferred_name = coalesce(payload->>'preferred_name', preferred_name),
    contact        = coalesce(payload->>'contact', contact),
    rsvp           = coalesce(nullif(payload->>'rsvp',''), rsvp),
    dish_category  = case
      when payload ? 'dish_category' then nullif(payload->>'dish_category','')
      else dish_category
    end,
    dish_detail    = coalesce(payload->>'dish_detail', dish_detail),
    dietary        = coalesce(payload->>'dietary', dietary),
    public_bio     = coalesce(payload->>'public_bio', public_bio),
    host_notes     = coalesce(payload->>'host_notes', host_notes),
    character_id   = case
      when payload ? 'character_id' then nullif(payload->>'character_id','')::uuid
      else character_id
    end,
    is_murderer    = coalesce((payload->>'is_murderer')::boolean, is_murderer)
  where id = p_id
  returning * into updated;

  if updated.id is null then
    raise exception 'participant not found';
  end if;

  return updated;
end;
$$;

revoke all on function host_update_participant(text, uuid, jsonb) from anon, authenticated;
grant execute on function host_update_participant(text, uuid, jsonb) to anon;
