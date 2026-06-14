import { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import type { CharacterItem } from '../../types/canvas';
import styles from './EdgeLayer.module.css';

interface Rect { x: number; y: number; w: number; h: number }
interface Anchor { x: number; y: number; nx: number; ny: number }
interface Pt { x: number; y: number }

const rectOf = (c: CharacterItem): Rect => ({ x: c.x, y: c.y, w: c.width, h: c.height });
const centerOf = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** The point on the side of `r` that faces `toward`, with its outward normal. */
function sideAnchor(r: Rect, toward: Pt): Anchor {
  const c = centerOf(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { x: r.x + r.w, y: c.y, nx: 1, ny: 0 }
      : { x: r.x, y: c.y, nx: -1, ny: 0 };
  }
  return dy >= 0
    ? { x: c.x, y: r.y + r.h, nx: 0, ny: 1 }
    : { x: c.x, y: r.y, nx: 0, ny: -1 };
}

/** Control points pushed out along each anchor's normal — a smooth S-curve. */
function controls(a: Anchor, b: Anchor) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const k = Math.max(36, Math.min(dist * 0.42, 180));
  return {
    c1: { x: a.x + a.nx * k, y: a.y + a.ny * k },
    c2: { x: b.x + b.nx * k, y: b.y + b.ny * k },
  };
}

function pathD(a: Anchor, b: Anchor): string {
  const { c1, c2 } = controls(a, b);
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
}

function midpoint(a: Anchor, b: Anchor): Pt {
  const { c1, c2 } = controls(a, b);
  return {
    x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8,
    y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8,
  };
}

/**
 * Draws relationship edges between character cards as fluid bezier connectors,
 * auto-anchored to whichever sides of the two cards face each other and capped
 * with an arrowhead. Rendered *inside* the transformed canvas, so it shares the
 * pan/zoom transform and works in canvas coordinates. A live ghost connector
 * follows the cursor while a connection is being dragged from a card handle.
 */
export default function EdgeLayer() {
  const characters = useCanvasStore((s) => s.characters);
  const relationships = useCanvasStore((s) => s.relationships);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const selectEdge = useCanvasStore((s) => s.selectEdge);
  const connect = useCanvasStore((s) => s.connect);
  const updateRelationship = useCanvasStore((s) => s.updateRelationship);
  const deleteRelationship = useCanvasStore((s) => s.deleteRelationship);

  const [editingId, setEditingId] = useState<string | null>(null);

  const edges = Object.values(relationships);

  // Live ghost while dragging a connection from a card edge handle.
  let ghost: string | null = null;
  if (connect) {
    const a = characters[connect.from];
    if (a) {
      const cursor = { x: connect.x, y: connect.y };
      const aAnch = sideAnchor(rectOf(a), cursor);
      const bAnch: Anchor = { x: cursor.x, y: cursor.y, nx: -aAnch.nx, ny: -aAnch.ny };
      ghost = pathD(aAnch, bAnch);
    }
  }

  return (
    <>
      <svg className={styles.svg} width="1" height="1" aria-hidden>
        <defs>
          <marker
            id="edge-arrow"
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path className={styles.arrowHead} d="M0,0 L10,5 L0,10 z" />
          </marker>
        </defs>

        {edges.map((e) => {
          const a = characters[e.from];
          const b = characters[e.to];
          if (!a || !b) return null;
          const ra = rectOf(a);
          const rb = rectOf(b);
          const aAnch = sideAnchor(ra, centerOf(rb));
          const bAnch = sideAnchor(rb, centerOf(ra));
          const d = pathD(aAnch, bAnch);
          const selected = selectedEdgeId === e.id;
          const active = selectedId === e.from || selectedId === e.to;
          return (
            <g key={e.id}>
              {/* Fat transparent path so the thin arrow is easy to click. */}
              <path
                className={styles.hit}
                d={d}
                data-ui
                onClick={() => selectEdge(e.id)}
                onDoubleClick={() => {
                  selectEdge(e.id);
                  setEditingId(e.id);
                }}
              />
              <path
                d={d}
                markerEnd="url(#edge-arrow)"
                className={`${styles.edge} ${
                  selected ? styles.edgeSelected : active ? styles.edgeActive : ''
                }`}
              />
            </g>
          );
        })}

        {ghost && <path d={ghost} markerEnd="url(#edge-arrow)" className={styles.ghost} />}
      </svg>

      {edges.map((e) => {
        const a = characters[e.from];
        const b = characters[e.to];
        if (!a || !b) return null;
        const m = midpoint(sideAnchor(rectOf(a), centerOf(rectOf(b))), sideAnchor(rectOf(b), centerOf(rectOf(a))));
        const editing = editingId === e.id;
        // Show the label (or the faint "+ label") whenever it carries text, is
        // being edited, or its edge is selected — otherwise keep it hidden.
        const showLabel = Boolean(e.label) || editing || selectedEdgeId === e.id;
        return (
          <div
            key={e.id}
            className={`${styles.label} ${showLabel ? '' : styles.labelEmpty}`}
            data-ui
            style={{ left: m.x, top: m.y }}
            onPointerDown={(ev) => ev.stopPropagation()}
          >
            {editing ? (
              <input
                className={styles.input}
                autoFocus
                value={e.label}
                placeholder="how are they linked?"
                onChange={(ev) => updateRelationship(e.id, ev.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <button className={styles.text} onClick={() => setEditingId(e.id)}>
                {e.label || '+ label'}
              </button>
            )}
            <button
              className={styles.del}
              title="Remove connection"
              onClick={() => deleteRelationship(e.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </>
  );
}
