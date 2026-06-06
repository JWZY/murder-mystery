import { useEffect, useRef, useState } from 'react';
import s from './participant.module.css';

// Animates text on mount only. After completion, live text updates pass through
// without restarting — so a title like "Javan's file" doesn't re-animate on
// every keystroke. To force a new animation, change the component's React key.
export default function Typewriter({
  text,
  speed = 28,
  keepCaret = false,
  caret = true,
}: {
  text: string;
  speed?: number;
  keepCaret?: boolean;
  caret?: boolean;
}) {
  const initialTextRef = useRef(text);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = initialTextRef.current;
    if (!t) { setDone(true); return; }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= t.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => window.clearInterval(id);
  }, [speed]);

  if (done) {
    return (
      <>
        {text}
        {keepCaret && caret && <span className={s.tfCaret} data-done="true" aria-hidden>▍</span>}
      </>
    );
  }

  const initialText = initialTextRef.current;
  const finished = shown >= initialText.length;
  const showCaret = caret && (!finished || keepCaret);
  return (
    <>
      {initialText.slice(0, shown)}
      {showCaret && <span className={s.tfCaret} data-done={finished ? 'true' : 'false'} aria-hidden>▍</span>}
    </>
  );
}
