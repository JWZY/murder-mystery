// Single source of truth for every question we ask a guest. Three surfaces read
// from this list so phrasing never drifts:
//   - IntakeForm (initial sign-up wizard)
//   - RecordFields (post-signup edit page)
//   - GuestTab Detail (host-side expanded row)
//
// To add or rephrase a question: edit it here once.

import type { ParticipantRecord } from '../types/participant';

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

const DISH_OPTIONS: DishOption[] = [
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

const YES_NO: ChoiceOption[] = [
  { v: 'very', label: 'Yes' },
  { v: 'no', label: 'No' },
];

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
    question: 'What dish did you bring to the gathering?',
    label: 'Bringing',
    dishOptions: DISH_OPTIONS,
  },
  {
    key: 'dietary',
    kind: 'text',
    question: 'Known dietary restrictions, allergies, etc.',
    label: 'Dietary',
    placeholder: 'Allergies, restrictions, or none',
  },
  {
    key: 'roleplay_comfort',
    kind: 'scale',
    question: 'How big of a role do you want? (level of comfort with roleplaying)',
    label: 'Role size',
    required: true,
    caps: COMFORT_CAPS,
    descriptions: COMFORT_DESCRIPTIONS,
  },
  {
    key: 'trope_wishlist',
    kind: 'area',
    question: "Characters/tropes you've always wanted to play",
    label: "Character/tropes you'd love to play",
    placeholder: "Can write multiple, eg. detective, spy, pop star, rapper, director, gambler, boxer, etc",
  },
  {
    key: 'murderer_appetite',
    kind: 'choice',
    question: 'Were you the killer?',
    label: 'Interested in being the murderer?',
    options: YES_NO,
    showIf: (r) => (r.roleplay_comfort ?? 0) >= 4,
  },
  {
    key: 'murdered_appetite',
    kind: 'choice',
    question: 'Open to being the victim?',
    label: 'Interested in getting murdered?',
    options: YES_NO,
    showIf: (r) => (r.roleplay_comfort ?? 0) >= 4,
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

function describeDish(rec: ParticipantRecord): string {
  const cats = (rec.dish_category ?? '').split(',').filter(Boolean);
  let details: Record<string, string> = {};
  try {
    const parsed = JSON.parse(rec.dish_detail || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      details = parsed as Record<string, string>;
    }
  } catch { /* legacy free-text dish_detail — render category only */ }
  return cats
    .map((c) => {
      const label = DISH_LABEL[c] ?? c;
      const d = (details[c] ?? '').trim();
      return d ? `${label}: ${d}` : label;
    })
    .join(' · ');
}

export function formatAnswer(q: Question, rec: ParticipantRecord): string {
  switch (q.kind) {
    case 'dishes':
      return describeDish(rec);
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
