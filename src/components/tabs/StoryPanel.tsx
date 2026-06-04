import { AnimatePresence, motion } from 'framer-motion';
import { useCanvasStore } from '../../store/canvasStore';
import styles from './StoryPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function StoryPanel({ open, onClose }: Props) {
  const premise = useCanvasStore((s) => s.premise);
  const updatePremise = useCanvasStore((s) => s.updatePremise);
  const acts = useCanvasStore((s) => s.acts);
  const updateAct = useCanvasStore((s) => s.updateAct);
  const intake = useCanvasStore((s) => s.intake);
  const intakeOrder = useCanvasStore((s) => s.intakeOrder);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className={styles.panel}
          data-ui
          initial={{ x: -380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -380, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        >
          <header className={styles.header}>
            <h2 className={styles.heading}>Story Structure</h2>
            <button className={styles.close} onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          <div className={styles.scroll}>
            <label className={styles.field}>
              <span className={styles.label}>Premise</span>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="The one-paragraph hook for the night."
                value={premise}
                onChange={(e) => updatePremise(e.target.value)}
              />
            </label>

            {acts.map((act) => (
              <div key={act.id} className={styles.field}>
                <input
                  className={styles.actTitle}
                  value={act.title}
                  onChange={(e) => updateAct(act.id, { title: e.target.value })}
                />
                <textarea
                  className={styles.textarea}
                  rows={4}
                  placeholder="What happens, what's revealed, what guests do."
                  value={act.notes}
                  onChange={(e) => updateAct(act.id, { notes: e.target.value })}
                />
              </div>
            ))}

            <div className={styles.refBox}>
              <span className={styles.label}>Guest preferences to map</span>
              <p className={styles.refHint}>
                From your intake form — pull these into casting and beats.
              </p>
              {intakeOrder.length === 0 && <p className={styles.refHint}>No intake questions yet.</p>}
              <ul className={styles.refList}>
                {intakeOrder.map((id) => {
                  const q = intake[id];
                  if (!q) return null;
                  return (
                    <li key={id} className={styles.refItem}>
                      <strong>{q.label || 'Untitled question'}</strong>
                      {q.intent && <span className={styles.refIntent}>→ {q.intent}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
