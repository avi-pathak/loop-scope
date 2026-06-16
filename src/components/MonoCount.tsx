import { useEffect, useRef, useState } from 'react';

/**
 * A monospace number that performs a quick "type-in" flicker whenever it
 * changes — a blinking caret appears briefly and the digit eases in. Pure
 * presentation; reinforces the technical readout feel.
 */
export default function MonoCount({ value }: { value: number }) {
  const [typing, setTyping] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setTyping(true);
      const t = window.setTimeout(() => setTyping(false), 360);
      return () => window.clearTimeout(t);
    }
  }, [value]);

  return (
    <span className="inline-flex items-center tabular-nums">
      <span key={value} className="animate-typeIn">
        {value}
      </span>
      {typing && <span className="ml-px inline-block h-[1em] w-[5px] bg-current animate-caretBlink" />}
    </span>
  );
}
