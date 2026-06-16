import { motion } from 'framer-motion';
import type { Phase } from '../interpreter/types';

const CYCLE: { phase: Phase; label: string }[] = [
  { phase: 'sync', label: 'Run sync' },
  { phase: 'check-stack-empty', label: 'Stack empty?' },
  { phase: 'drain-microtasks', label: 'Drain micro' },
  { phase: 'render', label: 'Render' },
  { phase: 'macrotask', label: 'One macro' },
];

interface EventLoopProps {
  phase: Phase;
  phaseLabel: string;
  stepCount: number;
  clock: number;
}

/** Pulsing event-loop indicator + step / clock readouts. */
export default function EventLoop({ phase, phaseLabel, stepCount, clock }: EventLoopProps) {
  const activeIndex = CYCLE.findIndex((c) => c.phase === phase);
  const isError = phase === 'error';
  const isDone = phase === 'done';

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.span
            key={phase}
            className={`inline-block h-3 w-3 rounded-full ${
              isError ? 'bg-red-400' : isDone ? 'bg-emerald-400' : 'bg-sky-400'
            }`}
            animate={isError || isDone ? {} : { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1.3 }}
          />
          <span className="text-sm font-semibold text-slate-100">{phaseLabel}</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
          <span>
            step <span className="text-slate-200">{stepCount}</span>
          </span>
          <span>
            clock <span className="text-slate-200">{clock}ms</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {CYCLE.map((c, i) => {
          const active = i === activeIndex;
          return (
            <div key={c.phase} className="flex items-center gap-1.5">
              <span
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-sky-400/20 text-sky-200 ring-1 ring-sky-400/50'
                    : 'bg-slate-800/60 text-slate-500'
                }`}
              >
                {c.label}
              </span>
              {i < CYCLE.length - 1 && <span className="text-slate-600">→</span>}
            </div>
          );
        })}
        <span className="text-slate-600">↻</span>
      </div>
    </div>
  );
}
