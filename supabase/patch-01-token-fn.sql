-- Patch 01 — fix token generator for Supabase's `extensions` schema.
-- Run this once in the Supabase SQL Editor (New query → paste → Run).
create or replace function app_new_token()
returns text language sql volatile
set search_path = public, extensions
as $$
  select replace(replace(replace(
           encode(extensions.gen_random_bytes(16), 'base64'),
           '+', '-'), '/', '_'), '=', '');
$$;
