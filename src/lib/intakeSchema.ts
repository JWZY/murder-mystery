// Single source of truth for every question we ask a guest. Three surfaces read
// from this list so phrasing never drifts:
//   - IntakeForm (initial sign-up wizard)
//   - RecordFields (post-signup edit page)
//   - RosterTab detail drawer (host-side read-only entry)
//
// To add or rephrase a question: edit it here once.

import type { ParticipantRecord, PotluckRow } from '../types/participant';

export type QuestionKind = 'text' | 'area' | 'choice' | 'scale' | 'dishes';

export type ChoiceOption = { v: string; label: string };
export type DishOption = { v: string; label: string; placeholder?: string };

export interface Question {
  /** Field key on ParticipantRecord. For 'dishes', this is dish_category (dish_detail is co-managed). */
  key: keyof ParticipantRecord;
  kind: QuestionKind;
  /** Full question phrasing — used by the intake wizard. */
  question: string;
  /** Short label — used by the edit form and the host detail view. */
  label: string;
  desc?: string;
  placeholder?: string;
  required?: boolean;
  showIf?: (rec: ParticipantRecord) => boolean;
  options?: ChoiceOption[];
  multi?: boolean;
  caps?: string[];
  descriptions?: string[];
  dishOptions?: DishOption[];
}

export const DISH_OPTIONS: DishOption[] = [
  { v: 'appetizer', label: 'Appetizer', placeholder: 'What, exactly?' },
  { v: 'main', label: 'Main', placeholder: 'What, exactly?' },
  { v: 'side', label: 'Side', placeholder: 'What, exactly?' },
  { v: 'dessert', label: 'Dessert', placeholder: 'What, exactly?' },
  { v: 'drink', label: 'Drink', placeholder: 'What, exactly?' },
  { v: 'fill_gaps', label: 'Fill gaps' },
];

const DISH_LABEL: Record<string, string> = Object.fromEntries(
  DISH_OPTIONS.map((o) => [o.v, o.label])
);

function humanizeToken(token: string): string {
  const text = token.replace(/[_-]+/g, ' ').trim();
  return text ? text[0].toUpperCase() + text.slice(1).toLowerCase() : '';
}

const COMFORT_CAPS = ['Extra', 'Cameo', 'Recurring', 'Supporting', 'Lead'];
const COMFORT_DESCRIPTIONS = [
  'as low commitment as possible please!',
  'I can handle a few lines and an action or two.',
  "I don't mind some dialogue and actions in character.",
  'I can handle conversations in character, and share the spotlight.',
  'I was born to be the star of the show!',
];

export const INTAKE_QUESTIONS: Question[] = [
  {
    key: 'preferred_name',
    kind: 'text',
    question: 'State your name for the record.',
    label: 'Name',
    required: true,
    placeholder: 'What you go by',
  },
  {
    key: 'dish_category',
    kind: 'dishes',
    question: 'Dish to bring for the potluck?',
    label: 'Bringing',
    dishOptions: DISH_OPTIONS,
  },
  {
    key: 'dietary',
    kind: 'text',
    question: 'Dietary restrictions, allergies, etc.',
    label: 'Dietary',
    placeholder: 'Allergies, restrictions, or none',
  },
  {
    key: 'roleplay_comfort',
    kind: 'scale',
    question: 'How big of a role do you want? (comfort with roleplaying)',
    label: 'Role size',
    required: true,
    caps: COMFORT_CAPS,
    descriptions: COMFORT_DESCRIPTIONS,
  },
  {
    key: 'trope_wishlist',
    kind: 'area',
    question: 'Characters/tropes you want to play',
    label: "Character/tropes you'd love to play",
    desc: 'Share a loose vibe, archetype, name, bit, or backstory.',
    placeholder: 'eg. Cole D. Case: detective; Paige Turner: journalist; Conny Condo: real estate mogul',
  },
  // Retired for now:
  // - murderer_appetite: 'Open to being the killer?'
  // - murdered_appetite: 'Open to being the victim?'
  {
    key: 'surprise_fact',
    kind: 'area',
    question: 'How much of your character is you?',
    label: 'How much of your character is you?',
    desc: 'Real-life details or facts to weave into the character',
    placeholder: 'eg. a surprise fact, niche obsession, worst job, small secret, strong opinion, life chapter, inside joke',
  },
  {
    key: 'hard_limits',
    kind: 'area',
    question: "Lines we shouldn't cross.",
    label: 'Tropes/themes we should avoid',
    desc: "There won't be SA, domestic violence. Your boundaries will be respected and kept private.",
    placeholder: 'eg. torture, etc',
  },
];

// ─── value formatting (for the host detail view) ─────────────────────────

export function formatDishContribution(rec: Pick<ParticipantRecord, 'dish_category' | 'dish_detail'>): string {
  const cats = (rec.dish_category ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  let details: Record<string, string> = {};
  try {
    const parsed = JSON.parse(rec.dish_detail || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      details = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>)
          .filter(([, value]) => typeof value === 'string')
          .map(([key, value]) => [key.toLowerCase(), value as string])
      );
    }
  } catch {
    const legacyDetail = (rec.dish_detail ?? '').trim();
    if (legacyDetail) return legacyDetail;
  }
  if (!cats.length) {
    return Object.values(details)
      .map((d) => d.trim())
      .filter(Boolean)
      .join(' · ');
  }
  return cats
    .map((c) => {
      const label = DISH_LABEL[c] ?? humanizeToken(c);
      const d = (details[c.toLowerCase()] ?? '').trim();
      return d || label;
    })
    .join(' · ');
}

// ─── potluck roll-up (for the intake form's "what's coming" hints) ───────

/** Per-category tally across everyone who's already submitted a dish. */
export interface PotluckTally {
  /** How many people are bringing something in this category. */
  count: number;
  /** The specifics they named, in submission order, repeats kept ("wine, wine"). */
  specifics: string[];
  /** True if at least one person checked the category but left the specifics blank → "etc". */
  hasUnspecified: boolean;
}

function parseDetailMap(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>)
          .filter(([, v]) => typeof v === 'string')
          .map(([k, v]) => [k.toLowerCase(), v as string]),
      );
    }
  } catch {
    /* legacy free-text detail — no per-category map to read */
  }
  return {};
}

/**
 * Roll anonymous potluck rows up per dish category, keyed by the DishOption `v`.
 * A checked category with no written specific contributes to `hasUnspecified`
 * (rendered as "etc"), never an empty string — so "So far: wine, wine, etc" means
 * two people named wine and one more is bringing a drink without saying what.
 */
export function tallyPotluck(rows: PotluckRow[]): Record<string, PotluckTally> {
  const tally: Record<string, PotluckTally> = {};
  for (const o of DISH_OPTIONS) tally[o.v] = { count: 0, specifics: [], hasUnspecified: false };
  for (const row of rows) {
    const cats = (row.dish_category ?? '')
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const details = parseDetailMap(row.dish_detail);
    for (const c of cats) {
      const t = tally[c] ?? (tally[c] = { count: 0, specifics: [], hasUnspecified: false });
      t.count += 1;
      const d = (details[c] ?? '').trim();
      if (d) t.specifics.push(d);
      else t.hasUnspecified = true;
    }
  }
  return tally;
}

/**
 * Which dish categories are lagging and worth nudging toward — the set of
 * DishOption `v`s tied for the lowest count among the real food categories.
 * "Fill gaps" is excluded (it's a catch-all, not something to balance).
 *
 * The nudge only fires for a clear minority: when every category is level there's
 * no laggard, and when 3+ categories tie for the lowest, flagging them all loses
 * the signal. So we only return a set of 1 or 2 categories.
 */
export function needMorePotluck(tally: Record<string, PotluckTally>): Set<string> {
  const cats = DISH_OPTIONS.filter((o) => o.placeholder !== undefined);
  if (!cats.length) return new Set();
  const counts = cats.map((o) => tally[o.v]?.count ?? 0);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  if (max === min) return new Set();
  const lowest = cats.filter((o) => (tally[o.v]?.count ?? 0) === min).map((o) => o.v);
  if (lowest.length > 2) return new Set();
  return new Set(lowest);
}

export function formatAnswer(q: Question, rec: ParticipantRecord): string {
  switch (q.kind) {
    case 'dishes':
      return formatDishContribution(rec);
    case 'choice': {
      const v = rec[q.key];
      const match = q.options?.find((o) => o.v === v);
      return match?.label ?? '';
    }
    case 'scale': {
      const n = rec[q.key] as number | null;
      if (n == null) return '';
      const cap = q.caps?.[n - 1];
      return cap ? `${n} — ${cap}` : String(n);
    }
    case 'text':
    case 'area':
    default: {
      const v = rec[q.key];
      return typeof v === 'string' ? v : v == null ? '' : String(v);
    }
  }
}
