import { motion } from 'framer-motion';
import { useCanvasStore } from '../../store/canvasStore';
import type { TabId } from '../../types/canvas';
import styles from './TabBar.module.css';

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: 'responses', label: 'Responses', hint: 'Live intake answers' },
  { id: 'casting', label: 'Casting', hint: 'Cast guests + write character cards' },
  { id: 'settings', label: 'Settings', hint: 'Open/close intake, roster, title' },
  { id: 'planning', label: 'Canvas', hint: 'Relationship brainstorming (local)' },
  { id: 'guests', label: 'Guest List', hint: 'Local scratchpad' },
  { id: 'intake', label: 'Q-Planner', hint: 'Local — plan what to ask' },
];

export default function TabBar() {
  const activeTab = useCanvasStore((s) => s.activeTab);
  const setActiveTab = useCanvasStore((s) => s.setActiveTab);

  return (
    <nav className={styles.bar} data-ui>
      <div className={styles.brand}>🔪 Murder Mystery</div>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.active : ''}`}
            onClick={() => setActiveTab(t.id)}
            title={t.hint}
          >
            {activeTab === t.id && (
              <motion.span
                layoutId="tab-pill"
                className={styles.pill}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className={styles.tabLabel}>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
