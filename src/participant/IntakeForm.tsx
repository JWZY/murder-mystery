import { useState } from 'react';
import { emptyRecord, type ParticipantRecord, type PublicSettings } from '../types/participant';
import { submitIntake } from '../lib/api';
import { isConfigured } from '../lib/supabase';
import RecordFields from './RecordFields';
import s from './participant.module.css';

export default function IntakeForm({ settings }: { settings: PublicSettings | null }) {
  const [rec, setRec] = useState<ParticipantRecord>(emptyRecord());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<ParticipantRecord>) => setRec((r) => ({ ...r, ...p }));

  const title = settings?.party_title ?? 'The Reunion';
  const closed = settings ? !settings.intake_open : false;
  const canSubmit = isConfigured && !closed && rec.preferred_name.trim().length > 0 && !busy;

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      const token = await submitIntake(rec);
      // Send them to their permanent, editable link.
      const url = new URL(window.location.href);
      url.searchParams.set('p', token);
      window.location.href = url.toString();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.masthead}>
          <div className={s.kicker}>You’re invited · A Murder Mystery</div>
          <h1 className={s.partyTitle}>{title}</h1>
          <p className={s.lede}>
            {settings?.party_blurb ||
              'A reunion gala — old faces, new drama, and a body before dessert. You’ll play a character built partly from the real you. Fill this out so I can cast you right.'}
          </p>
        </header>

        {!isConfigured && (
          <div className={`${s.banner} ${s.bannerWarn}`}>
            Heads up: the backend isn’t connected yet, so this form can’t save.
            (Host: add your Supabase keys to <code>.env</code> — see <code>supabase/SETUP.md</code>.)
          </div>
        )}
        {closed && (
          <div className={`${s.banner} ${s.bannerWarn}`}>
            Intake is closed for now — message the host if you still want in.
          </div>
        )}

        <RecordFields rec={rec} patch={patch} />

        {error && <div className={`${s.banner} ${s.bannerWarn}`}>{error}</div>}

        <button className={s.primary} disabled={!canSubmit} onClick={handleSubmit}>
          {busy ? 'Sending…' : 'Send it in →'}
        </button>
        <p className={s.foot}>
          After you submit you’ll get a private link to edit your answers anytime.
        </p>
      </div>
    </div>
  );
}
