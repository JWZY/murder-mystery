import { supabase, isConfigured } from './supabase';
import type {
  ParticipantRecord,
  RosterEntry,
  PotluckRow,
  MyCharacter,
  PublicSettings,
} from '../types/participant';

/** Thrown when the backend hasn't been configured yet (no .env). */
export class NotConfiguredError extends Error {
  constructor() {
    super('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    this.name = 'NotConfiguredError';
  }
}

function guard() {
  if (!isConfigured) throw new NotConfiguredError();
}

export async function getPublicSettings(): Promise<PublicSettings | null> {
  guard();
  const { data, error } = await supabase.rpc('get_public_settings');
  if (error) throw error;
  return (data?.[0] as PublicSettings) ?? null;
}

/** Open intake. Returns the new permanent token for this person. */
export async function submitIntake(payload: Partial<ParticipantRecord>): Promise<string> {
  guard();
  const { data, error } = await supabase.rpc('submit_intake', { payload });
  if (error) throw error;
  return data as string;
}

export async function getMyRecord(token: string): Promise<ParticipantRecord | null> {
  guard();
  const { data, error } = await supabase.rpc('get_my_record', { p_token: token });
  if (error) throw error;
  return (data as ParticipantRecord) ?? null;
}

export async function updateMyRecord(
  token: string,
  payload: Partial<ParticipantRecord>,
): Promise<boolean> {
  guard();
  const { data, error } = await supabase.rpc('update_my_record', { p_token: token, payload });
  if (error) throw error;
  return Boolean(data);
}

export async function getRoster(token: string): Promise<RosterEntry[]> {
  guard();
  const { data, error } = await supabase.rpc('get_roster', { p_token: token });
  if (error) throw error;
  return (data as RosterEntry[]) ?? [];
}

/**
 * Anonymous roll-up of what's being brought, for the intake form's dish hints.
 * No token: this is read during open sign-up, before a token exists. Returns only
 * dish columns, never identity.
 */
export async function getPotluckSummary(): Promise<PotluckRow[]> {
  guard();
  const { data, error } = await supabase.rpc('get_potluck_summary');
  if (error) throw error;
  return (data as PotluckRow[]) ?? [];
}

export async function getMyCharacter(token: string): Promise<MyCharacter | null> {
  guard();
  const { data, error } = await supabase.rpc('get_my_character', { p_token: token });
  if (error) throw error;
  return (data as MyCharacter) ?? null;
}
