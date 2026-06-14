-- ════════════════════════════════════════════════════════════════════════
--  Migration — anonymous potluck summary for the intake form
-- ════════════════════════════════════════════════════════════════════════
--  Run this once in the Supabase SQL editor (it's also folded into schema.sql,
--  so re-applying the full schema works too).
--
--  Adds get_potluck_summary(): a tokenless RPC that backs the "So far: …" hints
--  shown under each dish on the OPEN intake form. The intake wizard has no token
--  (the person hasn't signed up yet), and get_roster() requires both a token and
--  roster_visible — so neither can power this. This function returns ONLY the two
--  dish columns, no identity, making it safe to grant to anon without a token.
-- ════════════════════════════════════════════════════════════════════════

create or replace function get_potluck_summary()
returns table (dish_category text, dish_detail text)
language sql security definer set search_path = public as $$
  select p.dish_category, p.dish_detail
  from participants p
  where p.rsvp <> 'no' and coalesce(p.dish_category, '') <> '';
$$;

grant execute on function get_potluck_summary() to anon;
