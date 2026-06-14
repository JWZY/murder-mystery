-- ════════════════════════════════════════════════════════════════════════
--  Casting phase 2 — two-phase reveal (consent → full) + canvas juice
-- ════════════════════════════════════════════════════════════════════════
--
--  Run this ONCE in the Supabase SQL Editor, AFTER casting.sql.
--  Idempotent (create-or-replace / add-column-if-not-exists) — safe to re-run.
--
--  Adds the "send a friend their concept for consent, then hand them their
--  secret action at the party" flow:
--    • background_released — the host has sent the archetype + background blurb
--      for the player to sign off on. They see a consent-shaped card.
--    • released           — the full character is live (acts, props, action…).
--    • action             — the party-time secret instruction. Distinct from
--                           `secret` (host-only motive); revealed only at `full`.
--    • juice              — the one-line hook the canvas riffs on. Host-facing.
-- ════════════════════════════════════════════════════════════════════════

alter table characters add column if not exists background_released boolean not null default false;
alter table characters add column if not exists action            text    not null default '';
alter table characters add column if not exists juice             text    not null default '';

-- ════════════════════════════════════════════════════════════════════════
--  PLAYER VIEW — phased. A card reveals itself in two stages.
-- ════════════════════════════════════════════════════════════════════════
--  `released`            → full card (acts, props, the secret action).
--  else `background_released` → consent card (who they are, no plot).
--  else                  → null (player still sees the placeholder).
--
--  `secret` (host-only motive) is NEVER selected in either branch — the no-leak
--  is structural, not a flag. `action` only ships in the full branch.
create or replace function get_my_character(p_token text)
returns jsonb
language sql security definer set search_path = public as $$
  select case
    when ch.released then jsonb_build_object(
      'phase', 'full',
      'name', ch.name, 'title', ch.title, 'background', ch.background,
      'act1', ch.act1, 'act2', ch.act2, 'act3', ch.act3,
      'action', ch.action, 'props', ch.props,
      'recommended_meets', ch.recommended_meets,
      'truth_tags', ch.truth_tags, 'color', ch.color
    )
    when ch.background_released then jsonb_build_object(
      'phase', 'consent',
      'name', ch.name, 'title', ch.title, 'background', ch.background,
      'truth_tags', ch.truth_tags, 'color', ch.color
    )
    else null
  end
  from participants p
  join characters ch on ch.id = p.character_id
  where p.token = p_token;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  CHARACTERS — upsert, now carrying background_released / action / juice
-- ════════════════════════════════════════════════════════════════════════
--  Same contract as casting.sql, with two changes:
--    • the three new columns are coalesced into both branches;
--    • the INSERT branch accepts a client-supplied `id` so the canvas can mint
--      its own UUID (crypto.randomUUID) and upsert on it — no id-swap race.
create or replace function host_save_character(p_secret text, payload jsonb)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare cid uuid;
begin
  if not host_check(p_secret) then raise exception 'bad passcode'; end if;

  if payload ? 'id' and nullif(payload->>'id','') is not null then
    cid := (payload->>'id')::uuid;
    update characters set
      name                = coalesce(payload->>'name', name),
      title               = coalesce(payload->>'title', title),
      background          = coalesce(payload->>'background', background),
      act1                = coalesce(payload->>'act1', act1),
      act2                = coalesce(payload->>'act2', act2),
      act3                = coalesce(payload->>'act3', act3),
      action              = coalesce(payload->>'action', action),
      secret              = coalesce(payload->>'secret', secret),
      props               = coalesce(payload->>'props', props),
      recommended_meets   = coalesce(payload->>'recommended_meets', recommended_meets),
      truth_tags          = coalesce(payload->'truth_tags', truth_tags),
      juice               = coalesce(payload->>'juice', juice),
      color               = coalesce(payload->>'color', color),
      released            = coalesce((payload->>'released')::boolean, released),
      background_released = coalesce((payload->>'background_released')::boolean, background_released),
      x                   = coalesce((payload->>'x')::double precision, x),
      y                   = coalesce((payload->>'y')::double precision, y)
    where id = cid;

    -- update touched nothing → the supplied id is new; fall through to insert.
    if not found then
      insert into characters (id, name, title, background, act1, act2, act3,
                              action, secret, props, recommended_meets, truth_tags,
                              juice, color, released, background_released, x, y)
      values (
        cid,
        coalesce(payload->>'name','New Character'),
        coalesce(payload->>'title',''),
        coalesce(payload->>'background',''),
        coalesce(payload->>'act1',''),
        coalesce(payload->>'act2',''),
        coalesce(payload->>'act3',''),
        coalesce(payload->>'action',''),
        coalesce(payload->>'secret',''),
        coalesce(payload->>'props',''),
        coalesce(payload->>'recommended_meets',''),
        coalesce(payload->'truth_tags','[]'::jsonb),
        coalesce(payload->>'juice',''),
        coalesce(payload->>'color','#c0392b'),
        coalesce((payload->>'released')::boolean, false),
        coalesce((payload->>'background_released')::boolean, false),
        coalesce((payload->>'x')::double precision, 0),
        coalesce((payload->>'y')::double precision, 0)
      );
    end if;
  else
    insert into characters (name, title, background, act1, act2, act3,
                            action, secret, props, recommended_meets, truth_tags,
                            juice, color, released, background_released)
    values (
      coalesce(payload->>'name','New Character'),
      coalesce(payload->>'title',''),
      coalesce(payload->>'background',''),
      coalesce(payload->>'act1',''),
      coalesce(payload->>'act2',''),
      coalesce(payload->>'act3',''),
      coalesce(payload->>'action',''),
      coalesce(payload->>'secret',''),
      coalesce(payload->>'props',''),
      coalesce(payload->>'recommended_meets',''),
      coalesce(payload->'truth_tags','[]'::jsonb),
      coalesce(payload->>'juice',''),
      coalesce(payload->>'color','#c0392b'),
      coalesce((payload->>'released')::boolean, false),
      coalesce((payload->>'background_released')::boolean, false)
    )
    returning id into cid;
  end if;

  if payload ? 'participant_id' and nullif(payload->>'participant_id','') is not null then
    update participants set character_id = cid where id = (payload->>'participant_id')::uuid;
  end if;

  return cid;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  GRANTS — unchanged signatures, re-granted for completeness / re-run safety
-- ════════════════════════════════════════════════════════════════════════
revoke all on function host_save_character(text, jsonb) from anon, authenticated;
grant execute on function host_save_character(text, jsonb) to anon;

-- ── Done. Cards now reveal in two phases; the canvas owns its own UUIDs. ──
