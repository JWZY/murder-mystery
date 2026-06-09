import { Fragment, type FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Clipboard, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  hostAddInvitee,
  hostBootstrap,
  hostDeleteParticipant,
  hostUpdateParticipant,
  type HostWorld,
  type ParticipantFull,
} from '../../lib/hostApi';
import type { Rsvp } from '../../types/participant';
import { useHost } from '../../host/hostContext';
import { updateMyRecord } from '../../lib/api';
import {
  DISH_OPTIONS,
  INTAKE_QUESTIONS,
  formatAnswer,
  formatDishContribution,
} from '../../lib/intakeSchema';
import s from '../../styles/ui.module.css';
import styles from './GuestTab.module.css';

type InviteeDraft = {
  preferred_name: string;
  contact: string;
  rsvp: Rsvp;
  host_notes: string;
};

type RowDraft = {
  preferred_name: string;
  contact: string;
  rsvp: Rsvp;
  dish_category: string;
  dish_detail: string;
  host_notes: string;
};

const EMPTY_DRAFT: InviteeDraft = {
  preferred_name: '',
  contact: '',
  rsvp: 'maybe',
  host_notes: '',
};

export default function GuestTab() {
  const { secret } = useHost();
  const [world, setWorld] = useState<HostWorld | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<InviteeDraft>(EMPTY_DRAFT);
  const [savingInvitee, setSavingInvitee] = useState(false);
  const [inviteeError, setInviteeError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState<RowDraft | null>(null);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [rowError, setRowError] = useState('');

  useEffect(() => {
    hostBootstrap(secret).then(setWorld).catch(() => setError('Could not load the guest list.'));
  }, [secret]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onDelete(p: ParticipantFull) {
    if (!confirm(`Delete "${displayName(p)}" permanently?`)) return;
    await hostDeleteParticipant(secret, p.id);
    setWorld((prev) =>
      prev ? { ...prev, participants: prev.participants.filter((x) => x.id !== p.id) } : prev
    );
    if (editingId === p.id) cancelEdit();
  }

  function startEdit(p: ParticipantFull) {
    setRowError('');
    setEditingId(p.id);
    setRowDraft({
      preferred_name: p.preferred_name ?? '',
      contact: p.contact ?? '',
      rsvp: p.rsvp,
      dish_category: p.dish_category ?? '',
      dish_detail: p.dish_detail ?? '',
      host_notes: p.host_notes ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setRowDraft(null);
    setRowError('');
  }

  function updateRowDraft<K extends keyof RowDraft>(key: K, value: RowDraft[K]) {
    setRowDraft((current) => current ? { ...current, [key]: value } : current);
  }

  async function saveRow(p: ParticipantFull) {
    if (!rowDraft) return;
    const name = rowDraft.preferred_name.trim();
    const contact = rowDraft.contact.trim();
    if (!name && !contact) {
      setRowError('Keep a name or contact on the row.');
      return;
    }

    setSavingRowId(p.id);
    setRowError('');
    try {
      const payload = {
        preferred_name: name,
        contact,
        rsvp: rowDraft.rsvp,
        dish_category: rowDraft.dish_category.trim() || null,
        dish_detail: rowDraft.dish_detail.trim(),
        host_notes: rowDraft.host_notes.trim(),
      };
      const participant = await updateParticipantRow(secret, p, payload);
      setWorld((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((existing) =>
                existing.id === participant.id ? participant : existing
              ),
            }
          : prev
      );
      cancelEdit();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Could not save that row.');
    } finally {
      setSavingRowId(null);
    }
  }

  async function onAddInvitee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.preferred_name.trim();
    const contact = draft.contact.trim();
    const notes = draft.host_notes.trim();
    if (!name && !contact) {
      setInviteeError('Add a name or contact so this row is findable later.');
      return;
    }

    setSavingInvitee(true);
    setInviteeError('');
    try {
      const participant = await hostAddInvitee(secret, {
        preferred_name: name,
        contact,
        rsvp: draft.rsvp,
        host_notes: notes,
      });
      setWorld((prev) =>
        prev ? { ...prev, participants: [...prev.participants, participant] } : prev
      );
      setDraft(EMPTY_DRAFT);
      setExpanded((prev) => new Set(prev).add(participant.id));
    } catch (e) {
      setInviteeError(e instanceof Error ? e.message : 'Could not add invitee.');
    } finally {
      setSavingInvitee(false);
    }
  }

  async function copyInviteLink(p: ParticipantFull) {
    const link = inviteLink(p);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(p.id);
      window.setTimeout(() => setCopiedId((current) => current === p.id ? null : current), 1400);
    } catch {
      window.prompt('Copy invite link', link);
    }
  }

  if (error) return <Shell><p className={s.body}>{error}</p></Shell>;
  if (!world) return <Shell><p className={`${s.body} ${s.muted}`}>Loading...</p></Shell>;

  const guests = [...world.participants].sort(sortGuests);
  const charactersById = Object.fromEntries(world.characters.map((c) => [c.id, c]));
  const submitted = guests.filter(hasSubmittedIntake).length;
  const invitedOnly = guests.length - submitted;
  const coming = guests.filter((g) => g.rsvp === 'yes').length;
  const rosterVisible = world.settings?.roster_visible ?? false;

  return (
    <Shell>
      <div className={s.titleRow}>
        <div>
          <h1 className={s.title}>Guests</h1>
          <p className={s.intro}>
            {guests.length} tracked · {submitted} submitted · {invitedOnly} invited · {coming} yes · roster {rosterVisible ? 'live' : 'hidden'}
          </p>
        </div>
      </div>

      <form className={styles.addStrip} onSubmit={onAddInvitee}>
        <label>
          <span>Name</span>
          <input
            className={s.input}
            value={draft.preferred_name}
            placeholder="Who did you invite?"
            onChange={(e) => setDraft((d) => ({ ...d, preferred_name: e.target.value }))}
          />
        </label>
        <label>
          <span>Contact</span>
          <input
            className={s.input}
            value={draft.contact}
            placeholder="Phone, email, handle"
            onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))}
          />
        </label>
        <label>
          <span>RSVP</span>
          <select
            className={s.select}
            value={draft.rsvp}
            onChange={(e) => setDraft((d) => ({ ...d, rsvp: e.target.value as Rsvp }))}
          >
            <option value="maybe">Maybe</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label>
          <span>Host note</span>
          <input
            className={s.input}
            value={draft.host_notes}
            placeholder="Invited via text, plus-one, follow up..."
            onChange={(e) => setDraft((d) => ({ ...d, host_notes: e.target.value }))}
          />
        </label>
        <button className={`${s.btn} ${styles.addButton}`} disabled={savingInvitee}>
          <Plus size={17} />
          {savingInvitee ? 'Adding...' : 'Add'}
        </button>
      </form>
      <p className={styles.inviteHint}>
        Logged invitees get their own intake link. Send that row's link to update the same row; the blank public form creates a separate submission.
      </p>
      {inviteeError && <p className={`${s.notice} ${styles.addError}`}>{inviteeError}</p>}
      {rowError && <p className={`${s.notice} ${styles.addError}`}>{rowError}</p>}

      <div className={styles.tableFrame}>
        <table className={styles.guestTable}>
          <thead>
            <tr>
              <th scope="col">Guest</th>
              <th scope="col">Status</th>
              <th scope="col">RSVP</th>
              <th scope="col">Contact</th>
              <th scope="col">Dish</th>
              <th scope="col">Role</th>
              <th scope="col">Notes</th>
              <th scope="col" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {guests.length === 0 && (
              <tr>
                <td className={styles.empty} colSpan={8}>
                  Add invitees here as you ask people, then share each row's intake link when you are ready.
                </td>
              </tr>
            )}
            {guests.map((g) => {
              const character = g.character_id ? charactersById[g.character_id] : null;
              const isOpen = expanded.has(g.id);
              const isEditing = editingId === g.id && rowDraft;
              const isSaving = savingRowId === g.id;
              const submittedRow = hasSubmittedIntake(g);
              const dish = formatDishContribution(g);
              const detailId = `guest-detail-${g.id}`;
              const rowStatus = submittedRow ? 'Submitted' : 'Invited';
              const playing = character
                ? `${character.name}${character.title ? ` · ${character.title}` : ''}${character.released ? '' : ' · unreleased'}`
                : '';

              return (
                <Fragment key={g.id}>
                  <tr className={isOpen ? styles.openRow : undefined}>
                    <th scope="row">
                      {isEditing ? (
                        <input
                          className={styles.tableInput}
                          value={rowDraft.preferred_name}
                          placeholder="Name"
                          onChange={(e) => updateRowDraft('preferred_name', e.target.value)}
                        />
                      ) : (
                        <button
                          type="button"
                          className={styles.rowToggle}
                          onClick={() => toggle(g.id)}
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                        >
                          <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
                          <span>{displayName(g)}</span>
                        </button>
                      )}
                    </th>
                    <td>
                      <span className={`${styles.status} ${submittedRow ? styles.statusSubmitted : styles.statusInvited}`}>
                        {rowStatus}
                      </span>
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className={styles.tableSelect}
                          value={rowDraft.rsvp}
                          onChange={(e) => updateRowDraft('rsvp', e.target.value as Rsvp)}
                        >
                          <option value="yes">Yes</option>
                          <option value="maybe">Maybe</option>
                          <option value="no">No</option>
                        </select>
                      ) : humanRsvp(g.rsvp)}
                    </td>
                    <td className={isEditing ? undefined : styles.truncate}>
                      {isEditing ? (
                        <input
                          className={styles.tableInput}
                          value={rowDraft.contact}
                          placeholder="Contact"
                          onChange={(e) => updateRowDraft('contact', e.target.value)}
                        />
                      ) : g.contact || '—'}
                    </td>
                    <td className={isEditing ? undefined : styles.truncate}>
                      {isEditing ? (
                        <div className={styles.dishEdit}>
                          <select
                            className={styles.tableSelect}
                            value={rowDraft.dish_category}
                            onChange={(e) => updateRowDraft('dish_category', e.target.value)}
                            aria-label="Dish category"
                          >
                            <option value="">TBD</option>
                            {DISH_OPTIONS.map((option) => (
                              <option key={option.v} value={option.v}>{option.label}</option>
                            ))}
                          </select>
                          <input
                            className={styles.tableInput}
                            value={rowDraft.dish_detail}
                            placeholder="Dish detail"
                            onChange={(e) => updateRowDraft('dish_detail', e.target.value)}
                          />
                        </div>
                      ) : dish || 'TBD'}
                    </td>
                    <td className={styles.truncate}>{playing || 'Uncast'}</td>
                    <td className={isEditing ? undefined : styles.truncate}>
                      {isEditing ? (
                        <input
                          className={styles.tableInput}
                          value={rowDraft.host_notes}
                          placeholder="Host notes"
                          onChange={(e) => updateRowDraft('host_notes', e.target.value)}
                        />
                      ) : g.host_notes || g.notes || '—'}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => saveRow(g)}
                              title="Save row"
                              aria-label={`Save ${displayName(g)}`}
                              disabled={isSaving}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={cancelEdit}
                              title="Cancel editing"
                              aria-label={`Cancel editing ${displayName(g)}`}
                              disabled={isSaving}
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => startEdit(g)}
                              title="Edit row"
                              aria-label={`Edit ${displayName(g)}`}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => copyInviteLink(g)}
                              title={copiedId === g.id ? 'Copied' : 'Copy intake link'}
                              aria-label={`Copy intake link for ${displayName(g)}`}
                            >
                              <Clipboard size={16} />
                            </button>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => onDelete(g)}
                              title="Delete row"
                              aria-label={`Delete ${displayName(g)}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen && !isEditing && (
                    <tr className={styles.detailRow}>
                      <td id={detailId} colSpan={8}>
                        <Detail r={g} submitted={submittedRow} inviteLink={inviteLink(g)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

async function updateParticipantRow(
  secret: string,
  participant: ParticipantFull,
  payload: {
    preferred_name: string;
    contact: string;
    rsvp: Rsvp;
    dish_category: string | null;
    dish_detail: string;
    host_notes: string;
  },
): Promise<ParticipantFull> {
  try {
    return await hostUpdateParticipant(secret, participant.id, payload);
  } catch (e) {
    if (!isMissingHostUpdateRpc(e)) throw e;
  }

  await updateMyRecord(participant.token, {
    preferred_name: payload.preferred_name,
    contact: payload.contact,
    rsvp: payload.rsvp,
    dish_category: payload.dish_category,
    dish_detail: payload.dish_detail,
  });
  return {
    ...participant,
    preferred_name: payload.preferred_name,
    contact: payload.contact,
    rsvp: payload.rsvp,
    dish_category: payload.dish_category,
    dish_detail: payload.dish_detail,
    updated_at: new Date().toISOString(),
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <div className={`${s.inner} ${styles.inner}`}>{children}</div>
    </div>
  );
}

function Detail({
  r,
  submitted,
  inviteLink,
}: {
  r: ParticipantFull;
  submitted: boolean;
  inviteLink: string;
}) {
  const visible = INTAKE_QUESTIONS.filter((q) => !q.showIf || q.showIf(r));
  const logistics = useMemo(() => [
    ['Invite link', inviteLink],
    ['Created', formatDate(r.created_at)],
    ['Last updated', r.updated_at ? formatDate(r.updated_at) : '—'],
    ['Response state', submitted ? 'Intake submitted' : 'Logged by host, waiting for intake'],
  ], [inviteLink, r.created_at, r.updated_at, submitted]);

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailGrid}>
        {logistics.map(([q, a]) => (
          <QA key={q} q={q} a={a} />
        ))}
      </div>

      <div className={styles.answerGrid}>
        {visible.map((q) => (
          <QA key={String(q.key) + q.kind} q={q.label} a={formatAnswer(q, r)} />
        ))}
      </div>

      {r.host_notes && (
        <div className={styles.hostNotes}>
          <p className={s.bodyBold}>Host notes</p>
          <p className={s.body}>{r.host_notes}</p>
        </div>
      )}
    </div>
  );
}

function QA({ q, a }: { q: string; a: string | null | undefined }) {
  return (
    <div className={styles.qa}>
      <span>{q}</span>
      <span>{a || '—'}</span>
    </div>
  );
}

function displayName(p: ParticipantFull): string {
  return p.preferred_name?.trim() || p.contact?.trim() || 'unnamed';
}

function humanRsvp(rsvp: Rsvp): string {
  return rsvp === 'yes' ? 'Yes' : rsvp === 'no' ? 'No' : 'Maybe';
}

function inviteLink(p: ParticipantFull): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?p=${p.token}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function sortGuests(a: ParticipantFull, b: ParticipantFull): number {
  const aSubmitted = hasSubmittedIntake(a);
  const bSubmitted = hasSubmittedIntake(b);
  if (aSubmitted !== bSubmitted) return aSubmitted ? -1 : 1;
  return displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' });
}

function hasSubmittedIntake(p: ParticipantFull): boolean {
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
    p.notes
  );
}

function isMissingHostUpdateRpc(e: unknown): boolean {
  return getErrorText(e).includes('host_update_participant');
}

function getErrorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const parts = ['message', 'details', 'hint']
      .map((key) => {
        const value = (e as Record<string, unknown>)[key];
        return typeof value === 'string' ? value : '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  return '';
}
