import { useEffect, useState } from 'react';
import { hostParticipants, hostDeleteParticipant, type ParticipantFull } from '../lib/hostApi';
import { useHost } from './hostContext';
import s from './responses.module.css';

/**
 * Host view of the LIVE intake responses pulled from Supabase. Renders inside
 * <HostGate>, so the passcode is already validated. This is the input to casting.
 */
export default function ResponsesTab() {
  const { secret } = useHost();
  const [rows, setRows] = useState<ParticipantFull[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    hostParticipants(secret).then(setRows).catch(() => setError('Could not load responses.'));
  }, [secret]);

  async function onDelete(r: ParticipantFull) {
    if (!confirm(`Delete "${r.preferred_name || 'unnamed'}" permanently?`)) return;
    await hostDeleteParticipant(secret, r.id);
    setRows((prev) => prev?.filter((x) => x.id !== r.id) ?? null);
  }

  if (error) return <div className={s.page}><div className={s.inner}><p className={s.error}>{error}</p></div></div>;
  if (!rows) return <div className={s.page}><div className={s.inner}><p className={s.subtitle}>Loading…</p></div></div>;

  const going = rows.filter((r) => r.rsvp === 'yes').length;
  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.head}>
          <h1 className={s.title}>Live responses</h1>
          <p className={s.subtitle}>
            Everything guests submitted, host eyes only. This feeds casting and the two-layer
            character cards.
          </p>
        </header>

        <div className={s.toolbar}>
          <span className={s.count}>
            {rows.length} response{rows.length === 1 ? '' : 's'} · {going} coming
          </span>
        </div>

        {rows.map((r) => (
          <ResponseCard key={r.id} r={r} onDelete={() => onDelete(r)} />
        ))}
      </div>
    </div>
  );
}

function ResponseCard({ r, onDelete }: { r: ParticipantFull; onDelete: () => void }) {
  return (
    <div className={s.card}>
      <button className={s.del} onClick={onDelete} aria-label="Delete">
        ×
      </button>
      <div className={s.cardHead}>
        <span className={s.name}>{r.preferred_name || <em>unnamed</em>}</span>
        <span className={`${s.rsvp} ${r.rsvp === 'yes' ? s.rsvpYes : r.rsvp === 'no' ? s.rsvpNo : ''}`}>
          {r.rsvp}
        </span>
        {r.is_murderer && <span className={s.truthTag}>murderer</span>}
      </div>
      <div className={s.meta}>
        {r.contact || 'no contact'} · comfort {r.roleplay_comfort ?? '—'}/5 · murderer appetite:{' '}
        {r.murderer_appetite ?? '—'}
      </div>

      <div className={s.grid}>
        <QA q="Bringing" a={[r.dish_category, r.dish_detail].filter(Boolean).join(' — ')} />
        <QA q="Dietary" a={r.dietary} />
        <QA q="Trope wishlist" a={r.trope_wishlist} />
        <QA q="Hard limits" a={r.hard_limits} />
        <QA q="Public bio" a={r.public_bio} />
      </div>

      <div className={s.truth}>
        <span className={s.q}>
          Truth layer
          <span className={s.truthTag}>reveal dial {r.reveal_dial ?? '—'}/5</span>
        </span>
        <div className={s.grid} style={{ marginTop: 8 }}>
          <QA q="Surprising fact" a={r.surprise_fact} />
          <QA q="Worst job" a={r.worst_job} />
          <QA q="Hobby" a={r.hobby} />
          <QA q="Changed opinion" a={r.changed_opinion} />
          <QA q="Outable secret" a={r.outable_secret} />
          <QA q="Known for" a={r.social_known} />
          <QA q="Wants to be seen as" a={r.social_want} />
          <QA q="Could fake being good at" a={r.fakeable_skill} />
        </div>
      </div>

      {r.host_notes && (
        <div className={s.truth}>
          <QA q="Host notes" a={r.host_notes} />
        </div>
      )}
    </div>
  );
}

function QA({ q, a }: { q: string; a: string | null | undefined }) {
  return (
    <div className={s.qa}>
      <span className={s.q}>{q}</span>
      <div className={`${s.a} ${a ? '' : s.aEmpty}`}>{a || '—'}</div>
    </div>
  );
}
