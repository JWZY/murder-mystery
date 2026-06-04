import type { ParticipantRecord } from '../types/participant';
import s from './participant.module.css';

type Patch = (p: Partial<ParticipantRecord>) => void;

/** Small typed field primitives ------------------------------------------ */
function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <label className={s.field}>
      <span className={s.label}>
        {label}
        {sub && <div className={s.sub}>{sub}</div>}
      </span>
      {children}
    </label>
  );
}

function Text({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={s.input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

function Area({ value, onChange, placeholder, rows }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className={s.textarea} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

function Scale({ value, onChange, caps }: { value: number | null; onChange: (v: number) => void; caps: string[] }) {
  return (
    <div className={s.segments}>
      {caps.map((cap, i) => {
        const n = i + 1;
        return (
          <button type="button" key={n}
            className={`${s.segment} ${value === n ? s.segmentOn : ''}`}
            onClick={() => onChange(n)}>
            <span className={s.segmentNum}>{n}</span>
            <span className={s.segmentCap}>{cap}</span>
          </button>
        );
      })}
    </div>
  );
}

function Choice<T extends string>({ value, onChange, options }: { value: T | null; onChange: (v: T) => void; options: { v: T; label: string }[] }) {
  return (
    <div className={s.segments}>
      {options.map((o) => (
        <button type="button" key={o.v}
          className={`${s.segment} ${value === o.v ? s.segmentOn : ''}`}
          onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The full intake/edit field set. ---------------------------------------- */
export default function RecordFields({ rec, patch }: { rec: ParticipantRecord; patch: Patch }) {
  return (
    <>
      {/* ── Part A: the basics ── */}
      <div className={s.section}>
        <div className={s.sectionTitle}>The basics</div>
        <div className={s.sectionHint}>
          So I can reach you and balance the potluck. Quick stuff.
        </div>

        <Field label="Your preferred name">
          <Text value={rec.preferred_name} onChange={(v) => patch({ preferred_name: v })} placeholder="What you go by" />
        </Field>
        <Field label="Best way to reach you" sub="Texts/DMs about the party — host eyes only.">
          <Text value={rec.contact} onChange={(v) => patch({ contact: v })} placeholder="Phone, IG, Discord, email…" />
        </Field>

        <Field label="Are you coming?">
          <Choice value={rec.rsvp} onChange={(v) => patch({ rsvp: v })}
            options={[{ v: 'yes', label: 'Yes!' }, { v: 'maybe', label: 'Maybe' }, { v: 'no', label: 'Can’t' }]} />
        </Field>

        <Field label="Bringing to the potluck?">
          <Choice value={rec.dish_category} onChange={(v) => patch({ dish_category: v })}
            options={[
              { v: 'appetizer', label: 'Appetizer' }, { v: 'main', label: 'Main' },
              { v: 'side', label: 'Side' }, { v: 'dessert', label: 'Dessert' }, { v: 'drink', label: 'Drinks' },
            ]} />
        </Field>
        <Field label="…anything specific in mind?">
          <Text value={rec.dish_detail} onChange={(v) => patch({ dish_detail: v })} placeholder="e.g. cranberry brie bites — or TBD" />
        </Field>
        <Field label="Dietary constraints / allergies">
          <Text value={rec.dietary} onChange={(v) => patch({ dietary: v })} placeholder="Veg, vegan, allergies, none…" />
        </Field>
      </div>

      {/* ── Part A: casting signal ── */}
      <div className={s.section}>
        <div className={s.sectionTitle}>How you want to play</div>
        <div className={s.sectionHint}>
          This is a costumed, character-driven murder mystery. No experience needed — I’ll cast you to your comfort.
        </div>

        <Field label="How big a role do you want?" sub="Be honest — a great Extra beats a miserable Lead.">
          <Scale value={rec.roleplay_comfort} onChange={(v) => patch({ roleplay_comfort: v })}
            caps={['Extra', 'Cameo', 'Recurring', 'Supporting', 'Lead']} />
        </Field>

        <Field label="Any character types you’d love (or hate) to play?" sub="e.g. detective, washed-up rockstar, con artist, sweet grandma…">
          <Area value={rec.trope_wishlist} onChange={(v) => patch({ trope_wishlist: v })} rows={2} placeholder="Dream roles, or 'anything but the lead'…" />
        </Field>

        <Field label="Could you be the murderer?" sub="Needs someone who won’t crack under questioning / likes social-deception games.">
          <Choice value={rec.murderer_appetite} onChange={(v) => patch({ murderer_appetite: v })}
            options={[{ v: 'very', label: 'Very into it' }, { v: 'maybe', label: 'Could try' }, { v: 'no', label: 'Please no' }]} />
        </Field>
      </div>

      {/* ── Part B: the truth harvest ── */}
      <div className={s.section}>
        <div className={s.sectionTitle}>The real you (the secret sauce)</div>
        <div className={s.sectionHint}>
          Last time, people felt they got to know the <em>characters</em> but not each
          other. So this year your character is built partly from <strong>real things about you.</strong>{' '}
          Answer what you’re comfortable with — the dial at the bottom controls how much of this
          actually shows up. There are no wrong answers and the funny/awkward ones are the best.
        </div>

        <Field label="Something people are surprised to learn about you">
          <Area value={rec.surprise_fact} onChange={(v) => patch({ surprise_fact: v })} rows={2} placeholder="A hidden talent, an odd fact, a wild past…" />
        </Field>
        <Field label="The worst (or most chaotic) job you’ve ever had">
          <Area value={rec.worst_job} onChange={(v) => patch({ worst_job: v })} rows={2} placeholder="We love a horror story." />
        </Field>
        <Field label="A hobby or obsession you could talk about for an hour">
          <Area value={rec.hobby} onChange={(v) => patch({ hobby: v })} rows={2} placeholder="The thing you won’t shut up about." />
        </Field>
        <Field label="An opinion you used to hold that has since changed">
          <Area value={rec.changed_opinion} onChange={(v) => patch({ changed_opinion: v })} rows={2} placeholder="What you believed, and what flipped it." />
        </Field>
        <Field label="A small, harmless ‘secret’ you’d be fine getting outed in-character" sub="Nothing heavy — think 'I’ve never seen Star Wars', not real confessions.">
          <Area value={rec.outable_secret} onChange={(v) => patch({ outable_secret: v })} rows={2} placeholder="A silly, low-stakes secret." />
        </Field>
        <Field label="A skill you could believably fake on the spot" sub="Accent, palm-reading, sportscaster commentary, a magic trick…">
          <Text value={rec.fakeable_skill} onChange={(v) => patch({ fakeable_skill: v })} placeholder="Your party trick." />
        </Field>

        <Field label="Who here do you already know well?" sub="Helps me avoid casting you with only your bestie.">
          <Text value={rec.social_known} onChange={(v) => patch({ social_known: v })} placeholder="Names, if any" />
        </Field>
        <Field label="Anyone you’d like to get to know better?" sub="I’ll try to entangle your storylines. Totally optional.">
          <Text value={rec.social_want} onChange={(v) => patch({ social_want: v })} placeholder="Names, or 'surprise me'" />
        </Field>

        <Field label="How much should tonight reveal the real you?" sub="Your consent dial. 1 = pure fiction, a mask. 5 = basically me in a wig.">
          <Scale value={rec.reveal_dial} onChange={(v) => patch({ reveal_dial: v })}
            caps={['Mask', 'Mostly', 'Mix', 'Open', 'Wig']} />
        </Field>
      </div>

      {/* ── Public bio + safety ── */}
      <div className={s.section}>
        <div className={s.sectionTitle}>Two last things</div>
        <Field label="A one-liner other guests can see" sub="The ONLY thing others see before the party. Be intriguing, stay in your real voice.">
          <Text value={rec.public_bio} onChange={(v) => patch({ public_bio: v })} placeholder="e.g. 'Will out-argue you about pizza toppings.'" />
        </Field>
        <Field label="Any hard limits / topics to keep out of your character?" sub="Private. I will never weaponize anything real that you flag here.">
          <Area value={rec.hard_limits} onChange={(v) => patch({ hard_limits: v })} rows={2} placeholder="Anything off-limits for your storyline." />
        </Field>
      </div>
    </>
  );
}
