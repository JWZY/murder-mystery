-- ════════════════════════════════════════════════════════════════════════
--  Casting phase 3 — relationship edges actually persist
-- ════════════════════════════════════════════════════════════════════════
--
--  Run this ONCE in the Supabase SQL Editor, AFTER casting.sql.
--  Idempotent (create-or-replace) — safe to re-run.
--
--  THE BUG: the canvas mints its own UUID for a new edge and sends it as
--  `id`, so host_save_relationship always took the UPDATE branch — which
--  matched zero rows for a brand-new id, inserted nothing, raised no error,
--  and returned the id. The optimistic arrow stayed on screen but was never
--  written, so it vanished on the next bootstrap (refresh).
--
--  THE FIX: mirror host_save_character — when the UPDATE touches nothing,
--  fall through and INSERT on the supplied id.
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

    -- update touched nothing → the supplied id is new; insert on it. Skip when
    -- from/to are absent (e.g. a label-only patch for an edge since deleted).
    if not found and nullif(payload->>'from_char','') is not null
                 and nullif(payload->>'to_char','') is not null then
      insert into relationships (id, from_char, to_char, label)
      values (rid, (payload->>'from_char')::uuid, (payload->>'to_char')::uuid,
              coalesce(payload->>'label',''));
    end if;
  else
    insert into relationships (from_char, to_char, label)
    values ((payload->>'from_char')::uuid, (payload->>'to_char')::uuid, coalesce(payload->>'label',''))
    returning id into rid;
  end if;
  return rid;
end;
$$;

-- Re-grant for completeness / re-run safety (signature unchanged).
revoke all on function host_save_relationship(text, jsonb) from anon, authenticated;
grant execute on function host_save_relationship(text, jsonb) to anon;

-- ── Done. New arrows now survive a refresh. ──────────────────────────────
