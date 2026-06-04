import { useRef, useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { clientToCanvas } from '../utils/canvasCoords';
import { computeSnap } from '../utils/snapGuides';

const DRAG_THRESHOLD = 6;

interface ItemDragOptions {
  itemId: string;
  itemRef: React.RefObject<HTMLDivElement | null>;
  onTap: () => void;
}

export function useItemDrag({ itemId, itemRef, onTap }: ItemDragOptions) {
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

      const viewport = state.viewport;
      const canvasPos = clientToCanvas(e.clientX, e.clientY, viewport);
      const rawX = canvasPos.x - offsetX.current;
      const rawY = canvasPos.y - offsetY.current;

      // Snap to nearby items
      const snap = computeSnap(
        rawX, rawY,
        item.width, item.height,
        itemId,
        state.characters,
        state.itemOrder,
      );

      currentX.current = snap.x;
      currentY.current = snap.y;
      state.setSnapGuides(snap.guides);

      if (itemRef.current) {
        itemRef.current.style.left = `${currentX.current}px`;
        itemRef.current.style.top = `${currentY.current}px`;
      }
    },
    [itemRef, itemId],
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
