import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CallStack from './components/CallStack';
import CodeEditor from './components/CodeEditor';
import Console from './components/ConsolePanel';
import Controls, { type RunState } from './components/Controls';
import EventLoop from './components/EventLoop';
import Legend from './components/Legend';
import MacrotaskQueue from './components/MacrotaskQueue';
import MicrotaskQueue from './components/MicrotaskQueue';
import WebApis from './components/WebApis';
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

  const activePreset = useMemo(() => PRESETS.find((p) => p.id === presetId), [presetId]);
  const editorReadOnly = runState === 'running';

  return (
    <div className="flex h-screen flex-col gap-3 p-3">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <img src="./loop.svg" alt="" className="h-7 w-7" />
          <h1 className="text-lg font-bold tracking-tight text-slate-100">
            Loop<span className="text-sky-400">Scope</span>
          </h1>
          <span className="hidden text-xs text-slate-500 sm:inline">
            interactive JavaScript event-loop visualizer
          </span>
        </div>
        <div className="ml-auto w-full lg:w-auto lg:flex-1">
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
      </header>

      {/* Main work area */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Left: editor */}
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-5">
          <Legend />
          {activePreset && (
            <p className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
              {activePreset.description}
            </p>
          )}
          <div className="min-h-[280px] flex-1">
            <CodeEditor
              value={code}
              onChange={handleCodeChange}
              currentLine={snapshot.currentLine}
              readOnly={editorReadOnly}
            />
          </div>
        </div>

        {/* Center: visualization */}
        <div className="flex min-h-0 flex-col gap-3 overflow-auto lg:col-span-7">
          <EventLoop
            phase={snapshot.phase}
            phaseLabel={snapshot.phaseLabel}
            stepCount={snapshot.stepCount}
            clock={snapshot.clock}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CallStack frames={snapshot.callStack} />
            <WebApis items={snapshot.webApis} />
            <MicrotaskQueue items={snapshot.microtasks} />
            <MacrotaskQueue items={snapshot.macrotasks} />
          </div>
        </div>
      </div>

      {/* Bottom: console */}
      <div className="h-44 shrink-0">
        <Console lines={snapshot.console} error={snapshot.error} />
      </div>
    </div>
  );
}
