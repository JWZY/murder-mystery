import { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import {
  hostBootstrap,
  hostDeleteParticipant,
  type HostWorld,
  type ParticipantFull,
} from '../../lib/hostApi';
import { useHost } from '../../host/hostContext';
import { INTAKE_QUESTIONS, formatAnswer } from '../../lib/intakeSchema';
import s from '../../styles/ui.module.css';

// Bringing/Dishes is the one schema field surfaced in the compact header above.
const DISH_QUESTION = INTAKE_QUESTIONS.find((q) => q.kind === 'dishes')!;

export default function GuestTab() {
  const { secret } = useHost();
  const [world, setWorld] = useState<HostWorld | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
    if (!confirm(`Delete "${p.preferred_name || 'unnamed'}" permanently?`)) return;
    await hostDeleteParticipant(secret, p.id);
    setWorld((prev) =>
      prev ? { ...prev, participants: prev.participants.filter((x) => x.id !== p.id) } : prev
    );
  }

  if (error) return <Shell><p className={s.body}>{error}</p></Shell>;
  if (!world) return <Shell><p className={`${s.body} ${s.muted}`}>Loading…</p></Shell>;

  const guests = world.participants;
  const charactersById = Object.fromEntries(world.characters.map((c) => [c.id, c]));
  const going = guests.filter((g) => g.rsvp === 'yes').length;
  const rosterVisible = world.settings?.roster_visible ?? false;

  return (
    <Shell>
      <h1 className={s.title}>Guests</h1>
      <p className={`${s.body} ${s.muted}`} style={{ marginTop: 'var(--space-2)' }}>
        Compact roster up top, full intake answers behind each row. Click a card to expand.
      </p>
      <p className={`${s.body} ${s.muted}`} style={{ marginTop: 'var(--space-2)' }}>
        {guests.length} response{guests.length === 1 ? '' : 's'} · {going} coming · roster {rosterVisible ? 'live to guests' : 'hidden from guests'}
      </p>

      <div style={{ marginTop: 'var(--space-6)' }}>
        {guests.length === 0 && (
          <p className={`${s.body} ${s.muted}`}>No responses yet — share the intake link.</p>
        )}

        {guests.map((g) => {
          const character = g.character_id ? charactersById[g.character_id] : null;
          const dish = formatAnswer(DISH_QUESTION, g);
          const isOpen = expanded.has(g.id);
          const playing = character
            ? `${character.name}${character.title ? ` · ${character.title}` : ''}${character.released ? '' : ' · unreleased'}`
            : null;
          const headline = [
            g.rsvp,
            dish || 'bringing TBD',
            g.is_murderer ? 'murderer' : null,
          ].filter(Boolean).join(' · ');

          return (
            <div
              key={g.id}
              className={s.card}
              onClick={() => toggle(g.id)}
              style={{ cursor: 'pointer' }}
            >
              <button
                className={s.cardClose}
                onClick={(e) => { e.stopPropagation(); onDelete(g); }}
                aria-label="Delete"
              >
                <X size={16} />
              </button>

              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <p className={s.bodyBold}>{g.preferred_name || <em>unnamed</em>}</p>
                <ChevronDown
                  size={18}
                  style={{
                    color: 'var(--color-text)',
                    transition: 'transform var(--transition-fast)',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                  }}
                />
              </div>

              <p className={`${s.body} ${s.muted}`}>{headline}</p>
              {playing && <p className={s.body} style={{ marginTop: 'var(--space-2)' }}>Playing: {playing}</p>}

              {isOpen && <Detail r={g} />}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <div className={s.inner}>{children}</div>
    </div>
  );
}

function Detail({ r }: { r: ParticipantFull }) {
  const visible = INTAKE_QUESTIONS.filter((q) => !q.showIf || q.showIf(r));
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', cursor: 'default' }}
    >
      <div className={s.qaGrid}>
        {visible.map((q) => (
          <QA key={String(q.key) + q.kind} q={q.label} a={formatAnswer(q, r)} />
        ))}
      </div>

      {r.host_notes && (
        <>
          <p className={s.bodyBold} style={{ marginTop: 'var(--space-5)' }}>Host notes</p>
          <p className={s.body} style={{ whiteSpace: 'pre-wrap' }}>{r.host_notes}</p>
        </>
      )}
    </div>
  );
}

function QA({ q, a }: { q: string; a: string | null | undefined }) {
  return (
    <div className={s.qa}>
      <span className={s.bodyBold}>{q}</span>
      <span className={`${s.body} ${a ? '' : s.faint}`} style={{ whiteSpace: 'pre-wrap' }}>{a || '—'}</span>
    </div>
  );
}
