// Shapes shared between the intake form and the participant view. These mirror
// the columns the RPCs in supabase/schema.sql actually return — keep in sync.

export type Rsvp = 'yes' | 'maybe' | 'no';
export type DishCategory = 'appetizer' | 'main' | 'dessert' | 'side' | 'drink';

/** Everything a participant fills in / can edit about themselves. */
export interface ParticipantRecord {
  // Part A — logistics & casting
  preferred_name: string;
  contact: string;
  roleplay_comfort: number | null; // 1–5
  trope_wishlist: string;
  dietary: string;
  dish_category: string | null; // comma-separated DishCategory values for multi-select
  dish_detail: string;
  hard_limits: string;
  // Part B — truth harvest
  surprise_fact: string;
  worst_job: string;
  hobby: string;
  changed_opinion: string;
  outable_secret: string;
  social_known: string;
  social_want: string;
  fakeable_skill: string;
  reveal_dial: number | null; // 1–5: how much the character should be *them* (1 pure fiction → 5 basically them)
  // Optional catch-all the participant fills at the end of intake.
  notes: string;
  // public-facing
  public_bio: string;
  rsvp: Rsvp;
  updated_at?: string;
}

/**
 * One anonymous row behind the intake potluck hints. No identity — just the dish
 * columns — so it can be read on the open intake form without a token.
 */
export interface PotluckRow {
  dish_category: string | null;
  dish_detail: string;
}

/** The curated partial view of another guest. */
export interface RosterEntry {
  preferred_name: string;
  public_bio: string;
  dish_category: string | null;
  dish_detail: string;
  rsvp: Rsvp;
}

/**
 * The fiction a player is allowed to see for their own character.
 *
 * Binary reveal (see supabase/casting-phase4.sql `get_my_character`): until the
 * host releases the character the RPC returns null and the player sees a
 * "casting in progress" placeholder. Once released they see only their name,
 * archetype title, and "who you are" background. Acts, props, the secret action,
 * and truth tags are delivered by the host out of band and are never sent to the
 * client — the no-leak is structural, not a display flag.
 */
export interface MyCharacter {
  name: string;
  title: string;
  background: string;
}

export interface PublicSettings {
  party_title: string;
  party_blurb: string;
  intake_open: boolean;
  roster_visible: boolean;
}

export function emptyRecord(): ParticipantRecord {
  return {
    preferred_name: '', contact: '', roleplay_comfort: null, trope_wishlist: '',
    dietary: '', dish_category: null, dish_detail: '',
    hard_limits: '', surprise_fact: '', worst_job: '', hobby: '',
    changed_opinion: '', outable_secret: '', social_known: '', social_want: '',
    fakeable_skill: '', reveal_dial: null, notes: '', public_bio: '', rsvp: 'yes',
  };
}
