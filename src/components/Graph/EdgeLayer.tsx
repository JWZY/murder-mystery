import { useCanvasStore } from '../../store/canvasStore';
import styles from './EdgeLayer.module.css';

/**
 * Draws relationship edges between character nodes. Rendered *inside* the
 * transformed canvas container, so it shares the pan/zoom transform and can
 * work directly in canvas coordinates.
 */
export default function EdgeLayer() {
  const characters = useCanvasStore((s) => s.characters);
  const relationships = useCanvasStore((s) => s.relationships);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const deleteRelationship = useCanvasStore((s) => s.deleteRelationship);

  const edges = Object.values(relationships);

  return (
    <>
      <svg className={styles.svg} width="1" height="1" aria-hidden>
        {edges.map((e) => {
          const a = characters[e.from];
          const b = characters[e.to];
          if (!a || !b) return null;
          const x1 = a.x + a.width / 2;
          const y1 = a.y + a.height / 2;
          const x2 = b.x + b.width / 2;
          const y2 = b.y + b.height / 2;
          const active = selectedId === e.from || selectedId === e.to;
          return (
            <line
              key={e.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={`${styles.edge} ${active ? styles.edgeActive : ''}`}
              style={{ stroke: a.color }}
            />
          );
        })}
      </svg>

      {edges.map((e) => {
        const a = characters[e.from];
        const b = characters[e.to];
        if (!a || !b) return null;
        const mx = (a.x + a.width / 2 + b.x + b.width / 2) / 2;
        const my = (a.y + a.height / 2 + b.y + b.height / 2) / 2;
        if (!e.label) return null;
        return (
          <div
            key={e.id}
            className={styles.label}
            data-ui
            style={{ left: mx, top: my }}
          >
            <span>{e.label}</span>
            <button
              className={styles.del}
              title="Remove connection"
              onPointerDown={(ev) => ev.stopPropagation()}
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
