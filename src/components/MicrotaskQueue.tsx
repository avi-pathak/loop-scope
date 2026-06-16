import type { QueueItem } from '../interpreter/types';
import { usePalette } from '../lib/theme';
import QueuePanel from './QueuePanel';

export default function MicrotaskQueue({ items }: { items: QueueItem[] }) {
  return <QueuePanel tag="Microtask Q" meta="FIFO" items={items} signal={usePalette().signals.micro} />;
}
