import { useTheme } from '../lib/theme';

/** Compact outlined toggle that flips between the light and dark blueprint themes. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark mode"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-[2px] border border-ink/40 bg-panel px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink hover:bg-ink/5"
    >
      <span className="text-[13px] leading-none">{dark ? '☼' : '☾'}</span>
      <span className="hidden sm:inline">{dark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
