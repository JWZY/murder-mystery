import { useEffect, useRef } from 'react';
import type { ParticipantRecord } from '../types/participant';
import { INTAKE_QUESTIONS, type DishOption, type Question } from '../lib/intakeSchema';
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

function DishRow({ option, active, value, onToggle, onValueChange }: {
  option: DishOption;
  active: boolean;
  value: string;
  onToggle: () => void;
  onValueChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prev = useRef(active);
  useEffect(() => {
    if (active && !prev.current) inputRef.current?.focus();
    prev.current = active;
  }, [active]);
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
        <span className={s.rfCheckLabel}>{option.label}</span>
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

function Dishes({ q, rec, patch }: { q: Question; rec: ParticipantRecord; patch: Patch }) {
  const cats = (rec.dish_category ?? '').split(',').filter(Boolean);
  const details = parseDishDetail(rec.dish_detail);
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
