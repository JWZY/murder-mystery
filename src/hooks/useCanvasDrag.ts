import { useRef, useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore';

interface CanvasDragOptions {
  applyTransform: (panX: number, panY: number, zoom: number) => void;
}

export function useCanvasDrag({ applyTransform }: CanvasDragOptions) {
  const setViewport = useCanvasStore((s) => s.setViewport);
  const closeOpenFolder = useCanvasStore((s) => s.closeOpenFolder);

  // Read viewport transiently (via getState) to avoid re-renders on every pan frame.
  const getViewport = () => useCanvasStore.getState().viewport;
  const getDraggingId = () => useCanvasStore.getState().draggingId;

  const isDragging = useRef(false);
  const didMove = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const currentPan = useRef({ x: 0, y: 0 });
  const currentZoom = useRef(1);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || getDraggingId()) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-canvas-item]')) return;
      if (target.closest('[data-ui]')) return;

      const vp = getViewport();
      isDragging.current = true;
      didMove.current = false;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      currentPan.current = { x: vp.panX, y: vp.panY };
      currentZoom.current = vp.zoom;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastX.current;
      const dy = e.clientY - lastY.current;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didMove.current = true;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      currentPan.current.x += dx;
      currentPan.current.y += dy;
      applyTransform(currentPan.current.x, currentPan.current.y, currentZoom.current);
    },
    [applyTransform],
  );

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!didMove.current) {
      closeOpenFolder();
    }
    setViewport({ panX: currentPan.current.x, panY: currentPan.current.y });
  }, [setViewport, closeOpenFolder]);

  return { onPointerDown, onPointerMove, onPointerUp };
}
