import type { QueueItem } from '../interpreter/types';
import QueuePanel from './QueuePanel';

export default function MicrotaskQueue({ items }: { items: QueueItem[] }) {
  return (
    <QueuePanel
      title="Microtask Queue"
      items={items}
      accentDot="bg-microHue"
      itemClass="border-violet-400/40 bg-violet-400/10"
      textClass="text-violet-200"
      hint="FIFO · drained completely after the stack empties (Promises, queueMicrotask)"
    />
  );
}
