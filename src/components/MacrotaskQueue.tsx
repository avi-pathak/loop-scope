import type { QueueItem } from '../interpreter/types';
import { usePalette } from '../lib/theme';
import QueuePanel from './QueuePanel';

export default function MacrotaskQueue({ items }: { items: QueueItem[] }) {
  return <QueuePanel tag="Macrotask Q" meta="FIFO" items={items} signal={usePalette().signals.macro} />;
}
