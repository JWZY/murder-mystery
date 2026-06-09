import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { emptyRecord, type ParticipantRecord, type PublicSettings } from '../types/participant';
import { submitIntake } from '../lib/api';
import { isConfigured } from '../lib/supabase';
import { INTAKE_QUESTIONS, type DishOption, type Question } from '../lib/intakeSchema';
import s from './participant.module.css';
import ui from '../styles/ui.module.css';
import Typewriter from './Typewriter';
import Moodboard from './Moodboard';
import AutoFitTextarea from './AutoFitTextarea';
import SmokeAmbience from '../components/SmokeAmbience/SmokeAmbience';

type IntakeKey = keyof ParticipantRecord;
type ChapterStep = { kind: 'chapter'; number: number; questions: Question[] };
type Step = { kind: 'welcome' } | ChapterStep;
type DraftStatus = 'idle' | 'saving' | 'saved' | 'error';
type IntakeDraft = {
  rec?: Partial<ParticipantRecord>;
  consents?: boolean[];
  idx?: number;
};

const DRAFT_KEY = 'mm.intake.draft';

// House rules the participant must acknowledge before the form will submit.
// Edit this list to add/rename items; the final chapter auto-requires all of them.
const HOUSE_RULES: string[] = [
  'I will stay in character and not spoil the plot for other guests.',
  'I will show up on time, or give reasonable notice if I can’t make it.',
  'I will find an outfit that makes sense for my character and role.',
  'I understand this party takes significant effort to plan, and I’ll be respectful of that.',
];

const QUESTION_BY_KEY = new Map<IntakeKey, Question>(
  INTAKE_QUESTIONS.map((q) => [q.key, q])
);

function getQuestion(key: IntakeKey): Question {
  const q = QUESTION_BY_KEY.get(key);
  if (!q) throw new Error(`Missing intake question for ${String(key)}`);
  return q;
}

const CHAPTER_COUNT = 4;
const STEPS: Step[] = [
  { kind: 'welcome' },
  { kind: 'chapter', number: 1, questions: [getQuestion('roleplay_comfort'), getQuestion('trope_wishlist')] },
  { kind: 'chapter', number: 2, questions: [getQuestion('surprise_fact')] },
  { kind: 'chapter', number: 3, questions: [getQuestion('dish_category'), getQuestion('dietary')] },
  { kind: 'chapter', number: 4, questions: [getQuestion('hard_limits')] },
];

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

function Area({ q, rec, patch, autoFocus }: {
  q: Question;
  rec: ParticipantRecord;
  patch: (p: Partial<ParticipantRecord>) => void;
  autoFocus?: boolean;
}) {
  const value = String(rec[q.key] ?? '');
  return (
    <AutoFitTextarea
      autoFocus={autoFocus}
      className={s.tfArea}
      value={value}
      placeholder={q.placeholder}
      onChange={(e) => patch({ [q.key]: e.target.value } as Partial<ParticipantRecord>)}
    />
  );
}

function ctaLabel(step: Step, busy = false): string {
  if (step.kind === 'welcome') return 'Start';
  if (step.number === CHAPTER_COUNT) return busy ? 'Submitting...' : 'Submit';
  return 'Next';
}

function questionAnswered(q: Question, rec: ParticipantRecord): boolean {
  if (!q.required) return true;
  if (q.kind === 'text' || q.kind === 'area') return String(rec[q.key] ?? '').trim().length > 0;
  if (q.kind === 'scale') return rec[q.key] != null;
  if (q.kind === 'dishes') return String(rec.dish_category ?? '').trim().length > 0;
  return true;
}

function readDraft(): IntakeDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as IntakeDraft;
    return draft && typeof draft === 'object' ? draft : null;
  } catch {
    return null;
  }
}

function clampStep(value: unknown): number {
  return typeof value === 'number'
    ? Math.max(0, Math.min(value, STEPS.length - 1))
    : 0;
}

function hasDraftContent(rec: ParticipantRecord, consents: boolean[], idx: number): boolean {
  return idx > 0
    || consents.some(Boolean)
    || Object.entries(rec).some(([key, value]) => {
      if (key === 'rsvp') return false;
      if (typeof value === 'string') return value.trim().length > 0;
      return value != null;
    });
}

function draftStatusLabel(status: DraftStatus): string | null {
  if (status === 'saving') return 'Saving...';
  return null;
}

export default function IntakeForm({ settings }: { settings: PublicSettings | null }) {
  const initialDraft = useRef<IntakeDraft | null | undefined>(undefined);
  if (initialDraft.current === undefined) initialDraft.current = readDraft();

  const [rec, setRec] = useState<ParticipantRecord>(() => ({
    ...emptyRecord(),
    ...(initialDraft.current?.rec ?? {}),
  }));
  const [idx, setIdx] = useState(() => clampStep(initialDraft.current?.idx));
  const [dir, setDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [consents, setConsents] = useState<boolean[]>(() => (
    HOUSE_RULES.map((_, i) => Boolean(initialDraft.current?.consents?.[i]))
  ));
  const [draftStatus, setDraftStatus] = useState<DraftStatus>(() => (
    hasDraftContent(
      { ...emptyRecord(), ...(initialDraft.current?.rec ?? {}) },
      HOUSE_RULES.map((_, i) => Boolean(initialDraft.current?.consents?.[i])),
      clampStep(initialDraft.current?.idx),
    ) ? 'saved' : 'idle'
  ));
  const draftTimer = useRef<number | null>(null);

  const title = 'A murder at 57 Wagon Trailway. July 11, after 7PM.';
  const closed = settings ? !settings.intake_open : false;
  const step = STEPS[idx];
  const atFirst = idx === 0;
  const atFinalChapter = step.kind === 'chapter' && step.number === CHAPTER_COUNT;

  const patch = useCallback((p: Partial<ParticipantRecord>) => setRec((r) => ({ ...r, ...p })), []);

  const canAdvance = (() => {
    if (busy) return false;
    if (step.kind === 'welcome') return rec.preferred_name.trim().length > 0;
    const requiredQuestionsAnswered = step.questions.every((q) => questionAnswered(q, rec));
    if (step.number === CHAPTER_COUNT) return requiredQuestionsAnswered && consents.every(Boolean);
    return requiredQuestionsAnswered;
  })();

  async function submit(allowPartial = false) {
    if (busy || (!allowPartial && !canAdvance) || (allowPartial && !rec.preferred_name.trim())) return;
    setError(null);
    setBusy(true);
    try {
      const token = await submitIntake(rec);
      const url = new URL(window.location.href);
      url.searchParams.set('p', token);
      url.searchParams.set('submitted', '1');
      localStorage.removeItem(DRAFT_KEY);
      setDraftStatus('idle');
      setSuccess(allowPartial ? 'Saved for later.' : "We'll be in touch.");
      window.setTimeout(() => {
        window.location.href = url.toString();
      }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  function next() {
    if (!canAdvance) return;
    if (atFinalChapter) {
      submit();
      return;
    }
    setDir(1);
    setIdx((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function back() {
    setDir(-1);
    setIdx((i) => Math.max(i - 1, 0));
  }

  useEffect(() => {
    if (!hasDraftContent(rec, consents, idx)) {
      setDraftStatus('idle');
      return;
    }

    setDraftStatus('saving');
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ rec, consents, idx }));
        setDraftStatus('saved');
      } catch {
        setDraftStatus('error');
      }
    }, 250);

    return () => {
      if (draftTimer.current) window.clearTimeout(draftTimer.current);
    };
  }, [rec, consents, idx]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'TEXTAREA' && !e.metaKey && !e.ctrlKey) return;
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowDown') { e.preventDefault(); next(); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); back(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back]);

  return (
    <div className={s.tfPage}>
      <SmokeAmbience className="tfIntakeSmoke" />
      {!isConfigured && <div className={`${ui.notice} ${s.tfBanner}`}>Backend not connected — form can&rsquo;t save.</div>}
      {closed && <div className={`${ui.notice} ${s.tfBanner}`}>Intake is closed.</div>}

      <div className={s.tfStage}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={success ? 'success' : idx}
            custom={dir}
            initial={{ opacity: 0, y: dir > 0 ? 24 : -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dir > 0 ? -24 : 24 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={s.tfStep}
            data-step-kind={success ? 'success' : step.kind}
          >
            {success ? (
              <SuccessStep message={success} />
            ) : step.kind === 'welcome' ? (
              <Welcome
                title={title}
                name={rec.preferred_name}
                onNameChange={(preferred_name) => patch({ preferred_name })}
                onStart={next}
                canStart={canAdvance}
              />
            ) : (
              <ChapterStep
                step={step}
                rec={rec}
                patch={patch}
                consents={consents}
                onToggleConsent={(i) => setConsents((c) => c.map((v, j) => (j === i ? !v : v)))}
                onNext={next}
                busy={busy}
                canAdvance={canAdvance}
                error={atFinalChapter ? error : null}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {!success && (
        <div className={s.tfNav}>
          <button className={s.tfNavBtn} onClick={back} disabled={atFirst} aria-label="Previous">↑</button>
          <button className={s.tfNavBtn} onClick={next} disabled={!canAdvance} aria-label={atFinalChapter ? 'Submit' : 'Next'}>↓</button>
        </div>
      )}

      {!success && (
        <div className={s.tfMobileBar}>
          {!atFirst && (
            <button className={s.tfMobileBack} onClick={back} aria-label="Previous">&lt;</button>
          )}
          <button
            className={s.tfMobilePrimary}
            onClick={next}
            disabled={!canAdvance}
          >
            {ctaLabel(step, busy)}
          </button>
          {draftStatusLabel(draftStatus) && (
            <span className={s.tfMobileSaveStatus} data-state={draftStatus} aria-live="polite">
              {draftStatusLabel(draftStatus)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Welcome({ title, name, onNameChange, onStart, canStart }: {
  title: string;
  name: string;
  onNameChange: (value: string) => void;
  onStart: () => void;
  canStart: boolean;
}) {
  return (
    <div className={s.tfWelcomeScene}>
      <Moodboard variant="backdrop" />
      <div className={s.tfWelcome}>
        <h1 className={s.tfTitle}><Typewriter text={title} keepCaret /></h1>
        <label className={s.tfWelcomeName}>
          <input
            autoFocus
            aria-label="State your name for the record."
            className={s.tfInput}
            value={name}
            placeholder="State your name for the record."
            onChange={(e) => onNameChange(e.target.value)}
          />
        </label>
        <button className={s.tfPrimary} onClick={onStart} disabled={!canStart}>{ctaLabel({ kind: 'welcome' })}</button>
      </div>
    </div>
  );
}

function SuccessStep({ message }: { message: string }) {
  return (
    <div className={s.tfWelcome}>
      <h2 className={s.tfTitle}><Typewriter text={message} keepCaret /></h2>
    </div>
  );
}

function ChapterStep({ step, rec, patch, consents, onToggleConsent, onNext, busy, canAdvance, error }: {
  step: ChapterStep;
  rec: ParticipantRecord;
  patch: (p: Partial<ParticipantRecord>) => void;
  consents: boolean[];
  onToggleConsent: (i: number) => void;
  onNext: () => void;
  busy: boolean;
  canAdvance: boolean;
  error: string | null;
}) {
  const isFinal = step.number === CHAPTER_COUNT;
  const reduceMotion = useReducedMotion();
  const [firstTitleDone, setFirstTitleDone] = useState(false);
  const revealReady = Boolean(reduceMotion || firstTitleDone);
  const secondaryCount = Math.max(0, step.questions.length - 1) + (isFinal ? 1 : 0);

  return (
    <div className={s.tfBlock}>
      <div className={s.tfBody}>
        <div className={s.tfChapterIndicator}>{step.number} of {CHAPTER_COUNT}</div>
        <div className={s.tfFields}>
          {step.questions.map((q, i) => (
            <QuestionField
              key={String(q.key)}
              q={q}
              rec={rec}
              patch={patch}
              autoFocus={i === 0}
              titleMode={i === 0 ? 'typewriter' : 'plain'}
              reveal={revealReady}
              revealDelay={i === 0 ? 0 : (i - 1) * 0.08}
              onTitleDone={i === 0 ? () => setFirstTitleDone(true) : undefined}
            />
          ))}
          {isFinal && (
            <HouseRules
              rules={HOUSE_RULES}
              checked={consents}
              onToggle={onToggleConsent}
              reveal={revealReady}
              revealDelay={Math.max(0, step.questions.length - 1) * 0.08}
            />
          )}
        </div>
        {error && <div className={ui.notice}>{error}</div>}
        <Reveal show={revealReady} delay={secondaryCount * 0.08 + 0.06} className={s.tfActionsReveal}>
          <Actions
            label={ctaLabel(step, busy)}
            onOk={onNext}
            okDisabled={!canAdvance}
          />
        </Reveal>
      </div>
    </div>
  );
}

function QuestionField({ q, rec, patch, autoFocus, titleMode = 'typewriter', reveal = true, revealDelay = 0, onTitleDone }: {
  q: Question;
  rec: ParticipantRecord;
  patch: (p: Partial<ParticipantRecord>) => void;
  autoFocus?: boolean;
  titleMode?: 'typewriter' | 'plain';
  reveal?: boolean;
  revealDelay?: number;
  onTitleDone?: () => void;
}) {
  const title = (
    <div className={s.tfQ}>
      {titleMode === 'plain' ? q.question : <Typewriter text={q.question} onDone={onTitleDone} />}
      {q.required && <span className={s.tfReq}> *</span>}
    </div>
  );

  const body = (
    <>
      {q.desc && <div className={s.tfDesc}>{q.desc}</div>}
      {renderInput(q, rec, patch, autoFocus)}
    </>
  );

  if (titleMode === 'plain') {
    return (
      <Reveal show={Boolean(reveal)} delay={revealDelay} className={s.tfField}>
        {title}
        {body}
      </Reveal>
    );
  }

  return (
    <div className={s.tfField}>
      {title}
      <Reveal show={Boolean(reveal)} delay={revealDelay} className={s.tfFieldContent}>
        {body}
      </Reveal>
    </div>
  );
}

function renderInput(q: Question, rec: ParticipantRecord, patch: (p: Partial<ParticipantRecord>) => void, autoFocus?: boolean) {
  if (q.kind === 'text') return (
    <input
      autoFocus={autoFocus}
      className={s.tfInput}
      value={String(rec[q.key] ?? '')}
      placeholder={q.placeholder}
      onChange={(e) => patch({ [q.key]: e.target.value } as Partial<ParticipantRecord>)}
    />
  );

  if (q.kind === 'area') return <Area q={q} rec={rec} patch={patch} autoFocus={autoFocus} />;

  if (q.kind === 'choice' && q.options) {
    const current = String(rec[q.key] ?? '');
    const selected = q.multi ? current.split(',').filter(Boolean) : [current];
    return (
      <div className={s.tfChoices}>
        {q.options.map((o) => {
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
    );
  }

  if (q.kind === 'dishes' && q.dishOptions) {
    const cats = String(rec.dish_category ?? '').split(',').filter(Boolean);
    const details = parseDishDetail(String(rec.dish_detail ?? ''));
    return (
      <div className={s.tfChoices}>
        {q.dishOptions.map((o) => {
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
    );
  }

  if (q.kind === 'scale' && q.caps) return (
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
              <strong>{n} - {cap}</strong>
              {desc && <span className={s.tfChoiceDesc}>: {desc}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );

  return null;
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

function HouseRules({ rules, checked, onToggle, reveal, revealDelay = 0 }: {
  rules: string[];
  checked: boolean[];
  onToggle: (i: number) => void;
  reveal: boolean;
  revealDelay?: number;
}) {
  return (
    <Reveal show={reveal} delay={revealDelay} className={s.tfField}>
      <div className={s.tfQ}>
        Rules and expectations.
        <span className={s.tfReq}> *</span>
      </div>
      <div className={s.tfChoices}>
        {rules.map((rule, i) => {
          const on = checked[i];
          return (
            <button
              key={i}
              type="button"
              className={`${s.tfChoice} ${on ? s.tfChoiceOn : ''}`}
              onClick={() => onToggle(i)}
              aria-pressed={on}
            >
              <span className={`${s.tfCheck} ${on ? s.tfCheckOn : ''}`} />
              <span>{rule}</span>
            </button>
          );
        })}
      </div>
    </Reveal>
  );
}

function Reveal({ show, delay = 0, className, children }: {
  show: boolean;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      aria-hidden={!show || undefined}
      inert={!show || undefined}
      initial={false}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : 10 }}
      style={{ pointerEvents: show ? 'auto' : 'none' }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Actions({ label, onOk, okDisabled }: {
  label: string;
  onOk: () => void;
  okDisabled?: boolean;
}) {
  return (
    <div className={s.tfActions}>
      <button className={s.tfOk} onClick={onOk} disabled={okDisabled}>
        {label}
      </button>
    </div>
  );
}
