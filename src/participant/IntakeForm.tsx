import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { emptyRecord, type ParticipantRecord, type PublicSettings } from '../types/participant';
import { submitIntake } from '../lib/api';
import { isConfigured } from '../lib/supabase';
import { INTAKE_QUESTIONS, type DishOption, type Question } from '../lib/intakeSchema';
import s from './participant.module.css';
import ui from '../styles/ui.module.css';
import Typewriter from './Typewriter';

type ShowIf = (rec: ParticipantRecord) => boolean;
type Step =
  | { kind: 'welcome' }
  | { kind: 'question'; q: Question; showIf?: ShowIf }
  | { kind: 'submit' };

// dish_detail is JSON-encoded { [categoryV]: text } so each picked category gets its own freeform note.
function parseDishDetail(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, string> : {};
  } catch { return {}; }
}
function serializeDishDetail(map: Record<string, string>): string {
  const trimmed = Object.fromEntries(Object.entries(map).filter(([, v]) => v.trim().length > 0));
  return Object.keys(trimmed).length ? JSON.stringify(trimmed) : '';
}

const STEPS: Step[] = [
  { kind: 'welcome' },
  ...INTAKE_QUESTIONS.map<Step>((q) => ({ kind: 'question', q, showIf: q.showIf })),
  { kind: 'submit' },
];

/** Single source of truth for the primary CTA label. Both the desktop CTAs
 *  (Welcome's start, Actions' next, SubmitStep's finish) and the mobile bar
 *  read from this — so they can't drift apart. */
function ctaLabel(kind: Step['kind'], busy = false): string {
  if (kind === 'welcome') return 'Start';
  if (kind === 'submit') return busy ? 'Sending…' : 'Finish';
  return 'Next';
}

export default function IntakeForm({ settings }: { settings: PublicSettings | null }) {
  const [rec, setRec] = useState<ParticipantRecord>(emptyRecord());
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = 'A murder at 57 Wagon Trailway. July 11, after 7PM.';
  const closed = settings ? !settings.intake_open : false;

  const step = STEPS[idx];
  const stepVisible = useCallback(
    (st: Step, r: ParticipantRecord) => (st.kind === 'welcome' || st.kind === 'submit' ? true : st.showIf ? st.showIf(r) : true),
    []
  );
  const visibleIndices = useMemo(
    () => STEPS.map((st, i) => (stepVisible(st, rec) ? i : -1)).filter((i) => i >= 0),
    [rec, stepVisible]
  );
  const visiblePos = visibleIndices.indexOf(idx);
  const total = visibleIndices.length;
  const progress = total > 1 ? visiblePos / (total - 1) : 0;

  const patch = useCallback((p: Partial<ParticipantRecord>) => setRec((r) => ({ ...r, ...p })), []);

  const canAdvance = useMemo(() => {
    if (step.kind !== 'question') return true;
    const q = step.q;
    if (!q.required) return true;
    if (q.kind === 'text') return String(rec[q.key] ?? '').trim().length > 0;
    if (q.kind === 'scale') return rec[q.key] != null;
    return true;
  }, [step, rec]);

  const next = useCallback(() => {
    if (!canAdvance) return;
    setDir(1);
    setIdx((i) => {
      for (let j = i + 1; j < STEPS.length; j++) {
        if (stepVisible(STEPS[j], rec)) return j;
      }
      return i;
    });
  }, [canAdvance, rec, stepVisible]);

  const back = useCallback(() => {
    setDir(-1);
    setIdx((i) => {
      for (let j = i - 1; j >= 0; j--) {
        if (stepVisible(STEPS[j], rec)) return j;
      }
      return i;
    });
  }, [rec, stepVisible]);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const token = await submitIntake(rec);
      const url = new URL(window.location.href);
      url.searchParams.set('p', token);
      window.location.href = url.toString();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'TEXTAREA' && !e.metaKey && !e.ctrlKey) return;
        e.preventDefault();
        if (step.kind === 'submit') { if (!busy) submit(); return; }
        next();
      } else if (e.key === 'ArrowDown') { e.preventDefault(); next(); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); back(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, next, back, busy]);

  return (
    <div className={s.tfPage}>
      <div className={s.tfProgress}><div style={{ width: `${progress * 100}%` }} /></div>

      {!isConfigured && <div className={`${ui.notice} ${s.tfBanner}`}>Backend not connected — form can&rsquo;t save.</div>}
      {closed && <div className={`${ui.notice} ${s.tfBanner}`}>Intake is closed.</div>}

      <div className={s.tfStage}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={idx}
            custom={dir}
            initial={{ opacity: 0, y: dir > 0 ? 24 : -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dir > 0 ? -24 : 24 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={s.tfStep}
            data-step-kind={step.kind}
          >
            {step.kind === 'welcome' && <Welcome title={title} onStart={next} />}

            {step.kind === 'question' && (() => {
              const q = step.q;
              const skipBtn = (
                <Actions onOk={next} okDisabled={!canAdvance} onSkip={submit}
                  skipVisible={rec.preferred_name.trim().length > 0 && !busy} />
              );
              if (q.kind === 'text') return (
                <QuestionBlock num={visiblePos} question={q.question} desc={q.desc} required={q.required}>
                  <input
                    autoFocus
                    className={s.tfInput}
                    value={String(rec[q.key] ?? '')}
                    placeholder={q.placeholder}
                    onChange={(e) => patch({ [q.key]: e.target.value } as Partial<ParticipantRecord>)}
                  />
                  {skipBtn}
                </QuestionBlock>
              );
              if (q.kind === 'area') return (
                <QuestionBlock num={visiblePos} question={q.question} desc={q.desc} required={q.required}>
                  <textarea
                    autoFocus
                    rows={1}
                    className={s.tfArea}
                    value={String(rec[q.key] ?? '')}
                    placeholder={q.placeholder}
                    onChange={(e) => patch({ [q.key]: e.target.value } as Partial<ParticipantRecord>)}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = el.scrollHeight + 'px';
                    }}
                  />
                  {skipBtn}
                </QuestionBlock>
              );
              if (q.kind === 'choice' && q.options) return (
                <QuestionBlock num={visiblePos} question={q.question} desc={q.desc} required={q.required}>
                  <div className={s.tfChoices}>
                    {q.options.map((o) => {
                      const current = String(rec[q.key] ?? '');
                      const selected = q.multi ? current.split(',').filter(Boolean) : [current];
                      const active = selected.includes(o.v);
                      return (
                        <button key={o.v} className={`${s.tfChoice} ${active ? s.tfChoiceOn : ''}`}
                          onClick={() => {
                            if (q.multi) {
                              const nextSet = active ? selected.filter((x) => x !== o.v) : [...selected, o.v];
                              patch({ [q.key]: nextSet.join(',') } as Partial<ParticipantRecord>);
                            } else {
                              patch({ [q.key]: o.v } as Partial<ParticipantRecord>);
                            }
                          }}>
                          <span className={`${q.multi ? s.tfCheck : s.tfRadio} ${active ? (q.multi ? s.tfCheckOn : s.tfRadioOn) : ''}`} />
                          <span>{o.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {skipBtn}
                </QuestionBlock>
              );
              if (q.kind === 'dishes' && q.dishOptions) return (
                <QuestionBlock num={visiblePos} question={q.question} desc={q.desc} required={q.required}>
                  <div className={s.tfChoices}>
                    {q.dishOptions.map((o) => {
                      const cats = String(rec.dish_category ?? '').split(',').filter(Boolean);
                      const details = parseDishDetail(String(rec.dish_detail ?? ''));
                      const active = cats.includes(o.v);
                      return (
                        <DishRow
                          key={o.v}
                          option={o}
                          active={active}
                          value={details[o.v] ?? ''}
                          onToggle={() => {
                            const nextCats = active ? cats.filter((x) => x !== o.v) : [...cats, o.v];
                            const nextDetails = { ...details };
                            if (!active && nextDetails[o.v] == null) nextDetails[o.v] = '';
                            if (active) delete nextDetails[o.v];
                            patch({
                              dish_category: nextCats.join(','),
                              dish_detail: serializeDishDetail(nextDetails),
                            });
                          }}
                          onValueChange={(v) => {
                            patch({ dish_detail: serializeDishDetail({ ...details, [o.v]: v }) });
                          }}
                        />
                      );
                    })}
                  </div>
                  {skipBtn}
                </QuestionBlock>
              );
              if (q.kind === 'scale' && q.caps) return (
                <QuestionBlock num={visiblePos} question={q.question} desc={q.desc} required={q.required}>
                  <div className={s.tfChoices}>
                    {q.caps.map((cap, i) => {
                      const n = i + 1;
                      const active = rec[q.key] === n;
                      const desc = q.descriptions?.[i];
                      return (
                        <button key={n} className={`${s.tfChoice} ${active ? s.tfChoiceOn : ''}`}
                          onClick={() => patch({ [q.key]: n } as Partial<ParticipantRecord>)}>
                          <span className={`${s.tfRadio} ${active ? s.tfRadioOn : ''}`} />
                          <span>
                            <strong>{n} — {cap}</strong>
                            {desc && <span className={s.tfChoiceDesc}>: {desc}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {skipBtn}
                </QuestionBlock>
              );
              return null;
            })()}

            {step.kind === 'submit' && (
              <SubmitStep rec={rec} busy={busy} error={error} onSubmit={submit} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={s.tfNav}>
        <span className={s.tfCount}>{visiblePos} / {total - 1}</span>
        <button className={s.tfNavBtn} onClick={back} disabled={visiblePos === 0} aria-label="Previous">↑</button>
        <button className={s.tfNavBtn} onClick={next} disabled={visiblePos === total - 1 || !canAdvance} aria-label="Next">↓</button>
      </div>

      <div className={s.tfMobileBar}>
        {visiblePos > 0 && (
          <button className={s.tfMobileBack} onClick={back} aria-label="Previous">&lt;</button>
        )}
        <button
          className={s.tfMobilePrimary}
          onClick={step.kind === 'submit' ? submit : next}
          disabled={(step.kind === 'submit' ? (busy || !rec.preferred_name.trim()) : !canAdvance)}
        >
          {ctaLabel(step.kind, busy)}
        </button>
      </div>
    </div>
  );
}

function Welcome({ title, onStart }: { title: string; onStart: () => void }) {
  return (
    <div className={s.tfWelcome}>
      <h1 className={s.tfTitle}><Typewriter text={title} keepCaret /></h1>
      <button className={s.tfPrimary} onClick={onStart}>{ctaLabel('welcome')}</button>
    </div>
  );
}

function QuestionBlock({ num, question, desc, required, children }: { num: number; question: string; desc?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className={s.tfBlock}>
      <div className={s.tfBody}>
        <div className={s.tfQ}>
          <span className={s.tfNum}>{num}.</span>
          <Typewriter text={question} />
          {required && <span className={s.tfReq}> *</span>}
        </div>
        {desc && <div className={s.tfDesc}>{desc}</div>}
        {children}
      </div>
    </div>
  );
}

function DishRow({ option, active, value, onToggle, onValueChange }: {
  option: DishOption;
  active: boolean;
  value: string;
  onToggle: () => void;
  onValueChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prevActive = useRef(active);
  useEffect(() => {
    if (active && !prevActive.current) inputRef.current?.focus();
    prevActive.current = active;
  }, [active]);
  return (
    <div className={`${s.tfChoice} ${active ? s.tfChoiceOn : ''} ${s.tfDishRow}`} onClick={(e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      onToggle();
    }}>
      <span className={`${s.tfCheck} ${active ? s.tfCheckOn : ''}`} />
      <span className={s.tfDishMain}>
        <span className={s.tfDishLabel}>
          {option.label}
        </span>
        {active && option.placeholder !== undefined && (
          <input
            ref={inputRef}
            className={s.tfDishInput}
            value={value}
            placeholder={option.placeholder}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onValueChange(e.target.value)}
          />
        )}
      </span>
    </div>
  );
}

function Actions({ onOk, okDisabled, onSkip, skipVisible }: {
  onOk: () => void;
  okDisabled?: boolean;
  onSkip: () => void;
  skipVisible: boolean;
}) {
  return (
    <div className={s.tfActions}>
      <button className={s.tfOk} onClick={onOk} disabled={okDisabled}>
        {ctaLabel('question')}
      </button>
      {skipVisible && (
        <button className={s.tfSkip} onClick={onSkip} type="button">
          Save for later
        </button>
      )}
    </div>
  );
}

function SubmitStep({ rec, busy, error, onSubmit }: {
  rec: ParticipantRecord; busy: boolean; error: string | null; onSubmit: () => void;
}) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { okRef.current?.focus(); }, []);
  return (
    <div className={s.tfWelcome}>
      <h2 className={s.tfTitle}><Typewriter text="We'll be in touch." keepCaret /></h2>
      {error && <div className={ui.notice}>{error}</div>}
      <button ref={okRef} className={s.tfPrimary} onClick={onSubmit} disabled={busy || !rec.preferred_name.trim()}>
        {ctaLabel('submit', busy)}
      </button>
    </div>
  );
}
