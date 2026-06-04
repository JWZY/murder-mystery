import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { themes, useThemeStore } from '../../store/themeStore';
import { useCanvasStore } from '../../store/canvasStore';
import styles from './ThemePicker.module.css';

// ─── CIRCULAR FLOWER LAYOUT ────────────────────────────────
// 3 concentric rings: center (1) + inner ring (6) + outer ring (12) = 19.
// Existing Canvas themes keep their order; new extras are appended to the outer ring.

const RING_UNIT = 48;
const PETAL_SIZE = 36;
const RING1_RADIUS = RING_UNIT * 0.54;
const RING2_RADIUS = RING_UNIT * 1.0;

// How far bloom is above the trigger (must match CSS)
const BLOOM_OFFSET_Y = 80;

// Ring definitions: [startIndex, count, radius, startAngle, zIndex]
const RINGS: { start: number; count: number; radius: number; angleOffset: number; z: number }[] = [
  { start: 0, count: 1, radius: 0, angleOffset: 0, z: 6 },
  { start: 1, count: 6, radius: RING1_RADIUS, angleOffset: -90, z: 4 },
  { start: 7, count: 12, radius: RING2_RADIUS, angleOffset: -90, z: 2 },
];

interface PetalPos { x: number; y: number; z: number }

function easeOutDelay(progress: number) {
  return 1 - Math.pow(1 - progress, 1.55);
}

function easeOutPathTime(progress: number) {
  // Inverse ease-out timing: maps equal spatial samples around the ring
  // onto timestamps that move quickly at first, then settle smoothly.
  return 1 - Math.pow(1 - progress, 1 / 2);
}

function getRingTiming(index: number) {
  if (index === 0) {
    return { localIndex: 0, count: 1, openDelay: 0 };
  }

  const isInnerRing = index < 7;
  const count = isInnerRing ? 6 : 12;
  const localIndex = index - (isInnerRing ? 1 : 7);
  const progress = localIndex / (count - 1);
  const openBaseDelay = isInnerRing ? 0.028 : 0.108;
  const totalDuration = isInnerRing ? 0.15 : 0.1;
  const openDelay = openBaseDelay + easeOutDelay(progress) * totalDuration;

  return { localIndex, count, openDelay };
}

function getCloseTransition(index: number) {
  const pseudoRandomDelay = ((index * 7) % 11) * 0.004;

  return {
    delay: pseudoRandomDelay,
    duration: 0.15 + ((index * 5) % 4) * 0.006,
    ease: swatchEase,
  };
}

function getRingArcPath(index: number) {
  if (index === 0) {
    return {
      x: [0, 0],
      y: [0, 0],
      times: [0, 1],
      filter: ['blur(0.8px)', 'blur(0px)'],
      scaleX: [1.06, 1],
      scaleY: [0.96, 1],
    };
  }

  const isInnerRing = index < 7;
  const ringStartIndex = isInnerRing ? 1 : 7;
  const count = isInnerRing ? 6 : 12;
  const radius = isInnerRing ? RING1_RADIUS : RING2_RADIUS;
  const localIndex = index - ringStartIndex;

  // Each swatch rides a scaled version of its ring's clock-face circle:
  // the circle starts collapsed at the picker center, expands from that origin,
  // and the swatch travels clockwise along that growing circle to its final slot.
  const ringStartAngle = -90;
  const endAngle = ringStartAngle + (360 / count) * localIndex;
  const startAngle = ringStartAngle + (endAngle - ringStartAngle) * 0.9;
  const steps = Math.max(10, localIndex * 8);
  const x: number[] = [];
  const y: number[] = [];
  const times: number[] = [];
  const filter: string[] = [];
  const scaleX: number[] = [];
  const scaleY: number[] = [];

  for (let step = 0; step <= steps; step++) {
    const progress = step / steps;
    const angle = (startAngle + (endAngle - startAngle) * progress) * (Math.PI / 180);
    const scaledRadius = radius * (0.94 + easeOutDelay(progress) * 0.06);
    x.push(Math.cos(angle) * scaledRadius);
    y.push(Math.sin(angle) * scaledRadius);
    times.push(easeOutPathTime(progress));

    const smear = 1 - progress;
    filter.push(`blur(${(smear * 1.15).toFixed(3)}px)`);
    scaleX.push(1 + smear * 0.05);
    scaleY.push(1 - smear * 0.02);
  }

  return { x, y, times, filter, scaleX, scaleY };
}

function getFlowerPositions(): PetalPos[] {
  const positions: PetalPos[] = [];
  for (const ring of RINGS) {
    for (let i = 0; i < ring.count; i++) {
      if (ring.radius === 0) {
        positions.push({ x: 0, y: 0, z: ring.z });
      } else {
        const angle = (ring.angleOffset + (360 / ring.count) * i) * (Math.PI / 180);
        positions.push({
          x: Math.cos(angle) * ring.radius,
          y: Math.sin(angle) * ring.radius,
          z: ring.z,
        });
      }
    }
  }
  return positions;
}

const flowerPositions = getFlowerPositions();

const morphSpring = { type: 'spring' as const, stiffness: 340, damping: 28, mass: 0.62 };
const swatchEase = [0.42, 0, 0.58, 1] as const;
const swatchHoverEase = [0.25, 1, 0.5, 1] as const;
const petalTransition = { duration: 0.24, ease: swatchHoverEase };
const hoverTransition = petalTransition;
const closeBloomTransition = { duration: 0.18, ease: swatchEase };
const hoverSpring = { type: 'spring' as const, stiffness: 500, damping: 30, mass: 0.42 };
const OPEN_INTERACTION_DELAY = 430;

const HOVER_PETAL_SIZE = PETAL_SIZE * 1.38;
const SELECT_PETAL_SIZE = PETAL_SIZE * 1.48;
const REPEL_RADIUS = PETAL_SIZE * 4.1;
const REST_SPREAD = PETAL_SIZE * 0.12;
const SELECT_SPREAD = PETAL_SIZE * 0.42;

let audioContext: AudioContext | null = null;

function getAudioContext() {
  audioContext ??= new AudioContext();
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

function playHoverSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.03);
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    gain.gain.setValueAtTime(0.026, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);

    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.01), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.2));
    }
    const noise = ctx.createBufferSource();
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 500;
    noiseGain.gain.setValueAtTime(0.008, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.01);
  } catch {
    // Audio is decorative; ignore browsers that block or lack Web Audio.
  }
}

function playSelectSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.045);
    filter.type = 'lowpass';
    filter.frequency.value = 250;
    gain.gain.setValueAtTime(0.027, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);

    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.015), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.2));
    }
    const noise = ctx.createBufferSource();
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 600;
    noiseGain.gain.setValueAtTime(0.007, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.015);
  } catch {
    // Audio is decorative; ignore browsers that block or lack Web Audio.
  }
}

function getInteractivePositions(anchorIndex: number | null, spread: number) {
  if (anchorIndex == null) return flowerPositions;
  const anchor = flowerPositions[anchorIndex];
  if (!anchor) return flowerPositions;

  return flowerPositions.map((pos, i) => {
    if (i === anchorIndex) return pos;
    const dx = pos.x - anchor.x;
    const dy = pos.y - anchor.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return pos;

    const falloff = Math.max(0, 1 - distance / REPEL_RADIUS);
    const push = spread * (0.08 + falloff * 0.7);

    return {
      ...pos,
      x: pos.x + (dx / distance) * push,
      y: pos.y + (dy / distance) * push,
    };
  });
}

export default function ThemePicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [canInteract, setCanInteract] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectingIndex, setSelectingIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isPreviewing = useCanvasStore((s) => s.previewItemId != null);

  const interactionIndex = selectingIndex ?? hoveredIndex;
  const interactivePositions = useMemo(
    () => getInteractivePositions(interactionIndex, selectingIndex == null ? REST_SPREAD : SELECT_SPREAD),
    [interactionIndex, selectingIndex]
  );
  const glowTheme = interactionIndex == null ? null : themes[interactionIndex];
  const glowPos = interactionIndex == null ? { x: 0, y: 0 } : interactivePositions[interactionIndex];

  const handleClose = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (interactionTimerRef.current != null) {
      clearTimeout(interactionTimerRef.current);
      interactionTimerRef.current = null;
    }
    setCanInteract(false);
    setHoveredIndex(null);
    setSelectingIndex(null);
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('pointerdown', onPointerDown), 10);
    return () => { clearTimeout(timer); document.removeEventListener('pointerdown', onPointerDown); };
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  const handleSelect = useCallback((id: string, index: number) => {
    if (!canInteract) return;

    setCanInteract(false);
    setIsOpening(false);
    setSelectingIndex(index);
    setTheme(id);
    playSelectSound();

    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setHoveredIndex(null);
      setSelectingIndex(null);
      setIsOpen(false);
      closeTimerRef.current = null;
    }, 140);
  }, [canInteract, setTheme]);

  useEffect(() => {
    if (!isOpen) {
      setCanInteract(false);
      setIsOpening(false);
      return;
    }

    setCanInteract(false);
    setIsOpening(true);
    interactionTimerRef.current = setTimeout(() => {
      setCanInteract(true);
      setIsOpening(false);
      interactionTimerRef.current = null;
    }, OPEN_INTERACTION_DELAY);

    return () => {
      if (interactionTimerRef.current != null) {
        clearTimeout(interactionTimerRef.current);
        interactionTimerRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => () => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
    }
    if (interactionTimerRef.current != null) {
      clearTimeout(interactionTimerRef.current);
    }
  }, []);

  // Backdrop sized with a little breathing room beyond the outer ring.
  const backdropSize = (RING2_RADIUS + PETAL_SIZE * 0.9) * 2;

  return (
    <div ref={containerRef} className={styles.anchor} data-ui>
      {/* Trigger */}
      <motion.button
        className={styles.trigger}
        onClick={() => {
          playHoverSound();
          setIsOpen((open) => {
            if (open) {
              setCanInteract(false);
              setIsOpening(false);
              setHoveredIndex(null);
            }
            return !open;
          });
        }}
        aria-label="Change theme"
        whileHover={!isOpen ? { scale: 1.12 } : undefined}
        whileTap={!isOpen ? { scale: 0.9 } : undefined}
        animate={
          isOpen
            ? { scale: 0, opacity: 0, y: 0 }
            : isPreviewing
              ? { scale: 0.5, opacity: 0, y: 20 }
              : { scale: 1, opacity: 1, y: 0 }
        }
        transition={morphSpring}
        style={{ pointerEvents: isOpen || isPreviewing ? 'none' : 'auto' }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 2.24164L14.7167 6.9583C15.6495 7.89048 16.2848 9.07836 16.5424 10.3717C16.8 11.665 16.6682 13.0057 16.1638 14.2241C15.6593 15.4425 14.8048 16.484 13.7084 17.2167C12.612 17.9495 11.3229 18.3406 10.0042 18.3406C8.68544 18.3406 7.39633 17.9495 6.29991 17.2167C5.20349 16.484 4.34901 15.4425 3.84455 14.2241C3.3401 13.0057 3.20833 11.665 3.46592 10.3717C3.72351 9.07836 4.35888 7.89048 5.29167 6.9583L10 2.24164Z"
            stroke="var(--color-text)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="var(--color-accent)"
            fillOpacity="0.15"
          />
        </svg>
      </motion.button>

      {/* Flower bloom */}
      <AnimatePresence>
        {isOpen && (
          <div className={styles.bloomContainer}>
            {/* Frosted backdrop clips both the glow and the moving swatches. */}
            <motion.div
              className={styles.backdrop}
              style={{
                width: backdropSize,
                height: backdropSize,
                left: -backdropSize / 2,
                top: -backdropSize / 2,
              }}
              initial={{ scale: 0, opacity: 0, y: BLOOM_OFFSET_Y }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: BLOOM_OFFSET_Y, transition: closeBloomTransition }}
              transition={morphSpring}
            >
              <motion.div
                className={styles.clippedGlow}
                animate={{
                  opacity: glowTheme ? 1 : 0,
                  x: glowPos.x,
                  y: glowPos.y,
                  backgroundColor: glowTheme?.swatch ?? '#ffffff',
                }}
                transition={{ ...petalTransition, delay: 0 }}
              />

              {/* Petals */}
              <motion.div
                className={styles.flower}
                initial={{ rotate: -35, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{
                  rotate: 0,
                  opacity: 0,
                  transition: {
                    rotate: { duration: 0 },
                    opacity: { delay: 0.18, duration: 0.04, ease: 'linear' },
                  },
                }}
                transition={{
                  rotate: { duration: 0.38, ease: swatchEase },
                  opacity: { duration: 0.04, ease: 'linear' },
                }}
                style={{ transformOrigin: 'center center' }}
              >
                {themes.map((theme, i) => {
                  const pos = interactivePositions[i];
                  if (!pos) return null;
                  const isActive = theme.id === activeThemeId;
                  const isHovered = i === hoveredIndex;
                  const isSelecting = i === selectingIndex;
                  const isHighlighted = isHovered || isSelecting;
                  const visualSize = isSelecting
                    ? SELECT_PETAL_SIZE
                    : isHovered
                      ? HOVER_PETAL_SIZE
                      : PETAL_SIZE;
                  const { openDelay } = getRingTiming(i);
                  const closeTransition = getCloseTransition(i);
                  const arcPath = getRingArcPath(i);
                  const openDuration = i < 7 ? 0.1 : 0.09;

                  return (
                    <motion.button
                      key={theme.id}
                      className={styles.petal}
                      initial={{
                        scale: 0.96,
                        x: arcPath.x[0],
                        y: arcPath.y[0],
                        filter: arcPath.filter[0],
                        scaleX: arcPath.scaleX[0],
                        scaleY: arcPath.scaleY[0],
                        width: PETAL_SIZE,
                        height: PETAL_SIZE,
                        marginLeft: -PETAL_SIZE / 2,
                        marginTop: -PETAL_SIZE / 2,
                      }}
                      animate={{
                        scale: 1,
                        x: isOpening ? arcPath.x : pos.x,
                        y: isOpening ? arcPath.y : pos.y,
                        filter: isOpening ? arcPath.filter : 'blur(0px)',
                        scaleX: isOpening ? arcPath.scaleX : 1,
                        scaleY: isOpening ? arcPath.scaleY : 1,
                        width: visualSize,
                        height: visualSize,
                        marginLeft: -visualSize / 2,
                        marginTop: -visualSize / 2,
                      }}
                      exit={{
                        scale: 0.28,
                        x: 0,
                        y: BLOOM_OFFSET_Y * 0.82,
                        opacity: [1, 0.85, 0],
                        filter: ['blur(0px)', 'blur(1.1px)', 'blur(2px)'],
                        scaleX: [1, 1.12, 0.9],
                        scaleY: [1, 0.94, 0.9],
                        width: PETAL_SIZE,
                        height: PETAL_SIZE,
                        marginLeft: -PETAL_SIZE / 2,
                        marginTop: -PETAL_SIZE / 2,
                        transition: {
                          ...closeTransition,
                          opacity: { ...closeTransition, times: [0, 0.42, 1] },
                        },
                      }}
                      transition={isOpening
                        ? { duration: openDuration, ease: 'linear', times: arcPath.times, delay: openDelay }
                        : (isHovered || isSelecting ? hoverTransition : petalTransition)
                      }
                      whileTap={{ scale: 0.94, transition: { duration: 0.1, ease: swatchEase } }}
                      onPointerEnter={() => {
                        if (!canInteract) return;
                        setHoveredIndex(i);
                        playHoverSound();
                      }}
                      onPointerLeave={() => setHoveredIndex((current) => current === i ? null : current)}
                      onClick={() => handleSelect(theme.id, i)}
                      aria-label={theme.name}
                      style={{
                        pointerEvents: canInteract ? 'auto' : 'none',
                        backgroundColor: theme.swatch,
                        zIndex: isHighlighted ? pos.z + 1 : pos.z,
                        border: isHighlighted ? '3px solid rgba(255,255,255,0.96)' : '3px solid transparent',
                        boxShadow: isHighlighted
                          ? `0 8px 22px ${theme.swatch}55`
                          : isActive
                            ? `0 3px 12px ${theme.glow}`
                            : '0 2px 8px rgba(0,0,0,0.06)',
                      }}
                    />
                  );
                })}
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
