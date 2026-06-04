import { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import type { IntakeFieldType } from '../../types/canvas';
import f from './forms.module.css';

const TYPES: { id: IntakeFieldType; label: string }[] = [
  { id: 'short-text', label: 'Short text' },
  { id: 'long-text', label: 'Paragraph' },
  { id: 'single-select', label: 'Pick one' },
  { id: 'multi-select', label: 'Pick many' },
];

export default function IntakeTab() {
  const intake = useCanvasStore((s) => s.intake);
  const order = useCanvasStore((s) => s.intakeOrder);
  const add = useCanvasStore((s) => s.addIntakeQuestion);
  const update = useCanvasStore((s) => s.updateIntakeQuestion);
  const del = useCanvasStore((s) => s.deleteIntakeQuestion);

  return (
    <div className={f.page}>
      <div className={f.inner}>
        <header className={f.head}>
          <h1 className={f.title}>Intake Form</h1>
          <p className={f.subtitle}>
            Draft the questions you’ll send guests. Answers feed the guest list and help you
            cast characters — note what each question is <em>for</em> so future-you remembers
            how to map it.
          </p>
        </header>

        {order.length === 0 && <div className={f.empty}>No questions yet. Add your first below.</div>}

        {order.map((id) => {
          const q = intake[id];
          if (!q) return null;
          const isSelect = q.type === 'single-select' || q.type === 'multi-select';
          return (
            <div key={id} className={f.card}>
              <button className={f.del} onClick={() => del(id)} aria-label="Delete question">
                ×
              </button>

              <div className={f.field}>
                <span className={f.label}>Question</span>
                <input
                  className={f.input}
                  placeholder="e.g. How much do you want to ham it up?"
                  value={q.label}
                  onChange={(e) => update(id, { label: e.target.value })}
                />
              </div>

              <div className={f.field}>
                <span className={f.label}>Answer type</span>
                <div className={f.pillRow}>
                  {TYPES.map((t) => (
                    <button
                      key={t.id}
                      className={`${f.typePill} ${q.type === t.id ? f.typePillOn : ''}`}
                      onClick={() => update(id, { type: t.id })}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {isSelect && <OptionsEditor id={id} options={q.options} />}

              <div className={f.field}>
                <span className={f.label}>What it’s for (private)</span>
                <input
                  className={f.input}
                  placeholder="How this answer maps to casting / story"
                  value={q.intent}
                  onChange={(e) => update(id, { intent: e.target.value })}
                />
              </div>
            </div>
          );
        })}

        <div className={f.row}>
          <button className={f.addBtn} onClick={() => add('short-text')}>
            + Add question
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionsEditor({ id, options }: { id: string; options: string[] }) {
  const update = useCanvasStore((s) => s.updateIntakeQuestion);
  const [draft, setDraft] = useState('');

  const addOption = () => {
    const v = draft.trim();
    if (!v) return;
    update(id, { options: [...options, v] });
    setDraft('');
  };

  return (
    <div className={f.field}>
      <span className={f.label}>Options</span>
      <div className={f.pillRow}>
        {options.map((opt, i) => (
          <span key={i} className={f.tag}>
            {opt}
            <button
              onClick={() => update(id, { options: options.filter((_, j) => j !== i) })}
              aria-label={`Remove ${opt}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className={f.row}>
        <input
          className={f.input}
          style={{ flex: 1 }}
          placeholder="Add an option, press Enter"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOption();
            }
          }}
        />
        <button className={f.ghostBtn} onClick={addOption}>
          Add
        </button>
      </div>
    </div>
  );
}
