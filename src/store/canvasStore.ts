import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  CharacterItem,
  Relationship,
  Guest,
  IntakeQuestion,
  StoryAct,
  TabId,
  ViewportState,
  IntakeFieldType,
} from '../types/canvas';
import type { CharacterFull, HostWorld, ParticipantFull } from '../lib/hostApi';
import { formatDishContribution } from '../lib/intakeSchema';
import type { SnapGuide } from '../utils/snapGuides';
import { seed } from './seed';

const STORAGE_KEY = 'murder-mystery-state';

const NODE_W = 220;
const NODE_H = 132;

const PALETTE = [
  '#c0392b', '#2980b9', '#27ae60', '#8e44ad',
  '#d35400', '#16a085', '#c2185b', '#7f8c8d',
];

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

function sourceNodeId(participantId: string): string {
  return `participant-${participantId}`;
}

function displayName(p: ParticipantFull): string {
  return p.preferred_name?.trim() || p.contact?.trim() || 'Unnamed guest';
}

function hasSubmittedIntake(p: ParticipantFull): boolean {
  return Boolean(
    p.roleplay_comfort != null ||
      p.reveal_dial != null ||
      p.dish_category ||
      p.dish_detail ||
      p.dietary ||
      p.trope_wishlist ||
      p.hard_limits ||
      p.surprise_fact ||
      p.public_bio ||
      p.notes,
  );
}

function roleFromParticipant(p: ParticipantFull): string {
  if (p.trope_wishlist?.trim()) return 'Wants: ' + p.trope_wishlist.trim();
  const comfort = p.roleplay_comfort;
  if (comfort != null) return `Role comfort ${comfort}/5`;
  return hasSubmittedIntake(p) ? 'Submitted source' : 'Invited guest';
}

function sourceDigest(p: ParticipantFull): string {
  const parts = [
    p.public_bio && `Public bio: ${p.public_bio}`,
    p.trope_wishlist && `Character wish: ${p.trope_wishlist}`,
    p.surprise_fact && `Truth hook: ${p.surprise_fact}`,
    p.notes && `Notes: ${p.notes}`,
  ].filter(Boolean);
  return parts.join('\n') || 'No planning notes submitted yet.';
}

function privateSourceNotes(p: ParticipantFull): string {
  const parts = [
    p.hard_limits && `Boundaries: ${p.hard_limits}`,
    p.dietary && `Dietary: ${p.dietary}`,
    p.host_notes && `Host notes: ${p.host_notes}`,
  ].filter(Boolean);
  return parts.join('\n');
}

function storyActsFromWorld(world: HostWorld): StoryAct[] {
  if (world.story_acts.length) {
    return world.story_acts.map((act) => ({
      id: act.id,
      title: act.title || `Act ${act.position + 1}`,
      notes: act.notes,
    }));
  }

  const submitted = world.participants.filter(hasSubmittedIntake);
  const cast = world.participants.filter((p) => p.character_id).length;
  const released = world.characters.filter((c) => c.released).length;
  const roleSignals = submitted
    .map((p) => {
      const name = displayName(p);
      const comfort = p.roleplay_comfort != null ? `comfort ${p.roleplay_comfort}/5` : null;
      const dial = p.reveal_dial != null ? `truth dial ${p.reveal_dial}/5` : null;
      return [name, comfort, dial].filter(Boolean).join(' - ');
    })
    .filter(Boolean)
    .join('\n');
  const wishes = submitted
    .map((p) => p.trope_wishlist?.trim())
    .filter(Boolean)
    .join('\n');
  const truthHooks = submitted
    .map((p) => p.surprise_fact?.trim())
    .filter(Boolean)
    .join('\n');
  const boundaries = submitted
    .map((p) => p.hard_limits?.trim())
    .filter(Boolean)
    .join('\n');

  return [
    {
      id: 'source-act-arrival',
      title: 'Act I - Arrivals',
      notes: roleSignals || 'Waiting for submitted role comfort and truth-dial signals.',
    },
    {
      id: 'source-act-casting',
      title: 'Act II - Casting Hooks',
      notes: wishes || 'Use submitted trope wishes here as character cards are drafted.',
    },
    {
      id: 'source-act-truth',
      title: 'Act III - Truth Hooks',
      notes: truthHooks || 'Use consented real-life hooks here once they are submitted.',
    },
    {
      id: 'source-act-release',
      title: 'Act IV - Release Plan',
      notes: [
        `${cast}/${world.participants.length} guests cast.`,
        `${released}/${world.characters.length} cards released.`,
        boundaries ? `Boundaries to respect:\n${boundaries}` : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ];
}

function premiseFromWorld(world: HostWorld): string {
  const submitted = world.participants.filter(hasSubmittedIntake).length;
  const title = world.settings?.party_title?.trim() || 'Murder mystery';
  const blurb = world.settings?.party_blurb?.trim();
  return [
    title,
    blurb,
    `${submitted}/${world.participants.length} guest entries submitted for planning.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function characterNodeFromSource({
  id,
  character,
  participant,
  index,
}: {
  id: string;
  character: CharacterFull | null;
  participant: ParticipantFull | null;
  index: number;
}): CharacterItem {
  const col = index % 4;
  const row = Math.floor(index / 4);
  const fallbackX = 180 + col * 300;
  const fallbackY = 180 + row * 190;
  const hasBackendPosition = Boolean(character && (character.x !== 0 || character.y !== 0));

  return {
    id,
    type: 'character',
    name: character?.name || (participant ? displayName(participant) : 'New Character'),
    role: character?.title || (participant ? roleFromParticipant(participant) : 'Unassigned role'),
    bio: character?.background || (participant ? sourceDigest(participant) : ''),
    secret: [character?.secret, participant ? privateSourceNotes(participant) : ''].filter(Boolean).join('\n\n'),
    color: character?.color || PALETTE[index % PALETTE.length],
    guestId: participant?.id ?? null,
    x: hasBackendPosition ? character!.x : fallbackX,
    y: hasBackendPosition ? character!.y : fallbackY,
    width: NODE_W,
    height: NODE_H,
    zIndex: index + 1,
  };
}

// ─── Persistence ──────────────────────────────────────────────────────

interface PersistedState {
  characters: Record<string, CharacterItem>;
  itemOrder: string[];
  relationships: Record<string, Relationship>;
  guests: Record<string, Guest>;
  guestOrder: string[];
  intake: Record<string, IntakeQuestion>;
  intakeOrder: string[];
  acts: StoryAct[];
  premise: string;
}

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {
    /* fall through to seed */
  }
  return seed();
}

// panToFocus animation handle, so we can cancel on re-entry.
let _panRaf: number | null = null;

// ─── Store ────────────────────────────────────────────────────────────

interface MysteryState extends PersistedState {
  // canvas engine
  viewport: ViewportState;
  draggingId: string | null;
  snapGuides: SnapGuide[];
  // stub kept so reused brain-canvas chrome (ThemePicker, ZoomSlider) compiles
  previewItemId: string | null;

  // ui
  activeTab: TabId;
  selectedId: string | null;
  /** When set, the next node click creates a relationship from this id. */
  connectingFrom: string | null;

  // engine actions
  setViewport: (v: Partial<ViewportState>) => void;
  panToFocus: (x: number, y: number, width: number, height: number) => void;
  moveItem: (id: string, x: number, y: number) => void;
  bringToFront: (id: string) => void;
  setDragging: (id: string | null) => void;
  setSnapGuides: (guides: SnapGuide[]) => void;
  closeOpenFolder: () => void; // repurposed: clear selection on background tap

  // ui actions
  setActiveTab: (tab: TabId) => void;
  select: (id: string | null) => void;
  startConnecting: (id: string) => void;
  cancelConnecting: () => void;

  // character actions
  addCharacter: (partial?: Partial<CharacterItem>) => string;
  updateCharacter: (id: string, patch: Partial<CharacterItem>) => void;
  deleteCharacter: (id: string) => void;

  // relationship actions
  addRelationship: (from: string, to: string, label?: string) => void;
  updateRelationship: (id: string, label: string) => void;
  deleteRelationship: (id: string) => void;

  // guest actions
  addGuest: (partial?: Partial<Guest>) => string;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  deleteGuest: (id: string) => void;

  // intake actions
  addIntakeQuestion: (type?: IntakeFieldType) => string;
  updateIntakeQuestion: (id: string, patch: Partial<IntakeQuestion>) => void;
  deleteIntakeQuestion: (id: string) => void;

  // story actions
  updateAct: (id: string, patch: Partial<StoryAct>) => void;
  updatePremise: (text: string) => void;

  // host source projection
  syncFromHostWorld: (world: HostWorld) => void;
}

function persist(s: MysteryState) {
  const data: PersistedState = {
    characters: s.characters,
    itemOrder: s.itemOrder,
    relationships: s.relationships,
    guests: s.guests,
    guestOrder: s.guestOrder,
    intake: s.intake,
    intakeOrder: s.intakeOrder,
    acts: s.acts,
    premise: s.premise,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

export const useCanvasStore = create<MysteryState>()(
  immer((set, get) => {
    const initial = load();

    return {
      ...initial,
      viewport: { panX: 0, panY: 0, zoom: 1 },
      draggingId: null,
      snapGuides: [],
      previewItemId: null,

      activeTab: 'guests',
      selectedId: null,
      connectingFrom: null,

      // ── engine ──────────────────────────────────────────────────────
      setViewport: (v) =>
        set((s) => {
          Object.assign(s.viewport, v);
        }),

      panToFocus: (x, y, width, height) => {
        if (_panRaf != null) {
          cancelAnimationFrame(_panRaf);
          _panRaf = null;
        }
        const zoom = get().viewport.zoom;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const targetPanX = -x * zoom + vw * 0.42 - (width * zoom) / 2;
        const targetPanY = -y * zoom + vh * 0.5 - (height * zoom) / 2;
        const startPanX = get().viewport.panX;
        const startPanY = get().viewport.panY;
        const startTime = performance.now();
        const duration = 400;
        const ease = (t: number) =>
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const animate = () => {
          const elapsed = performance.now() - startTime;
          const t = Math.min(elapsed / duration, 1);
          const e = ease(t);
          set((s) => {
            s.viewport.panX = startPanX + (targetPanX - startPanX) * e;
            s.viewport.panY = startPanY + (targetPanY - startPanY) * e;
          });
          if (t < 1) _panRaf = requestAnimationFrame(animate);
          else _panRaf = null;
        };
        _panRaf = requestAnimationFrame(animate);
      },

      moveItem: (id, x, y) => {
        set((s) => {
          const c = s.characters[id];
          if (!c) return;
          c.x = x;
          c.y = y;
        });
        persist(get());
      },

      bringToFront: (id) =>
        set((s) => {
          s.itemOrder = s.itemOrder.filter((oid) => oid !== id);
          s.itemOrder.push(id);
          if (s.characters[id]) s.characters[id].zIndex = s.itemOrder.length;
        }),

      setDragging: (id) =>
        set((s) => {
          s.draggingId = id;
          if (!id) s.snapGuides = [];
        }),

      setSnapGuides: (guides) =>
        set((s) => {
          s.snapGuides = guides;
        }),

      closeOpenFolder: () =>
        set((s) => {
          s.selectedId = null;
          s.connectingFrom = null;
        }),

      // ── ui ──────────────────────────────────────────────────────────
      setActiveTab: (tab) => set((s) => { s.activeTab = tab; }),
      select: (id) => set((s) => { s.selectedId = id; }),
      startConnecting: (id) => set((s) => { s.connectingFrom = id; }),
      cancelConnecting: () => set((s) => { s.connectingFrom = null; }),

      // ── characters ──────────────────────────────────────────────────
      addCharacter: (partial = {}) => {
        const id = uid();
        set((s) => {
          const n = Object.keys(s.characters).length;
          const color = PALETTE[n % PALETTE.length];
          const vp = s.viewport;
          // drop it roughly in the middle of the current viewport
          const cx = (window.innerWidth / 2 - vp.panX) / vp.zoom - NODE_W / 2;
          const cy = (window.innerHeight / 2 - vp.panY) / vp.zoom - NODE_H / 2;
          const char: CharacterItem = {
            id,
            type: 'character',
            name: 'New Character',
            role: '',
            bio: '',
            secret: '',
            color,
            guestId: null,
            x: cx + (n % 3) * 24,
            y: cy + (n % 3) * 24,
            width: NODE_W,
            height: NODE_H,
            zIndex: s.itemOrder.length + 1,
            ...partial,
          };
          s.characters[id] = char;
          s.itemOrder.push(id);
          s.selectedId = id;
        });
        persist(get());
        return id;
      },

      updateCharacter: (id, patch) => {
        set((s) => {
          const c = s.characters[id];
          if (!c) return;
          Object.assign(c, patch);
        });
        persist(get());
      },

      deleteCharacter: (id) => {
        set((s) => {
          delete s.characters[id];
          s.itemOrder = s.itemOrder.filter((oid) => oid !== id);
          // drop edges touching this node
          for (const rid of Object.keys(s.relationships)) {
            const r = s.relationships[rid];
            if (r.from === id || r.to === id) delete s.relationships[rid];
          }
          // unassign guests cast as this character
          for (const g of Object.values(s.guests)) {
            if (g.characterId === id) g.characterId = null;
          }
          if (s.selectedId === id) s.selectedId = null;
          if (s.connectingFrom === id) s.connectingFrom = null;
        });
        persist(get());
      },

      // ── relationships ───────────────────────────────────────────────
      addRelationship: (from, to, label = '') => {
        if (from === to) return;
        set((s) => {
          // avoid duplicate undirected pair
          const exists = Object.values(s.relationships).some(
            (r) =>
              (r.from === from && r.to === to) ||
              (r.from === to && r.to === from),
          );
          if (exists) return;
          const id = uid();
          s.relationships[id] = { id, from, to, label };
          s.connectingFrom = null;
        });
        persist(get());
      },

      updateRelationship: (id, label) => {
        set((s) => {
          if (s.relationships[id]) s.relationships[id].label = label;
        });
        persist(get());
      },

      deleteRelationship: (id) => {
        set((s) => {
          delete s.relationships[id];
        });
        persist(get());
      },

      // ── guests ──────────────────────────────────────────────────────
      addGuest: (partial = {}) => {
        const id = uid();
        set((s) => {
          s.guests[id] = {
            id,
            name: '',
            dish: '',
            characterId: null,
            rsvp: 'invited',
            ...partial,
          };
          s.guestOrder.push(id);
        });
        persist(get());
        return id;
      },

      updateGuest: (id, patch) => {
        set((s) => {
          const g = s.guests[id];
          if (!g) return;
          Object.assign(g, patch);
          // keep character.guestId in sync when casting changes
          if ('characterId' in patch) {
            for (const c of Object.values(s.characters)) {
              if (c.guestId === id) c.guestId = null;
            }
            if (patch.characterId && s.characters[patch.characterId]) {
              s.characters[patch.characterId].guestId = id;
            }
          }
        });
        persist(get());
      },

      deleteGuest: (id) => {
        set((s) => {
          delete s.guests[id];
          s.guestOrder = s.guestOrder.filter((gid) => gid !== id);
          for (const c of Object.values(s.characters)) {
            if (c.guestId === id) c.guestId = null;
          }
        });
        persist(get());
      },

      // ── intake ──────────────────────────────────────────────────────
      addIntakeQuestion: (type = 'short-text') => {
        const id = uid();
        set((s) => {
          s.intake[id] = { id, label: '', type, options: [], intent: '' };
          s.intakeOrder.push(id);
        });
        persist(get());
        return id;
      },

      updateIntakeQuestion: (id, patch) => {
        set((s) => {
          const q = s.intake[id];
          if (!q) return;
          Object.assign(q, patch);
        });
        persist(get());
      },

      deleteIntakeQuestion: (id) => {
        set((s) => {
          delete s.intake[id];
          s.intakeOrder = s.intakeOrder.filter((qid) => qid !== id);
        });
        persist(get());
      },

      // ── story ───────────────────────────────────────────────────────
      updateAct: (id, patch) => {
        set((s) => {
          const a = s.acts.find((act) => act.id === id);
          if (a) Object.assign(a, patch);
        });
        persist(get());
      },

      updatePremise: (text) => {
        set((s) => {
          s.premise = text;
        });
        persist(get());
      },

      syncFromHostWorld: (world) => {
        set((s) => {
          const participantsByCharacter = new Map(
            world.participants
              .filter((p) => p.character_id)
              .map((p) => [p.character_id as string, p]),
          );
          const usedIds = new Set<string>();
          const nextCharacters: Record<string, CharacterItem> = {};
          const nextGuests: Record<string, Guest> = {};
          const nextGuestOrder: string[] = [];
          let index = 0;

          for (const p of world.participants) {
            nextGuests[p.id] = {
              id: p.id,
              name: displayName(p),
              dish: formatDishContribution(p),
              characterId: p.character_id,
              rsvp: p.rsvp === 'yes' || p.rsvp === 'no' || p.rsvp === 'maybe' ? p.rsvp : 'maybe',
            };
            nextGuestOrder.push(p.id);
          }

          for (const character of world.characters) {
            const participant = participantsByCharacter.get(character.id) ?? null;
            const id = character.id;
            usedIds.add(id);
            nextCharacters[id] = characterNodeFromSource({
              id,
              character,
              participant,
              index,
            });
            index += 1;
          }

          for (const participant of world.participants) {
            if (participant.character_id) continue;
            const id = sourceNodeId(participant.id);
            usedIds.add(id);
            nextCharacters[id] = characterNodeFromSource({
              id,
              character: null,
              participant,
              index,
            });
            index += 1;
          }

          const nextRelationships: Record<string, Relationship> = {};
          for (const r of world.relationships) {
            if (!usedIds.has(r.from_char) || !usedIds.has(r.to_char)) continue;
            nextRelationships[r.id] = {
              id: r.id,
              from: r.from_char,
              to: r.to_char,
              label: r.label,
            };
          }

          s.characters = nextCharacters;
          s.itemOrder = Object.keys(nextCharacters);
          s.relationships = nextRelationships;
          s.guests = nextGuests;
          s.guestOrder = nextGuestOrder;
          s.acts = storyActsFromWorld(world);
          s.premise = premiseFromWorld(world);
          if (s.selectedId && !nextCharacters[s.selectedId]) s.selectedId = null;
          if (s.connectingFrom && !nextCharacters[s.connectingFrom]) s.connectingFrom = null;
        });
        persist(get());
      },
    };
  }),
);
