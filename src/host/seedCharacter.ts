import type { ParticipantFull, CharacterFull, TruthTag } from '../lib/hostApi';

// ════════════════════════════════════════════════════════════════════════
//  Two-layer character seeding
// ════════════════════════════════════════════════════════════════════════
//  The headline mechanic: a fictional reunion-gala persona grown from a real
//  person's intake answers, with how much truth shows through GATED by their
//  own consent dial (reveal_dial 1–5: "Mask" → "Wig").
//
//  This produces a DRAFT the host then edits — it is intentionally a strong
//  first pass, not a finished card. It never touches `hard_limits` (topics the
//  guest said to never weaponize) and only surfaces `outable_secret` at dial 5.
// ════════════════════════════════════════════════════════════════════════

const PALETTE = [
  '#c0392b', '#8e44ad', '#2980b9', '#16a085', '#d35400',
  '#27ae60', '#c2185b', '#00838f', '#5e35b1', '#ef6c00',
];

/** A fact is "open" (woven into the player-visible card) only at/above its dial. */
interface Source {
  label: string;
  value: string | null | undefined;
  minDial: number; // reveal_dial needed before this shows to the player
  beat: 'background' | 'act1' | 'act2' | 'act3';
}

function sources(p: ParticipantFull): Source[] {
  return [
    { label: 'hobby', value: p.hobby, minDial: 2, beat: 'background' },
    { label: 'known for', value: p.social_known, minDial: 2, beat: 'act1' },
    { label: 'wants to be seen as', value: p.social_want, minDial: 3, beat: 'act1' },
    { label: 'can convincingly fake', value: p.fakeable_skill, minDial: 3, beat: 'act2' },
    { label: 'a surprising fact', value: p.surprise_fact, minDial: 3, beat: 'background' },
    { label: 'their worst job', value: p.worst_job, minDial: 3, beat: 'background' },
    { label: 'an opinion they changed', value: p.changed_opinion, minDial: 4, beat: 'act2' },
    { label: 'something they could be outed on', value: p.outable_secret, minDial: 5, beat: 'act3' },
  ];
}

function dialName(d: number): string {
  return ['', 'Mask', 'Veil', 'Half-mask', 'Open face', 'Wig'][d] ?? 'Veil';
}

/** Build a strong first-draft character card from a participant + the theme. */
export function seedCharacter(p: ParticipantFull, index = 0): Partial<CharacterFull> {
  const dial = p.reveal_dial ?? 2;
  const all = sources(p);
  const open = all.filter((s) => s.value && dial >= s.minDial);
  const held = all.filter((s) => s.value && dial < s.minDial); // host-only, kept back

  const name = p.preferred_name || 'New Guest';
  const archetype = pickArchetype(p);

  // Player-visible background weaves the OPEN truths into the gala fiction.
  const woven = open
    .filter((s) => s.beat === 'background')
    .map((s) => `Word at the reunion is they're ${truthClause(s)}.`)
    .join(' ');
  const background =
    `${name} arrives at the reunion gala as ${archetype}. ` +
    (woven ? woven + ' ' : '') +
    `They haven't been back in years, and everyone has a theory about why.`;

  const truth_tags: TruthTag[] = open.map((s) => ({ beat: s.beat, truth: `${s.label}: ${s.value}` }));

  // Host-only motive seeded from what they held back.
  const motiveBits = held.map((s) => `${s.label}: ${s.value}`);
  const secret =
    (motiveBits.length ? `Held-back hooks you can use privately: ${motiveBits.join('; ')}. ` : '') +
    `Seed a motive that lets them plausibly be involved without deciding the murderer from intake answers.`;

  return {
    name,
    title: archetype,
    background,
    act1:
      `ARRIVAL (late afternoon, front rooms). Reconnect with two people. ` +
      meetLine(p) +
      ` Drop one true-feeling detail about your past here.`,
    act2:
      `THE TURN (basement — the cool room — after dark). A secret surfaces. ` +
      (open.some((s) => s.beat === 'act2')
        ? `Lean on what you're known for; let the cracks show.`
        : `You learn something that complicates an old friendship.`),
    act3:
      `RECKONING (backyard / finale). ` +
      (dial >= 5
        ? `You may choose to reveal the real thing behind the rumor.`
        : `Decide how much of the truth you let out before the night ends.`),
    props: [p.hobby && `something tied to "${p.hobby}"`, p.fakeable_skill && `a prop to fake "${p.fakeable_skill}"`]
      .filter(Boolean)
      .join('; '),
    recommended_meets: [p.social_want && `Wants to meet: ${p.social_want}`, p.social_known && `Already knows: ${p.social_known}`]
      .filter(Boolean)
      .join(' · '),
    secret,
    truth_tags,
    color: PALETTE[index % PALETTE.length],
    released: false,
  };
}

function truthClause(s: Source): string {
  // Make the label read naturally inside the gala rumor mill.
  switch (s.label) {
    case 'hobby':
      return `quietly obsessed with ${s.value}`;
    case 'their worst job':
      return `still scarred from ${s.value}`;
    case 'a surprising fact':
      return `the one who ${s.value}`;
    default:
      return `${s.label} — ${s.value}`;
  }
}

function meetLine(p: ParticipantFull): string {
  if (p.social_want) return `Find the person who is "${p.social_want}".`;
  return `Find someone you've never really talked to.`;
}

/** A loose reunion-gala archetype from casting signals. Host can overwrite. */
function pickArchetype(p: ParticipantFull): string {
  const comfort = p.roleplay_comfort ?? 3;
  const wantsBig = comfort >= 4;
  const wantsSmall = comfort <= 2;
  if (wantsBig) return 'the one everyone expected to make it big';
  if (wantsSmall) return 'the quiet one who saw everything';
  return 'the one who never quite left town';
}
