import type {
  CharacterItem,
  Relationship,
  Guest,
  IntakeQuestion,
  StoryAct,
} from '../types/canvas';

/**
 * First-run sample content so the canvas, guest list, and intake form all
 * have something to look at. Wiped the moment the host edits anything (we
 * persist the whole state over this).
 */
export function seed(): {
  characters: Record<string, CharacterItem>;
  itemOrder: string[];
  relationships: Record<string, Relationship>;
  guests: Record<string, Guest>;
  guestOrder: string[];
  intake: Record<string, IntakeQuestion>;
  intakeOrder: string[];
  acts: StoryAct[];
  premise: string;
} {
  const NODE_W = 220;
  const NODE_H = 132;

  const chars: CharacterItem[] = [
    {
      id: 'c-heiress', type: 'character', name: 'Vivian Thorne', role: 'The Heiress',
      bio: 'Inherited the estate last spring. Gracious host, sharper than she lets on.',
      secret: 'Knows the will was forged. Stands to lose everything if it surfaces.',
      color: '#c0392b', guestId: 'g-1',
      x: 520, y: 200, width: NODE_W, height: NODE_H, zIndex: 1,
    },
    {
      id: 'c-butler', type: 'character', name: 'Mr. Ashby', role: 'The Butler',
      bio: 'Forty years in service to the Thorne family. Sees everything, says little.',
      secret: 'Is Vivian’s real father. Has the original will hidden in the cellar.',
      color: '#2980b9', guestId: 'g-2',
      x: 220, y: 420, width: NODE_W, height: NODE_H, zIndex: 2,
    },
    {
      id: 'c-doctor', type: 'character', name: 'Dr. Sloane', role: 'The Physician',
      bio: 'Old family friend. Signed the late patriarch’s death certificate.',
      secret: 'Was paid to ignore the poisoning. Now being blackmailed.',
      color: '#27ae60', guestId: null,
      x: 840, y: 420, width: NODE_W, height: NODE_H, zIndex: 3,
    },
    {
      id: 'c-rival', type: 'character', name: 'Marcus Vale', role: 'The Rival',
      bio: 'Business partner of the deceased. Charming, deeply in debt.',
      secret: 'The victim — found in the study before the reading of the will.',
      color: '#8e44ad', guestId: null,
      x: 560, y: 620, width: NODE_W, height: NODE_H, zIndex: 4,
    },
  ];

  const rels: Relationship[] = [
    { id: 'r-1', from: 'c-butler', to: 'c-heiress', label: 'secretly her father' },
    { id: 'r-2', from: 'c-doctor', to: 'c-rival', label: 'being blackmailed by' },
    { id: 'r-3', from: 'c-rival', to: 'c-heiress', label: 'owed a fortune' },
    { id: 'r-4', from: 'c-heiress', to: 'c-doctor', label: 'childhood friends' },
  ];

  const guestList: Guest[] = [
    { id: 'g-1', name: 'Priya', dish: 'Saffron rice', characterId: 'c-heiress', rsvp: 'yes' },
    { id: 'g-2', name: 'Dev', dish: 'Smoked brisket', characterId: 'c-butler', rsvp: 'yes' },
    { id: 'g-3', name: 'Sam', dish: 'Lemon tart', characterId: null, rsvp: 'maybe' },
  ];

  const questions: IntakeQuestion[] = [
    {
      id: 'q-1', label: 'How much do you want to ham it up?',
      type: 'single-select', options: ['Wallflower', 'Some lines', 'Give me a monologue'],
      intent: 'Maps to how central a character + how many secrets I hand them.',
    },
    {
      id: 'q-2', label: 'Any accents / costumes you’re excited to do?',
      type: 'long-text', options: [],
      intent: 'Casting flavor — match characters to what people want to wear.',
    },
    {
      id: 'q-3', label: 'What are you bringing to the potluck?',
      type: 'short-text', options: [],
      intent: 'Feeds the public guest list.',
    },
  ];

  const acts: StoryAct[] = [
    { id: 'act-1', title: 'Act I — Arrival', notes: 'Guests arrive, characters introduced, the will is to be read tonight. Plant relationships.' },
    { id: 'act-2', title: 'Act II — The Body', notes: 'Marcus Vale found dead in the study. First round of alibis. Lights go out.' },
    { id: 'act-3', title: 'Act III — Secrets Surface', notes: 'The forged will, the blackmail, the hidden parentage all leak out in clues.' },
    { id: 'act-4', title: 'Act IV — The Reveal', notes: 'Accusations, the real motive, who did it and why. Final vote.' },
  ];

  return {
    characters: Object.fromEntries(chars.map((c) => [c.id, c])),
    itemOrder: chars.map((c) => c.id),
    relationships: Object.fromEntries(rels.map((r) => [r.id, r])),
    guests: Object.fromEntries(guestList.map((g) => [g.id, g])),
    guestOrder: guestList.map((g) => g.id),
    intake: Object.fromEntries(questions.map((q) => [q.id, q])),
    intakeOrder: questions.map((q) => q.id),
    acts,
    premise:
      'A potluck dinner to read the late patriarch’s will. Before the reading, the rival is dead. Everyone has a secret; one of them is a killer.',
  };
}
