import { useEffect, useRef, useState } from 'react';
import type { ParticipantRecord } from '../types/participant';
import { getPotluckSummary } from '../lib/api';
import {
  INTAKE_QUESTIONS,
  needMorePotluck,
  tallyPotluck,
  type DishOption,
  type PotluckTally,
  type Question,
} from '../lib/intakeSchema';
import AutoFitTextarea from './AutoFitTextarea';
import s from './participant.module.css';

type Patch = (p: Partial<ParticipantRecord>) => void;

function parseDishDetail(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch { return {}; }
}
function serializeDishDetail(map: Record<string, string>): string {
  const trimmed = Object.fromEntries(Object.entries(map).filter(([, v]) => v.trim().length > 0));
  return Object.keys(trimmed).length ? JSON.stringify(trimmed) : '';
}

function Text({ q, rec, patch }: { q: Question; rec: ParticipantRecord; patch: Patch }) {
  return (
    <input
      className={s.tfInput}
      value={String(rec[q.key] ?? '')}
      placeholder={q.placeholder ?? ' '}
      onChange={(e) => patch({ [q.key]: e.target.value } as Partial<ParticipantRecord>)}
    />
  );
}

function Area({ q, rec, patch }: { q: Question; rec: ParticipantRecord; patch: Patch }) {
  const value = String(rec[q.key] ?? '');
  return (
    <AutoFitTextarea
      className={s.tfArea}
      value={value}
      placeholder={q.placeholder ?? ' '}
      onChange={(e) => patch({ [q.key]: e.target.value } as Partial<ParticipantRecord>)}
    />
  );
}

function Choice({ q, rec, patch }: { q: Question; rec: ParticipantRecord; patch: Patch }) {
  const current = String(rec[q.key] ?? '');
  return (
    <div className={s.rfChecks}>
      {(q.options ?? []).map((o) => {
        const active = current === o.v;
        return (
          <label
            key={o.v}
            className={s.rfCheckRow}
            onClick={(e) => { e.preventDefault(); patch({ [q.key]: active ? '' : o.v } as Partial<ParticipantRecord>); }}
          >
            <input type="radio" name={String(q.key)} checked={active} readOnly />
            <span className={`${s.tfRadio} ${active ? s.tfRadioOn : ''}`} />
            <span className={s.rfCheckLabel}>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function Scale({ q, rec, patch }: { q: Question; rec: ParticipantRecord; patch: Patch }) {
  const value = rec[q.key] as number | null;
  return (
    <div className={s.rfChecks}>
      {(q.caps ?? []).map((cap, i) => {
        const n = i + 1;
        const active = value === n;
        const desc = q.descriptions?.[i];
        return (
          <label
            key={n}
            className={s.rfCheckRow}
            onClick={(e) => { e.preventDefault(); patch({ [q.key]: n } as Partial<ParticipantRecord>); }}
          >
            <input type="radio" name={String(q.key)} checked={active} readOnly />
            <span className={`${s.tfRadio} ${active ? s.tfRadioOn : ''}`} />
            <span className={s.rfCheckLabel}>
              <strong>{n} — {cap}</strong>
              {desc && <span className={s.tfChoiceDesc}>: {desc}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function DishRow({ option, active, value, tally, needMore, onToggle, onValueChange }: {
  option: DishOption;
  active: boolean;
  value: string;
  tally?: PotluckTally;
  needMore: boolean;
  onToggle: () => void;
  onValueChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prev = useRef(active);
  useEffect(() => {
    if (active && !prev.current) inputRef.current?.focus();
    prev.current = active;
  }, [active]);

  const collectsSpecifics = option.placeholder !== undefined;
  const soFar = soFarText(tally, collectsSpecifics);

  return (
    <label
      className={s.rfCheckRow}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text') return;
        e.preventDefault();
        onToggle();
      }}
    >
      <input type="checkbox" checked={active} readOnly />
      <span className={`${s.tfCheck} ${active ? s.tfCheckOn : ''}`} />
      <span className={s.rfDishMain}>
        <span className={s.tfDishLabelRow}>
          <span className={s.rfCheckLabel}>{option.label}</span>
          {needMore && <span className={s.tfDishNeed}>[Need more]</span>}
        </span>
        {soFar && <span className={s.tfDishSoFar}>{soFar}</span>}
        {active && option.placeholder !== undefined && (
          <input
            ref={inputRef}
            type="text"
            className={s.tfDishInput}
            value={value}
            placeholder={option.placeholder}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onValueChange(e.target.value)}
          />
        )}
      </span>
    </label>
  );
}

/**
 * "3 so far: wine, wine, etc" — the running count, then the named specifics with
 * "etc" for any left blank. Categories that don't collect a specific ("Fill gaps")
 * show the bare count ("1 so far"); a category with nobody yet shows nothing.
 */
function soFarText(tally: PotluckTally | undefined, collectsSpecifics: boolean): string {
  const count = tally?.count ?? 0;
  if (count === 0) return '';
  if (!collectsSpecifics) return `${count} so far`;
  const parts = [...(tally?.specifics ?? [])];
  if (tally?.hasUnspecified) parts.push('etc');
  return parts.length ? `${count} so far: ${parts.join(', ')}` : `${count} so far`;
}

function Dishes({ q, rec, patch }: { q: Question; rec: ParticipantRecord; patch: Patch }) {
  // Same anonymous "what's coming" roll-up as the intake form; fails quiet.
  const [tally, setTally] = useState<Record<string, PotluckTally>>({});
  useEffect(() => {
    let alive = true;
    getPotluckSummary()
      .then((rows) => { if (alive) setTally(tallyPotluck(rows)); })
      .catch(() => { /* no hints if the summary can't load */ });
    return () => { alive = false; };
  }, []);

  const cats = (rec.dish_category ?? '').split(',').filter(Boolean);
  const details = parseDishDetail(rec.dish_detail);
  const needMore = needMorePotluck(tally);
  return (
    <div className={s.rfChecks}>
      {(q.dishOptions ?? []).map((o) => {
        const active = cats.includes(o.v);
        const toggle = () => {
          const nextCats = active ? cats.filter((x) => x !== o.v) : [...cats, o.v];
          const nextDetails = { ...details };
          if (!active && nextDetails[o.v] == null) nextDetails[o.v] = '';
          if (active) delete nextDetails[o.v];
          patch({ dish_category: nextCats.join(','), dish_detail: serializeDishDetail(nextDetails) });
        };
        return (
          <DishRow
            key={o.v}
            option={o}
            active={active}
            value={details[o.v] ?? ''}
            tally={tally[o.v]}
            needMore={needMore.has(o.v)}
            onToggle={toggle}
            onValueChange={(v) => patch({ dish_detail: serializeDishDetail({ ...details, [o.v]: v }) })}
          />
        );
      })}
    </div>
  );
}

function renderInput(q: Question, rec: ParticipantRecord, patch: Patch) {
  switch (q.kind) {
    case 'text':   return <Text q={q} rec={rec} patch={patch} />;
    case 'area':   return <Area q={q} rec={rec} patch={patch} />;
    case 'choice': return <Choice q={q} rec={rec} patch={patch} />;
    case 'scale':  return <Scale q={q} rec={rec} patch={patch} />;
    case 'dishes': return <Dishes q={q} rec={rec} patch={patch} />;
  }
}

export default function RecordFields({ rec, patch }: { rec: ParticipantRecord; patch: Patch }) {
  const visible = INTAKE_QUESTIONS.filter((q) => !q.showIf || q.showIf(rec));
  return (
    <div className={s.rfList}>
      {visible.map((q) => (
        <div key={String(q.key) + q.kind} className={s.rfField}>
          <span className={s.rfLabel}>{q.label}</span>
          {renderInput(q, rec, patch)}
        </div>
      ))}
    </div>
  );
}
