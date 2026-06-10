import { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import {
  ZOOM_STEPS,
  useCurrentZoom,
  useCurrentStepIndex,
} from '../../hooks/useZoom';
import styles from './ZoomSlider.module.css';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToStep: (stepIndex: number, clientX: number, clientY: number) => void;
  onResetZoom: () => void;
}

const TRACK_WIDTH = 120;

const spring = { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.6 };

export default function ZoomSlider({ onZoomIn, onZoomOut, onZoomToStep, onResetZoom }: Props) {
  const isPreviewing = useCanvasStore((s) => s.previewItemId != null);
  const currentZoom = useCurrentZoom();
  const stepIndex = useCurrentStepIndex();

  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const percent = Math.round(currentZoom * 100);

  // Thumb position: map stepIndex to track fraction
  const thumbFraction = stepIndex / (ZOOM_STEPS.length - 1);
  const thumbX = thumbFraction * TRACK_WIDTH;

  // ── Track / thumb interaction ──────────────────────────────

  const stepFromTrackX = useCallback((clientX: number) => {
    if (!trackRef.current) return stepIndex;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, TRACK_WIDTH));
    const frac = x / TRACK_WIDTH;
    return Math.round(frac * (ZOOM_STEPS.length - 1));
  }, [stepIndex]);

  const commitStep = useCallback(
    (newStep: number) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      onZoomToStep(newStep, cx, cy);
    },
    [onZoomToStep],
  );

  const onTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = true;
      commitStep(stepFromTrackX(e.clientX));
    },
    [commitStep, stepFromTrackX],
  );

  const onTrackPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      commitStep(stepFromTrackX(e.clientX));
    },
    [commitStep, stepFromTrackX],
  );

  const onTrackPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // ── Keyboard on slider ─────────────────────────────────────

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          onZoomIn();
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          onZoomOut();
          break;
        case 'Home':
          e.preventDefault();
          commitStep(0);
          break;
        case 'End':
          e.preventDefault();
          commitStep(ZOOM_STEPS.length - 1);
          break;
      }
    },
    [onZoomIn, onZoomOut, commitStep],
  );

  return (
    <AnimatePresence>
      {!isPreviewing && (
        <motion.div
          className={styles.container}
          data-ui
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={spring}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          {/* Minus button */}
          <button
            className={styles.stepButton}
            onClick={onZoomOut}
            aria-label="Zoom out"
            tabIndex={-1}
          >
            <Minus size={18} />
          </button>

          {/* Track */}
          <div
            ref={trackRef}
            className={styles.track}
            style={{ width: TRACK_WIDTH }}
            role="slider"
            tabIndex={0}
            aria-valuemin={ZOOM_STEPS[0] * 100}
            aria-valuemax={ZOOM_STEPS[ZOOM_STEPS.length - 1] * 100}
            aria-valuenow={percent}
            aria-label="Zoom level"
            onKeyDown={onKeyDown}
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerUp={onTrackPointerUp}
            onPointerCancel={onTrackPointerUp}
          >
            {/* Tick marks */}
            {ZOOM_STEPS.map((_, i) => (
              <div
                key={i}
                className={styles.tick}
                style={{ left: (i / (ZOOM_STEPS.length - 1)) * 100 + '%' }}
              />
            ))}

            {/* Filled portion */}
            <div className={styles.trackFill} style={{ width: thumbX }} />

            {/* Thumb */}
            <motion.div
              className={styles.thumb}
              animate={{ x: thumbX }}
              transition={spring}
            />
          </div>

          {/* Plus button */}
          <button
            className={styles.stepButton}
            onClick={onZoomIn}
            aria-label="Zoom in"
            tabIndex={-1}
          >
            <Plus size={18} />
          </button>

          {/* Percentage label */}
          <button
            className={styles.percentLabel}
            onClick={onResetZoom}
            aria-label="Reset zoom to 100%"
            tabIndex={-1}
          >
            <motion.span
              key={percent}
              initial={{ y: 4, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.12 }}
            >
              {percent}%
            </motion.span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
