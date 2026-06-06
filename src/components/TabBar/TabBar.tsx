import type { LucideIcon } from 'lucide-react';
import styles from './TabBar.module.css';

export type TabBarItem<Id extends string = string> = {
  id: Id;
  label: string;
  Icon: LucideIcon;
};

type Props<Id extends string> = {
  tabs: TabBarItem<Id>[];
  activeId: Id;
  onChange: (id: Id) => void;
  showLabels?: boolean;
  /** Retained for API compatibility; the active marker is a static ink shape,
   *  not a shared-element morph. */
  layoutId?: string;
};

export default function TabBar<Id extends string>({
  tabs,
  activeId,
  onChange,
  showLabels = false,
}: Props<Id>) {
  return (
    <nav className={`${styles.bar} ${showLabels ? styles.barLabeled : ''}`} data-ui>
      <div className={styles.tabs}>
        {tabs.map((t) => {
          const active = activeId === t.id;
          return (
            <button
              key={t.id}
              className={`${styles.tab} ${showLabels ? styles.tabLabeled : ''} ${active ? styles.active : ''}`}
              onClick={() => onChange(t.id)}
              title={t.label}
              aria-label={t.label}
            >
              {showLabels && <span className={styles.splatter} aria-hidden="true" />}
              {showLabels ? (
                <span className={styles.tabLabel}>{t.label}</span>
              ) : (
                <span className={styles.tabIcon}>
                  <t.Icon size={18} strokeWidth={2} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
