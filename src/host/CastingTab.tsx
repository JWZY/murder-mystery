import { useEffect, useState } from 'react';
import {
  hostBootstrap,
  hostAssign,
  hostSetFlags,
  hostSaveCharacter,
  hostDeleteCharacter,
  type HostWorld,
  type ParticipantFull,
  type CharacterFull,
  type TruthTag,
} from '../lib/hostApi';
import { useHost } from './hostContext';
import { seedCharacter } from './seedCharacter';
import s from './responses.module.css';
import c from './casting.module.css';

/**
 * The host casting workspace. For each guest: cast them into a character,
 * flag the murderer, and author their two-layer card (auto-seeded from their
 * own answers, gated by their consent dial). Releasing a card is what makes it
 * visible on that guest's "Your character" tab.
 */
export default function CastingTab() {
  const { secret } = useHost();
  const [world, setWorld] = useState<HostWorld | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null); // participant id

  async function reload() {
    try {
      setWorld(await hostBootstrap(secret));
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      setError(
        /host_bootstrap|does not exist|schema cache/i.test(msg)
          ? 'Casting backend not installed yet — run supabase/casting.sql in the Supabase SQL Editor, then reload.'
          : 'Could not load casting data.',
      );
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret]);

  if (error) return <div className={s.page}><div className={s.inner}><p className={s.error}>{error}</p></div></div>;
  if (!world) return <div className={s.page}><div className={s.inner}><p className={s.subtitle}>Loading…</p></div></div>;

  const byId = (id: string | null) => world.characters.find((x) => x.id === id) ?? null;
  const cast = world.participants.filter((p) => p.character_id).length;
  const killers = world.participants.filter((p) => p.is_murderer).length;

  async function draftFor(p: ParticipantFull, index: number) {
    const seed = seedCharacter(p, index);
    await hostSaveCharacter(secret, { ...seed, participant_id: p.id });
    await reload();
    setEditing(p.id);
  }

  async function assign(p: ParticipantFull, charId: string) {
    await hostAssign(secret, p.id, charId || null);
    await reload();
  }

  async function toggleMurderer(p: ParticipantFull) {
    await hostSetFlags(secret, p.id, { is_murderer: !p.is_murderer });
    await reload();
  }

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.head}>
          <h1 className={s.title}>Casting</h1>
          <p className={s.subtitle}>
            Cast each guest, draft their card from their real answers (consent-dialed), then{' '}
            <strong>release</strong> it so they can read it. {cast}/{world.participants.length} cast ·{' '}
            {killers} murderer{killers === 1 ? '' : 's'} flagged.
          </p>
        </header>

        {world.participants.map((p, i) => {
          const char = byId(p.character_id);
          return (
            <div key={p.id} className={s.card}>
              <div className={s.cardHead}>
                <span className={s.name}>{p.preferred_name || <em>unnamed</em>}</span>
                <span className={s.rsvp}>comfort {p.roleplay_comfort ?? '—'}/5</span>
                <span className={s.truthTag}>dial {p.reveal_dial ?? '—'}/5</span>
                {p.is_murderer && <span className={c.pillOn}>murderer</span>}
                {char?.released && <span className={c.pillReleased}>released</span>}
              </div>

              <div className={c.row} style={{ marginTop: 6 }}>
                <select
                  className={c.select}
                  value={p.character_id ?? ''}
                  onChange={(e) => assign(p, e.target.value)}
                >
                  <option value="">— not cast —</option>
                  {world.characters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                      {ch.title ? ` · ${ch.title}` : ''}
                    </option>
                  ))}
                </select>

                {!char && (
                  <button className={c.btn} onClick={() => draftFor(p, i)}>
                    ✨ Draft card from answers
                  </button>
                )}
                {char && (
                  <button
                    className={`${c.btn} ${c.btnGhost}`}
                    onClick={() => setEditing(editing === p.id ? null : p.id)}
                  >
                    {editing === p.id ? 'Close editor' : 'Edit card'}
                  </button>
                )}

                <label className={c.toggle}>
                  <input type="checkbox" checked={p.is_murderer} onChange={() => toggleMurderer(p)} />
                  murderer
                </label>

                <span className={c.spacer} />
                {!char && <span className={c.uncast}>no card yet</span>}
              </div>

              {char && editing === p.id && (
                <CardEditor
                  key={char.id}
                  secret={secret}
                  participant={p}
                  character={char}
                  onSaved={reload}
                  onDeleted={async () => {
                    await hostDeleteCharacter(secret, char.id);
                    setEditing(null);
                    await reload();
                  }}
                />
              )}
            </div>
          );
        })}

        {world.participants.length === 0 && (
          <div className={s.subtitle}>No responses yet — cards appear here once guests submit.</div>
        )}
      </div>
    </div>
  );
}

// ── Card editor ─────────────────────────────────────────────────────────────
function CardEditor({
  secret,
  participant,
  character,
  onSaved,
  onDeleted,
}: {
  secret: string;
  participant: ParticipantFull;
  character: CharacterFull;
  onSaved: () => Promise<void> | void;
  onDeleted: () => Promise<void> | void;
}) {
  const [d, setD] = useState<CharacterFull>(character);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  const set = (patch: Partial<CharacterFull>) => setD((prev) => ({ ...prev, ...patch }));
  const setTag = (i: number, patch: Partial<TruthTag>) =>
    setD((prev) => ({ ...prev, truth_tags: prev.truth_tags.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));

  const link = `${window.location.origin}${import.meta.env.BASE_URL}?p=${participant.token}`;

  async function save(extra?: Partial<CharacterFull>) {
    setBusy(true);
    try {
      const payload = { ...d, ...extra, id: character.id };
      await hostSaveCharacter(secret, payload);
      if (extra) setD((prev) => ({ ...prev, ...extra }));
      setFlash('Saved ✓');
      setTimeout(() => setFlash(''), 1500);
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={c.editor}>
      <div className={c.editorGrid}>
        <Field label="Persona name">
          <input className={c.input} value={d.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Archetype / title">
          <input className={c.input} value={d.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Card colour">
          <input className={c.input} type="color" value={d.color} onChange={(e) => set({ color: e.target.value })} />
        </Field>
      </div>

      <Field label="Background (player sees this)">
        <textarea className={c.area} value={d.background} onChange={(e) => set({ background: e.target.value })} />
      </Field>

      <div className={c.editorGrid}>
        <Field label="Act I — Arrival">
          <textarea className={c.area} value={d.act1} onChange={(e) => set({ act1: e.target.value })} />
        </Field>
        <Field label="Act II — The Turn (basement)">
          <textarea className={c.area} value={d.act2} onChange={(e) => set({ act2: e.target.value })} />
        </Field>
        <Field label="Act III — Reckoning">
          <textarea className={c.area} value={d.act3} onChange={(e) => set({ act3: e.target.value })} />
        </Field>
      </div>

      <div className={c.editorGrid}>
        <Field label="Props to bring">
          <textarea className={c.area} value={d.props} onChange={(e) => set({ props: e.target.value })} />
        </Field>
        <Field label="Recommended guests to meet">
          <textarea className={c.area} value={d.recommended_meets} onChange={(e) => set({ recommended_meets: e.target.value })} />
        </Field>
        <div />
      </div>

      <div className={c.secret}>
        <Field label="🔒 Secret / motive — HOST ONLY, never shown to the player">
          <textarea className={c.area} value={d.secret} onChange={(e) => set({ secret: e.target.value })} />
        </Field>
      </div>

      <Field label={`Truth tags — real facts woven in (this guest's dial: ${participant.reveal_dial ?? '—'}/5)`}>
        {d.truth_tags.map((t, i) => (
          <div key={i} className={c.tag}>
            <input
              className={`${c.input} ${c.tagBeat}`}
              placeholder="beat"
              value={t.beat ?? ''}
              onChange={(e) => setTag(i, { beat: e.target.value })}
            />
            <input
              className={c.input}
              placeholder="the truth woven in"
              value={t.truth ?? ''}
              onChange={(e) => setTag(i, { truth: e.target.value })}
            />
            <button
              className={`${c.btn} ${c.btnGhost}`}
              onClick={() => set({ truth_tags: d.truth_tags.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className={`${c.btn} ${c.btnGhost}`}
          onClick={() => set({ truth_tags: [...d.truth_tags, { beat: '', truth: '' }] })}
        >
          + truth tag
        </button>
      </Field>

      <div className={c.saveBar}>
        <button className={c.btn} disabled={busy} onClick={() => save()}>
          {busy ? 'Saving…' : 'Save card'}
        </button>
        <button
          className={`${c.btn} ${d.released ? c.btnGhost : ''}`}
          disabled={busy}
          onClick={() => save({ released: !d.released })}
        >
          {d.released ? 'Un-release (hide from player)' : '🚀 Release to player'}
        </button>
        <button className={`${c.btn} ${c.btnDanger}`} disabled={busy} onClick={onDeleted}>
          Delete card
        </button>
        {flash && <span className={c.saved}>{flash}</span>}
        <span className={c.spacer} />
      </div>

      <div className={c.saveBar}>
        <span className={c.link}>{link}</span>
        <button className={`${c.btn} ${c.btnGhost}`} onClick={() => navigator.clipboard?.writeText(link)}>
          Copy link
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={c.field}>
      <span className={s.q}>{label}</span>
      {children}
    </label>
  );
}
