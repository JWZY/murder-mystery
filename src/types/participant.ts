// Shapes shared between the intake form and the participant view. These mirror
// the columns the RPCs in supabase/schema.sql actually return — keep in sync.

export type MurdererAppetite = 'very' | 'maybe' | 'no';
export type Rsvp = 'yes' | 'maybe' | 'no';
export type DishCategory = 'appetizer' | 'main' | 'dessert' | 'side' | 'drink';

/** Everything a participant fills in / can edit about themselves. */
export interface ParticipantRecord {
  // Part A — logistics & casting
  preferred_name: string;
  contact: string;
  roleplay_comfort: number | null; // 1–5
  trope_wishlist: string;
  murderer_appetite: MurdererAppetite | null;
  dietary: string;
  dish_category: DishCategory | null;
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
  reveal_dial: number | null; // 1–5 consent dial
  // public-facing
  public_bio: string;
  rsvp: Rsvp;
  updated_at?: string;
}

/** The curated partial view of another guest. */
export interface RosterEntry {
  preferred_name: string;
  public_bio: string;
  dish_category: DishCategory | null;
  dish_detail: string;
  rsvp: Rsvp;
}

/** The fiction a player is allowed to see for their own character. */
export interface MyCharacter {
  name: string;
  title: string;
  background: string;
  act1: string;
  act2: string;
  act3: string;
  props: string;
  recommended_meets: string;
  truth_tags: { beat?: string; truth?: string }[];
  color: string;
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
    murderer_appetite: null, dietary: '', dish_category: null, dish_detail: '',
    hard_limits: '', surprise_fact: '', worst_job: '', hobby: '',
    changed_opinion: '', outable_secret: '', social_known: '', social_want: '',
    fakeable_skill: '', reveal_dial: null, public_bio: '', rsvp: 'yes',
  };
}
