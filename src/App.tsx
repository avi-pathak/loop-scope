import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeEditor from './components/CodeEditor';
import Console from './components/ConsolePanel';
import Controls, { type RunState } from './components/Controls';
import Legend from './components/Legend';
import Schematic from './components/Schematic';
import ThemeToggle from './components/ThemeToggle';
import { Runner } from './interpreter/eventLoop';
import type { Snapshot } from './interpreter/types';
import { DEFAULT_CODE, PRESETS } from './presets';

function emptySnapshot(): Snapshot {
  return {
    stepCount: 0,
    phase: 'idle',
    phaseLabel: 'Idle',
    currentLine: null,
    callStack: [],
    webApis: [],
    microtasks: [],
    macrotasks: [],
    console: [],
    error: null,
    done: false,
    clock: 0,
  };
}

/** Map the 0–100 speed slider to an inter-step delay in milliseconds. */
function speedToDelay(speed: number): number {
  return Math.max(15, Math.round(700 - speed * 6.6));
}

/** How long the finished state stays on screen before auto-resetting to idle. */
const AUTO_RESET_MS = 2800;

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [runState, setRunState] = useState<RunState>('idle');
  const [speed, setSpeed] = useState(55);

  const runnerRef = useRef<Runner | null>(null);
  const intervalRef = useRef<number | null>(null);

  const stopInterval = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /** Lazily (re)build the runner for the current code. */
  const ensureRunner = useCallback((): Runner => {
    if (!runnerRef.current) {
      runnerRef.current = new Runner(code);
    }
    return runnerRef.current;
  }, [code]);

  const doStep = useCallback((): boolean => {
    const runner = ensureRunner();
    const snap = runner.step();
    setSnapshot(snap);
    if (runner.done) {
      setRunState('done');
      return false;
    }
    return true;
  }, [ensureRunner]);

  const handleStep = useCallback(() => {
    if (runState === 'running' || runState === 'done') return;
    setRunState((s) => (s === 'idle' ? 'paused' : s));
    doStep();
  }, [doStep, runState]);

  const handleRun = useCallback(() => {
    if (runState === 'done') return;
    setRunState('running');
  }, [runState]);

  const handlePause = useCallback(() => {
    stopInterval();
    setRunState('paused');
  }, [stopInterval]);

  const handleReset = useCallback(() => {
    stopInterval();
    runnerRef.current = null;
    setSnapshot(emptySnapshot());
    setRunState('idle');
  }, [stopInterval]);

  const handleCodeChange = useCallback(
    (value: string) => {
      setCode(value);
      stopInterval();
      runnerRef.current = null;
      setSnapshot(emptySnapshot());
      setRunState('idle');
    },
    [stopInterval],
  );

  const handlePresetChange = useCallback(
    (id: string) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset) return;
      setPresetId(id);
      handleCodeChange(preset.code);
    },
    [handleCodeChange],
  );

  // Drive the simulation while running.
  useEffect(() => {
    if (runState !== 'running') return;
    const delay = speedToDelay(speed);
    intervalRef.current = window.setInterval(() => {
      const keepGoing = doStep();
      if (!keepGoing) stopInterval();
    }, delay);
    return stopInterval;
  }, [runState, speed, doStep, stopInterval]);

  useEffect(() => () => stopInterval(), [stopInterval]);

  // When a run finishes, hold the final state briefly, then auto-reset to idle
  // so the controls are immediately ready for another run.
  useEffect(() => {
    if (runState !== 'done') return;
    const t = window.setTimeout(() => handleReset(), AUTO_RESET_MS);
    return () => window.clearTimeout(t);
  }, [runState, handleReset]);

  const activePreset = useMemo(() => PRESETS.find((p) => p.id === presetId), [presetId]);
  const editorReadOnly = runState === 'running';

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 lg:h-screen lg:min-h-0">
      {/* Header — a drafted title block with a baseline rule. */}
      <header className="shrink-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-2">
          <div className="flex items-center gap-2.5">
            <img src="./loop.svg" alt="" className="h-8 w-8" />
            <div className="leading-none">
              <h1 className="font-mono text-lg font-bold tracking-tight text-ink">
                Loop<span className="text-stackHue">Scope</span>
              </h1>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.3em] text-inkSoft">
                event-loop schematic
              </p>
            </div>
            <span className="ml-2 hidden font-annotate text-base text-inkSoft/80 lg:inline">
              a live engineering diagram of the JS runtime
            </span>
          </div>
          <div className="ml-auto flex w-full items-center gap-2 lg:w-auto lg:flex-1">
            <div className="min-w-0 flex-1">
              <Controls
                runState={runState}
                onRun={handleRun}
                onPause={handlePause}
                onStep={handleStep}
                onReset={handleReset}
                speed={speed}
                onSpeedChange={setSpeed}
                presets={PRESETS}
                presetId={presetId}
                onPresetChange={handlePresetChange}
              />
            </div>
            <ThemeToggle />
          </div>
        </div>
        {/* Full-width baseline rule with end ticks. */}
        <div className="relative h-px w-full bg-ink/30">
          <span className="absolute -top-1 left-0 h-2 w-px bg-ink/30" />
          <span className="absolute -top-1 right-0 h-2 w-px bg-ink/30" />
        </div>
      </header>

      {/* Main work area */}
      <div className="grid grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:overflow-hidden">
        {/* Left: editor */}
        <div className="flex flex-col gap-3 lg:col-span-5 lg:min-h-0">
          <Legend />
          {activePreset && (
            <p className="rounded-draft border border-ink/30 bg-panel px-3 py-2 font-mono text-[11px] leading-relaxed text-inkSoft shadow-draft">
              <span className="font-bold uppercase tracking-wider text-ink">{activePreset.name}</span>
              <span className="mx-1.5 text-inkFaint">—</span>
              {activePreset.description}
            </p>
          )}
          <div className="h-[320px] lg:h-auto lg:min-h-0 lg:flex-1">
            <CodeEditor
              value={code}
              onChange={handleCodeChange}
              currentLine={snapshot.currentLine}
              readOnly={editorReadOnly}
            />
          </div>
        </div>

        {/* Center: the schematic */}
        <div className="lg:col-span-7 lg:min-h-0 lg:overflow-auto">
          <Schematic snapshot={snapshot} />
        </div>
      </div>

      {/* Bottom: console */}
      <div className="h-40 shrink-0 lg:h-40">
        <Console lines={snapshot.console} error={snapshot.error} />
      </div>
    </div>
  );
}
