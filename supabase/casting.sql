-- ════════════════════════════════════════════════════════════════════════
--  Casting layer — host RPCs for characters, relationships, acts, settings
-- ════════════════════════════════════════════════════════════════════════
--
--  Run this ONCE in the Supabase SQL Editor, AFTER schema.sql and host.sql.
--  Idempotent (create-or-replace / add-column-if-not-exists) — safe to re-run.
--
--  All write access is gated by host_check(passcode) from host.sql, so the
--  tables stay sealed to the public key. Participants still only ever see their
--  own card, and only once the host flips `released`.
-- ════════════════════════════════════════════════════════════════════════

-- A character is invisible to its player until the host releases it. This lets
-- the host draft and revise cards without anyone seeing a half-finished story.
alter table characters add column if not exists released boolean not null default false;

-- Re-gate the player's view of their character on `released`.
create or replace function get_my_character(p_token text)
returns jsonb
language sql security definer set search_path = public as $$
  select to_jsonb(c)
  from (
    select ch.name, ch.title, ch.background, ch.act1, ch.act2, ch.act3,
           ch.props, ch.recommended_meets, ch.truth_tags, ch.color
    from participants p
    join characters ch on ch.id = p.character_id
    where p.token = p_token and ch.released
  ) c;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  READ — one round-trip that returns the host's whole world
-- ════════════════════════════════════════════════════════════════════════
create or replace function host_bootstrap(p_secret text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;
  return jsonb_build_object(
    'participants',  coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from participants p), '[]'),
    'characters',    coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from characters c), '[]'),
    'relationships', coalesce((select jsonb_agg(to_jsonb(r)) from relationships r), '[]'),
    'story_acts',    coalesce((select jsonb_agg(to_jsonb(a) order by a.position) from story_acts a), '[]'),
    'settings',      (select to_jsonb(s) from public_settings s where s.id)
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  CHARACTERS
-- ════════════════════════════════════════════════════════════════════════
-- Upsert a character. If payload has 'id' → update those keys; else insert.
-- If payload has 'participant_id' → link that participant to this character.
-- Returns the character id.
create or replace function host_save_character(p_secret text, payload jsonb)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare cid uuid;
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;

  if payload ? 'id' and nullif(payload->>'id','') is not null then
    cid := (payload->>'id')::uuid;
    update characters set
      name              = coalesce(payload->>'name', name),
      title             = coalesce(payload->>'title', title),
      background        = coalesce(payload->>'background', background),
      act1              = coalesce(payload->>'act1', act1),
      act2              = coalesce(payload->>'act2', act2),
      act3              = coalesce(payload->>'act3', act3),
      secret            = coalesce(payload->>'secret', secret),
      props             = coalesce(payload->>'props', props),
      recommended_meets = coalesce(payload->>'recommended_meets', recommended_meets),
      truth_tags        = coalesce(payload->'truth_tags', truth_tags),
      color             = coalesce(payload->>'color', color),
      released          = coalesce((payload->>'released')::boolean, released),
      x                 = coalesce((payload->>'x')::double precision, x),
      y                 = coalesce((payload->>'y')::double precision, y)
    where id = cid;
  else
    insert into characters (name, title, background, act1, act2, act3, secret,
                            props, recommended_meets, truth_tags, color, released)
    values (
      coalesce(payload->>'name','New Character'),
      coalesce(payload->>'title',''),
      coalesce(payload->>'background',''),
      coalesce(payload->>'act1',''),
      coalesce(payload->>'act2',''),
      coalesce(payload->>'act3',''),
      coalesce(payload->>'secret',''),
      coalesce(payload->>'props',''),
      coalesce(payload->>'recommended_meets',''),
      coalesce(payload->'truth_tags','[]'::jsonb),
      coalesce(payload->>'color','#c0392b'),
      coalesce((payload->>'released')::boolean, false)
    )
    returning id into cid;
  end if;

  if payload ? 'participant_id' and nullif(payload->>'participant_id','') is not null then
    update participants set character_id = cid where id = (payload->>'participant_id')::uuid;
  end if;

  return cid;
end;
$$;

create or replace function host_delete_character(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;
  delete from characters where id = p_id;  -- participants.character_id → null (FK)
  return true;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  CASTING — link / unlink a participant, murderer flag, host notes
-- ════════════════════════════════════════════════════════════════════════
create or replace function host_assign(p_secret text, p_participant uuid, p_character uuid)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;
  update participants set character_id = p_character where id = p_participant;
  return true;
end;
$$;

create or replace function host_set_flags(p_secret text, p_participant uuid, payload jsonb)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;
  update participants set
    is_murderer = coalesce((payload->>'is_murderer')::boolean, is_murderer),
    host_notes  = coalesce(payload->>'host_notes', host_notes)
  where id = p_participant;
  return true;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  RELATIONSHIPS
-- ════════════════════════════════════════════════════════════════════════
create or replace function host_save_relationship(p_secret text, payload jsonb)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare rid uuid;
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;
  if payload ? 'id' and nullif(payload->>'id','') is not null then
    rid := (payload->>'id')::uuid;
    update relationships set
      from_char = coalesce((payload->>'from_char')::uuid, from_char),
      to_char   = coalesce((payload->>'to_char')::uuid, to_char),
      label     = coalesce(payload->>'label', label)
    where id = rid;
  else
    insert into relationships (from_char, to_char, label)
    values ((payload->>'from_char')::uuid, (payload->>'to_char')::uuid, coalesce(payload->>'label',''))
    returning id into rid;
  end if;
  return rid;
end;
$$;

create or replace function host_delete_relationship(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;
  delete from relationships where id = p_id;
  return true;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  STORY ACTS
-- ════════════════════════════════════════════════════════════════════════
create or replace function host_save_act(p_secret text, payload jsonb)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare aid uuid;
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;
  if payload ? 'id' and nullif(payload->>'id','') is not null then
    aid := (payload->>'id')::uuid;
    update story_acts set
      position = coalesce((payload->>'position')::int, position),
      title    = coalesce(payload->>'title', title),
      notes    = coalesce(payload->>'notes', notes)
    where id = aid;
  else
    insert into story_acts (position, title, notes)
    values (coalesce((payload->>'position')::int,0), coalesce(payload->>'title',''), coalesce(payload->>'notes',''))
    returning id into aid;
  end if;
  return aid;
end;
$$;

create or replace function host_delete_act(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;
  delete from story_acts where id = p_id;
  return true;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  PUBLIC SETTINGS (open/close intake, roster visibility, title/blurb)
-- ════════════════════════════════════════════════════════════════════════
create or replace function host_update_settings(p_secret text, payload jsonb)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;
  update public_settings set
    party_title    = coalesce(payload->>'party_title', party_title),
    party_blurb    = coalesce(payload->>'party_blurb', party_blurb),
    intake_open    = coalesce((payload->>'intake_open')::boolean, intake_open),
    roster_visible = coalesce((payload->>'roster_visible')::boolean, roster_visible)
  where id;
  return true;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  GRANTS
-- ════════════════════════════════════════════════════════════════════════
revoke all on function host_bootstrap(text)                      from anon, authenticated;
revoke all on function host_save_character(text, jsonb)          from anon, authenticated;
revoke all on function host_delete_character(text, uuid)         from anon, authenticated;
revoke all on function host_assign(text, uuid, uuid)             from anon, authenticated;
revoke all on function host_set_flags(text, uuid, jsonb)         from anon, authenticated;
revoke all on function host_save_relationship(text, jsonb)       from anon, authenticated;
revoke all on function host_delete_relationship(text, uuid)      from anon, authenticated;
revoke all on function host_save_act(text, jsonb)                from anon, authenticated;
revoke all on function host_delete_act(text, uuid)               from anon, authenticated;
revoke all on function host_update_settings(text, jsonb)         from anon, authenticated;

grant execute on function host_bootstrap(text)                   to anon;
grant execute on function host_save_character(text, jsonb)       to anon;
grant execute on function host_delete_character(text, uuid)      to anon;
grant execute on function host_assign(text, uuid, uuid)          to anon;
grant execute on function host_set_flags(text, uuid, jsonb)      to anon;
grant execute on function host_save_relationship(text, jsonb)    to anon;
grant execute on function host_delete_relationship(text, uuid)   to anon;
grant execute on function host_save_act(text, jsonb)             to anon;
grant execute on function host_delete_act(text, uuid)            to anon;
grant execute on function host_update_settings(text, jsonb)      to anon;

-- ── Done. The host now has a full CRUD surface, all passcode-gated. ──
