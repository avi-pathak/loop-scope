import type { Preset } from '../presets';

export type RunState = 'idle' | 'running' | 'paused' | 'done';

interface ControlsProps {
  runState: RunState;
  onRun: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (v: number) => void;
  presets: Preset[];
  presetId: string;
  onPresetChange: (id: string) => void;
}

const base =
  'inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-35';

// Outlined navy button (secondary).
const outlined = `${base} border-ink/40 bg-panel text-ink hover:border-ink hover:bg-ink/5`;
// Filled accent button (primary action only). Dark text on the brighter
// dark-mode accents keeps the label readable in both themes.
const primary = (hue: string) =>
  `${base} border-transparent text-white dark:text-paper ${hue} hover:opacity-90`;

export default function Controls({
  runState,
  onRun,
  onPause,
  onStep,
  onReset,
  speed,
  onSpeedChange,
  presets,
  presetId,
  onPresetChange,
}: ControlsProps) {
  const isRunning = runState === 'running';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isRunning ? (
        <button
          className={primary('bg-macroHue')}
          onClick={onPause}
        >
          ❚❚ Pause
        </button>
      ) : (
        <button
          className={primary('bg-stackHue')}
          onClick={onRun}
          disabled={runState === 'done'}
        >
          ▶ Run
        </button>
      )}
      <button className={outlined} onClick={onStep} disabled={isRunning || runState === 'done'}>
        ▶▶ Step
      </button>
      <button className={outlined} onClick={onReset}>
        ↺ Reset
      </button>

      <label className="ml-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-inkSoft">
        Speed
        <input
          type="range"
          min={0}
          max={100}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-ink/20 accent-stackHue"
        />
      </label>

      <div className="relative ml-auto">
        <span className="pointer-events-none absolute -top-[7px] left-2 bg-paper px-1 text-[8px] font-bold uppercase tracking-[0.2em] text-inkFaint">
          example
        </span>
        <select
          value={presetId}
          onChange={(e) => onPresetChange(e.target.value)}
          className="rounded-[2px] border border-ink/40 bg-panel px-2 py-1.5 text-[11px] font-medium text-ink focus:border-ink focus:outline-none"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
