import { useEffect, useState } from 'react';
import { hostBootstrap, hostUpdateSettings, type HostSettings } from '../lib/hostApi';
import { useHost } from './hostContext';
import s from './responses.module.css';
import c from './casting.module.css';

/** Host knobs that change what the public participant site does. */
export default function SettingsTab() {
  const { secret, lock } = useHost();
  const [v, setV] = useState<HostSettings | null>(null);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    hostBootstrap(secret)
      .then((w) => setV(w.settings))
      .catch((e) => {
        const msg = (e as { message?: string })?.message ?? '';
        setError(
          /host_bootstrap|does not exist|schema cache/i.test(msg)
            ? 'Settings backend not installed yet — run supabase/casting.sql in the Supabase SQL Editor, then reload.'
            : 'Could not load settings.',
        );
      });
  }, [secret]);

  async function save(patch: Partial<HostSettings>) {
    const next = { ...(v as HostSettings), ...patch };
    setV(next);
    await hostUpdateSettings(secret, patch);
    setFlash('Saved ✓');
    setTimeout(() => setFlash(''), 1500);
  }

  if (error) return <div className={s.page}><div className={s.inner}><p className={s.error}>{error}</p></div></div>;
  if (!v) return <div className={s.page}><div className={s.inner}><p className={s.subtitle}>Loading…</p></div></div>;

  const intakeLink = `${window.location.origin}${import.meta.env.BASE_URL}`;

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.head}>
          <h1 className={s.title}>Settings</h1>
          <p className={s.subtitle}>Controls for the public participant site. Changes are live immediately.</p>
        </header>

        <div className={s.card}>
          <label className={c.field}>
            <span className={s.q}>Party title</span>
            <input
              className={c.input}
              value={v.party_title}
              onChange={(e) => setV({ ...v, party_title: e.target.value })}
              onBlur={(e) => save({ party_title: e.target.value })}
            />
          </label>
          <label className={c.field}>
            <span className={s.q}>Blurb (shown above the intake form)</span>
            <textarea
              className={c.area}
              value={v.party_blurb}
              onChange={(e) => setV({ ...v, party_blurb: e.target.value })}
              onBlur={(e) => save({ party_blurb: e.target.value })}
            />
          </label>

          <div className={c.row} style={{ marginTop: 8 }}>
            <label className={c.toggle}>
              <input
                type="checkbox"
                checked={v.intake_open}
                onChange={(e) => save({ intake_open: e.target.checked })}
              />
              Intake open {v.intake_open ? '(accepting new guests)' : '(closed)'}
            </label>
            <span className={c.spacer} />
            <label className={c.toggle}>
              <input
                type="checkbox"
                checked={v.roster_visible}
                onChange={(e) => save({ roster_visible: e.target.checked })}
              />
              Roster visible to guests
            </label>
          </div>
          {flash && <p className={c.saved} style={{ marginTop: 10 }}>{flash}</p>}
        </div>

        <div className={s.card}>
          <span className={s.q}>Public intake link (share this to collect responses)</span>
          <div className={c.saveBar}>
            <span className={c.link}>{intakeLink}</span>
            <button className={`${c.btn} ${c.btnGhost}`} onClick={() => navigator.clipboard?.writeText(intakeLink)}>
              Copy
            </button>
          </div>
        </div>

        <button className={`${c.btn} ${c.btnGhost}`} onClick={lock}>
          Lock host workspace
        </button>
      </div>
    </div>
  );
}
