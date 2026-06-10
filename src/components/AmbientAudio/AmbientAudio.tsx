import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import styles from './AmbientAudio.module.css';
import vinylUrl from '../../../Vinyl.svg?url';

// Pull every mp3 from /music at the repo root, sorted by filename so the
// numeric prefixes (01., 08., 23., …) control playback order. Drop a new
// track into the folder and it joins the rotation on next build.
const trackModules = import.meta.glob<string>('../../../music/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});
const TRACKS: string[] = Object.keys(trackModules)
  .sort()
  .map((k) => trackModules[k]);

type AmbientAudioContextValue = {
  muted: boolean;
  playing: boolean;
  hasTracks: boolean;
  toggleMuted: () => void;
};

const AmbientAudioContext = createContext<AmbientAudioContextValue | null>(null);

function useAmbientAudio() {
  const value = useContext(AmbientAudioContext);
  if (!value) throw new Error('AmbientAudioToggle must be used inside AmbientAudioProvider');
  return value;
}

export function AmbientAudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const hasTracks = TRACKS.length > 0;

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !hasTracks) return;
    el.muted = muted;
    el.volume = 0.4;
    if (muted && !el.paused) el.pause();
  }, [hasTracks, muted]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !hasTracks) return;
    const syncPlaying = () => setPlaying(!el.paused && !el.ended);
    el.addEventListener('play', syncPlaying);
    el.addEventListener('playing', syncPlaying);
    el.addEventListener('pause', syncPlaying);
    el.addEventListener('ended', syncPlaying);
    syncPlaying();
    return () => {
      el.removeEventListener('play', syncPlaying);
      el.removeEventListener('playing', syncPlaying);
      el.removeEventListener('pause', syncPlaying);
      el.removeEventListener('ended', syncPlaying);
    };
  }, [hasTracks]);

  // When a track ends, advance to the next one (wrap to 0 after the last).
  // React's onEnded fires reliably; the effect below resumes while unmuted.
  function handleEnded() {
    setTrackIndex((i) => (i + 1) % TRACKS.length);
  }

  // Playback only starts once someone presses Unmute. Track changes continue
  // the rotation while unmuted, but stay silent while muted.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !hasTracks) return;
    if (muted) return;
    const p = el.play();
    if (p && typeof p.then === 'function') p.catch(() => { /* ignore */ });
  }, [hasTracks, muted, trackIndex]);

  const value = useMemo(() => ({
    muted,
    playing,
    hasTracks,
    toggleMuted: () => setMuted((m) => !m),
  }), [hasTracks, muted, playing]);

  return (
    <AmbientAudioContext.Provider value={value}>
      {hasTracks && (
        <audio
          ref={audioRef}
          src={TRACKS[trackIndex]}
          preload="auto"
          onEnded={handleEnded}
        />
      )}
      {children}
    </AmbientAudioContext.Provider>
  );
}

export function AmbientAudioToggle({ className }: { className?: string }) {
  const { muted, playing, hasTracks, toggleMuted } = useAmbientAudio();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {hasTracks && (
        <motion.button
          type="button"
          className={[
            styles.vinylButton,
            className ?? styles.muteBtn,
            playing ? styles.playing : '',
          ].filter(Boolean).join(' ')}
          onClick={toggleMuted}
          aria-label={muted ? 'Unmute background music' : 'Mute background music'}
          title={muted ? 'Unmute' : 'Mute'}
          exit={reduceMotion ? { opacity: 1 } : { opacity: [1, 1, 0] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.24, times: [0, 0.65, 1] }}
        >
          <motion.span
            className={styles.vinylDisc}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
          >
            <span className={styles.vinylSpin}>
              <img className={styles.vinylIcon} src={vinylUrl} alt="" aria-hidden="true" />
            </span>
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
