import { useRef, useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { clientToCanvas } from '../utils/canvasCoords';

const DRAG_THRESHOLD = 6;

interface ItemDragOptions {
  itemId: string;
  onTap: () => void;
}

export function useItemDrag({ itemId, onTap }: ItemDragOptions) {
  const store = useCanvasStore;

  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const startClientX = useRef(0);
  const startClientY = useRef(0);
  const offsetX = useRef(0);
  const offsetY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      const viewport = store.getState().viewport;
      const item = store.getState().characters[itemId];
      if (!item) return;

      isDragging.current = true;
      hasMoved.current = false;
      startClientX.current = e.clientX;
      startClientY.current = e.clientY;

      // Defer bringToFront/setDragging until we confirm it's a real drag (Bug: folder jump on tap)
      const canvasPos = clientToCanvas(e.clientX, e.clientY, viewport);
      offsetX.current = canvasPos.x - item.x;
      offsetY.current = canvasPos.y - item.y;
      currentX.current = item.x;
      currentY.current = item.y;

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [itemId],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;

      if (!hasMoved.current) {
        const dx = e.clientX - startClientX.current;
        const dy = e.clientY - startClientY.current;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        hasMoved.current = true;
        // Only promote to drag state once threshold is exceeded
        store.getState().bringToFront(itemId);
        store.getState().setDragging(itemId);
      }

      const state = store.getState();
      const item = state.characters[itemId];
      if (!item) return;

      const canvasPos = clientToCanvas(e.clientX, e.clientY, state.viewport);
      currentX.current = canvasPos.x - offsetX.current;
      currentY.current = canvasPos.y - offsetY.current;

      // Drive position through the store (local only) so connected edges follow
      // the card live; the persisted write happens once, on drop.
      state.setPosition(itemId, currentX.current, currentY.current);
    },
    [itemId],
  );

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    store.getState().setDragging(null);

    if (!hasMoved.current) {
      onTap();
      return;
    }

    store.getState().moveItem(itemId, currentX.current, currentY.current);
  }, [itemId, onTap]);

  return { onPointerDown, onPointerMove, onPointerUp };
}
