import { useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useCanvasDrag } from '../../hooks/useCanvasDrag';
import { useZoom } from '../../hooks/useZoom';
import CharacterNode from './CharacterNode';
import EdgeLayer from './EdgeLayer';
import SnapGuides from '../Canvas/SnapGuides';
import ZoomSlider from '../ZoomSlider/ZoomSlider';
import styles from '../Canvas/Canvas.module.css';
import graph from './CharacterGraph.module.css';

interface Props {
  autoFitKey?: number;
}

export default function CharacterGraph({ autoFitKey = 0 }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const applyTransform = useCallback((panX: number, panY: number, zoom: number) => {
    if (canvasRef.current) {
      canvasRef.current.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }
  }, []);

  const itemIds = useCanvasStore((s) => s.itemOrder);
  const storeItems = useCanvasStore((s) => s.characters);
  const items = itemIds.map((id) => storeItems[id]).filter(Boolean);
  const draggingId = useCanvasStore((s) => s.draggingId);
  const connectingFrom = useCanvasStore((s) => s.connectingFrom);
  const cancelConnecting = useCanvasStore((s) => s.cancelConnecting);
  const closeOpenFolder = useCanvasStore((s) => s.closeOpenFolder);

  const { onPointerDown, onPointerMove, onPointerUp } = useCanvasDrag({ applyTransform });
  const { zoomIn, zoomOut, zoomToStep, resetZoom, zoomToFit } = useZoom({
    applyTransform,
    viewportRef,
  });

  useEffect(() => {
    if (!autoFitKey || items.length === 0) return;
    const raf = requestAnimationFrame(() => zoomToFit());
    return () => cancelAnimationFrame(raf);
  }, [autoFitKey, items.length, zoomToFit]);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-canvas-item]') || target.closest('[data-ui]')) return;
      zoomToFit();
    },
    [zoomToFit],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;

      if (e.key === 'Escape') {
        if (connectingFrom) cancelConnecting();
        else closeOpenFolder();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
      else if (mod && e.key === '-') { e.preventDefault(); zoomOut(); }
      else if (mod && e.key === '0') { e.preventDefault(); resetZoom(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [connectingFrom, cancelConnecting, closeOpenFolder, zoomIn, zoomOut, resetZoom]);

  // Sync store-driven viewport changes (panToFocus) to the DOM.
  useEffect(() => {
    return useCanvasStore.subscribe((state, prev) => {
      const vp = state.viewport;
      const p = prev.viewport;
      if (vp.panX !== p.panX || vp.panY !== p.panY || vp.zoom !== p.zoom) {
        applyTransform(vp.panX, vp.panY, vp.zoom);
      }
    });
  }, [applyTransform]);

  return (
    <>
      <div
        ref={viewportRef}
        className={`${styles.viewport} ${draggingId ? styles.isDragging : ''} ${
          connectingFrom ? graph.connecting : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <div ref={canvasRef} className={styles.canvas}>
          <EdgeLayer />
          {items.map((item) => (
            <CharacterNode key={item.id} item={item} />
          ))}
          <SnapGuides />
        </div>
      </div>

      {connectingFrom && (
        <div className={graph.connectBanner} data-ui>
          Click another character to connect — or
          <button onClick={cancelConnecting}>cancel</button>
          <kbd>Esc</kbd>
        </div>
      )}

      <ZoomSlider
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomToStep={zoomToStep}
        onResetZoom={resetZoom}
      />
    </>
  );
}
