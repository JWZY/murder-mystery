// Host-only data access. These call the passcode-gated RPCs in supabase/host.sql.
// The passcode is entered once in the UI and kept in localStorage — never baked
// into the build — so the deployed static site carries no privileged key.
import { supabase, isConfigured } from './supabase';
import type { ParticipantRecord } from '../types/participant';
import { NotConfiguredError } from './api';

const SECRET_KEY = 'mm-host-secret';

export function getHostSecret(): string {
  return localStorage.getItem(SECRET_KEY) ?? '';
}
export function setHostSecret(secret: string): void {
  localStorage.setItem(SECRET_KEY, secret);
}
export function clearHostSecret(): void {
  localStorage.removeItem(SECRET_KEY);
}

/** A full participant row — everything, including host-only fields. */
export interface ParticipantFull extends ParticipantRecord {
  id: string;
  token: string;
  character_id: string | null;
  is_murderer: boolean;
  host_notes: string;
  created_at: string;
}

export type HostAddInviteePayload = Partial<
  Pick<ParticipantFull, 'preferred_name' | 'contact' | 'rsvp' | 'host_notes' | 'public_bio'>
>;

function guard() {
  if (!isConfigured) throw new NotConfiguredError();
}

/** True if the passcode is valid. */
export async function hostCheck(secret: string): Promise<boolean> {
  guard();
  const { data, error } = await supabase.rpc('host_check', { p_secret: secret });
  if (error) throw error;
  return Boolean(data);
}

/** Every participant, all columns. Throws on a bad passcode. */
export async function hostParticipants(secret: string): Promise<ParticipantFull[]> {
  guard();
  const { data, error } = await supabase.rpc('host_participants', { p_secret: secret });
  if (error) throw error;
  return (data as ParticipantFull[]) ?? [];
}

/** Create a minimal invitee row before they submit intake. */
export async function hostAddInvitee(
  secret: string,
  payload: HostAddInviteePayload,
): Promise<ParticipantFull> {
  guard();
  const { data, error } = await supabase.rpc('host_add_invitee', { p_secret: secret, payload });
  if (error) throw error;
  return data as ParticipantFull;
}

/** Permanently delete a participant (smoke-test rows, withdrawals). */
export async function hostDeleteParticipant(secret: string, id: string): Promise<boolean> {
  guard();
  const { data, error } = await supabase.rpc('host_delete_participant', {
    p_secret: secret,
    p_id: id,
  });
  if (error) throw error;
  return Boolean(data);
}

// ── Characters / casting / story ───────────────────────────────────────────

export interface TruthTag {
  beat?: string;
  truth?: string;
}

/** A full character row (host eyes only — includes the secret motive). */
export interface CharacterFull {
  id: string;
  name: string;
  title: string;
  background: string;
  act1: string;
  act2: string;
  act3: string;
  secret: string;
  props: string;
  recommended_meets: string;
  truth_tags: TruthTag[];
  color: string;
  released: boolean;
  x: number;
  y: number;
  created_at?: string;
}

export interface Relationship {
  id: string;
  from_char: string;
  to_char: string;
  label: string;
}

export interface StoryAct {
  id: string;
  position: number;
  title: string;
  notes: string;
}

export interface HostSettings {
  party_title: string;
  party_blurb: string;
  intake_open: boolean;
  roster_visible: boolean;
}

export interface HostWorld {
  participants: ParticipantFull[];
  characters: CharacterFull[];
  relationships: Relationship[];
  story_acts: StoryAct[];
  settings: HostSettings | null;
}

/** One round-trip: the host's entire world. Throws on a bad passcode. */
export async function hostBootstrap(secret: string): Promise<HostWorld> {
  guard();
  const { data, error } = await supabase.rpc('host_bootstrap', { p_secret: secret });
  if (error) throw error;
  return data as HostWorld;
}

/** Upsert a character. Pass `id` to update, `participant_id` to also cast. Returns id. */
export async function hostSaveCharacter(
  secret: string,
  payload: Partial<CharacterFull> & { participant_id?: string },
): Promise<string> {
  guard();
  const { data, error } = await supabase.rpc('host_save_character', { p_secret: secret, payload });
  if (error) throw error;
  return data as string;
}

export async function hostDeleteCharacter(secret: string, id: string): Promise<boolean> {
  guard();
  const { data, error } = await supabase.rpc('host_delete_character', { p_secret: secret, p_id: id });
  if (error) throw error;
  return Boolean(data);
}

/** Cast (or un-cast with null) a participant into a character. */
export async function hostAssign(
  secret: string,
  participantId: string,
  characterId: string | null,
): Promise<boolean> {
  guard();
  const { data, error } = await supabase.rpc('host_assign', {
    p_secret: secret,
    p_participant: participantId,
    p_character: characterId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function hostSetFlags(
  secret: string,
  participantId: string,
  payload: { is_murderer?: boolean; host_notes?: string },
): Promise<boolean> {
  guard();
  const { data, error } = await supabase.rpc('host_set_flags', {
    p_secret: secret,
    p_participant: participantId,
    payload,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function hostUpdateSettings(
  secret: string,
  payload: Partial<HostSettings>,
): Promise<boolean> {
  guard();
  const { data, error } = await supabase.rpc('host_update_settings', { p_secret: secret, payload });
  if (error) throw error;
  return Boolean(data);
}
