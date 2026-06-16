import { AnimatePresence, motion } from 'framer-motion';
import type { QueueItem } from '../interpreter/types';
import Panel from './Panel';

interface QueuePanelProps {
  title: string;
  items: QueueItem[];
  accentDot: string;
  itemClass: string;
  textClass: string;
  hint: string;
}

/** FIFO queue visualization shared by the micro- and macro-task panels. */
export default function QueuePanel({
  title,
  items,
  accentDot,
  itemClass,
  textClass,
  hint,
}: QueuePanelProps) {
  return (
    <Panel title={title} accent={accentDot} count={items.length} hint={hint} className="min-h-[120px]">
      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: -20 }}
              transition={{ type: 'spring', stiffness: 480, damping: 34 }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${itemClass}`}
            >
              <span className={`font-mono text-[10px] ${textClass} opacity-60`}>{i === 0 ? 'next →' : i + 1}</span>
              <span className={`font-mono text-xs ${textClass}`}>{item.label}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && <p className="py-4 text-center text-xs text-slate-500">empty</p>}
      </div>
    </Panel>
  );
}
