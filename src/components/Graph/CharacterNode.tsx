import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useCanvasStore } from '../../store/canvasStore';
import { useItemDrag } from '../../hooks/useItemDrag';
import type { CharacterItem } from '../../types/canvas';
import styles from './CharacterNode.module.css';

interface Props {
  item: CharacterItem;
}

export default function CharacterNode({ item }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const connectingFrom = useCanvasStore((s) => s.connectingFrom);
  const select = useCanvasStore((s) => s.select);
  const addRelationship = useCanvasStore((s) => s.addRelationship);
  const guests = useCanvasStore((s) => s.guests);

  const isSelected = selectedId === item.id;
  const isConnectSource = connectingFrom === item.id;
  const connecting = connectingFrom != null;

  const onTap = () => {
    if (connecting && connectingFrom !== item.id) {
      addRelationship(connectingFrom!, item.id);
      return;
    }
    select(isSelected ? null : item.id);
  };

  const { onPointerDown, onPointerMove, onPointerUp } = useItemDrag({
    itemId: item.id,
    itemRef: ref,
    onTap,
  });

  const cast = item.guestId ? guests[item.guestId] : null;

  return (
    <motion.div
      ref={ref}
      data-canvas-item
      className={`${styles.node} ${isSelected ? styles.selected : ''} ${
        isConnectSource ? styles.connectSource : ''
      } ${connecting && !isConnectSource ? styles.connectTarget : ''}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
        // @ts-expect-error custom property
        '--node-color': item.color,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      <div className={styles.accent} />
      <div className={styles.body}>
        <div className={styles.role}>{item.role || 'Unassigned role'}</div>
        <div className={styles.name}>{item.name}</div>
        <div className={styles.cast}>
          {cast ? (
            <span className={styles.castName}>
              <span className={styles.dot} /> {cast.name || 'unnamed guest'}
            </span>
          ) : (
            <span className={styles.uncast}>not cast</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
