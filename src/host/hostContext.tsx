import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { hostCheck, getHostSecret, setHostSecret, clearHostSecret } from '../lib/hostApi';
import { NotConfiguredError } from '../lib/api';
import s from './responses.module.css';

/**
 * Shared host-unlock state. The passcode is validated server-side once, kept in
 * localStorage, and reused across every host tab so you only type it once.
 */
interface HostCtx {
  secret: string;
  unlocked: boolean;
  lock: () => void;
}
const Ctx = createContext<HostCtx | null>(null);

export function useHost(): HostCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHost must be used inside <HostGate>');
  return ctx;
}

/** Wrap host-only tabs. Renders a passcode gate until unlocked. */
export function HostGate({ children }: { children: ReactNode }) {
  const [secret, setSecret] = useState(getHostSecret());
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState(getHostSecret());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Validate a stored passcode silently on mount.
  useEffect(() => {
    const stored = getHostSecret();
    if (!stored) return;
    setBusy(true);
    hostCheck(stored)
      .then((ok) => {
        if (ok) {
          setSecret(stored);
          setUnlocked(true);
        }
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  }, []);

  async function tryUnlock(candidate: string) {
    setBusy(true);
    setError('');
    try {
      const ok = await hostCheck(candidate);
      if (ok) {
        setHostSecret(candidate);
        setSecret(candidate);
        setUnlocked(true);
      } else {
        setError('That passcode was rejected.');
      }
    } catch (e) {
      setError(e instanceof NotConfiguredError ? 'Backend not configured — add your .env.' : 'Could not reach the backend.');
    } finally {
      setBusy(false);
    }
  }

  function lock() {
    clearHostSecret();
    setSecret('');
    setInput('');
    setUnlocked(false);
  }

  if (unlocked) {
    return <Ctx.Provider value={{ secret, unlocked, lock }}>{children}</Ctx.Provider>;
  }

  return (
    <div className={s.page}>
      <div className={s.gate}>
        <h1 className={s.title}>Host workspace</h1>
        <p className={s.subtitle}>Enter the host passcode to manage responses, casting, and settings.</p>
        <form
          className={s.gateForm}
          onSubmit={(e) => {
            e.preventDefault();
            tryUnlock(input);
          }}
        >
          <input
            className={s.input}
            type="password"
            placeholder="Host passcode"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <button className={s.btn} disabled={busy || !input}>
            {busy ? '…' : 'Unlock'}
          </button>
        </form>
        {error && <p className={s.error}>{error}</p>}
      </div>
    </div>
  );
}
