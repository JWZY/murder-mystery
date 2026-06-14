import { useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useCanvasDrag } from '../../hooks/useCanvasDrag';
import { useZoom } from '../../hooks/useZoom';
import CharacterNode from './CharacterNode';
import EdgeLayer from './EdgeLayer';
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
  const connecting = useCanvasStore((s) => s.connect != null);
  const cancelConnect = useCanvasStore((s) => s.cancelConnect);
  const closeOpenFolder = useCanvasStore((s) => s.closeOpenFolder);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const deleteRelationship = useCanvasStore((s) => s.deleteRelationship);

  const { onPointerDown, onPointerMove, onPointerUp } = useCanvasDrag({ applyTransform });
  const { zoomIn, zoomOut, resetZoom, zoomToFit } = useZoom({
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
        if (connecting) cancelConnect();
        else closeOpenFolder();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdgeId) {
        e.preventDefault();
        deleteRelationship(selectedEdgeId);
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
      else if (mod && e.key === '-') { e.preventDefault(); zoomOut(); }
      else if (mod && e.key === '0') { e.preventDefault(); resetZoom(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [connecting, cancelConnect, closeOpenFolder, selectedEdgeId, deleteRelationship, zoomIn, zoomOut, resetZoom]);

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
    <div
      ref={viewportRef}
      className={`${styles.viewport} ${draggingId ? styles.isDragging : ''} ${
        connecting ? graph.connecting : ''
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
      </div>
    </div>
  );
}
