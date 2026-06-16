import { AnimatePresence, motion } from 'framer-motion';
import type { StackFrame } from '../interpreter/types';
import { usePalette } from '../lib/theme';
import Panel from './Panel';

/** Call stack — LIFO. Newest frame renders on top. */
export default function CallStack({ frames }: { frames: StackFrame[] }) {
  const S = usePalette().signals.stack;
  const reversed = [...frames].reverse();
  return (
    <Panel tag="Call Stack" meta="LIFO" accent={S.color} count={frames.length} className="h-full">
      <div className="flex h-full flex-col gap-1.5 overflow-auto">
        <AnimatePresence initial={false}>
          {reversed.map((frame, i) => (
            <motion.div
              key={frame.id}
              layout
              initial={{ opacity: 0, y: -10, scaleY: 0.9 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -10, scaleY: 0.9 }}
              transition={{ type: 'spring', stiffness: 520, damping: 34 }}
              className="flex items-center justify-between rounded-[2px] border px-2.5 py-1.5"
              style={{ borderColor: S.border, borderLeftWidth: 3, borderLeftColor: S.color, background: S.tint }}
            >
              <span className="truncate text-[12px] text-ink">
                <span className="mr-1.5 text-inkFaint">{i === 0 ? '▸' : ' '}</span>
                {frame.name}
                <span className="text-inkFaint">()</span>
              </span>
              {frame.line != null && (
                <span className="ml-2 shrink-0 text-[10px]" style={{ color: S.color }}>
                  ln {frame.line}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {frames.length === 0 && <EmptyRow label="stack empty" />}
      </div>
    </Panel>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="select-none py-5 text-center text-[11px] uppercase tracking-widest text-inkFaint">
      ┄ {label} ┄
    </p>
  );
}
