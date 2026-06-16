import { AnimatePresence, motion } from 'framer-motion';
import type { WebApiItem } from '../interpreter/types';
import { usePalette } from '../lib/theme';
import Panel from './Panel';

/** Web APIs — async operations in flight (timers with countdowns). */
export default function WebApis({ items }: { items: WebApiItem[] }) {
  const S = usePalette().signals.api;
  return (
    <Panel tag="Web APIs" meta="async" accent={S.color} count={items.length} className="h-full">
      <div className="flex h-full flex-col gap-1.5 overflow-auto">
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
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                className="rounded-[2px] border px-2.5 py-1.5"
                style={{ borderColor: S.border, borderLeftWidth: 3, borderLeftColor: S.color, background: S.tint }}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-[11px] text-ink">{item.label}</span>
                  {item.remaining != null && (
                    <span className="ml-2 shrink-0 text-[10px] tabular-nums" style={{ color: S.color }}>
                      t−{item.remaining}ms
                    </span>
                  )}
                </div>
                {/* Countdown rule, drafted as a thin ticked bar. */}
                <div className="mt-1.5 h-[3px] w-full bg-ink/10">
                  <motion.div
                    className="h-full"
                    style={{ background: S.color }}
                    animate={{ width: `${(1 - pct) * 100}%` }}
                    transition={{ type: 'tween', duration: 0.25 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {items.length === 0 && (
          <p className="select-none py-5 text-center text-[11px] uppercase tracking-widest text-inkFaint">
            ┄ idle ┄
          </p>
        )}
      </div>
    </Panel>
  );
}
