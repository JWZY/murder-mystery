import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { formatAnswer, formatDishContribution, INTAKE_QUESTIONS } from '../../lib/intakeSchema';
import type { HostWorld, ParticipantFull } from '../../lib/hostApi';
import styles from './StoryPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  world: HostWorld | null;
}

export default function StoryPanel({ open, onClose, world }: Props) {
  const premise = useCanvasStore((s) => s.premise);
  const updatePremise = useCanvasStore((s) => s.updatePremise);
  const acts = useCanvasStore((s) => s.acts);
  const updateAct = useCanvasStore((s) => s.updateAct);

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
              <X size={18} />
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
              <span className={styles.label}>Submitted entries to map</span>
              <p className={styles.refHint}>
                Read-only source material from the intake rows.
              </p>
              {!world && <p className={styles.refHint}>Loading entries...</p>}
              {world?.participants.length === 0 && <p className={styles.refHint}>No entries yet.</p>}
              <div className={styles.sourceList}>
                {world?.participants.map((p) => (
                  <EntryCard key={p.id} participant={p} />
                ))}
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function EntryCard({ participant }: { participant: ParticipantFull }) {
  const answers = INTAKE_QUESTIONS
    .filter((q) => !q.showIf || q.showIf(participant))
    .map((q) => [q.label, formatAnswer(q, participant)] as const)
    .filter(([, answer]) => answer);
  const meta = [
    participant.roleplay_comfort != null ? `comfort ${participant.roleplay_comfort}/5` : null,
    participant.reveal_dial != null ? `truth ${participant.reveal_dial}/5` : null,
    formatDishContribution(participant),
  ].filter(Boolean);

  return (
    <article className={styles.sourceCard}>
      <h3>{participant.preferred_name || participant.contact || 'Unnamed guest'}</h3>
      {meta.length > 0 && <p className={styles.sourceMeta}>{meta.join(' / ')}</p>}
      {answers.length > 0 ? (
        <dl className={styles.answerList}>
          {answers.map(([label, answer]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={styles.refHint}>No intake answers submitted yet.</p>
      )}
    </article>
  );
}
