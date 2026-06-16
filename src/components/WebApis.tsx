import { AnimatePresence, motion } from 'framer-motion';
import type { WebApiItem } from '../interpreter/types';
import Panel from './Panel';

/** Web APIs — async operations in flight (timers with countdowns). */
export default function WebApis({ items }: { items: WebApiItem[] }) {
  return (
    <Panel
      title="Web APIs"
      accent="bg-apiHue"
      count={items.length}
      hint="Timers run here, then hand their callback to the macrotask queue"
      className="min-h-[140px]"
    >
      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const pct =
              item.delay > 0 && item.remaining != null
                ? Math.max(0, Math.min(1, item.remaining / item.delay))
                : 0;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-emerald-200">{item.label}</span>
                  {item.remaining != null && (
                    <span className="font-mono text-[11px] text-emerald-300/80">
                      {item.remaining}ms
                    </span>
                  )}
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-emerald-900/60">
                  <motion.div
                    className="h-full rounded-full bg-emerald-400"
                    animate={{ width: `${(1 - pct) * 100}%` }}
                    transition={{ type: 'tween', duration: 0.25 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {items.length === 0 && (
          <p className="py-5 text-center text-xs text-slate-500">no async work in flight</p>
        )}
      </div>
    </Panel>
  );
}
