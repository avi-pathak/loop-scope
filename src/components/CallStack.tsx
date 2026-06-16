import { AnimatePresence, motion } from 'framer-motion';
import type { StackFrame } from '../interpreter/types';
import Panel from './Panel';

/** Call stack — LIFO. Newest frame renders on top. */
export default function CallStack({ frames }: { frames: StackFrame[] }) {
  const reversed = [...frames].reverse();
  return (
    <Panel
      title="Call Stack"
      accent="bg-stackHue"
      count={frames.length}
      hint="LIFO · functions push on entry, pop on return"
      className="min-h-[180px]"
    >
      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {reversed.map((frame) => (
            <motion.div
              key={frame.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="flex items-center justify-between rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2"
            >
              <span className="font-mono text-sm text-sky-200">{frame.name}</span>
              {frame.line != null && (
                <span className="font-mono text-[11px] text-sky-400/70">line {frame.line}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {frames.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-500">stack is empty</p>
        )}
      </div>
    </Panel>
  );
}
