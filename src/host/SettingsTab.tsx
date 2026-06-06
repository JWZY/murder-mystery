import { useEffect, useState } from 'react';
import { hostBootstrap, hostUpdateSettings, type HostSettings } from '../lib/hostApi';
import { useHost } from './hostContext';
import s from '../styles/ui.module.css';

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
    setFlash('Saved');
    setTimeout(() => setFlash(''), 1500);
  }

  if (error) return <Shell><p className={s.body}>{error}</p></Shell>;
  if (!v) return <Shell><p className={`${s.body} ${s.muted}`}>Loading…</p></Shell>;

  const intakeLink = `${window.location.origin}${import.meta.env.BASE_URL}`;

  return (
    <Shell>
      <h1 className={s.title}>Settings</h1>
      <p className={`${s.body} ${s.muted}`} style={{ marginTop: 'var(--space-2)' }}>
        Controls for the public participant site. Changes are live immediately.
      </p>

      <div className={s.section}>
        <label className={`${s.body} ${s.row}`} style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <input
            type="checkbox"
            checked={v.intake_open}
            onChange={(e) => save({ intake_open: e.target.checked })}
          />
          Intake open {v.intake_open ? '(accepting new guests)' : '(closed)'}
        </label>
        <label className={`${s.body} ${s.row}`} style={{ gap: 'var(--space-2)' }}>
          <input
            type="checkbox"
            checked={v.roster_visible}
            onChange={(e) => save({ roster_visible: e.target.checked })}
          />
          Roster visible to guests
        </label>

        {flash && <p className={`${s.body} ${s.muted}`} style={{ marginTop: 'var(--space-3)' }}>{flash}</p>}
      </div>

      <div className={s.section}>
        <p className={s.bodyBold}>Public intake link</p>
        <p className={`${s.body} ${s.muted}`} style={{ marginTop: 'var(--space-2)' }}>
          Share this to collect responses.
        </p>
        <div className={s.actions} style={{ marginTop: 'var(--space-3)' }}>
          <span className={s.code}>{intakeLink}</span>
          <button className={`${s.btn} ${s.btnGhost}`} onClick={() => navigator.clipboard?.writeText(intakeLink)}>
            Copy
          </button>
        </div>
      </div>

      <div className={s.section}>
        <button className={`${s.btn} ${s.btnGhost}`} onClick={lock}>
          Lock host workspace
        </button>
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
