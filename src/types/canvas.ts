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

/**
 * A character node on the relationship canvas — a FigJam-style sticky note.
 *
 * Deliberately unstructured: a name and a free-text body you can write anything
 * into, with the cast actor's name shown at the foot. The card grows to fit its
 * content; arrows between cards are relationships. The formal character (title,
 * acts, secret, props…) is shaped later in the Casting editor, backed by the
 * same Supabase row.
 */
export interface CharacterItem extends BaseItem {
  type: 'character';
  /**
   * Free-text body — concept, hook, whatever. Host-only scratchpad; maps to
   * `characters.juice` (never sent to a player), NOT `title` (which is).
   */
  notes: string;
  /** Name of the cast participant, shown at the card's foot. Read-only here. */
  castName: string | null;
  /** Cast participant's roleplay comfort (1–5), shown color-coded at the foot. Read-only here. */
  castComfort: number | null;
  /** Guest assigned to play this character, if any (participant id). */
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

export type TabId = 'guests' | 'casting' | 'planning' | 'settings';
