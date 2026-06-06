// ─── Canvas engine primitives (reused from brain-canvas) ──────────────

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface BaseItem {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

// ─── Murder-mystery domain ────────────────────────────────────────────

/** A character node on the relationship canvas. */
export interface CharacterItem extends BaseItem {
  type: 'character';
  /** Role / archetype, e.g. "The Heiress", "The Butler". */
  role: string;
  /** Public-facing short bio (shown on the guest list). */
  bio: string;
  /** Private notes — motive, secret, the real story. Host eyes only. */
  secret: string;
  /** Accent color for the node + its edges. */
  color: string;
  /** Guest assigned to play this character, if any. */
  guestId: string | null;
}

/** The only kind of item the canvas renders, for now. */
export type CanvasItem = CharacterItem;

/** A directed relationship between two characters (an edge). */
export interface Relationship {
  id: string;
  from: string; // character id
  to: string; // character id
  /** Nature of the connection, e.g. "secretly in love", "owes money". */
  label: string;
}

/** A guest attending the party. */
export interface Guest {
  id: string;
  name: string;
  /** Potluck dish they're bringing. */
  dish: string;
  /** Character they've been cast as (character id), if assigned. */
  characterId: string | null;
  rsvp: 'yes' | 'maybe' | 'no' | 'invited';
}

export type IntakeFieldType = 'short-text' | 'long-text' | 'single-select' | 'multi-select';

/** A question the host plans to ask guests in the intake form. */
export interface IntakeQuestion {
  id: string;
  label: string;
  type: IntakeFieldType;
  /** Options for select-type questions. */
  options: string[];
  /** Why the host is asking — how it maps to casting/story. */
  intent: string;
}

/** One act of the story structure. */
export interface StoryAct {
  id: string;
  title: string;
  notes: string;
}

export type TabId = 'guests' | 'casting' | 'planning' | 'settings';
