import { useEffect, useState } from 'react';
import type { ParticipantRecord, RosterEntry, MyCharacter, PublicSettings } from '../types/participant';
import { getMyRecord, updateMyRecord, getRoster, getMyCharacter } from '../lib/api';
import RecordFields from './RecordFields';
import s from './participant.module.css';

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

  if (loadError) {
    return (
      <div className={s.page}><div className={s.inner}>
        <div className={`${s.banner} ${s.bannerWarn}`}>{loadError}</div>
      </div></div>
    );
  }
  if (!rec) {
    return <div className={s.page}><div className={s.inner}><p className={s.foot}>Loading your entry…</p></div></div>;
  }

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.masthead}>
          <div className={s.kicker}>Welcome back</div>
          <h1 className={s.partyTitle}>{rec.preferred_name || 'Your dossier'}</h1>
        </header>

        <nav className={s.tabs}>
          <button className={`${s.tab} ${tab === 'you' ? s.tabOn : ''}`} onClick={() => setTab('you')}>Your entry</button>
          <button className={`${s.tab} ${tab === 'roster' ? s.tabOn : ''}`} onClick={() => setTab('roster')}>Who’s coming</button>
          <button className={`${s.tab} ${tab === 'character' ? s.tabOn : ''}`} onClick={() => setTab('character')}>Your character</button>
        </nav>

        {tab === 'you' && <EditEntry token={token} rec={rec} setRec={setRec} />}
        {tab === 'roster' && <Roster token={token} visible={settings?.roster_visible ?? true} />}
        {tab === 'character' && <Character token={token} />}
      </div>
    </div>
  );
}

/* ── Edit your own entry ── */
function EditEntry({ token, rec, setRec }: { token: string; rec: ParticipantRecord; setRec: (r: ParticipantRecord) => void }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<ParticipantRecord>) => { setRec({ ...rec, ...p }); setSaved(false); };

  async function save() {
    setError(null); setSaving(true);
    try {
      await updateMyRecord(token, rec);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className={`${s.banner} ${s.bannerInfo}`}>
        Edit anything below and hit save. This link is your private door back in — bookmark it.
      </div>
      <RecordFields rec={rec} patch={patch} />
      {error && <div className={`${s.banner} ${s.bannerWarn}`}>{error}</div>}
      {saved && <div className={`${s.banner} ${s.bannerOk}`}>Saved ✓</div>}
      <button className={s.primary} disabled={saving} onClick={save}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </>
  );
}

/* ── Partial view of everyone else ── */
function Roster({ token, visible }: { token: string; visible: boolean }) {
  const [list, setList] = useState<RosterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    getRoster(token).then(setList).catch((e) => setError(e instanceof Error ? e.message : 'Failed.'));
  }, [token, visible]);

  if (!visible) return <div className={`${s.banner} ${s.bannerInfo}`}>The guest list is hidden for now — check back closer to the date.</div>;
  if (error) return <div className={`${s.banner} ${s.bannerWarn}`}>{error}</div>;
  if (!list) return <p className={s.foot}>Loading guests…</p>;

  return (
    <>
      <div className={`${s.banner} ${s.bannerInfo}`}>
        Everyone who’s coming, in their own words. Characters stay secret until the night.
      </div>
      <div className={s.rosterGrid}>
        {list.map((g, i) => (
          <div key={i} className={s.guestCard}>
            <div className={s.guestName}>
              {g.preferred_name}{g.rsvp === 'maybe' && ' (maybe)'}
            </div>
            {g.public_bio && <div className={s.guestBio}>“{g.public_bio}”</div>}
            {g.dish_category && (
              <div className={s.guestDish}>Bringing: {g.dish_category}{g.dish_detail ? ` — ${g.dish_detail}` : ''}</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Your assigned character (once the host releases it) ── */
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

  if (error) return <div className={`${s.banner} ${s.bannerWarn}`}>{error}</div>;
  if (!loaded) return <p className={s.foot}>Checking…</p>;
  if (!char) {
    return (
      <div className={`${s.banner} ${s.bannerInfo}`}>
        Your character hasn’t been revealed yet. I’m still weaving everyone’s stories together —
        you’ll see it here once casting is done. 🎭
      </div>
    );
  }

  return (
    <div className={s.charCard} style={{ ['--accent' as string]: char.color }}>
      <div className={s.charName}>{char.name}</div>
      <div className={s.charTitle}>{char.title}</div>

      <div className={s.act}>
        <div className={s.actLabel}>Who you are</div>
        <div className={s.actBody}>{char.background}</div>
      </div>
      <Act label="Act I — Arrival" body={char.act1} />
      <Act label="Act II — The Catalyst" body={char.act2} />
      <Act label="Act III — The Reckoning" body={char.act3} />

      {char.recommended_meets && (
        <div className={s.act}>
          <div className={s.actLabel}>People to seek out</div>
          <div className={s.actBody}>{char.recommended_meets}</div>
        </div>
      )}
      {char.props && (
        <div className={s.act}>
          <div className={s.actLabel}>Props / what to bring</div>
          <div className={s.actBody}>{char.props}</div>
        </div>
      )}
      {char.truth_tags?.length > 0 && (
        <div className={s.act}>
          <div className={s.actLabel}>The real you, woven in</div>
          {char.truth_tags.map((t, i) => (
            <div key={i} className={s.truthTag}>
              {t.beat ? `${t.beat}: ` : ''}{t.truth} — true, share it if you’re comfortable.
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Act({ label, body }: { label: string; body: string }) {
  if (!body) return null;
  return (
    <div className={s.act}>
      <div className={s.actLabel}>{label}</div>
      <div className={s.actBody}>{body}</div>
    </div>
  );
}
