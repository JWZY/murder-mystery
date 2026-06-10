import { useCallback, useEffect, useState } from 'react';
import type { PublicSettings } from '../types/participant';
import { getPublicSettings } from '../lib/api';
import { isConfigured } from '../lib/supabase';
import { getHostSecret } from '../lib/hostApi';
import IntakeForm from './IntakeForm';
import ParticipantHome from './ParticipantHome';
import {
  clearParticipantSessionAndDraft,
  clearParticipantSession,
  getStoredParticipantToken,
  removeParticipantTokenFromUrl,
  saveParticipantToken,
} from './session';
import s from '../styles/ui.module.css';
import participant from './participant.module.css';
import dev from './DevReset.module.css';

/**
 * Participant entry point. `?p=<token>` → their personal home (edit + roster +
 * character). No token → the open intake form.
 */

export default function ParticipantApp() {
  const urlToken = new URLSearchParams(window.location.search).get('p');
  const storedToken = !urlToken ? getStoredParticipantToken() : null;
  const token = urlToken ?? storedToken;
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [missingLinkedRecord, setMissingLinkedRecord] = useState(false);
  const [, setSessionResetAt] = useState(0);

  useEffect(() => {
    if (!isConfigured) return;
    getPublicSettings().then(setSettings).catch(() => { /* fall back to defaults */ });
  }, []);

  // Persist the token so a bookmark of `/` still lands them on their record.
  // Reflect a recovered token back into the URL so refresh / share works the same way.
  useEffect(() => {
    if (urlToken) {
      saveParticipantToken(urlToken);
    } else if (storedToken) {
      const url = new URL(window.location.href);
      url.searchParams.set('p', storedToken);
      window.history.replaceState({}, '', url.toString());
    }
  }, [urlToken, storedToken]);

  const resetSession = useCallback((mode: 'push' | 'replace' = 'push') => {
    clearParticipantSessionAndDraft();
    removeParticipantTokenFromUrl(mode);
    setMissingLinkedRecord(false);
    setSessionResetAt((current) => current + 1);
  }, []);

  const handleMissingRecord = useCallback(() => {
    clearParticipantSession();
    removeParticipantTokenFromUrl('replace');
    if (urlToken) {
      setMissingLinkedRecord(true);
    } else {
      setSessionResetAt((current) => current + 1);
    }
  }, [urlToken]);

  return (
    <>
      {missingLinkedRecord
        ? <RecoveryState onResetSession={resetSession} />
        : token
        ? (
          <ParticipantHome
            token={token}
            settings={settings}
            onMissingRecord={handleMissingRecord}
            onResetSession={resetSession}
          />
        )
        : <IntakeForm settings={settings} />}
      <DevReset visible={!!token && !!getHostSecret()} />
    </>
  );
}

function RecoveryState({ onResetSession }: { onResetSession: (mode?: 'push' | 'replace') => void }) {
  return (
    <div className={s.page}>
      <div className={s.inner}>
        <div className={`${s.notice} ${participant.recovery}`}>
          <p>This entry was removed or the link is no longer valid.</p>
          <button type="button" className={s.btn} onClick={() => onResetSession()}>
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}

function DevReset({ visible }: { visible: boolean }) {
  if (!visible) return null;
  const reset = () => {
    clearParticipantSessionAndDraft();
    removeParticipantTokenFromUrl('push');
    window.location.reload();
  };
  return (
    <button type="button" onClick={reset} className={dev.reset}>
      Reset (dev)
    </button>
  );
}
