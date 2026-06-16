import { AnimatePresence, motion } from 'framer-motion';
import type { QueueItem } from '../interpreter/types';
import type { SignalMeta } from '../lib/signals';
import Panel from './Panel';

interface QueuePanelProps {
  tag: string;
  meta: string;
  items: QueueItem[];
  signal: SignalMeta;
}

/** FIFO queue visualization shared by the micro- and macro-task panels. */
export default function QueuePanel({ tag, meta, items, signal }: QueuePanelProps) {
  return (
    <Panel tag={tag} meta={meta} accent={signal.color} count={items.length} className="h-full">
      <div className="flex h-full flex-col gap-1.5 overflow-auto">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scaleX: 0.92, x: -16 }}
              transition={{ type: 'spring', stiffness: 480, damping: 34 }}
              className="flex items-center gap-2 rounded-[2px] border px-2.5 py-1.5"
              style={{
                borderColor: signal.border,
                borderLeftWidth: 3,
                borderLeftColor: signal.color,
                background: signal.tint,
              }}
            >
              <span
                className="w-9 shrink-0 text-[9px] uppercase tracking-wider"
                style={{ color: i === 0 ? signal.color : 'rgba(27,42,74,0.35)' }}
              >
                {i === 0 ? 'head▸' : `+${i}`}
              </span>
              <span className="truncate text-[11px] text-ink">{item.label}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <p className="select-none py-4 text-center text-[11px] uppercase tracking-widest text-inkFaint">
            ┄ empty ┄
          </p>
        )}
      </div>
    </Panel>
  );
}
