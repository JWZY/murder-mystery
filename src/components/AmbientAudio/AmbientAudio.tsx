import { useEffect, useRef, useState } from 'react';
import styles from './AmbientAudio.module.css';

const STORAGE_KEY = 'mm:ambient-muted';

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

export default function AmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  // Try to start playback. Browsers block sound-on autoplay until the user
  // interacts, so retry on the first pointer/key event if the initial play
  // promise rejects.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || TRACKS.length === 0) return;
    el.muted = muted;
    el.volume = 0.4;

    let armed = true;
    const tryPlay = () => {
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.catch(() => { /* will retry on next user gesture */ });
      }
    };
    tryPlay();

    const onGesture = () => {
      if (!armed) return;
      tryPlay();
      if (!el.paused) {
        armed = false;
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
      }
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
    // Run once — mute toggle is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a track ends, advance to the next one (wrap to 0 after the last).
  // React's onEnded fires reliably; the new src auto-plays via the effect below.
  function handleEnded() {
    setTrackIndex((i) => (i + 1) % TRACKS.length);
  }

  // After the index changes, kick the next track into play. The audio element
  // pauses on src swap, so we explicitly call play() again.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || TRACKS.length === 0) return;
    const p = el.play();
    if (p && typeof p.then === 'function') p.catch(() => { /* ignore */ });
  }, [trackIndex]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch { /* noop */ }
    if (!muted && el.paused) {
      const p = el.play();
      if (p && typeof p.then === 'function') p.catch(() => { /* ignore */ });
    }
  }, [muted]);

  if (TRACKS.length === 0) return null;

  return (
    <>
      <audio
        ref={audioRef}
        src={TRACKS[trackIndex]}
        preload="auto"
        onEnded={handleEnded}
      />
      <button
        type="button"
        className={styles.muteBtn}
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? 'Unmute background music' : 'Mute background music'}
      >
        {muted ? 'Unmute' : 'Mute'}
      </button>
    </>
  );
}
