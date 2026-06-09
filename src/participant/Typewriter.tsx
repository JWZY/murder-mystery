import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import s from './participant.module.css';

// Animates text on mount only. After completion, live text updates pass through
// without restarting — so a title like "Javan's file" doesn't re-animate on
// every keystroke. To force a new animation, change the component's React key.
export default function Typewriter({
  text,
  speed = 28,
  keepCaret = false,
  caret = true,
  delay = 0,
  reserveLayout = false,
  onDone,
}: {
  text: string;
  speed?: number;
  keepCaret?: boolean;
  caret?: boolean;
  delay?: number;
  reserveLayout?: boolean;
  onDone?: () => void;
}) {
  const initialTextRef = useRef(text);
  const onDoneRef = useRef(onDone);
  const finishedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const t = initialTextRef.current;
    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setShown(t.length);
      setDone(true);
      onDoneRef.current?.();
    };

    if (reduceMotion || !t) {
      finish();
      return;
    }

    let i = 0;
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= t.length) {
        if (intervalId) window.clearInterval(intervalId);
        finish();
      }
      }, speed);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [delay, reduceMotion, speed]);

  if (reduceMotion) return <>{text}</>;

  if (done) {
    const content = (
      <>
        {text}
        {keepCaret && caret && <span className={s.tfCaret} data-done="true" aria-hidden>▍</span>}
      </>
    );
    if (!reserveLayout) return content;
    return <span className={s.typewriterReserve}>{content}</span>;
  }

  const initialText = initialTextRef.current;
  const finished = shown >= initialText.length;
  const showCaret = caret && (!finished || keepCaret);
  const content = (
    <>
      {initialText.slice(0, shown)}
      {showCaret && <span className={s.tfCaret} data-done={finished ? 'true' : 'false'} aria-hidden>▍</span>}
    </>
  );

  if (!reserveLayout) return content;

  return (
    <span className={s.typewriterReserve}>
      <span aria-hidden className={s.typewriterGhost}>{text}</span>
      <span className={s.typewriterText}>{content}</span>
    </span>
  );
}
