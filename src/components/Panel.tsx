import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  /** Tailwind text color class for the accent dot + title. */
  accent: string;
  count?: number;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/** Shared chrome for every visualization panel. */
export default function Panel({ title, accent, count, hint, children, className }: PanelProps) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-slate-700/60 bg-slate-900/60 backdrop-blur ${className ?? ''}`}
    >
      <header className="flex items-center gap-2 border-b border-slate-700/60 px-3 py-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h2>
        {count !== undefined && (
          <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-400">
            {count}
          </span>
        )}
      </header>
      <div className="flex-1 overflow-auto p-3">{children}</div>
      {hint && <p className="border-t border-slate-700/40 px-3 py-1.5 text-[11px] text-slate-500">{hint}</p>}
    </section>
  );
}
