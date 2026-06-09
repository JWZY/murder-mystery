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
    };
  }),
);
