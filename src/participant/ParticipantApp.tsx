import { useEffect, useState } from 'react';
import type { PublicSettings } from '../types/participant';
import { getPublicSettings } from '../lib/api';
import { isConfigured } from '../lib/supabase';
import IntakeForm from './IntakeForm';
import ParticipantHome from './ParticipantHome';

/**
 * Participant entry point. `?p=<token>` → their personal home (edit + roster +
 * character). No token → the open intake form.
 */
export default function ParticipantApp() {
  const token = new URLSearchParams(window.location.search).get('p');
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    getPublicSettings().then(setSettings).catch(() => { /* fall back to defaults */ });
  }, []);

  return token
    ? <ParticipantHome token={token} settings={settings} />
    : <IntakeForm settings={settings} />;
}
