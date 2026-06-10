import type { ParticipantFull } from './hostApi';

const REVIEW_STORAGE_KEY = 'murder-mystery-host-intake-review-v1';

const IMPORTANT_KEYS = [
  'preferred_name',
  'contact',
  'rsvp',
  'roleplay_comfort',
  'trope_wishlist',
  'hard_limits',
  'surprise_fact',
  'worst_job',
  'hobby',
  'changed_opinion',
  'outable_secret',
  'social_known',
  'social_want',
  'fakeable_skill',
  'reveal_dial',
  'notes',
  'public_bio',
] as const;

type ImportantKey = (typeof IMPORTANT_KEYS)[number];

type ReviewStore = {
  initialized: boolean;
  records: Record<string, { fingerprint: string; seenAt: string }>;
};

export type IntakeReviewStatus = {
  kind: 'new' | 'modified';
  label: string;
};

export function hasSubmittedIntake(p: ParticipantFull): boolean {
  return Boolean(
    p.roleplay_comfort != null ||
      p.reveal_dial != null ||
      p.dish_category ||
      p.dish_detail ||
      p.dietary ||
      p.trope_wishlist ||
      p.hard_limits ||
      p.surprise_fact ||
      p.public_bio ||
      p.notes,
  );
}

export function hasSubmittedCastingAnswers(p: ParticipantFull): boolean {
  return Boolean(
    p.roleplay_comfort != null ||
      p.reveal_dial != null ||
      p.trope_wishlist ||
      p.hard_limits ||
      p.surprise_fact ||
      p.worst_job ||
      p.hobby ||
      p.changed_opinion ||
      p.outable_secret ||
      p.social_known ||
      p.social_want ||
      p.fakeable_skill ||
      p.notes ||
      p.public_bio,
  );
}

export function initializeIntakeReviewStore(participants: ParticipantFull[]): void {
  const store = loadReviewStore();
  if (store.initialized) return;
  for (const p of participants) {
    if (hasSubmittedIntake(p)) {
      store.records[p.id] = {
        fingerprint: importantFingerprint(p),
        seenAt: new Date().toISOString(),
      };
    }
  }
  store.initialized = true;
  saveReviewStore(store);
}

export function getIntakeReviewStatus(p: ParticipantFull): IntakeReviewStatus | null {
  if (!hasSubmittedIntake(p)) return null;
  const store = loadReviewStore();
  if (!store.initialized) return null;
  const record = store.records[p.id];
  const date = formatReviewDate(p.updated_at);
  if (!record) return { kind: 'new', label: `New submission ${date}` };
  if (record.fingerprint !== importantFingerprint(p)) {
    return { kind: 'modified', label: `Guest modified ${date}` };
  }
  return null;
}

export function markParticipantReviewed(p: ParticipantFull): void {
  if (!hasSubmittedIntake(p)) return;
  const store = loadReviewStore();
  store.initialized = true;
  store.records[p.id] = {
    fingerprint: importantFingerprint(p),
    seenAt: new Date().toISOString(),
  };
  saveReviewStore(store);
}

function importantFingerprint(p: ParticipantFull): string {
  const values: Record<ImportantKey, unknown> = {} as Record<ImportantKey, unknown>;
  for (const key of IMPORTANT_KEYS) values[key] = normalizeValue(p[key]);
  return JSON.stringify(values);
}

function normalizeValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value ?? null;
}

function loadReviewStore(): ReviewStore {
  if (typeof window === 'undefined') return { initialized: false, records: {} };
  try {
    const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ReviewStore;
  } catch {
    /* ignore corrupt local review state */
  }
  return { initialized: false, records: {} };
}

function saveReviewStore(store: ReviewStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota errors */
  }
}

function formatReviewDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
