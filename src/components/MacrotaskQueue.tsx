import type { QueueItem } from '../interpreter/types';
import QueuePanel from './QueuePanel';

export default function MacrotaskQueue({ items }: { items: QueueItem[] }) {
  return (
    <QueuePanel
      title="Macrotask Queue"
      items={items}
      accentDot="bg-macroHue"
      itemClass="border-orange-400/40 bg-orange-400/10"
      textClass="text-orange-200"
      hint="FIFO · exactly one task runs per loop turn (setTimeout / setInterval)"
    />
  );
}
