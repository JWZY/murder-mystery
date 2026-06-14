import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import CharacterGraph from '../Graph/CharacterGraph';
import { hostBootstrap, type HostWorld } from '../../lib/hostApi';
import { useHost } from '../../host/hostContext';
import styles from './PlanningTab.module.css';

export default function PlanningTab() {
  const { secret } = useHost();
  const [world, setWorld] = useState<HostWorld | null>(null);
  const [syncState, setSyncState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fitVersion, setFitVersion] = useState(0);
  const setHostSecret = useCanvasStore((s) => s.setHostSecret);
  const syncFromHostWorld = useCanvasStore((s) => s.syncFromHostWorld);
  const addCharacter = useCanvasStore((s) => s.addCharacter);
  const mappedCards = useCanvasStore((s) => s.itemOrder.length);
  const flushPendingWrites = useCanvasStore((s) => s.flushPendingWrites);
  const saveError = useCanvasStore((s) => s.saveError);

  useEffect(() => {
    let cancelled = false;
    setHostSecret(secret);
    setSyncState('loading');
    hostBootstrap(secret)
      .then((nextWorld) => {
        if (cancelled) return;
        syncFromHostWorld(nextWorld);
        setWorld(nextWorld);
        setSyncState('ready');
        setFitVersion((version) => version + 1);
      })
      .catch(() => {
        if (!cancelled) setSyncState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [secret, setHostSecret, syncFromHostWorld]);

  // A canvas edit sits in a 650ms debounce before it writes to Supabase. Flush
  // anything still queued when the page is hidden/closed or this tab unmounts,
  // so a switch, refresh, or close can't drop an in-flight edit.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushPendingWrites();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushPendingWrites);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushPendingWrites);
      flushPendingWrites();
    };
  }, [flushPendingWrites]);

  return (
    <>
      <CharacterGraph autoFitKey={fitVersion} />

      <button className={styles.addBtn} data-ui onClick={() => addCharacter()}>
        <Plus size={16} /> Add character
      </button>

      <div className={styles.sourceStatus} data-ui>
        {syncState === 'loading' && 'Reading entries...'}
        {syncState === 'ready' && world && `${world.participants.length} entries / ${mappedCards} cards`}
        {syncState === 'error' && 'Could not read host entries'}
      </div>

      {saveError && (
        <div className={styles.saveError} data-ui role="status">
          Couldn't save — check connection
        </div>
      )}
    </>
  );
}
