-- ════════════════════════════════════════════════════════════════════════
--  Casting phase 4 — collapse the player reveal to a single binary
-- ════════════════════════════════════════════════════════════════════════
--
--  Run ONCE in the Supabase SQL Editor, AFTER casting-phase2.sql.
--  Idempotent (create-or-replace) — safe to re-run.
--
--  Phase 2 shipped a two-stage reveal (consent → full). We've dropped the
--  middle stage. A character is now either:
--    • UNRELEASED — get_my_character returns null; the player sees a
--      "casting in progress" placeholder.
--    • RELEASED   — the player sees ONLY their name, archetype title, and
--      "who you are" background.
--
--  Everything else — the acts, props, the secret action, truth tags — is
--  delivered by the host out of band (a message at the party), so it is no
--  longer sent to the client at all. The no-leak stays structural: plot
--  columns are never selected into the player payload, and there is no `phase`
--  flag to get wrong.
--
--  `background_released` is left in place but is now dormant — the host UI no
--  longer toggles it and nothing reads it after this migration. (Left rather
--  than dropped to keep this migration non-destructive.)
-- ════════════════════════════════════════════════════════════════════════

create or replace function get_my_character(p_token text)
returns jsonb
language sql security definer set search_path = public as $$
  select case
    when ch.released then jsonb_build_object(
      'name', ch.name, 'title', ch.title, 'background', ch.background
    )
    else null
  end
  from participants p
  join characters ch on ch.id = p.character_id
  where p.token = p_token;
$$;

-- ── Done. The player card is now binary: name + "who you are", or nothing. ──
