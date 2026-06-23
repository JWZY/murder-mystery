import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  hostAssign,
  hostBootstrap,
  hostDeleteCharacter,
  hostSaveCharacter,
  hostSetFlags,
  type CharacterFull,
  type HostWorld,
  type ParticipantFull,
  type TruthTag,
} from '../lib/hostApi';
import { useHost } from './hostContext';
import s from '../styles/ui.module.css';
import styles from './CastingTab.module.css';

/** Text fields the editor autosaves (string-valued). truth_tags is handled apart. */
type TextField = keyof Pick<
  CharacterFull,
  'name' | 'title' | 'background' | 'act1' | 'act2' | 'act3' | 'action' | 'props' | 'recommended_meets' | 'secret'
>;

/**
 * Stage 3 — Cast. One character edited at a time. The left rail lists every
 * character (with who's cast + whether it's released); the right pane is a
 * plain form that autosaves changed keys back to Supabase.
 *
 * Reveal is binary: "Release" makes the player's card visible — their name and
 * "who you are" background only. Acts, props, and the secret action are
 * delivered by the host out of band, never sent to the player's card. Nothing
 * is auto-generated here — characters are born on the Canvas or via "Add
 * character", never seeded behind your back.
 */
export default function CastingTab() {
  const { secret } = useHost();
  const [world, setWorld] = useState<HostWorld | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Per-character debounced write-back. We accumulate changed keys and flush the
  // whole patch ~1s after the last edit — coalesce semantics on the RPC mean a
  // partial patch never clobbers sibling fields.
  const pending = useRef(new Map<string, Partial<CharacterFull>>());
  const timers = useRef(new Map<string, number>());

  async function reload() {
    try {
      setWorld(await hostBootstrap(secret));
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      setError(
        /host_bootstrap|does not exist|schema cache/i.test(msg)
          ? 'Casting backend not installed — run supabase/casting.sql then casting-phase2.sql, and reload.'
          : 'Could not load casting data.',
      );
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret]);

  // Flush everything still pending on unmount so no edit is lost on tab change.
  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      for (const id of pending.current.keys()) void flush(id);
      for (const t of timersMap.values()) window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function flush(id: string) {
    const patch = pending.current.get(id);
    pending.current.delete(id);
    const t = timers.current.get(id);
    if (t) { window.clearTimeout(t); timers.current.delete(id); }
    if (!patch || Object.keys(patch).length === 0) return;
    try {
      await hostSaveCharacter(secret, { id, ...patch });
    } catch {
      // re-queue the patch (without overwriting newer edits) and surface it
      pending.current.set(id, { ...patch, ...(pending.current.get(id) ?? {}) });
      setError('A change failed to save — it will retry on your next edit.');
    }
  }

  function queueSave(id: string, patch: Partial<CharacterFull>) {
    pending.current.set(id, { ...(pending.current.get(id) ?? {}), ...patch });
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.set(id, window.setTimeout(() => void flush(id), 1000));
  }

  function patchCharacter(id: string, patch: Partial<CharacterFull>) {
    setWorld((prev) => (prev ? mergeCharacter(prev, id, patch) : prev));
    queueSave(id, patch);
  }

  async function saveNow(id: string, patch: Partial<CharacterFull>) {
    setWorld((prev) => (prev ? mergeCharacter(prev, id, patch) : prev));
    await flush(id); // flush any queued edits first
    try {
      await hostSaveCharacter(secret, { id, ...patch });
    } catch {
      setError('Could not save that change.');
      await reload();
    }
  }

  async function onAdd() {
    const id = crypto.randomUUID();
    const blank = blankCharacter(id);
    setWorld((prev) => (prev ? { ...prev, characters: [...prev.characters, blank] } : prev));
    setSelectedId(id);
    try {
      await hostSaveCharacter(secret, { id, name: blank.name });
    } catch {
      setError('Could not create the character.');
      await reload();
    }
  }

  async function onDelete(char: CharacterFull) {
    if (!confirm(`Delete "${char.name || 'this character'}" permanently?`)) return;
    pending.current.delete(char.id);
    setWorld((prev) =>
      prev ? { ...prev, characters: prev.characters.filter((c) => c.id !== char.id) } : prev,
    );
    if (selectedId === char.id) setSelectedId(null);
    try {
      await hostDeleteCharacter(secret, char.id);
    } catch {
      setError('Could not delete the character.');
      await reload();
    }
  }

  async function onCast(char: CharacterFull, participantId: string | null) {
    const current = world?.participants.find((p) => p.character_id === char.id) ?? null;
    setWorld((prev) => (prev ? recast(prev, char.id, participantId) : prev));
    try {
      if (current && current.id !== participantId) await hostAssign(secret, current.id, null);
      if (participantId) await hostAssign(secret, participantId, char.id);
    } catch {
      setError('Could not update casting.');
      await reload();
    }
  }

  async function onToggleMurderer(participant: ParticipantFull) {
    const next = !participant.is_murderer;
    setWorld((prev) =>
      prev
        ? {
            ...prev,
            participants: prev.participants.map((p) =>
              p.id === participant.id ? { ...p, is_murderer: next } : p,
            ),
          }
        : prev,
    );
    try {
      await hostSetFlags(secret, participant.id, { is_murderer: next });
    } catch {
      setError('Could not update the murderer flag.');
      await reload();
    }
  }

  const selected = useMemo(
    () => (world && selectedId ? world.characters.find((c) => c.id === selectedId) ?? null : null),
    [world, selectedId],
  );

  if (error && !world) return <Shell><p className={s.body}>{error}</p></Shell>;
  if (!world) return <Shell><p className={s.body}>Loading…</p></Shell>;

  const characters = [...world.characters].sort(byCreated);
  const released = world.characters.filter((c) => c.released).length;
  const castParticipant = selected
    ? world.participants.find((p) => p.character_id === selected.id) ?? null
    : null;

  return (
    <Shell>
      <div className={s.titleRow}>
        <div>
          <h1 className={s.title}>Casting</h1>
          <p className={s.intro}>
            {characters.length} character{characters.length === 1 ? '' : 's'} · {released} released
          </p>
        </div>
        <button className={s.btn} onClick={onAdd}>Add character</button>
      </div>

      {error && <p className={`${s.notice} ${styles.errorNote}`}>{error}</p>}

      <div className={styles.layout}>
        <nav className={styles.list} aria-label="Characters">
          {characters.length === 0 && (
            <p className={`${s.body} ${styles.listEmpty}`}>
              No characters yet. Add one here, or sketch them on the Canvas.
            </p>
          )}
          {characters.map((c) => {
            const cast = world.participants.find((p) => p.character_id === c.id);
            return (
              <button
                key={c.id}
                className={`${styles.listItem} ${c.id === selectedId ? styles.listItemOn : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <span className={styles.listName}>{c.name || 'Untitled character'}</span>
                <span className={styles.listMeta}>
                  {c.title || 'no archetype'}{cast ? ` · ${displayName(cast)}` : ''}
                </span>
                <StageBadge released={c.released} />
              </button>
            );
          })}
        </nav>

        {selected ? (
          <Editor
            key={selected.id}
            char={selected}
            participants={world.participants}
            castParticipant={castParticipant}
            onEditText={(field, value) => patchCharacter(selected.id, { [field]: value })}
            onEditTruthTags={(tags) => patchCharacter(selected.id, { truth_tags: tags })}
            onCast={(pid) => onCast(selected, pid)}
            onToggleMurderer={onToggleMurderer}
            onSetRelease={(patch) => saveNow(selected.id, patch)}
            onDelete={() => onDelete(selected)}
          />
        ) : (
          <div className={styles.editorEmpty}>
            <p className={`${s.body} ${styles.dim}`}>Select a character to edit, or add one.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ── Editor ─────────────────────────────────────────────────────────────────

function Editor({
  char,
  participants,
  castParticipant,
  onEditText,
  onEditTruthTags,
  onCast,
  onToggleMurderer,
  onSetRelease,
  onDelete,
}: {
  char: CharacterFull;
  participants: ParticipantFull[];
  castParticipant: ParticipantFull | null;
  onEditText: (field: TextField, value: string) => void;
  onEditTruthTags: (tags: TruthTag[]) => void;
  onCast: (participantId: string | null) => void;
  onToggleMurderer: (participant: ParticipantFull) => void;
  onSetRelease: (patch: Partial<CharacterFull>) => void;
  onDelete: () => void;
}) {
  // truth_tags round-trips through text lossily (parse → stringify), so the
  // textarea keeps its own draft seeded once per character.
  const [truthDraft, setTruthDraft] = useState(() => truthTagsToText(char.truth_tags));
  const [confirm, setConfirm] = useState<null | { label: string; patch: Partial<CharacterFull> }>(null);

  return (
    <div className={styles.editor}>
      <Field label="Persona name">
        <input className={s.input} value={char.name} onChange={(e) => onEditText('name', e.target.value)} placeholder="e.g. Vivian Cross" />
      </Field>
      <Field label="Title / archetype">
        <input className={s.input} value={char.title} onChange={(e) => onEditText('title', e.target.value)} placeholder="The Heiress, The Mechanic…" />
      </Field>

      <Field label="Cast as">
        <select
          className={s.select}
          value={castParticipant?.id ?? ''}
          onChange={(e) => onCast(e.target.value || null)}
        >
          <option value="">— not cast —</option>
          {participants.map((p) => {
            const elsewhere = p.character_id && p.character_id !== char.id;
            return (
              <option key={p.id} value={p.id}>
                {displayName(p)}{elsewhere ? ' · cast elsewhere' : ''}
              </option>
            );
          })}
        </select>
      </Field>

      {castParticipant && (
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={castParticipant.is_murderer}
            onChange={() => onToggleMurderer(castParticipant)}
          />
          <span className={s.body}>This player is the murderer</span>
        </label>
      )}

      <Field label="Background">
        <textarea className={s.area} rows={3} value={char.background} onChange={(e) => onEditText('background', e.target.value)} placeholder="Who they are — the only thing shown on the player's card when you release." />
      </Field>

      <Field label="Act I"><textarea className={s.area} rows={3} value={char.act1} onChange={(e) => onEditText('act1', e.target.value)} /></Field>
      <Field label="Act II"><textarea className={s.area} rows={3} value={char.act2} onChange={(e) => onEditText('act2', e.target.value)} /></Field>
      <Field label="Act III"><textarea className={s.area} rows={3} value={char.act3} onChange={(e) => onEditText('act3', e.target.value)} /></Field>

      <Field label="Secret action" hint="What they do that shapes the crime. You deliver this to the player yourself — it's never sent to their card.">
        <textarea className={s.area} rows={3} value={char.action} onChange={(e) => onEditText('action', e.target.value)} />
      </Field>

      <Field label="Props / what to bring"><textarea className={s.area} rows={2} value={char.props} onChange={(e) => onEditText('props', e.target.value)} /></Field>
      <Field label="People to seek out"><textarea className={s.area} rows={2} value={char.recommended_meets} onChange={(e) => onEditText('recommended_meets', e.target.value)} /></Field>

      <Field label="Secret / motive" hint="Host eyes only — never sent to the player.">
        <textarea
          className={`${s.area} ${styles.secretArea}`}
          rows={3}
          value={char.secret}
          onChange={(e) => onEditText('secret', e.target.value)}
          placeholder="The real story behind this character."
        />
      </Field>

      <Field label="Truth tags" hint="One per line, as “beat: truth”. Real details woven into the fiction.">
        <textarea
          className={s.area}
          rows={3}
          value={truthDraft}
          onChange={(e) => { setTruthDraft(e.target.value); onEditTruthTags(parseTruthTags(e.target.value)); }}
          placeholder={'allergy: she really is allergic to perfume\njob: actually fixes cars'}
        />
      </Field>

      <div className={styles.release}>
        <div className={styles.releaseHead}>
          <span className={s.eyebrow}>Reveal</span>
          <StageBadge released={char.released} />
        </div>

        {confirm ? (
          <div className={styles.confirmRow}>
            <span className={s.body}>{confirm.label}</span>
            <button className={s.btn} onClick={() => { onSetRelease(confirm.patch); setConfirm(null); }}>Confirm</button>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        ) : (
          <div className={s.actions}>
            {char.released ? (
              <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setConfirm({ label: 'Unrelease — hide this character from the player again?', patch: { released: false } })}>
                Unrelease
              </button>
            ) : (
              <button className={s.btn} onClick={() => setConfirm({ label: 'Release this character to the player?', patch: { released: true } })}>
                Release
              </button>
            )}
          </div>
        )}
      </div>

      <button className={styles.deleteBtn} onClick={onDelete}>
        <Trash2 size={16} /> Delete character
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
      {children}
    </label>
  );
}

function StageBadge({ released }: { released: boolean }) {
  const cls = released ? styles.badgeFull : styles.badgePrivate;
  return <span className={`${styles.badge} ${cls}`}>{released ? 'Released' : 'Unreleased'}</span>;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={s.page}>
      <div className={`${s.inner} ${styles.shell}`}>{children}</div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────

function mergeCharacter(world: HostWorld, id: string, patch: Partial<CharacterFull>): HostWorld {
  return {
    ...world,
    characters: world.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

function recast(world: HostWorld, characterId: string, participantId: string | null): HostWorld {
  return {
    ...world,
    participants: world.participants.map((p) => {
      if (p.id === participantId) return { ...p, character_id: characterId };
      // clear anyone previously cast as this character (single occupant)
      if (p.character_id === characterId && p.id !== participantId) return { ...p, character_id: null };
      return p;
    }),
  };
}

function blankCharacter(id: string): CharacterFull {
  return {
    id, name: 'New character', title: '', background: '',
    act1: '', act2: '', act3: '', action: '', secret: '',
    props: '', recommended_meets: '', truth_tags: [], juice: '',
    color: '#c0392b', released: false, background_released: false, x: 0, y: 0,
  };
}

function byCreated(a: CharacterFull, b: CharacterFull): number {
  return (a.created_at ?? '').localeCompare(b.created_at ?? '');
}

function displayName(p: ParticipantFull): string {
  return p.preferred_name?.trim() || p.contact?.trim() || 'unnamed';
}

function truthTagsToText(tags: TruthTag[]): string {
  return tags
    .map((tag) => [tag.beat, tag.truth].filter(Boolean).join(': '))
    .filter(Boolean)
    .join('\n');
}

function parseTruthTags(value: string): TruthTag[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(':');
      if (index === -1) return { truth: line };
      return { beat: line.slice(0, index).trim(), truth: line.slice(index + 1).trim() };
    });
}
