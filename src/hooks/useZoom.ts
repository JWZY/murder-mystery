import { useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { zoomAroundPoint } from '../utils/canvasCoords';
import type { ViewportState } from '../types/canvas';

// ─── Stepped zoom ───────────────────────────────────────────
export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];
const DEFAULT_STEP = 4; // index of 1.0

const LERP_SPEED = 0.25;
const SNAP_THRESHOLD = 0.001;

// Continuous wheel / trackpad behavior
const ZOOM_SENSITIVITY_WHEEL = 0.002;
const ZOOM_SENSITIVITY_PINCH = 0.01;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4.0;

// ─── Helpers ────────────────────────────────────────────────

/** Find the nearest step index for a given zoom value. */
export function nearestStepIndex(zoom: number): number {
  let best = 0;
  let bestDist = Math.abs(zoom - ZOOM_STEPS[0]);
  for (let i = 1; i < ZOOM_STEPS.length; i++) {
    const d = Math.abs(zoom - ZOOM_STEPS[i]);
    if (d < bestDist) { best = i; bestDist = d; }
  }
  return best;
}

// ─── Shared reactive state (non-store, avoids Zustand churn) ─

let _currentZoom = 1;
let _currentStepIndex = DEFAULT_STEP;
let _isAnimating = false;
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach((l) => l()); }
function subscribe(l: () => void) { _listeners.add(l); return () => { _listeners.delete(l); }; }

/** Read current zoom (reactive via useSyncExternalStore). */
export function useCurrentZoom(): number {
  return useSyncExternalStore(subscribe, () => _currentZoom);
}
export function useCurrentStepIndex(): number {
  return useSyncExternalStore(subscribe, () => _currentStepIndex);
}
export function useIsZoomAnimating(): boolean {
  return useSyncExternalStore(subscribe, () => _isAnimating);
}

// ─── Hook ───────────────────────────────────────────────────

interface ZoomOptions {
  applyTransform: (panX: number, panY: number, zoom: number) => void;
  viewportRef: React.RefObject<HTMLElement | null>;
}

export function useZoom({ applyTransform, viewportRef }: ZoomOptions) {
  const setViewport = useCanvasStore((s) => s.setViewport);
  const getViewport = () => useCanvasStore.getState().viewport;

  const target = useRef<ViewportState | null>(null);
  const rafId = useRef<number | null>(null);

  // Sync shared zoom state on mount from store
  useEffect(() => {
    const vp = getViewport();
    _currentZoom = vp.zoom;
    _currentStepIndex = nearestStepIndex(vp.zoom);
    notify();
  }, []);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // ── Animation loop ──────────────────────────────────────────

  const animate = useCallback(() => {
    if (!target.current) {
      _isAnimating = false;
      notify();
      return;
    }

    const vp = getViewport();
    const t = target.current;

    const newPanX = vp.panX + (t.panX - vp.panX) * LERP_SPEED;
    const newPanY = vp.panY + (t.panY - vp.panY) * LERP_SPEED;
    const newZoom = vp.zoom + (t.zoom - vp.zoom) * LERP_SPEED;

    const done =
      Math.abs(newZoom - t.zoom) < SNAP_THRESHOLD &&
      Math.abs(newPanX - t.panX) < 0.5 &&
      Math.abs(newPanY - t.panY) < 0.5;

    if (done) {
      // Commit final step value to store
      applyTransform(t.panX, t.panY, t.zoom);
      setViewport(t);
      _currentZoom = t.zoom;
      _currentStepIndex = nearestStepIndex(t.zoom);
      _isAnimating = false;
      target.current = null;
      rafId.current = null;
      notify();
    } else {
      // Visual update via DOM bypass + store write for anything reading viewport
      applyTransform(newPanX, newPanY, newZoom);
      _currentZoom = newZoom;
      // Keep stepIndex showing the target step during animation
      _currentStepIndex = nearestStepIndex(t.zoom);
      notify();
      setViewport({ panX: newPanX, panY: newPanY, zoom: newZoom });
      rafId.current = requestAnimationFrame(animate);
    }
  }, [applyTransform, setViewport]);

  const startAnimation = useCallback(() => {
    _isAnimating = true;
    notify();
    if (rafId.current == null) {
      rafId.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  // ── Step helpers ────────────────────────────────────────────

  const zoomToStep = useCallback(
    (stepIndex: number, clientX: number, clientY: number) => {
      const idx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, stepIndex));
      const targetZoom = ZOOM_STEPS[idx];
      const viewport = target.current ?? getViewport();
      if (Math.abs(viewport.zoom - targetZoom) < SNAP_THRESHOLD) return;
      target.current = zoomAroundPoint(viewport, targetZoom, clientX, clientY);
      startAnimation();
    },
    [startAnimation],
  );

  const screenCenter = (): [number, number] => [window.innerWidth / 2, window.innerHeight / 2];

  const zoomIn = useCallback(() => {
    const cur = nearestStepIndex(target.current?.zoom ?? getViewport().zoom);
    const [cx, cy] = screenCenter();
    zoomToStep(cur + 1, cx, cy);
  }, [zoomToStep]);

  const zoomOut = useCallback(() => {
    const cur = nearestStepIndex(target.current?.zoom ?? getViewport().zoom);
    const [cx, cy] = screenCenter();
    zoomToStep(cur - 1, cx, cy);
  }, [zoomToStep]);

  const zoomTo = useCallback(
    (targetZoom: number, clientX: number, clientY: number) => {
      const viewport = target.current ?? getViewport();
      if (Math.abs(viewport.zoom - targetZoom) < SNAP_THRESHOLD) return;
      target.current = zoomAroundPoint(viewport, targetZoom, clientX, clientY);
      startAnimation();
    },
    [startAnimation],
  );

  const resetZoom = useCallback(() => {
    const [cx, cy] = screenCenter();
    zoomToStep(DEFAULT_STEP, cx, cy);
  }, [zoomToStep]);

  const zoomToFit = useCallback(() => {
    const state = useCanvasStore.getState();
    const visibleItems = state.itemOrder
      .map((id) => state.characters[id])
      .filter(Boolean);

    if (visibleItems.length === 0) {
      resetZoom();
      return;
    }

    const bounds = visibleItems.reduce(
      (acc, item) => ({
        minX: Math.min(acc.minX, item.x),
        minY: Math.min(acc.minY, item.y),
        maxX: Math.max(acc.maxX, item.x + item.width),
        maxY: Math.max(acc.maxY, item.y + item.height),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );

    const viewportEl = viewportRef.current;
    const viewportWidth = viewportEl?.clientWidth ?? window.innerWidth;
    const viewportHeight = viewportEl?.clientHeight ?? window.innerHeight;
    const padding = 96;
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const fitZoom = Math.min(
      ZOOM_MAX,
      Math.max(
        ZOOM_MIN,
        Math.min(
          (viewportWidth - padding * 2) / contentWidth,
          (viewportHeight - padding * 2) / contentHeight,
        ),
      ),
    );

    target.current = {
      panX: (viewportWidth - contentWidth * fitZoom) / 2 - bounds.minX * fitZoom,
      panY: (viewportHeight - contentHeight * fitZoom) / 2 - bounds.minY * fitZoom,
      zoom: fitZoom,
    };
    startAnimation();
  }, [resetZoom, startAnimation, viewportRef]);

  // ── Wheel handler (imperative for { passive: false }) ──────

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const cancelZoomAnimation = () => {
      target.current = null;
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (_isAnimating) {
        _isAnimating = false;
        notify();
      }
    };

    const handler = (e: WheelEvent) => {
      e.preventDefault();

      // Match Figma-like trackpad behavior:
      // - two-finger scroll pans the canvas
      // - pinch / ctrl-wheel / cmd-wheel zooms around the pointer
      if (!e.ctrlKey && !e.metaKey) {
        cancelZoomAnimation();
        const vp = getViewport();
        const deltaX = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
        const deltaY = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
        const next = {
          panX: vp.panX - deltaX,
          panY: vp.panY - deltaY,
          zoom: vp.zoom,
        };
        applyTransform(next.panX, next.panY, next.zoom);
        setViewport({ panX: next.panX, panY: next.panY });
        return;
      }

      const currentZoom = target.current?.zoom ?? getViewport().zoom;
      const sensitivity = e.ctrlKey ? ZOOM_SENSITIVITY_PINCH : ZOOM_SENSITIVITY_WHEEL;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN,
        currentZoom * (1 - e.deltaY * sensitivity),
      ));
      zoomTo(newZoom, e.clientX, e.clientY);
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [applyTransform, setViewport, zoomTo, viewportRef]);

  return { zoomIn, zoomOut, zoomToStep, zoomTo, resetZoom, zoomToFit };
}
