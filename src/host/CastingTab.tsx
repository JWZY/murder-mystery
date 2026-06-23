import { type ComponentProps, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const [query, setQuery] = useState('');

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

  const released = world.characters.filter((c) => c.released).length;
  const q = query.trim().toLowerCase();
  const characters = [...world.characters].sort(byCreated).filter((c) => {
    if (!q) return true;
    const cast = world.participants.find((p) => p.character_id === c.id);
    return `${c.name} ${c.title} ${cast ? displayName(cast) : ''}`.toLowerCase().includes(q);
  });
  const castParticipant = selected
    ? world.participants.find((p) => p.character_id === selected.id) ?? null
    : null;

  return (
    <Shell>
      {error && <p className={`${s.notice} ${styles.errorNote}`}>{error}</p>}

      <div className={styles.layout}>
        <aside className={styles.rail}>
          <div className={styles.railHead}>
            <h1 className={s.title}>Casting</h1>
            <div className={styles.countRow}>
              <p className={s.intro}>
                {characters.length} character{characters.length === 1 ? '' : 's'} · {released} released
              </p>
              <button className={styles.btnSubtle} onClick={onAdd}>Add</button>
            </div>
            <input
              className={`${s.input} ${styles.search}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search characters…"
              aria-label="Search characters"
            />
          </div>
          <nav className={styles.list} aria-label="Characters">
          {world.characters.length === 0 && (
            <p className={`${s.body} ${styles.listEmpty}`}>
              No characters yet. Add one here, or sketch them on the Canvas.
            </p>
          )}
          {world.characters.length > 0 && characters.length === 0 && (
            <p className={`${s.body} ${styles.listEmpty}`}>No matches for “{query}”.</p>
          )}
          {characters.map((c) => {
            const cast = world.participants.find((p) => p.character_id === c.id);
            return (
              <button
                key={c.id}
                className={`${styles.listItem} ${c.id === selectedId ? styles.listItemOn : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <span className={styles.listText}>
                  <span className={styles.listName}>{c.name || 'Untitled character'}</span>
                  <span className={styles.listMeta}>
                    {c.title || 'no archetype'}{cast ? ` · ${displayName(cast)}` : ''}
                  </span>
                </span>
                {c.released && <span className={styles.dot} aria-label="Released" />}
              </button>
            );
          })}
          </nav>
        </aside>

        <main className={styles.main}>
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
        </main>
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

  const comfort = castParticipant?.roleplay_comfort ?? null;

  return (
    <div className={styles.editor}>
      <div className={styles.editorGrid}>

        {/* Player identity + casting, merged. The release toggle up top both shows
            and sets state. Only the identity column (left) ever reaches the player. */}
        <section className={`${styles.group} ${styles.playerCard} ${styles.cardSpan}`}>
          <header className={styles.playerHead}>
            <div>
              <span className={`${s.eyebrow} ${styles.playerEyebrow}`}>Player-facing</span>
              <p className={styles.hint}>The persona and background below are all the player sees on release. Casting, acts and secrets are never sent.</p>
            </div>
            <ReleaseToggle
              released={char.released}
              onToggle={() =>
                setConfirm(
                  char.released
                    ? { label: 'Unrelease — hide this character from the player again?', patch: { released: false } }
                    : { label: 'Release this character to the player?', patch: { released: true } },
                )
              }
            />
          </header>

          {confirm && (
            <div className={styles.confirmRow}>
              <span className={s.body}>{confirm.label}</span>
              <button className={styles.btnSubtle} onClick={() => { onSetRelease(confirm.patch); setConfirm(null); }}>Confirm</button>
              <button className={styles.btnText} onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          )}

          <div className={styles.threeCol}>
            <Field label="Persona name" required>
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
          </div>

          <Field label="Background">
            <AutoArea className={s.area} value={char.background} onChange={(e) => onEditText('background', e.target.value)} placeholder="Who they are — shown on the player's card when you release." />
          </Field>

          {castParticipant ? (
            <div className={styles.castingRow}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={castParticipant.is_murderer}
                  onChange={() => onToggleMurderer(castParticipant)}
                />
                <span className={s.body}>This player is the murderer</span>
              </label>
              <div className={styles.metaItem}>
                <span className={s.eyebrow}>Comfort</span>
                <span className={s.body}>{comfort ? `${comfort}/5` : '—'}</span>
              </div>
            </div>
          ) : (
            <p className={`${s.body} ${styles.dim}`}>Cast a player to mark the murderer and see their comfort level.</p>
          )}
        </section>

        <section className={`${styles.group} ${styles.cardSpan}`}>
          <header className={styles.groupHead}>
            <span className={s.eyebrow}>The performance</span>
            <span className={styles.hint}>The player's beats, act by act. You deliver these — never on their card.</span>
          </header>
          <div className={styles.threeCol}>
            <Field label="Act I"><AutoArea className={s.area} value={char.act1} onChange={(e) => onEditText('act1', e.target.value)} /></Field>
            <Field label="Act II"><AutoArea className={s.area} value={char.act2} onChange={(e) => onEditText('act2', e.target.value)} /></Field>
            <Field label="Act III"><AutoArea className={s.area} value={char.act3} onChange={(e) => onEditText('act3', e.target.value)} /></Field>
          </div>
        </section>

        {/* Prep + secrets, merged — all host eyes only, never sent to the player. */}
        <section className={`${styles.group} ${styles.cardSpan}`}>
          <header className={styles.groupHead}>
            <span className={s.eyebrow}>Host eyes only</span>
            <span className={styles.hint}>Secrets, props and prep. Never sent to the player — you hand these over out of band.</span>
          </header>
          <Field label="Secret action" hint="What they do that shapes the crime.">
            <AutoArea className={s.area} value={char.action} onChange={(e) => onEditText('action', e.target.value)} />
          </Field>
          <div className={styles.twoCol}>
            <Field label="Props / what to bring" hint="Physical props to build or bring.">
              <textarea className={s.area} value={char.props} onChange={(e) => onEditText('props', e.target.value)} />
            </Field>
            <Field label="People to seek out" hint="Guests they should gravitate toward.">
              <textarea className={s.area} value={char.recommended_meets} onChange={(e) => onEditText('recommended_meets', e.target.value)} />
            </Field>
          </div>
          <div className={styles.twoCol}>
            <Field label="Secret / motive" hint="The real story behind this character.">
              <textarea
                className={`${s.area} ${styles.secretArea}`}
                value={char.secret}
                onChange={(e) => onEditText('secret', e.target.value)}
              />
            </Field>
            <Field label="Truth tags" hint="One per line, as “beat: truth”.">
              <textarea
                className={s.area}
                value={truthDraft}
                onChange={(e) => { setTruthDraft(e.target.value); onEditTruthTags(parseTruthTags(e.target.value)); }}
                placeholder={'allergy: she really is allergic to perfume\njob: actually fixes cars'}
              />
            </Field>
          </div>
        </section>

      </div>

      <button className={styles.deleteBtn} onClick={onDelete}>
        <Trash2 size={16} /> Delete character
      </button>
    </div>
  );
}

/** Textarea that grows to fit its content — no scrollbar, no fixed row count. */
function AutoArea({ value, className = '', ...rest }: ComponentProps<'textarea'>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }); // runs every render, so it re-fits as `value` changes
  return <textarea ref={ref} value={value} className={`${className} ${styles.autoArea}`} {...rest} />;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className={s.field}>
      <span className={styles.labelRow}>
        <span className={s.label}>{label}</span>
        {required && <span className={styles.req}>Required</span>}
      </span>
      {hint && <span className={styles.hint}>{hint}</span>}
      {children}
    </label>
  );
}

/** Combined badge + control: shows release state and toggles it on click. */
function ReleaseToggle({ released, onToggle }: { released: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={released}
      className={`${styles.releaseToggle} ${released ? styles.releaseToggleOn : ''}`}
      onClick={onToggle}
    >
      <span className={styles.releaseToggleLabel}>{released ? 'Released' : 'Unreleased'}</span>
      <span className={styles.releaseToggleTrack}><span className={styles.releaseToggleKnob} /></span>
    </button>
  );
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
