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

const btn =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';

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
        <button className={`${btn} bg-amber-500/90 text-amber-50 hover:bg-amber-500`} onClick={onPause}>
          ⏸ Pause
        </button>
      ) : (
        <button
          className={`${btn} bg-sky-500/90 text-sky-50 hover:bg-sky-500`}
          onClick={onRun}
          disabled={runState === 'done'}
        >
          ▶ Run
        </button>
      )}
      <button
        className={`${btn} bg-slate-700 text-slate-100 hover:bg-slate-600`}
        onClick={onStep}
        disabled={isRunning || runState === 'done'}
      >
        ⏭ Step
      </button>
      <button className={`${btn} bg-slate-700 text-slate-100 hover:bg-slate-600`} onClick={onReset}>
        ↺ Reset
      </button>

      <label className="ml-1 flex items-center gap-2 text-xs text-slate-400">
        Speed
        <input
          type="range"
          min={0}
          max={100}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="h-1 w-28 cursor-pointer accent-sky-400"
        />
      </label>

      <select
        value={presetId}
        onChange={(e) => onPresetChange(e.target.value)}
        className="ml-auto rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-400"
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
