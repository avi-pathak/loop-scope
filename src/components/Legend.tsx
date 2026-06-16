import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/** Collapsible "How the event loop works" help panel. */
export default function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-200"
      >
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
        How the event loop works
        <span className="ml-auto flex items-center gap-2 text-[11px] font-normal text-slate-500">
          <Dot className="bg-stackHue" /> stack
          <Dot className="bg-apiHue" /> web&nbsp;api
          <Dot className="bg-microHue" /> micro
          <Dot className="bg-macroHue" /> macro
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
            <ol className="space-y-1.5 px-4 pb-3 text-[13px] leading-relaxed text-slate-400">
              <li>
                <b className="text-slate-200">1. Sync first.</b> Synchronous code runs to completion —
                the call stack fully drains before anything async happens.
              </li>
              <li>
                <b className="text-slate-200">2. Web APIs.</b> <code>setTimeout</code> /{' '}
                <code>fetch</code> hand work to the browser. When a timer elapses its callback is
                placed on the <span className="text-macroHue">macrotask queue</span>.
              </li>
              <li>
                <b className="text-slate-200">3. Drain microtasks.</b> Once the stack is empty, the{' '}
                <span className="text-microHue">entire microtask queue</span> (Promise callbacks,{' '}
                <code>queueMicrotask</code>) is emptied — including microtasks queued by microtasks.
              </li>
              <li>
                <b className="text-slate-200">4. Render</b>, then pull exactly{' '}
                <span className="text-macroHue">one macrotask</span> and repeat from step&nbsp;3.
              </li>
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}
