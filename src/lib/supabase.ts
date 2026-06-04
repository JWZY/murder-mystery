import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True once the host has filled in `.env` — lets the UI degrade gracefully. */
export const isConfigured = Boolean(url && anonKey);

/**
 * Single shared client. When the env vars are missing (e.g. first checkout
 * before Supabase is set up) we still export a client so imports don't crash;
 * calls will simply fail and the UI shows a "backend not configured" notice.
 */
export const supabase: SupabaseClient = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  { auth: { persistSession: false } },
);
