import { useEffect, useRef, type ChangeEventHandler } from 'react';

function fitTextareaToContent(el: HTMLTextAreaElement) {
  const placeholder = el.placeholder;
  const value = el.value;
  el.style.height = 'auto';
  if (!value && placeholder) el.value = placeholder;
  const borderHeight = el.offsetHeight - el.clientHeight;
  el.style.height = `${el.scrollHeight + borderHeight}px`;
  if (!value && placeholder) el.value = value;
}

export default function AutoFitTextarea({
  autoFocus,
  className,
  value,
  placeholder,
  onChange,
}: {
  autoFocus?: boolean;
  className: string;
  value: string;
  placeholder?: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => fitTextareaToContent(el);
    fit();
    const frame = window.requestAnimationFrame(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    document.fonts?.ready.then(fit).catch(() => {});

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value, placeholder]);

  return (
    <textarea
      autoFocus={autoFocus}
      ref={ref}
      rows={1}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      onInput={(e) => fitTextareaToContent(e.currentTarget)}
    />
  );
}
