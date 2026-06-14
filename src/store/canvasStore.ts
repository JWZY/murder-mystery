import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CharacterItem, Relationship, TabId, ViewportState } from '../types/canvas';
import {
  hostBootstrap,
  hostDeleteCharacter,
  hostDeleteRelationship,
  hostSaveCharacter,
  hostSaveRelationship,
  type HostWorld,
} from '../lib/hostApi';

const STORAGE_KEY = 'murder-mystery-state';

// Sticky notes are a fixed width and grow downward to fit their content.
// NODE_H is only a seed/fallback; CharacterNode reports its real measured
// height back into the store so edges can anchor to the rendered card.
const NODE_W = 240;
const NODE_H = 96;

/** How long after the last edit/drag we flush a node or edge to Supabase. */
const WRITE_DEBOUNCE_MS = 650;

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

// ─── Supabase write-back ──────────────────────────────────────────────
//
// The canvas is an optimistic cache over the same `characters`/`relationships`
// rows the Casting editor edits. Every mutation updates local state instantly,
// then coalesces a patch and flushes it to Supabase after a short debounce.
// On any RPC failure we re-bootstrap so the backend stays the source of truth.

let hostSecret = '';

const charTimers = new Map<string, number>();
const charPending = new Map<string, Record<string, unknown>>();
const relTimers = new Map<string, number>();
const relPending = new Map<string, Record<string, unknown>>();

async function reconcile() {
  if (!hostSecret) return;
  try {
    const world = await hostBootstrap(hostSecret);
    useCanvasStore.getState().syncFromHostWorld(world);
  } catch {
    /* offline / transient — keep the optimistic state until the next sync */
  }
}

// Every fire-and-forget write routes its result through these so a failure is
// visible (a cue in the corner) instead of silently swallowed, and clears the
// moment any later write succeeds.
function onWriteOk() {
  useCanvasStore.getState().reportSaveError(false);
}
function onWriteErr() {
  useCanvasStore.getState().reportSaveError(true);
  reconcile();
}

/**
 * Flush every queued (debounced) character/edge write immediately. Called when
 * the canvas unmounts or the page is hidden, so an edit still inside the
 * debounce window isn't lost on a tab switch, refresh, or close.
 */
function flushAllPending() {
  for (const id of [...charPending.keys()]) flushChar(id);
  for (const id of [...relPending.keys()]) flushRel(id);
}

function flushChar(id: string) {
  const patch = charPending.get(id);
  charPending.delete(id);
  const t = charTimers.get(id);
  if (t) { clearTimeout(t); charTimers.delete(id); }
  if (!patch || !hostSecret) return;
  hostSaveCharacter(hostSecret, { id, ...patch }).then(onWriteOk, onWriteErr);
}

function queueChar(id: string, patch: Record<string, unknown>) {
  charPending.set(id, { ...(charPending.get(id) ?? {}), ...patch });
  const t = charTimers.get(id);
  if (t) clearTimeout(t);
  charTimers.set(id, window.setTimeout(() => flushChar(id), WRITE_DEBOUNCE_MS));
}

function dropChar(id: string) {
  charPending.delete(id);
  const t = charTimers.get(id);
  if (t) { clearTimeout(t); charTimers.delete(id); }
}

function flushRel(id: string) {
  const patch = relPending.get(id);
  relPending.delete(id);
  const t = relTimers.get(id);
  if (t) { clearTimeout(t); relTimers.delete(id); }
  if (!patch || !hostSecret) return;
  hostSaveRelationship(hostSecret, { id, ...(patch as { from_char: string; to_char: string; label?: string }) }).then(onWriteOk, onWriteErr);
}

function queueRel(id: string, patch: Record<string, unknown>) {
  relPending.set(id, { ...(relPending.get(id) ?? {}), ...patch });
  const t = relTimers.get(id);
  if (t) clearTimeout(t);
  relTimers.set(id, window.setTimeout(() => flushRel(id), WRITE_DEBOUNCE_MS));
}

/** Map a canvas-node patch onto the `characters` column names. */
function characterPayload(patch: Partial<CharacterItem>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('name' in patch) out.name = patch.name;
  // The free-text card body is host-only scratch → `juice`, never `title`.
  if ('notes' in patch) out.juice = patch.notes;
  if ('x' in patch) out.x = patch.x;
  if ('y' in patch) out.y = patch.y;
  return out;
}

// ─── Projection from the host world ───────────────────────────────────

function projectWorld(world: HostWorld): Pick<PersistedState, 'characters' | 'itemOrder' | 'relationships'> {
  // character id → the participant cast to play them (id + display name).
  const castByCharacter = new Map<string, { id: string; name: string; comfort: number | null }>();
  for (const p of world.participants) {
    if (p.character_id) {
      castByCharacter.set(p.character_id, { id: p.id, name: (p.preferred_name || '').trim(), comfort: p.roleplay_comfort });
    }
  }
  const characters: Record<string, CharacterItem> = {};
  const itemOrder: string[] = [];

  world.characters.forEach((c, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const hasPosition = c.x !== 0 || c.y !== 0;
    const cast = castByCharacter.get(c.id);
    characters[c.id] = {
      id: c.id,
      type: 'character',
      name: c.name || 'New character',
      // Read juice, but fall back to the old title so existing concepts still
      // show; edits only ever write back to juice (see characterPayload).
      notes: c.juice || c.title || '',
      castName: cast ? cast.name || '(unnamed guest)' : null,
      castComfort: cast?.comfort ?? null,
      guestId: cast?.id ?? null,
      x: hasPosition ? c.x : 160 + col * 280,
      y: hasPosition ? c.y : 160 + row * 200,
      width: NODE_W,
      height: NODE_H,
      zIndex: index + 1,
    };
    itemOrder.push(c.id);
  });

  const relationships: Record<string, Relationship> = {};
  for (const r of world.relationships) {
    if (!characters[r.from_char] || !characters[r.to_char]) continue;
    relationships[r.id] = { id: r.id, from: r.from_char, to: r.to_char, label: r.label };
  }

  return { characters, itemOrder, relationships };
}

// ─── Persistence (a self-healing cache; Supabase is the truth) ─────────

interface PersistedState {
  characters: Record<string, CharacterItem>;
  itemOrder: string[];
  relationships: Record<string, Relationship>;
}

function emptyState(): PersistedState {
  return { characters: {}, itemOrder: [], relationships: {} };
}

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      return {
        characters: parsed.characters ?? {},
        itemOrder: parsed.itemOrder ?? [],
        relationships: parsed.relationships ?? {},
      };
    }
  } catch {
    /* fall through to empty */
  }
  return emptyState();
}

// panToFocus animation handle, so we can cancel on re-entry.
let _panRaf: number | null = null;

// ─── Store ────────────────────────────────────────────────────────────

interface MysteryState extends PersistedState {
  // canvas engine
  viewport: ViewportState;
  draggingId: string | null;

  // ui
  activeTab: TabId;
  selectedId: string | null;
  /** A selected relationship edge (for highlight + keyboard delete). */
  selectedEdgeId: string | null;
  /** True when the most recent Supabase write failed; clears on the next OK. */
  saveError: boolean;
  /**
   * An in-progress FigJam-style connection drag: started from a card edge
   * handle (`from`), with a live endpoint (`x`/`y`, canvas coords) tracking the
   * cursor. Dropping over another card creates the relationship.
   */
  connect: { from: string; x: number; y: number } | null;

  // engine actions
  setViewport: (v: Partial<ViewportState>) => void;
  panToFocus: (x: number, y: number, width: number, height: number) => void;
  /** Live drag position — local only, no persist/RPC (so edges can follow). */
  setPosition: (id: string, x: number, y: number) => void;
  /** Drop position — persists + flushes to Supabase. */
  moveItem: (id: string, x: number, y: number) => void;
  /** Card reported its rendered height; local only (height isn't a DB column). */
  setMeasuredHeight: (id: string, height: number) => void;
  bringToFront: (id: string) => void;
  setDragging: (id: string | null) => void;
  closeOpenFolder: () => void; // clear selection / connecting on background tap

  // ui actions
  setActiveTab: (tab: TabId) => void;
  select: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  beginConnect: (from: string, x: number, y: number) => void;
  moveConnect: (x: number, y: number) => void;
  cancelConnect: () => void;

  // character actions
  addCharacter: (partial?: Partial<CharacterItem>) => string;
  updateCharacter: (id: string, patch: Partial<CharacterItem>) => void;
  deleteCharacter: (id: string) => void;

  // relationship actions
  addRelationship: (from: string, to: string, label?: string) => void;
  updateRelationship: (id: string, label: string) => void;
  deleteRelationship: (id: string) => void;

  // host source projection
  setHostSecret: (secret: string) => void;
  syncFromHostWorld: (world: HostWorld) => void;

  // write-back health
  /** Set/clear the "couldn't save" cue (called by the write-result handlers). */
  reportSaveError: (failed: boolean) => void;
  /** Flush all debounced writes now — on canvas unmount / page hide. */
  flushPendingWrites: () => void;
}

function persist(s: MysteryState) {
  const data: PersistedState = {
    characters: s.characters,
    itemOrder: s.itemOrder,
    relationships: s.relationships,
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

      activeTab: 'guests',
      selectedId: null,
      selectedEdgeId: null,
      saveError: false,
      connect: null,

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

      setPosition: (id, x, y) =>
        set((s) => {
          const c = s.characters[id];
          if (!c) return;
          c.x = x;
          c.y = y;
        }),

      moveItem: (id, x, y) => {
        set((s) => {
          const c = s.characters[id];
          if (!c) return;
          c.x = x;
          c.y = y;
        });
        persist(get());
        queueChar(id, { x, y });
      },

      setMeasuredHeight: (id, height) => {
        const c = get().characters[id];
        if (!c || Math.abs(c.height - height) <= 1) return;
        set((s) => {
          const it = s.characters[id];
          if (it) it.height = height;
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
        }),

      closeOpenFolder: () =>
        set((s) => {
          s.selectedId = null;
          s.selectedEdgeId = null;
          s.connect = null;
        }),

      // ── ui ──────────────────────────────────────────────────────────
      setActiveTab: (tab) => set((s) => { s.activeTab = tab; }),
      select: (id) => set((s) => { s.selectedId = id; s.selectedEdgeId = null; }),
      selectEdge: (id) => set((s) => { s.selectedEdgeId = id; s.selectedId = null; }),
      beginConnect: (from, x, y) => set((s) => { s.connect = { from, x, y }; s.selectedEdgeId = null; }),
      moveConnect: (x, y) => set((s) => { if (s.connect) { s.connect.x = x; s.connect.y = y; } }),
      cancelConnect: () => set((s) => { s.connect = null; }),

      // ── characters ──────────────────────────────────────────────────
      addCharacter: (partial = {}) => {
        const id = uid();
        set((s) => {
          const vp = s.viewport;
          // drop it roughly in the middle of the current viewport
          const cx = (window.innerWidth / 2 - vp.panX) / vp.zoom - NODE_W / 2;
          const cy = (window.innerHeight / 2 - vp.panY) / vp.zoom - NODE_H / 2;
          const n = s.itemOrder.length;
          const char: CharacterItem = {
            id,
            type: 'character',
            name: 'New character',
            notes: '',
            castName: null,
            castComfort: null,
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
          s.selectedEdgeId = null;
        });
        persist(get());
        const created = get().characters[id];
        if (hostSecret && created) {
          hostSaveCharacter(hostSecret, {
            id,
            name: created.name,
            juice: created.notes,
            x: created.x,
            y: created.y,
          }).then(onWriteOk, onWriteErr);
        }
        return id;
      },

      updateCharacter: (id, patch) => {
        set((s) => {
          const c = s.characters[id];
          if (!c) return;
          Object.assign(c, patch);
        });
        persist(get());
        const payload = characterPayload(patch);
        if (Object.keys(payload).length) queueChar(id, payload);
      },

      deleteCharacter: (id) => {
        const touchedRels: string[] = [];
        set((s) => {
          delete s.characters[id];
          s.itemOrder = s.itemOrder.filter((oid) => oid !== id);
          for (const rid of Object.keys(s.relationships)) {
            const r = s.relationships[rid];
            if (r.from === id || r.to === id) {
              touchedRels.push(rid);
              delete s.relationships[rid];
            }
          }
          if (s.selectedId === id) s.selectedId = null;
          if (s.connect?.from === id) s.connect = null;
        });
        persist(get());
        dropChar(id);
        // The DB cascades edges when the character is deleted, so we only need
        // the character delete; clear any pending edge writes for the dropped ones.
        for (const rid of touchedRels) {
          relPending.delete(rid);
          const t = relTimers.get(rid);
          if (t) { clearTimeout(t); relTimers.delete(rid); }
        }
        if (hostSecret) hostDeleteCharacter(hostSecret, id).then(onWriteOk, onWriteErr);
      },

      // ── relationships ───────────────────────────────────────────────
      addRelationship: (from, to, label = '') => {
        if (from === to) return;
        const existing = Object.values(get().relationships).find(
          (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from),
        );
        if (existing) {
          set((s) => { s.connect = null; });
          return;
        }
        const id = uid();
        set((s) => {
          s.relationships[id] = { id, from, to, label };
          s.connect = null;
        });
        persist(get());
        if (hostSecret) {
          hostSaveRelationship(hostSecret, { id, from_char: from, to_char: to, label }).then(onWriteOk, onWriteErr);
        }
      },

      updateRelationship: (id, label) => {
        set((s) => {
          if (s.relationships[id]) s.relationships[id].label = label;
        });
        persist(get());
        queueRel(id, { label });
      },

      deleteRelationship: (id) => {
        set((s) => {
          delete s.relationships[id];
          if (s.selectedEdgeId === id) s.selectedEdgeId = null;
        });
        persist(get());
        relPending.delete(id);
        const t = relTimers.get(id);
        if (t) { clearTimeout(t); relTimers.delete(id); }
        if (hostSecret) hostDeleteRelationship(hostSecret, id).then(onWriteOk, onWriteErr);
      },

      // ── write-back health ─────────────────────────────────────────────
      reportSaveError: (failed) =>
        set((s) => {
          if (s.saveError !== failed) s.saveError = failed;
        }),

      flushPendingWrites: () => flushAllPending(),

      // ── host source projection ────────────────────────────────────────
      setHostSecret: (secret) => {
        hostSecret = secret;
      },

      syncFromHostWorld: (world) => {
        const projected = projectWorld(world);
        set((s) => {
          s.characters = projected.characters;
          s.itemOrder = projected.itemOrder;
          s.relationships = projected.relationships;
          if (s.selectedId && !projected.characters[s.selectedId]) s.selectedId = null;
          if (s.selectedEdgeId && !projected.relationships[s.selectedEdgeId]) s.selectedEdgeId = null;
          if (s.connect && !projected.characters[s.connect.from]) s.connect = null;
        });
        persist(get());
      },
    };
  }),
);
