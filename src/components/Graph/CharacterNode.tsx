import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useItemDrag } from '../../hooks/useItemDrag';
import { clientToCanvas } from '../../utils/canvasCoords';
import type { CharacterItem } from '../../types/canvas';
import styles from './CharacterNode.module.css';

interface Props {
  item: CharacterItem;
}

type Side = 'top' | 'right' | 'bottom' | 'left';
const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

// Roleplay comfort 1–5, mapped to the intake scale's cap labels (for the tooltip).
const COMFORT_CAPS = ['Extra', 'Cameo', 'Recurring', 'Supporting', 'Lead'];

/**
 * Color for a comfort level on a 1–5 scale: muted gray at 1 (low commitment) →
 * the required-red at 5 (wants the spotlight), interpolated in oklch so the
 * mid-levels read as a smooth ramp rather than a muddy blend.
 */
function comfortColor(n: number): string {
  const t = Math.min(1, Math.max(0, (n - 1) / 4));
  return `color-mix(in oklch, var(--color-required) ${Math.round(t * 100)}%, var(--color-text-muted))`;
}

/** Stop a pointer/click on an interactive control from starting a node drag. */
const swallow = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

/**
 * A FigJam-style sticky note: a name, a free-text body that grows to fit, and
 * the cast actor's name at the foot. Hovering the card reveals four edge
 * handles you drag from to draw a connection to another card.
 */
export default function CharacterNode({ item }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const selectedId = useCanvasStore((s) => s.selectedId);
  const select = useCanvasStore((s) => s.select);
  const updateCharacter = useCanvasStore((s) => s.updateCharacter);
  const deleteCharacter = useCanvasStore((s) => s.deleteCharacter);
  const setMeasuredHeight = useCanvasStore((s) => s.setMeasuredHeight);

  const isSelected = selectedId === item.id;

  const onTap = () => select(isSelected ? null : item.id);

  const { onPointerDown, onPointerMove, onPointerUp } = useItemDrag({ itemId: item.id, onTap });

  // Report the card's rendered height back so edges anchor to the real card.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => setMeasuredHeight(item.id, el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [item.id, setMeasuredHeight]);

  // Grow the notes textarea to fit its content (the card grows with it).
  useLayoutEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [item.notes, isSelected]);

  return (
    <motion.div
      ref={ref}
      data-canvas-item
      data-char-id={item.id}
      className={`${styles.node} ${isSelected ? styles.selected : ''}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        zIndex: isSelected ? 9999 : item.zIndex,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
    >
      <div className={styles.body}>
        {isSelected ? (
          <>
            <input
              className={styles.nameInput}
              value={item.name}
              placeholder="Name"
              onPointerDown={swallow}
              onChange={(e) => updateCharacter(item.id, { name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
            <textarea
              ref={notesRef}
              className={styles.notesInput}
              value={item.notes}
              placeholder="Concept, hook, notes…"
              rows={1}
              onPointerDown={swallow}
              onChange={(e) => updateCharacter(item.id, { notes: e.target.value })}
            />
          </>
        ) : (
          <>
            <div className={styles.name}>{item.name || 'New character'}</div>
            {item.notes ? (
              <div className={styles.notes}>{item.notes}</div>
            ) : (
              <div className={`${styles.notes} ${styles.placeholder}`}>Concept, hook, notes…</div>
            )}
          </>
        )}

        <div className={styles.foot}>
          <span className={`${styles.actor} ${item.castName ? '' : styles.placeholder}`}>
            {item.castName || 'no actor yet'}
          </span>
          <span className={styles.footEnd}>
            {item.castComfort != null && (
              <span
                className={styles.comfort}
                style={{ color: comfortColor(item.castComfort) }}
                title={`Role size ${item.castComfort}/5${COMFORT_CAPS[item.castComfort - 1] ? ` — ${COMFORT_CAPS[item.castComfort - 1]}` : ''}`}
              >
                {item.castComfort}/5
              </span>
            )}
            {isSelected && (
              <button
                type="button"
                className={styles.del}
                title="Delete character"
                onPointerDown={swallow}
                onClick={() => deleteCharacter(item.id)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </span>
        </div>
      </div>

      {SIDES.map((side) => (
        <ConnectHandle key={side} side={side} nodeId={item.id} />
      ))}
    </motion.div>
  );
}

/**
 * A connection handle sitting on one edge of the card. Pressing it starts a
 * connection drag (pointer-captured), and releasing over another card creates
 * the relationship. It anchors to its own edge but the arrow auto-routes to
 * whichever sides face each other, so the exact handle is just the grab point.
 */
function ConnectHandle({ side, nodeId }: { side: Side; nodeId: string }) {
  const beginConnect = useCanvasStore((s) => s.beginConnect);
  const moveConnect = useCanvasStore((s) => s.moveConnect);
  const cancelConnect = useCanvasStore((s) => s.cancelConnect);
  const addRelationship = useCanvasStore((s) => s.addRelationship);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const vp = useCanvasStore.getState().viewport;
    const p = clientToCanvas(e.clientX, e.clientY, vp);
    beginConnect(nodeId, p.x, p.y);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!useCanvasStore.getState().connect) return;
    const vp = useCanvasStore.getState().viewport;
    const p = clientToCanvas(e.clientX, e.clientY, vp);
    moveConnect(p.x, p.y);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const from = useCanvasStore.getState().connect?.from;
    cancelConnect();
    if (!from) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const target = el?.closest('[data-char-id]') as HTMLElement | null;
    const to = target?.getAttribute('data-char-id');
    if (to && to !== from) addRelationship(from, to);
  };

  return (
    <span
      className={`${styles.handle} ${styles[side]}`}
      data-ui
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}
