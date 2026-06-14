import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import {
  hostAddInvitee,
  hostBootstrap,
  type HostWorld,
  type ParticipantFull,
} from '../../lib/hostApi';
import type { Rsvp } from '../../types/participant';
import { useHost } from '../../host/hostContext';
import { formatAnswer, formatDishContribution, INTAKE_QUESTIONS } from '../../lib/intakeSchema';
import {
  getIntakeReviewStatus,
  hasSubmittedIntake,
  initializeIntakeReviewStore,
  markParticipantReviewed,
} from '../../lib/participantReview';
import s from '../../styles/ui.module.css';
import styles from './RosterTab.module.css';

/**
 * Stage 1 — Track. A calm, read-first roster. The host mostly watches: who
 * submitted, who RSVP'd, who wrote something meaty, who's gone quiet. No inline
 * editing — the intake is the source of truth; reading the full entry opens a
 * read-only drawer, where the host can copy that guest's invite link. The only
 * write on this screen is adding an invitee.
 */
export default function RosterTab() {
  const { secret } = useHost();
  const [world, setWorld] = useState<HostWorld | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, setReviewTick] = useState(0);

  useEffect(() => {
    hostBootstrap(secret).then(setWorld).catch(() => setError('Could not load the roster.'));
  }, [secret]);

  useEffect(() => {
    if (!world) return;
    initializeIntakeReviewStore(world.participants);
    setReviewTick((tick) => tick + 1);
  }, [world]);

  const rows = useMemo(() => {
    if (!world) return [];
    return [...world.participants].sort(sortGuests);
  }, [world]);

  if (error) return <Shell><p className={s.body}>{error}</p></Shell>;
  if (!world) return <Shell><p className={s.body}>Loading…</p></Shell>;

  const guests = world.participants;
  const submitted = guests.filter(hasSubmittedIntake).length;
  const invitedOnly = guests.length - submitted;
  const coming = guests.filter((g) => g.rsvp === 'yes').length;
  const rosterVisible = world.settings?.roster_visible ?? false;
  const open = openId ? guests.find((g) => g.id === openId) ?? null : null;

  async function onAddInvitee() {
    const name = window.prompt('Invitee name (you can fill in the rest later):')?.trim();
    if (!name) return;
    try {
      const created = await hostAddInvitee(secret, { preferred_name: name });
      setWorld((prev) => (prev ? { ...prev, participants: [...prev.participants, created] } : prev));
    } catch {
      setError('Could not add that invitee.');
    }
  }

  async function onCopyLink(p: ParticipantFull) {
    const link = inviteLink(p);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(p.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === p.id ? null : cur)), 1400);
    } catch {
      window.prompt('Copy invite link', link);
    }
  }

  function onRead(p: ParticipantFull) {
    setOpenId(p.id);
    if (hasSubmittedIntake(p)) {
      markParticipantReviewed(p);
      setReviewTick((tick) => tick + 1);
    }
  }

  return (
    <div className={s.page}>
      <div className={styles.layout}>
        <main className={styles.main}>
          <div className={s.titleRow}>
            <div>
              <h1 className={s.title}>Roster</h1>
              <p className={s.intro}>
                {guests.length} tracked · {submitted} submitted · {invitedOnly} invited · {coming} yes ·
                roster {rosterVisible ? 'live' : 'hidden'}
              </p>
            </div>
            <button className={s.btn} onClick={onAddInvitee}>Add invitee</button>
          </div>

          {guests.length === 0 ? (
            <p className={`${s.body} ${styles.empty}`}>No one yet. Share an invite link to start tracking.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thLeft}>Guest</th>
                  <th>RSVP</th>
                  <th className={styles.thRight}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const review = getIntakeReviewStatus(p);
                  return (
                    <tr key={p.id} className={styles.row} onClick={() => onRead(p)}>
                      <td className={styles.nameCell}>
                        <span className={styles.name}>{displayName(p)}</span>
                        {review && (
                          <span
                            className={styles.marker}
                            title={review.kind === 'new' ? 'New entry' : 'Edited since last read'}
                          >
                            *
                          </span>
                        )}
                      </td>
                      <td><span className={rsvpClass(p.rsvp, styles)}>{humanRsvp(p.rsvp)}</span></td>
                      <td className={`${styles.statusCell} ${hasSubmittedIntake(p) ? '' : styles.dim}`}>
                        {hasSubmittedIntake(p) ? 'Submitted' : 'Invited'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </main>

        <Rollups guests={guests} />
      </div>

      <DetailDrawer participant={open} onClose={() => setOpenId(null)} onCopyLink={onCopyLink} copied={open ? copiedId === open.id : false} />
    </div>
  );
}

/**
 * The shareable side of the roster: three logistics lists rolled up across every
 * guest — who's bringing what, who has dietary needs, what lines to avoid. The
 * host reads this here before publishing any of it to the guest-facing About
 * page, so it's plain text, styled like that page's Premise/Where/When details.
 *
 * Note: hard limits are promised "private" at intake. This panel is host-only;
 * names are kept so the host can follow up, but consider anonymising before
 * sharing the limits list with players.
 */
function Rollups({ guests }: { guests: ParticipantFull[] }) {
  const dietary = useMemo(() => buildRollup(guests, (p) => p.dietary), [guests]);
  const limits = useMemo(() => buildRollup(guests, (p) => p.hard_limits), [guests]);

  return (
    <aside className={styles.aside}>
      <RollupSection label="Dietary" items={dietary} />
      <RollupSection label="Hard limits" items={limits} />
    </aside>
  );
}

function RollupSection({ label, items }: { label: string; items: RollupItem[] }) {
  return (
    <section className={styles.rollup}>
      <div className={styles.rollupHead}>
        <span className={styles.rollupLabel}>{label}</span>
        <span className={styles.rollupCount}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className={styles.rollupEmpty}>Nothing yet.</p>
      ) : (
        <dl className={styles.rollupList}>
          {items.map((it) => (
            <div key={it.id}>
              <dt className={styles.rollupName}>{it.name}</dt>
              <dd className={styles.rollupValue}>{it.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function DetailDrawer({
  participant,
  onClose,
  onCopyLink,
  copied,
}: {
  participant: ParticipantFull | null;
  onClose: () => void;
  onCopyLink: (p: ParticipantFull) => void;
  copied: boolean;
}) {
  return (
    <AnimatePresence>
      {participant && (
        <motion.aside
          className={styles.drawer}
          data-ui
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        >
          <header className={styles.drawerHead}>
            <h2 className={s.heading}>{displayName(participant)}</h2>
            <button className={styles.close} onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </header>

          <div className={styles.drawerScroll}>
            <p className={styles.meta}>{metaLine(participant)}</p>

            {hasSubmittedIntake(participant) ? (
              <dl className={styles.answers}>
                {INTAKE_QUESTIONS.filter((q) => !q.showIf || q.showIf(participant))
                  .map((q) => [q.label, formatAnswer(q, participant)] as const)
                  .filter(([, a]) => a)
                  .map(([label, answer]) => (
                    <div key={label}>
                      <dt className={s.eyebrow}>{label}</dt>
                      <dd className={s.body}>{answer}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className={`${s.body} ${styles.dim}`}>Hasn't submitted intake yet.</p>
            )}

            {participant.host_notes?.trim() && (
              <div className={styles.hostNotes}>
                <span className={s.eyebrow}>Host notes</span>
                <p className={s.body}>{participant.host_notes}</p>
              </div>
            )}

            <button className={s.btn} onClick={() => onCopyLink(participant)}>
              {copied ? 'Copied invite link' : 'Copy invite link'}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={s.page}>
      <div className={s.inner}>{children}</div>
    </div>
  );
}

// ── derivations ──────────────────────────────────────────────────────────

type RollupItem = { id: string; name: string; value: string };

/** Collect one free-text field across all guests into a sorted, signal-only list. */
function buildRollup(guests: ParticipantFull[], pick: (p: ParticipantFull) => string): RollupItem[] {
  return guests
    .map((p) => ({ id: p.id, name: displayName(p), value: (pick(p) ?? '').trim() }))
    .filter((it) => isMeaningful(it.value))
    .sort(byName);
}

/** Drop blanks and the handful of "nothing to report" answers so a shared list stays clean. */
function isMeaningful(text: string): boolean {
  return Boolean(text) && !/^(none|n\/?a|nil|nope?|–|—|-)\.?$/i.test(text);
}

function byName(a: RollupItem, b: RollupItem): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function metaLine(p: ParticipantFull): string {
  return [
    humanRsvp(p.rsvp),
    p.roleplay_comfort != null ? `role size ${p.roleplay_comfort}/5` : null,
    formatDishContribution(p) || null,
    p.contact?.trim() || null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function displayName(p: ParticipantFull): string {
  return p.preferred_name?.trim() || p.contact?.trim() || 'unnamed';
}

function humanRsvp(rsvp: Rsvp): string {
  return rsvp === 'yes' ? 'Yes' : rsvp === 'no' ? 'No' : 'Maybe';
}

function rsvpClass(rsvp: Rsvp, css: Record<string, string>): string {
  if (rsvp === 'yes') return css.rsvpYes;
  if (rsvp === 'no') return css.rsvpNo;
  return css.rsvpMaybe;
}

function inviteLink(p: ParticipantFull): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?p=${p.token}`;
}

/** Most-recently-touched first, so new and edited entries float to the top. */
function sortGuests(a: ParticipantFull, b: ParticipantFull): number {
  const diff = updatedTime(b) - updatedTime(a);
  if (diff !== 0) return diff;
  return displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' });
}

function updatedTime(p: ParticipantFull): number {
  const t = p.updated_at ? new Date(p.updated_at).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}
