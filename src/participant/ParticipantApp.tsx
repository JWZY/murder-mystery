import { useEffect, useState } from 'react';
import type { PublicSettings } from '../types/participant';
import { getPublicSettings } from '../lib/api';
import { isConfigured } from '../lib/supabase';
import { getHostSecret } from '../lib/hostApi';
import IntakeForm from './IntakeForm';
import ParticipantHome from './ParticipantHome';
import dev from './DevReset.module.css';

/**
 * Participant entry point. `?p=<token>` → their personal home (edit + roster +
 * character). No token → the open intake form.
 */
const TOKEN_KEY = 'mm.participant.token';

export default function ParticipantApp() {
  const urlToken = new URLSearchParams(window.location.search).get('p');
  const storedToken = !urlToken ? localStorage.getItem(TOKEN_KEY) : null;
  const token = urlToken ?? storedToken;
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    getPublicSettings().then(setSettings).catch(() => { /* fall back to defaults */ });
  }, []);

  // Persist the token so a bookmark of `/` still lands them on their record.
  // Reflect a recovered token back into the URL so refresh / share works the same way.
  useEffect(() => {
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken);
    } else if (storedToken) {
      const url = new URL(window.location.href);
      url.searchParams.set('p', storedToken);
      window.history.replaceState({}, '', url.toString());
    }
  }, [urlToken, storedToken]);

  return (
    <>
      {token
        ? <ParticipantHome token={token} settings={settings} />
        : <IntakeForm settings={settings} />}
      <DevReset visible={!!token && !!getHostSecret()} />
    </>
  );
}

function DevReset({ visible }: { visible: boolean }) {
  if (!visible) return null;
  const reset = () => {
    localStorage.removeItem(TOKEN_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete('p');
    window.location.href = url.pathname + (url.search ? url.search : '');
  };
  return (
    <button type="button" onClick={reset} className={dev.reset}>
      Reset (dev)
    </button>
  );
}
