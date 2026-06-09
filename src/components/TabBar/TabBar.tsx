import { useEffect, useId, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuTitleId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const selectTab = (id: Id) => {
    onChange(id);
    setMenuOpen(false);
  };

  return (
    <nav
      className={`${styles.bar} ${showLabels ? styles.barLabeled : ''} ${menuOpen ? styles.menuOpen : ''}`}
      data-ui
    >
      {showLabels && (
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      )}
      <div className={styles.tabs}>
        {tabs.map((t) => {
          const active = activeId === t.id;
          return (
            <button
              type="button"
              key={t.id}
              className={`${styles.tab} ${showLabels ? styles.tabLabeled : ''} ${active ? styles.active : ''}`}
              onClick={() => selectTab(t.id)}
              title={t.label}
              aria-label={t.label}
              aria-current={active ? 'page' : undefined}
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
      {showLabels && menuOpen && (
        <div
          id={menuId}
          className={styles.mobileMenu}
          role="dialog"
          aria-modal="true"
          aria-labelledby={menuTitleId}
        >
          <h2 id={menuTitleId} className={styles.mobileMenuTitle}>Menu</h2>
          <div className={styles.mobileMenuItems}>
            {tabs.map((t) => {
              const active = activeId === t.id;
              return (
                <button
                  type="button"
                  key={t.id}
                  className={`${styles.mobileMenuItem} ${active ? styles.mobileMenuItemActive : ''}`}
                  onClick={() => selectTab(t.id)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={styles.mobileSplatter} aria-hidden="true" />
                  <span className={styles.mobileMenuLabel}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
