import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConsoleLine } from '../interpreter/types';
import RegistrationTicks from './RegistrationTicks';

const LEVEL_STYLE: Record<ConsoleLine['level'], string> = {
  log: 'text-ink',
  info: 'text-apiHue',
  error: 'text-red-700',
};

/** On-screen console rendered as a drafted log strip. */
export default function ConsolePanel({ lines, error }: { lines: ConsoleLine[]; error: string | null }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines.length, error]);

  return (
    <section className="relative flex h-full flex-col rounded-draft border border-ink bg-panel font-mono shadow-draft">
      <RegistrationTicks />
      <div className="absolute -top-[9px] left-3 bg-panel px-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink">
        <span className="text-ink/40">[ </span>CONSOLE<span className="text-ink/30"> · </span>
        <span className="text-inkSoft">stdout</span>
        <span className="text-ink/40"> ]</span>
      </div>
      <div
        className="absolute -top-[10px] right-3 rounded-[2px] border bg-panel px-1.5 py-px text-[10px] font-bold tabular-nums text-ink"
        style={{ borderColor: 'rgba(27,42,74,0.22)' }}
      >
        <span className="text-inkFaint">lines </span>
        {lines.length}
      </div>

      <div className="flex-1 overflow-auto px-3 pb-2 pt-3 text-[12px] leading-relaxed">
        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-2 whitespace-pre-wrap"
            >
              <span className="select-none tabular-nums text-inkFaint">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="select-none text-ink/30">▸</span>
              <span className={LEVEL_STYLE[line.level]}>{line.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {error && (
          <div className="mt-1 flex gap-2 whitespace-pre-wrap border-l-2 border-red-600 bg-red-600/5 px-2 py-1 text-red-700">
            <span className="select-none font-bold">⚠ ERR</span>
            <span>{error}</span>
          </div>
        )}
        {lines.length === 0 && !error && (
          <p className="select-none text-[11px] uppercase tracking-widest text-inkFaint">
            ┄ awaiting output · press run ┄
          </p>
        )}
        <div ref={endRef} />
      </div>
    </section>
  );
}
