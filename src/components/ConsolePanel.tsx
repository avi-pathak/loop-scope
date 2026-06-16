import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConsoleLine } from '../interpreter/types';

const LEVEL_STYLE: Record<ConsoleLine['level'], string> = {
  log: 'text-slate-200',
  info: 'text-sky-300',
  error: 'text-red-400',
};

/** On-screen console output panel. */
export default function ConsolePanel({ lines, error }: { lines: ConsoleLine[]; error: string | null }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines.length, error]);

  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-700/60 bg-slate-950/70">
      <header className="flex items-center gap-2 border-b border-slate-700/60 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">Console</h2>
        <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-400">
          {lines.length}
        </span>
      </header>
      <div className="flex-1 overflow-auto p-3 font-mono text-[13px] leading-relaxed">
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={`whitespace-pre-wrap ${LEVEL_STYLE[line.level]}`}
            >
              <span className="select-none text-slate-600">› </span>
              {line.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {error && (
          <div className="mt-1 whitespace-pre-wrap rounded-md bg-red-500/10 px-2 py-1 text-red-400">
            ⚠ {error}
          </div>
        )}
        {lines.length === 0 && !error && (
          <p className="text-xs text-slate-600">console output appears here…</p>
        )}
        <div ref={endRef} />
      </div>
    </section>
  );
}
