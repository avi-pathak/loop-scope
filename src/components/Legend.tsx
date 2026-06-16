import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePalette } from '../lib/theme';
import RegistrationTicks from './RegistrationTicks';

/** Collapsible "How the event loop works" reference, drafted as a schematic note. */
export default function Legend() {
  const { signals } = usePalette();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative rounded-draft border border-ink bg-panel font-mono shadow-draft">
      <RegistrationTicks />
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-ink"
      >
        <span className="text-inkSoft">{open ? '▾' : '▸'}</span>
        How the event loop works
        <span className="ml-auto flex items-center gap-2">
          {(['stack', 'api', 'micro', 'macro'] as const).map((k) => (
            <Key key={k} color={signals[k].color} label={signals[k].label} />
          ))}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-ink/15 px-3 pb-3 pt-2">
              <ol className="space-y-1.5 text-[12px] leading-relaxed text-inkSoft">
                <Step n="1" title="Sync first">
                  synchronous code runs to completion — the call stack fully drains before anything
                  async happens.
                </Step>
                <Step n="2" title="Web APIs">
                  <code className="text-apiHue">setTimeout</code> hands work to the browser; when a
                  timer elapses its callback lands on the{' '}
                  <span className="font-bold text-macroHue">macrotask</span> queue.
                </Step>
                <Step n="3" title="Drain microtasks">
                  once the stack is empty, the{' '}
                  <span className="font-bold text-microHue">entire microtask</span> queue empties —
                  including microtasks queued by microtasks.
                </Step>
                <Step n="4" title="Render + one macro">
                  the browser paints, then exactly{' '}
                  <span className="font-bold text-macroHue">one macrotask</span> runs, and the loop
                  repeats from step 3.
                </Step>
              </ol>
              <p className="mt-2 font-annotate text-[15px] leading-none text-stackHue/80">
                ↳ the loop never blocks — it just keeps turning.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="select-none font-bold text-ink">{n}.</span>
      <span>
        <b className="text-ink">{title}.</b> {children}
      </span>
    </li>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="hidden items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-inkSoft md:flex">
      <span className="h-2 w-2 rounded-[1px]" style={{ background: color }} />
      {label}
    </span>
  );
}
