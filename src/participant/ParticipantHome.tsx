import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserRound, FileUser, VenetianMask } from 'lucide-react';
import type { ParticipantRecord, RosterEntry, MyCharacter, PublicSettings } from '../types/participant';
import { getMyRecord, updateMyRecord, getRoster, getMyCharacter } from '../lib/api';
import RecordFields from './RecordFields';
import Typewriter from './Typewriter';
import TabBar from '../components/TabBar/TabBar';
import s from '../styles/ui.module.css';
import sus from './Suspects.module.css';

type Tab = 'you' | 'roster' | 'character';

export default function ParticipantHome({ token, settings }: { token: string; settings: PublicSettings | null }) {
  const [rec, setRec] = useState<ParticipantRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('you');

  useEffect(() => {
    let alive = true;
    getMyRecord(token)
      .then((r) => { if (alive) { if (r) setRec(r); else setLoadError('We couldn’t find your entry — double-check your link.'); } })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : 'Failed to load.'); });
    return () => { alive = false; };
  }, [token]);

  if (loadError) return <Shell><p className={s.notice}>{loadError}</p></Shell>;
  if (!rec) return <Shell><p className={`${s.body} ${s.muted}`}>Loading your entry…</p></Shell>;

  const firstName = rec.preferred_name?.trim();
  const tabs = [
    { id: 'you' as const, label: firstName || 'You', Icon: UserRound },
    { id: 'roster' as const, label: 'Suspects', Icon: FileUser },
    { id: 'character' as const, label: 'Character', Icon: VenetianMask },
  ];

  return (
    <>
      <TabBar<Tab>
        tabs={tabs}
        activeId={tab}
        onChange={setTab}
        showLabels
        layoutId="participant-tab-pill"
      />
      <Shell>
        {tab === 'you' && <EditEntry token={token} rec={rec} setRec={setRec} />}
        {tab === 'roster' && <Roster token={token} visible={settings?.roster_visible ?? true} me={rec} />}
        {tab === 'character' && <Character token={token} />}
      </Shell>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <div className={s.inner}>{children}</div>
    </div>
  );
}

function EditEntry({ token, rec, setRec }: { token: string; rec: ParticipantRecord; setRec: (r: ParticipantRecord) => void }) {
  // Autosave: every edit schedules a debounced save (1200ms after last keystroke).
  // A 5s interval acts as a safety net so a long burst of edits still flushes.
  // A save in flight defers the next one until it returns; if more edits land
  // during that window, we re-flush once the in-flight save completes.
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef(rec);
  recRef.current = rec;
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const flush = useCallback(async () => {
    if (savingRef.current || !dirtyRef.current) return;
    dirtyRef.current = false;
    savingRef.current = true;
    setStatus('saving');
    setError(null);
    try {
      await updateMyRecord(token, recRef.current);
      savingRef.current = false;
      if (dirtyRef.current) {
        flush();
      } else {
        setStatus('saved');
      }
    } catch (e) {
      savingRef.current = false;
      dirtyRef.current = true;
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  }, [token]);

  const patch = useCallback((p: Partial<ParticipantRecord>) => {
    setRec({ ...recRef.current, ...p });
    dirtyRef.current = true;
    setStatus('saving');
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => flush(), 1200);
  }, [flush, setRec]);

  useEffect(() => {
    const id = window.setInterval(() => flush(), 5000);
    return () => {
      window.clearInterval(id);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [flush]);

  const statusText =
    status === 'saving' ? 'Saving…' :
    status === 'saved' ? 'Saved' :
    status === 'error' ? error || 'Save failed.' :
    '';

  return (
    <>
      <h1 className={s.title}>
        <Typewriter
          text={rec.preferred_name?.trim() ? `${rec.preferred_name.trim()}'s file` : 'Your file'}
          caret={false}
        />
      </h1>
      <div className={s.section}>
        <RecordFields rec={rec} patch={patch} />
        {statusText && (
          <p
            className={status === 'error' ? s.notice : `${s.body} ${s.muted}`}
            style={{ marginTop: 'var(--space-4)' }}
          >
            {statusText}
          </p>
        )}
      </div>
    </>
  );
}

function Roster({ token, visible, me }: { token: string; visible: boolean; me: ParticipantRecord }) {
  const [list, setList] = useState<RosterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    getRoster(token).then(setList).catch((e) => setError(e instanceof Error ? e.message : 'Failed.'));
  }, [token, visible]);

  // Order: current user pinned to 001, everyone else shuffled per page load.
  // We identify "me" by composite match (name + bio) since the RPC doesn't
  // return tokens. The shuffle is computed once per list fetch via useMemo.
  const ordered = useMemo(() => {
    if (!list) return null;
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const myName = (me.preferred_name || '').trim();
    const myBio = (me.public_bio || '').trim();
    const meIdx = arr.findIndex((e) =>
      (e.preferred_name || '').trim() === myName &&
      (e.public_bio || '').trim() === myBio
    );
    if (meIdx > -1) {
      const [meRow] = arr.splice(meIdx, 1);
      arr.unshift(meRow);
    }
    return arr;
  }, [list, me.preferred_name, me.public_bio]);

  if (!visible) return <><h1 className={s.title}><Typewriter text="Suspects" caret={false} /></h1><div className={s.section}><p className={s.notice}>The guest list is hidden for now — check back closer to the date.</p></div></>;
  if (error) return <><h1 className={s.title}><Typewriter text="Suspects" caret={false} /></h1><div className={s.section}><p className={s.notice}>{error}</p></div></>;
  if (!ordered) return <><h1 className={s.title}><Typewriter text="Suspects" caret={false} /></h1><div className={s.section}><p className={`${s.body} ${s.muted}`}>Loading guests…</p></div></>;

  return (
    <>
      <h1 className={s.title}><Typewriter text="Suspects" caret={false} /></h1>
      <div className={`${s.section} ${sus.lineup}`}>
        {ordered.map((g, i) => (
          <SuspectCard key={i} guest={g} index={i} />
        ))}
      </div>
    </>
  );
}

// Capitalize a single category token (e.g. "dessert" -> "Dessert").
function titleCase(s: string): string {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : '';
}

// Short, one-line name: full name if single word; "First L." for multi-part names.
function shortenName(full: string): string {
  const t = full.trim();
  if (!t) return 'Unknown';
  const parts = t.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}

function SuspectCard({ guest, index }: { guest: RosterEntry; index: number }) {
  const caseNum = String(index + 1).padStart(3, '0');
  // Economical contribution label: prefer the specific dish name; otherwise
  // list the selected categories. No "Bringing:" prefix.
  const detail = (guest.dish_detail || '').trim();
  const cats = (guest.dish_category || '')
    .split(',')
    .map((c) => titleCase(c))
    .filter(Boolean);
  const bringing = detail ? detail : cats.join(', ');
  const name = shortenName(guest.preferred_name || '');
  // Stack-of-photos tilt + slight scale jitter: random per mount, stable
  // across re-renders within the same page load. Tilt -2..+2 deg, scale
  // 0.98..1.02 — enough imperfection to feel hand-arranged.
  const tilt = useMemo(() => Math.random() * 4 - 2, [guest.preferred_name, index]);
  const scale = useMemo(() => 0.98 + Math.random() * 0.04, [guest.preferred_name, index]);
  // On hover the card rotates to the "inverse" of its resting tilt. If the
  // tilt is nearly flat (|t| < 0.5) the inverse barely shows, so amplify by
  // 2× in that range to keep the motion legible.
  const hoverTilt = Math.abs(tilt) < 0.5 ? tilt * -2 : -tilt;
  return (
    <article className={sus.mugshot}>
      <div
        className={sus.file}
        style={{
          ['--tilt' as string]: `${tilt.toFixed(2)}deg`,
          ['--tilt-hover' as string]: `${hoverTilt.toFixed(2)}deg`,
          ['--scale' as string]: scale.toFixed(3),
        } as React.CSSProperties}
      >
        <div className={sus.frame}>
          <span className={sus.caseNum}>{caseNum}</span>
          <Silhouette variant={index} />
        </div>
        <div className={sus.placard}>
          <div className={sus.placardName} title={guest.preferred_name || 'Unknown'}>{name}</div>
          <div className={sus.placardMeta}>{bringing}</div>
        </div>
      </div>
      {guest.public_bio && (
        <div className={sus.notes}>
          <p className={sus.bio}>“{guest.public_bio}”</p>
        </div>
      )}
    </article>
  );
}

function Silhouette({ variant }: { variant: number }) {
  // Each variant layers head + shoulders so the shapes overlap by a few units —
  // they merge into one connected figure instead of a head floating above a torso.
  const v = ((variant % 6) + 6) % 6;
  return (
    <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {v === 0 && (
        // Bare oval head
        <g>
          <path d="M 10 120 C 10 76 26 54 50 54 C 74 54 90 76 90 120 Z" />
          <ellipse cx="50" cy="38" rx="18" ry="21" />
        </g>
      )}
      {v === 1 && (
        // Squared crown — slicked-back / pomp hair
        <g>
          <path d="M 10 120 C 10 74 26 60 50 60 C 74 60 90 74 90 120 Z" />
          <path d="M 30 26 Q 30 12 50 12 Q 70 12 70 26 L 70 58 Q 50 66 30 58 Z" />
        </g>
      )}
      {v === 2 && (
        // Noir fedora: dome crown + thin elliptical brim sitting on the head
        <g>
          <path d="M 12 120 C 12 76 26 56 50 56 C 74 56 88 76 88 120 Z" />
          <ellipse cx="50" cy="46" rx="14" ry="15" />
          <ellipse cx="50" cy="32" rx="28" ry="4" />
          <path d="M 36 32 Q 36 14 50 14 Q 64 14 64 32 Z" />
        </g>
      )}
      {v === 3 && (
        // Shoulder-length wavy hair (1940s)
        <g>
          <path d="M 8 120 C 8 76 26 64 50 64 C 74 64 92 76 92 120 Z" />
          <path d="M 50 12 C 28 12 24 30 24 50 C 24 60 26 68 30 72 L 70 72 C 74 68 76 60 76 50 C 76 30 72 12 50 12 Z" />
        </g>
      )}
      {v === 4 && (
        // Newsboy / flat cap with short bill
        <g>
          <path d="M 12 120 C 12 76 26 56 50 56 C 74 56 88 76 88 120 Z" />
          <ellipse cx="50" cy="46" rx="14" ry="15" />
          <path d="M 32 30 Q 32 14 50 14 Q 68 14 68 30 L 76 32 L 76 35 L 30 35 Q 30 32 32 30 Z" />
        </g>
      )}
      {v === 5 && (
        // Hair pulled into a bun on top
        <g>
          <path d="M 10 120 C 10 76 26 56 50 56 C 74 56 90 76 90 120 Z" />
          <ellipse cx="50" cy="42" rx="16" ry="20" />
          <ellipse cx="50" cy="20" rx="10" ry="7" />
        </g>
      )}
    </svg>
  );
}

function Character({ token }: { token: string }) {
  const [char, setChar] = useState<MyCharacter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getMyCharacter(token)
      .then(setChar)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed.'))
      .finally(() => setLoaded(true));
  }, [token]);

  const title = char?.name ?? 'Casting in progress…';

  if (error) {
    return (
      <>
        <h1 className={s.title}><Typewriter text={title} caret={false} /></h1>
        <div className={s.section}><p className={s.notice}>{error}</p></div>
      </>
    );
  }
  if (!loaded) {
    return (
      <>
        <h1 className={s.title}><Typewriter text={title} caret={false} /></h1>
        <div className={s.section}><p className={`${s.body} ${s.muted}`}>Checking…</p></div>
      </>
    );
  }
  if (!char) {
    return (
      <>
        <h1 className={s.title}><Typewriter text={title} caret={false} /></h1>
        <div className={s.section}>
          <p className={s.intro}>
            Your character hasn’t been revealed yet. Still weaving everyone’s stories together — you’ll see it here once casting is done.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
    <h1 className={s.title}><Typewriter text={title} caret={false} /></h1>
    <div className={s.section}>
    <div className={s.card}>
      <p className={`${s.body} ${s.muted}`}>{char.title}</p>

      <Act label="Who you are" body={char.background} />
      <Act label="Act I — Arrival" body={char.act1} />
      <Act label="Act II — The Catalyst" body={char.act2} />
      <Act label="Act III — The Reckoning" body={char.act3} />
      {char.recommended_meets && <Act label="People to seek out" body={char.recommended_meets} />}
      {char.props && <Act label="Props / what to bring" body={char.props} />}

      {char.truth_tags?.length > 0 && (
        <>
          <p className={s.bodyBold} style={{ marginTop: 'var(--space-5)' }}>The real you, woven in</p>
          {char.truth_tags.map((t, i) => (
            <p key={i} className={s.body} style={{ marginTop: 'var(--space-2)' }}>
              {t.beat ? `${t.beat}: ` : ''}{t.truth} <span className={s.muted}>— true, share it if you’re comfortable.</span>
            </p>
          ))}
        </>
      )}
    </div>
    </div>
    </>
  );
}

function Act({ label, body }: { label: string; body: string }) {
  if (!body) return null;
  return (
    <>
      <p className={s.bodyBold} style={{ marginTop: 'var(--space-5)' }}>{label}</p>
      <p className={s.body} style={{ marginTop: 'var(--space-2)', whiteSpace: 'pre-wrap' }}>{body}</p>
    </>
  );
}
