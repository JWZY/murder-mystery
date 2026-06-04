import { useCanvasStore } from '../../store/canvasStore';
import styles from './SnapGuides.module.css';

export default function SnapGuides() {
  const guides = useCanvasStore((s) => s.snapGuides);

  if (guides.length === 0) return null;

  // Deduplicate guides by axis+position
  const seen = new Set<string>();
  const unique = guides.filter((g) => {
    const key = `${g.axis}:${Math.round(g.position)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <>
      {unique.map((guide, i) => (
        <div
          key={`${guide.axis}-${i}`}
          className={guide.axis === 'x' ? styles.vertical : styles.horizontal}
          style={
            guide.axis === 'x'
              ? { left: guide.position }
              : { top: guide.position }
          }
        />
      ))}
    </>
  );
}
