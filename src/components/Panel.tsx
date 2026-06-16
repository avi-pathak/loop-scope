import type { ReactNode } from 'react';
import { usePalette } from '../lib/theme';
import RegistrationTicks from './RegistrationTicks';
import MonoCount from './MonoCount';

interface PanelProps {
  /** Schematic component name, e.g. "CALL STACK". */
  tag: string;
  /** Secondary descriptor shown after a middot, e.g. "LIFO". */
  meta?: string;
  /** Accent ink for the label + count. */
  accent: string;
  count?: number;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * A drafted schematic frame: 1px navy border, near-square corners, an offset
 * "print" shadow, corner registration ticks, a component label straddling the
 * top edge, and a node-count badge.
 */
export default function Panel({
  tag,
  meta,
  accent,
  count,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  const { ink } = usePalette();
  return (
    <section
      className={`relative rounded-draft border border-ink bg-panel font-mono shadow-draft ${className ?? ''}`}
    >
      <RegistrationTicks />

      {/* Component label, tagged onto the top border like a drawing callout. */}
      <div
        className="absolute -top-[9px] left-3 flex items-center gap-1 bg-panel px-1.5 text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{ color: accent }}
      >
        <span className="text-ink/40">[</span>
        <span>{tag}</span>
        {meta && (
          <>
            <span className="text-ink/30">·</span>
            <span className="text-inkSoft">{meta}</span>
          </>
        )}
        <span className="text-ink/40">]</span>
      </div>

      {/* Node-count badge. */}
      {count !== undefined && (
        <div
          className="absolute -top-[10px] right-3 flex items-center gap-1 rounded-[2px] border bg-panel px-1.5 py-px text-[10px] font-bold tabular-nums"
          style={{ color: accent, borderColor: ink.INK_LINE }}
        >
          <span className="text-inkFaint">n=</span>
          <MonoCount value={count} />
        </div>
      )}

      <div className={`px-3 pb-3 pt-4 ${bodyClassName ?? ''}`}>{children}</div>
    </section>
  );
}
