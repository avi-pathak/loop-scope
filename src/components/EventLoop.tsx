import { motion } from 'framer-motion';
import type { Phase } from '../interpreter/types';
import { usePalette } from '../lib/theme';
import type { Palette } from '../lib/signals';
import RegistrationTicks from './RegistrationTicks';

interface RingPhase {
  phase: Phase;
  ring: string;
}

const CYCLE: RingPhase[] = [
  { phase: 'sync', ring: 'SYNC' },
  { phase: 'check-stack-empty', ring: 'EMPTY?' },
  { phase: 'drain-microtasks', ring: 'MICRO' },
  { phase: 'render', ring: 'RENDER' },
  { phase: 'macrotask', ring: 'MACRO' },
];

const CX = 100;
const CY = 100;
const R = 64;

function nodeAngle(i: number): number {
  // Start at the top, advance clockwise.
  return (i * 360) / CYCLE.length - 90;
}
function nodePos(i: number, radius = R): { x: number; y: number } {
  const a = (nodeAngle(i) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

function phaseColor(phase: Phase, palette: Palette): string {
  const { signals, ink } = palette;
  switch (phase) {
    case 'sync':
      return signals.stack.color;
    case 'drain-microtasks':
      return signals.micro.color;
    case 'macrotask':
    case 'timer-advance':
      return signals.macro.color;
    case 'render':
      return signals.api.color;
    case 'error':
      return '#EF4444';
    case 'done':
      return '#22C55E';
    default:
      return ink.INK;
  }
}

interface EventLoopProps {
  phase: Phase;
  phaseLabel: string;
  stepCount: number;
  clock: number;
}

/** The centerpiece: a labeled phase ring with a hand pointing at the current phase. */
export default function EventLoop({ phase, phaseLabel, stepCount, clock }: EventLoopProps) {
  const palette = usePalette();
  const { ink } = palette;
  const idx = CYCLE.findIndex((c) => c.phase === phase);
  const activeIndex = phase === 'timer-advance' ? 4 : idx;
  const accent = phaseColor(phase, palette);
  const isError = phase === 'error';
  const isDone = phase === 'done';
  const hand = activeIndex >= 0 ? nodePos(activeIndex, R - 12) : null;

  return (
    <section className="relative rounded-draft border border-ink bg-panel font-mono shadow-draft">
      <RegistrationTicks />
      <div
        className="absolute -top-[9px] left-3 bg-panel px-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink"
      >
        <span className="text-ink/40">[ </span>EVENT LOOP<span className="text-ink/30"> · </span>
        <span className="text-inkSoft">scheduler</span>
        <span className="text-ink/40"> ]</span>
      </div>

      <div className="flex flex-col items-center gap-4 px-4 pb-4 pt-5 sm:flex-row sm:items-center sm:gap-6">
        {/* The ring */}
        <svg viewBox="-38 -2 276 204" className="h-[188px] w-[244px] shrink-0">
          {/* Outer dashed orbit */}
          <circle
            cx={CX}
            cy={CY}
            r={R + 18}
            fill="none"
            stroke={ink.INK_LINE}
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          {/* Connecting arc between nodes */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={ink.INK_LINE} strokeWidth={1} />

          {/* Slow continuous sweep tick to "sell" the loop */}
          <g className="origin-center animate-sweep" style={{ transformOrigin: '100px 100px' }}>
            <line x1={CX} y1={CY - (R + 12)} x2={CX} y2={CY - (R + 24)} stroke={ink.INK_LINE} strokeWidth={2} />
          </g>

          {/* Hand pointing at the active phase */}
          {hand && !isDone && !isError && (
            <motion.line
              x1={CX}
              y1={CY}
              initial={false}
              animate={{ x2: hand.x, y2: hand.y }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              stroke={accent}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          )}
          <circle cx={CX} cy={CY} r={3.5} fill={accent} />

          {/* Phase nodes */}
          {CYCLE.map((c, i) => {
            const p = nodePos(i);
            const active = i === activeIndex && !isDone && !isError;
            const col = active ? accent : ink.INK;
            const lp = nodePos(i, R + 30);
            const anchor = Math.abs(lp.x - CX) < 6 ? 'middle' : lp.x > CX ? 'start' : 'end';
            return (
              <g key={c.phase}>
                <motion.rect
                  x={p.x - 6}
                  y={p.y - 6}
                  width={12}
                  height={12}
                  rx={1.5}
                  animate={{ scale: active ? 1.25 : 1 }}
                  style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                  fill={active ? accent : 'rgb(var(--panel))'}
                  stroke={col}
                  strokeWidth={1.5}
                />
                <text
                  x={lp.x}
                  y={lp.y + 3}
                  textAnchor={anchor}
                  fontSize={9}
                  fontWeight={active ? 700 : 500}
                  letterSpacing="0.06em"
                  fill={active ? accent : ink.INK_SOFT}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {c.ring}
                </text>
              </g>
            );
          })}

          {/* Center index number */}
          <text
            x={CX}
            y={CY + 22}
            textAnchor="middle"
            fontSize={8}
            letterSpacing="0.1em"
            fill={ink.INK_FAINT}
            fontFamily="JetBrains Mono, monospace"
          >
            ↻ LOOP
          </text>
        </svg>

        {/* Readout */}
        <div className="w-full min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.25em] text-inkFaint">current phase</div>
          <div className="mt-0.5 flex items-center gap-2">
            <motion.span
              key={phase}
              className="inline-block h-2.5 w-2.5 rounded-[1px]"
              style={{ background: accent }}
              animate={isError || isDone ? {} : { opacity: [1, 0.35, 1] }}
              transition={{ repeat: Infinity, duration: 1.3 }}
            />
            <span className="truncate text-[15px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              {phaseLabel}
            </span>
          </div>

          <div className="my-3 h-px w-full" style={{ background: ink.INK_LINE }} />

          <dl className="grid grid-cols-2 gap-y-1 text-[11px]">
            <Readout label="step" value={String(stepCount).padStart(3, '0')} />
            <Readout label="clock" value={`${clock}ms`} />
          </dl>

          <p className="mt-3 max-w-[34ch] text-[10px] leading-relaxed text-inkSoft">
            {describe(phase)}
          </p>
        </div>
      </div>
    </section>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[9px] uppercase tracking-widest text-inkFaint">{label}</dt>
      <dd className="font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function describe(phase: Phase): string {
  switch (phase) {
    case 'sync':
      return '// executing synchronous code — the stack must fully drain first.';
    case 'check-stack-empty':
      return '// stack empty? if so, proceed to drain microtasks.';
    case 'drain-microtasks':
      return '// emptying the ENTIRE microtask queue before any macrotask.';
    case 'render':
      return '// the browser would paint here, between turns.';
    case 'macrotask':
      return '// pulling exactly one macrotask, then re-checking microtasks.';
    case 'timer-advance':
      return '// advancing simulated timers; ready callbacks → macrotask queue.';
    case 'done':
      return '// queues are empty. program complete.';
    case 'error':
      return '// uncaught error — see console log.';
    default:
      return '// idle. press RUN or STEP to drive the loop.';
  }
}
