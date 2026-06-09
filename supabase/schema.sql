-- ════════════════════════════════════════════════════════════════════════
--  Murder Mystery 2026 — Supabase schema + access model
-- ════════════════════════════════════════════════════════════════════════
--
--  SECURITY MODEL (read this first)
--  --------------------------------
--  This app is a STATIC site on GitHub Pages. The Supabase *anon* key ships in
--  the client and is therefore PUBLIC. So we must assume an attacker has it.
--
--  We do NOT let the anon role touch tables directly. Instead:
--    1. RLS is ON for every table, with NO anon policies → tables are sealed.
--    2. The client only ever calls a handful of SECURITY DEFINER functions
--       (RPCs) that take a per-person `token` and return / mutate exactly the
--       data that token is allowed to see.
--    3. Each RPC hard-codes the column whitelist. Secrets, the plot, the
--       murderer assignment, and other people's private answers are never in a
--       function the anon role can call.
--
--  The host reads everything via the Supabase dashboard or the service_role
--  key (kept off the static site — used only from a local host build / .env).
--
--  Apply this file in the Supabase SQL editor (or `supabase db push`).
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- gen_random_uuid / gen_random_bytes

-- ─── Token generator ────────────────────────────────────────────────────
-- 22-char URL-safe base64 (~132 bits). Opaque, unguessable.
-- Note: in Supabase, pgcrypto installs into the `extensions` schema, so we
-- qualify gen_random_bytes explicitly (our SECURITY DEFINER fns pin search_path).
create or replace function app_new_token()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select replace(replace(replace(
           encode(extensions.gen_random_bytes(16), 'base64'),
           '+', '-'), '/', '_'), '=', '');
$$;

-- ════════════════════════════════════════════════════════════════════════
--  TABLES
-- ════════════════════════════════════════════════════════════════════════

-- ─── participants ─────────────────────────────────────────────────────────
-- One row per person. Holds intake answers (Part A logistics + Part B truth
-- harvest) and host-only casting fields.
create table if not exists participants (
  id              uuid primary key default gen_random_uuid(),
  token           text unique not null default app_new_token(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- ── Part A · logistics & casting signal (private to host) ──
  preferred_name  text not null default '',
  contact         text not null default '',
  roleplay_comfort smallint check (roleplay_comfort between 1 and 5),  -- Extra→Main
  trope_wishlist  text not null default '',
  dietary         text not null default '',
  dish_category   text,            -- appetizer/main/dessert/side/drink
  dish_detail     text not null default '',
  hard_limits     text not null default '',   -- topics to never weaponize

  -- ── Part B · truth harvest (private to host; woven into the character) ──
  surprise_fact   text not null default '',
  worst_job       text not null default '',
  hobby           text not null default '',
  changed_opinion text not null default '',
  outable_secret  text not null default '',
  social_known    text not null default '',   -- who they already know well
  social_want     text not null default '',   -- who they'd like to know better
  fakeable_skill  text not null default '',
  reveal_dial     smallint check (reveal_dial between 1 and 5),  -- 1 pure fiction → 5 basically them
  notes           text not null default '',  -- optional catch-all at the end of intake

  -- ── Public-facing (the "partial" others can see) ──
  public_bio      text not null default '',   -- the ONE free field they share
  rsvp            text not null default 'yes' check (rsvp in ('yes','maybe','no')),

  -- ── Host-only casting (never exposed via any anon RPC) ──
  character_id    uuid,            -- assigned character (FK added below)
  is_murderer     boolean not null default false,
  host_notes      text not null default ''
);
-- migration: add columns to existing installs
alter table participants add column if not exists notes text not null default '';
-- migration: retire direct killer/victim preference answers
alter table participants drop column if exists murderer_appetite;
alter table participants drop column if exists murdered_appetite;

-- ─── characters ───────────────────────────────────────────────────────────
-- Host-authored. The fiction layer + woven truth. NEVER exposed to anon except
-- the single field a participant is allowed to see (their own, via RPC).
create table if not exists characters (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null default 'New Character',
  title         text not null default '',
  background    text not null default '',
  act1          text not null default '',   -- Introduction
  act2          text not null default '',   -- Action / Catalyst
  act3          text not null default '',   -- Clue / Outcome
  secret        text not null default '',   -- motive (host eyes only)
  props         text not null default '',
  recommended_meets text not null default '',   -- "Recommended guests to meet"
  truth_tags    jsonb not null default '[]', -- [{beat:'act2', truth:'...'}] markers
  color         text not null default '#c0392b',
  released      boolean not null default false, -- player can't see card until host releases
  -- canvas position (reused by the host relationship graph)
  x             double precision not null default 0,
  y             double precision not null default 0,
  z_index       integer not null default 0
);

alter table participants
  drop constraint if exists participants_character_fk;
alter table participants
  add constraint participants_character_fk
  foreign key (character_id) references characters(id) on delete set null;

-- ─── relationships (character ↔ character edges) ───────────────────────────
create table if not exists relationships (
  id        uuid primary key default gen_random_uuid(),
  from_char uuid not null references characters(id) on delete cascade,
  to_char   uuid not null references characters(id) on delete cascade,
  label     text not null default ''
);

-- ─── story_acts (the plot spine; host only) ────────────────────────────────
create table if not exists story_acts (
  id        uuid primary key default gen_random_uuid(),
  position  integer not null default 0,
  title     text not null default '',
  notes     text not null default ''
);

-- ─── public_settings (single-row knobs the participant view may read) ──────
create table if not exists public_settings (
  id          boolean primary key default true check (id),   -- enforce 1 row
  party_title text not null default 'Murder Mystery + Potluck',
  party_blurb text not null default '57 wagon trailway · July 11 7PM',
  intake_open boolean not null default true,
  roster_visible boolean not null default true
);
insert into public_settings (id) values (true) on conflict do nothing;

-- updated_at trigger for participants
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_touch_participants on participants;
create trigger trg_touch_participants before update on participants
  for each row execute function touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════
--  LOCK EVERYTHING DOWN
-- ════════════════════════════════════════════════════════════════════════
alter table participants    enable row level security;
alter table characters      enable row level security;
alter table relationships   enable row level security;
alter table story_acts      enable row level security;
alter table public_settings enable row level security;

-- No policies for anon/authenticated → these tables are unreachable by the
-- anon key except through the SECURITY DEFINER functions below.
-- (service_role bypasses RLS, so the host still has full access.)

-- ════════════════════════════════════════════════════════════════════════
--  RPCs — the ONLY surface the static client touches
-- ════════════════════════════════════════════════════════════════════════

-- ─── Public settings (safe, no token needed) ───────────────────────────────
create or replace function get_public_settings()
returns table (party_title text, party_blurb text, intake_open boolean, roster_visible boolean)
language sql security definer set search_path = public as $$
  select party_title, party_blurb, intake_open, roster_visible from public_settings where id;
$$;

-- ─── Submit a brand-new intake (open form, unknown headcount) ──────────────
-- Returns the new token so the client can build the person's permanent
-- edit link: /?p=<token>
create or replace function submit_intake(payload jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  new_token text;
  is_open boolean;
begin
  select intake_open into is_open from public_settings where id;
  if not is_open then
    raise exception 'Intake is closed';
  end if;

  insert into participants (
    preferred_name, contact, roleplay_comfort, trope_wishlist,
    dietary, dish_category, dish_detail, hard_limits,
    surprise_fact, worst_job, hobby, changed_opinion, outable_secret,
    social_known, social_want, fakeable_skill, reveal_dial,
    notes, public_bio, rsvp
  ) values (
    coalesce(payload->>'preferred_name',''),
    coalesce(payload->>'contact',''),
    nullif(payload->>'roleplay_comfort','')::smallint,
    coalesce(payload->>'trope_wishlist',''),
    coalesce(payload->>'dietary',''),
    nullif(payload->>'dish_category',''),
    coalesce(payload->>'dish_detail',''),
    coalesce(payload->>'hard_limits',''),
    coalesce(payload->>'surprise_fact',''),
    coalesce(payload->>'worst_job',''),
    coalesce(payload->>'hobby',''),
    coalesce(payload->>'changed_opinion',''),
    coalesce(payload->>'outable_secret',''),
    coalesce(payload->>'social_known',''),
    coalesce(payload->>'social_want',''),
    coalesce(payload->>'fakeable_skill',''),
    nullif(payload->>'reveal_dial','')::smallint,
    coalesce(payload->>'notes',''),
    coalesce(payload->>'public_bio',''),
    coalesce(nullif(payload->>'rsvp',''),'yes')
  )
  returning token into new_token;

  return new_token;
end;
$$;

-- ─── Read my own full record (everything *I* filled) ───────────────────────
create or replace function get_my_record(p_token text)
returns jsonb
language sql security definer set search_path = public as $$
  select to_jsonb(r) - 'token' - 'id' - 'character_id' - 'is_murderer' - 'host_notes'
  from (
    select preferred_name, contact, roleplay_comfort, trope_wishlist,
           dietary, dish_category, dish_detail, hard_limits,
           surprise_fact, worst_job, hobby, changed_opinion, outable_secret,
           social_known, social_want, fakeable_skill, reveal_dial,
           notes, public_bio, rsvp, updated_at
    from participants where token = p_token
  ) r;
$$;

-- ─── Update my own record (logistics + answers; CANNOT touch casting) ──────
create or replace function update_my_record(p_token text, payload jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare hit int;
begin
  update participants set
    preferred_name   = coalesce(payload->>'preferred_name', preferred_name),
    contact          = coalesce(payload->>'contact', contact),
    roleplay_comfort = coalesce(nullif(payload->>'roleplay_comfort','')::smallint, roleplay_comfort),
    trope_wishlist   = coalesce(payload->>'trope_wishlist', trope_wishlist),
    dietary          = coalesce(payload->>'dietary', dietary),
    dish_category    = coalesce(nullif(payload->>'dish_category',''), dish_category),
    dish_detail      = coalesce(payload->>'dish_detail', dish_detail),
    hard_limits      = coalesce(payload->>'hard_limits', hard_limits),
    surprise_fact    = coalesce(payload->>'surprise_fact', surprise_fact),
    worst_job        = coalesce(payload->>'worst_job', worst_job),
    hobby            = coalesce(payload->>'hobby', hobby),
    changed_opinion  = coalesce(payload->>'changed_opinion', changed_opinion),
    outable_secret   = coalesce(payload->>'outable_secret', outable_secret),
    social_known     = coalesce(payload->>'social_known', social_known),
    social_want      = coalesce(payload->>'social_want', social_want),
    fakeable_skill   = coalesce(payload->>'fakeable_skill', fakeable_skill),
    reveal_dial      = coalesce(nullif(payload->>'reveal_dial','')::smallint, reveal_dial),
    notes            = coalesce(payload->>'notes', notes),
    public_bio       = coalesce(payload->>'public_bio', public_bio),
    rsvp             = coalesce(nullif(payload->>'rsvp',''), rsvp)
  where token = p_token;
  get diagnostics hit = row_count;
  return hit > 0;
end;
$$;

-- ─── Read the PARTIAL public roster (what others filled, curated) ──────────
-- Requires a valid token (so only invited people can browse). Returns only the
-- whitelisted public columns — never secrets, contact, or truth-layer answers.
create or replace function get_roster(p_token text)
returns table (preferred_name text, public_bio text, dish_category text, dish_detail text, rsvp text)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from participants where token = p_token) then
    raise exception 'Invalid token';
  end if;
  if not exists (select 1 from public_settings where id and roster_visible) then
    return;  -- roster hidden by host
  end if;
  return query
    select p.preferred_name, p.public_bio, p.dish_category, p.dish_detail, p.rsvp
    from participants p
    where p.rsvp <> 'no'
    order by p.preferred_name;
end;
$$;

-- ─── Read my assigned character (only once the host releases it) ───────────
-- Returns the fiction the player is allowed to see for THEIR character only.
-- The murderer flag and `secret` motive are deliberately excluded.
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
--  GRANTS — anon may ONLY execute these RPCs, nothing else
-- ════════════════════════════════════════════════════════════════════════
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant execute on function get_public_settings()              to anon;
grant execute on function submit_intake(jsonb)               to anon;
grant execute on function get_my_record(text)                to anon;
grant execute on function update_my_record(text, jsonb)      to anon;
grant execute on function get_roster(text)                   to anon;
grant execute on function get_my_character(text)             to anon;

-- app_new_token / touch_updated_at stay host-only (no anon grant).

-- ── Done. Tables are sealed; the 6 RPCs above are the entire public API. ──
