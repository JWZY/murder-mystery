import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Info, UserRound, FileUser } from 'lucide-react';
import type { ParticipantRecord, RosterEntry, PublicSettings } from '../types/participant';
import { getMyRecord, updateMyRecord, getRoster } from '../lib/api';
import { formatDishContribution } from '../lib/intakeSchema';
import RecordFields from './RecordFields';
import Typewriter from './Typewriter';
import Moodboard from './Moodboard';
import TabBar from '../components/TabBar/TabBar';
import s from '../styles/ui.module.css';
import sus from './Suspects.module.css';
import about from './About.module.css';
import participant from './participant.module.css';

type Tab = 'you' | 'about' | 'roster';
const TAB_TITLE_TYPE_DELAY = 300;

export default function ParticipantHome({
  token,
  settings,
  onMissingRecord,
  onResetSession,
}: {
  token: string;
  settings: PublicSettings | null;
  onMissingRecord: () => void;
  onResetSession: (mode?: 'push' | 'replace') => void;
}) {
  const [rec, setRec] = useState<ParticipantRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recordMissing, setRecordMissing] = useState(false);
  const [tab, setTab] = useState<Tab>('you');
  const [intakeSubmitted] = useState(
    () => new URLSearchParams(window.location.search).get('submitted') === '1'
  );

  useEffect(() => {
    let alive = true;
    getMyRecord(token)
      .then((r) => {
        if (!alive) return;
        if (r) {
          setRec(r);
          return;
        }
        onMissingRecord();
        setRecordMissing(true);
        setLoadError('This entry was removed or the link is no longer valid.');
      })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : 'Failed to load.'); });
    return () => { alive = false; };
  }, [onMissingRecord, token]);

  useEffect(() => {
    if (!intakeSubmitted) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('submitted');
    window.history.replaceState({}, '', url.toString());
  }, [intakeSubmitted]);

  if (loadError) {
    return (
      <Shell>
        <div className={`${s.notice} ${participant.recovery}`}>
          <p>{loadError}</p>
          {recordMissing && (
            <button type="button" className={s.btn} onClick={() => onResetSession()}>
              Start over
            </button>
          )}
        </div>
      </Shell>
    );
  }
  if (!rec) return <Shell><p className={`${s.body} ${s.muted}`}>Loading your entry…</p></Shell>;

  const firstName = rec.preferred_name?.trim();
  const tabs = [
    { id: 'you' as const, label: firstName || 'You', Icon: UserRound },
    { id: 'about' as const, label: 'About', Icon: Info },
    { id: 'roster' as const, label: 'Suspects', Icon: FileUser },
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
        <TabPanel tab={tab}>
          {tab === 'you' && <EditEntry token={token} rec={rec} setRec={setRec} intakeSubmitted={intakeSubmitted} />}
          {tab === 'about' && <About settings={settings} />}
          {tab === 'roster' && <Roster token={token} visible={settings?.roster_visible ?? true} me={rec} />}
        </TabPanel>
      </Shell>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${s.page} ${participant.pageScroll}`}>
      <div className={s.inner}>{children}</div>
    </div>
  );
}

function TabPanel({ tab, children }: { tab: Tab; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={s.tabPanel}>{children}</div>;

  return (
    <motion.div
      key={tab}
      className={s.tabPanel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function About({ settings: _settings }: { settings: PublicSettings | null }) {
  return (
    <>
      <TabTitle text="About" />
      <section className={`${s.section} ${about.aboutIntro}`}>
        <div>
          <p className={about.lede}>
            A tragic murder in 1928 Hollywood, and secrets unravel.
          </p>
          <p className={about.lede}>
            Film noir inspired. Think corrupt cops, hardboiled detective, broody monologues.
          </p>
          <p className={about.lede}>
            Everyone here has a sense of humour, bring drama and bring laughter. 
          </p>
          <p className={about.lede}>
            Dress smart-casual.
          </p>
        </div>
        <dl className={about.details}>
          <div>
            <dt>Premise</dt>
            <dd>1928 Hollywood</dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>100 Hollywood Blvd, LA</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>July 11, after 7PM</dd>
          </div>
        </dl>
      </section>

      <h2 className={about.moodboardTitle}>Moodboard</h2>
      <Moodboard variant="gallery" className={about.gallery} />
    </>
  );
}

function EditEntry({ token, rec, setRec, intakeSubmitted }: {
  token: string;
  rec: ParticipantRecord;
  setRec: (r: ParticipantRecord) => void;
  intakeSubmitted: boolean;
}) {
  // Autosave: every edit schedules a debounced save (1200ms after last keystroke).
  // A 5s interval acts as a safety net so a long burst of edits still flushes.
  // A save in flight defers the next one until it returns; if more edits land
  // during that window, we re-flush once the in-flight save completes.
  const recRef = useRef(rec);
  recRef.current = rec;
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const flush = useCallback(async () => {
    if (savingRef.current || !dirtyRef.current) return;
    dirtyRef.current = false;
    savingRef.current = true;
    try {
      await updateMyRecord(token, recRef.current);
      savingRef.current = false;
      if (dirtyRef.current) {
        flush();
      }
    } catch (e) {
      savingRef.current = false;
      dirtyRef.current = true;
      console.error(e);
    }
  }, [token]);

  const patch = useCallback((p: Partial<ParticipantRecord>) => {
    setRec({ ...recRef.current, ...p });
    dirtyRef.current = true;
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

  return (
    <>
      <TabTitle
        text={rec.preferred_name?.trim() ? `${rec.preferred_name.trim()}'s file` : 'Your file'}
      />
      <div className={s.section}>
        <RecordFields rec={rec} patch={patch} />
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

  if (!visible) return <><TabTitle text="Suspects" /><div className={s.section}><p className={s.notice}>The guest list is hidden for now — check back closer to the date.</p></div></>;
  if (error) return <><TabTitle text="Suspects" /><div className={s.section}><p className={s.notice}>{error}</p></div></>;
  if (!ordered) return <><TabTitle text="Suspects" /><div className={s.section}><p className={`${s.body} ${s.muted}`}>Loading guests…</p></div></>;

  return (
    <>
      <TabTitle text="Suspects" />
      <div className={`${s.section} ${sus.lineup}`}>
        {ordered.map((g, i) => (
          <SuspectCard key={i} guest={g} index={i} />
        ))}
      </div>
    </>
  );
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
  const bringing = formatDishContribution(guest);
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

function TabTitle({ text, aside }: { text: string; aside?: React.ReactNode }) {
  return (
    <div className={s.titleRow}>
      <h1 className={s.title}>
        <Typewriter text={text} caret={false} delay={TAB_TITLE_TYPE_DELAY} reserveLayout />
      </h1>
      {aside}
    </div>
  );
}
