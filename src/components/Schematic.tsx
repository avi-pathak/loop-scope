import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Snapshot } from '../interpreter/types';
import { usePalette } from '../lib/theme';
import CallStack from './CallStack';
import ConnectionLayer, { type Box, type AnchorKey, type Pulse, type RouteKey } from './ConnectionLayer';
import EventLoop from './EventLoop';
import MacrotaskQueue from './MacrotaskQueue';
import MicrotaskQueue from './MicrotaskQueue';
import RegistrationTicks from './RegistrationTicks';
import WebApis from './WebApis';

interface SchematicProps {
  snapshot: Snapshot;
}

let pulseSeq = 0;
const nextPulseId = () => `pulse-${(pulseSeq += 1)}`;

/** Derive signal routings from the change between two snapshots. */
function derivePulses(prev: Snapshot, cur: Snapshot): RouteKey[] {
  // Ignore resets / non-advances.
  if (cur.stepCount <= prev.stepCount) return [];
  const dApi = cur.webApis.length - prev.webApis.length;
  const dMacro = cur.macrotasks.length - prev.macrotasks.length;
  const dMicro = cur.microtasks.length - prev.microtasks.length;
  const dStack = cur.callStack.length - prev.callStack.length;

  const routes: RouteKey[] = [];
  if (dApi < 0 && dMacro > 0) routes.push('api-macro'); // timer matured
  if (dApi > 0) routes.push('stack-api'); // setTimeout registered
  if (dMacro < 0 && dStack > 0) routes.push('macro-stack'); // macrotask dispatched
  if (dMicro < 0 && dStack > 0) routes.push('micro-stack'); // microtask dispatched
  return routes;
}

function boxesEqual(a: Partial<Record<AnchorKey, Box>>, b: Partial<Record<AnchorKey, Box>>): boolean {
  const keys: AnchorKey[] = ['loop', 'stack', 'api', 'micro', 'macro'];
  for (const k of keys) {
    const x = a[k];
    const y = b[k];
    if (!x || !y) {
      if (x !== y) return false;
      continue;
    }
    if (x.x !== y.x || x.y !== y.y || x.w !== y.w || x.h !== y.h) return false;
  }
  return true;
}

/**
 * The visualization "sheet": the event-loop ring, the four component panels,
 * the SVG connection routing between them, and travelling signal pulses.
 */
export default function Schematic({ snapshot }: SchematicProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<HTMLDivElement>(null);
  const microRef = useRef<HTMLDivElement>(null);
  const macroRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [boxes, setBoxes] = useState<Partial<Record<AnchorKey, Box>>>({});
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const prevSnap = useRef<Snapshot>(snapshot);

  const measure = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cr = c.getBoundingClientRect();
    const toBox = (el: HTMLElement | null): Box | undefined => {
      if (!el) return undefined;
      const r = el.getBoundingClientRect();
      return { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height };
    };
    const next: Partial<Record<AnchorKey, Box>> = {
      loop: toBox(loopRef.current),
      stack: toBox(stackRef.current),
      api: toBox(apiRef.current),
      micro: toBox(microRef.current),
      macro: toBox(macroRef.current),
    };
    setSize((s) => (s.w === cr.width && s.h === cr.height ? s : { w: cr.width, h: cr.height }));
    setBoxes((b) => (boxesEqual(b, next) ? b : next));
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  // Re-measure after content height changes between steps.
  useLayoutEffect(() => {
    measure();
  }, [measure, snapshot.stepCount, snapshot.callStack.length, snapshot.webApis.length, snapshot.microtasks.length, snapshot.macrotasks.length]);

  // Emit pulses on snapshot transitions.
  useEffect(() => {
    const routes = derivePulses(prevSnap.current, snapshot);
    prevSnap.current = snapshot;
    if (routes.length === 0) return;
    setPulses((p) => [...p, ...routes.map((route) => ({ id: nextPulseId(), route }))]);
  }, [snapshot]);

  const removePulse = useCallback((id: string) => {
    setPulses((p) => p.filter((x) => x.id !== id));
  }, []);

  // Draw connections only when the panels are laid out as a 2×2 grid (i.e. the
  // macro panel sits to the right of the api panel, not stacked beneath it).
  const twoCol = !!(boxes.api && boxes.macro && boxes.macro.x > boxes.api.x + 20);
  const showConnections = twoCol && size.w > 0;

  return (
    <div ref={containerRef} className="relative px-3 pb-10 pt-1">
      <RegistrationTicks />

      {showConnections && (
        <ConnectionLayer
          width={size.w}
          height={size.h}
          boxes={boxes}
          pulses={pulses}
          onPulseDone={removePulse}
        />
      )}

      <div className="relative z-10 flex flex-col gap-9">
        <div ref={loopRef}>
          <EventLoop
            phase={snapshot.phase}
            phaseLabel={snapshot.phaseLabel}
            stepCount={snapshot.stepCount}
            clock={snapshot.clock}
          />
        </div>

        <div className="grid grid-cols-1 gap-x-16 gap-y-12 sm:grid-cols-2">
          <div ref={apiRef} className="h-[196px]">
            <WebApis items={snapshot.webApis} />
          </div>
          <div ref={macroRef} className="h-[196px]">
            <MacrotaskQueue items={snapshot.macrotasks} />
          </div>
          <div ref={microRef} className="h-[196px]">
            <MicrotaskQueue items={snapshot.microtasks} />
          </div>
          <div ref={stackRef} className="h-[196px]">
            <CallStack frames={snapshot.callStack} />
          </div>
        </div>
      </div>

      <SignalKey />
    </div>
  );
}

/** A small drafted key explaining the four signal colors. */
function SignalKey() {
  const { signals } = usePalette();
  return (
    <div className="pointer-events-none absolute bottom-1 right-3 z-20 hidden rounded-[2px] border border-ink/30 bg-panel/90 px-2 py-1 font-mono shadow-draft sm:block">
      <div className="mb-1 text-[8px] uppercase tracking-[0.2em] text-inkFaint">signal key</div>
      <div className="flex items-center gap-2.5">
        {(['stack', 'api', 'micro', 'macro'] as const).map((k) => (
          <span key={k} className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-inkSoft">
            <span className="h-2 w-2 rounded-[1px]" style={{ background: signals[k].color }} />
            {signals[k].label}
          </span>
        ))}
      </div>
    </div>
  );
}
