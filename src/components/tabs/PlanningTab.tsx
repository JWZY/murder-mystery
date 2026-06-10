import { useEffect, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import CharacterGraph from '../Graph/CharacterGraph';
import Inspector from '../Inspector/Inspector';
import { hostBootstrap, type HostWorld } from '../../lib/hostApi';
import { useHost } from '../../host/hostContext';
import styles from './PlanningTab.module.css';

export default function PlanningTab() {
  const { secret } = useHost();
  const [world, setWorld] = useState<HostWorld | null>(null);
  const [syncState, setSyncState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fitVersion, setFitVersion] = useState(0);
  const syncFromHostWorld = useCanvasStore((s) => s.syncFromHostWorld);
  const mappedCards = useCanvasStore((s) => s.itemOrder.length);

  useEffect(() => {
    let cancelled = false;
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
  }, [secret, syncFromHostWorld]);

  return (
    <>
      <CharacterGraph autoFitKey={fitVersion} />
      <Inspector />
      <div className={styles.sourceStatus} data-ui>
        {syncState === 'loading' && 'Reading entries...'}
        {syncState === 'ready' && world && `${world.participants.length} entries / ${mappedCards} cards mapped`}
        {syncState === 'error' && 'Could not read host entries'}
      </div>
    </>
  );
}
