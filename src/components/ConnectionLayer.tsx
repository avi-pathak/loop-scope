import { useMemo } from 'react';
import { usePalette } from '../lib/theme';
import type { SignalMeta } from '../lib/signals';

/** A measured box in container-local coordinates. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AnchorKey = 'loop' | 'stack' | 'api' | 'micro' | 'macro';
export type RouteKey = 'api-macro' | 'macro-stack' | 'micro-stack' | 'stack-api';

/** A travelling signal, rendered as a dot easing along a route's path. */
export interface Pulse {
  id: string;
  route: RouteKey;
}

interface ConnectionLayerProps {
  width: number;
  height: number;
  boxes: Partial<Record<AnchorKey, Box>>;
  pulses: Pulse[];
  onPulseDone: (id: string) => void;
}

type Dir = 'left' | 'right' | 'up' | 'down';

interface Connection {
  key: RouteKey | string;
  d: string;
  signal: SignalMeta | null;
  arrow?: { x: number; y: number; dir: Dir };
}

const pt = (x: number, y: number) => ({ x, y });

/** Horizontal-first orthogonal route. */
function orthH(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const d = `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`;
  const dir: Dir = b.x >= mx ? 'right' : 'left';
  return { d, arrow: { x: b.x, y: b.y, dir } };
}

/** Vertical-first orthogonal route. */
function orthV(a: { x: number; y: number }, b: { x: number; y: number }) {
  const my = (a.y + b.y) / 2;
  const d = `M ${a.x} ${a.y} L ${a.x} ${my} L ${b.x} ${my} L ${b.x} ${b.y}`;
  const dir: Dir = b.y >= my ? 'down' : 'up';
  return { d, arrow: { x: b.x, y: b.y, dir } };
}

function arrowPoints(x: number, y: number, dir: Dir, s = 6): string {
  switch (dir) {
    case 'right':
      return `${x},${y} ${x - s - 1},${y - s + 1} ${x - s - 1},${y + s - 1}`;
    case 'left':
      return `${x},${y} ${x + s + 1},${y - s + 1} ${x + s + 1},${y + s - 1}`;
    case 'down':
      return `${x},${y} ${x - s + 1},${y - s - 1} ${x + s - 1},${y - s - 1}`;
    case 'up':
      return `${x},${y} ${x - s + 1},${y + s + 1} ${x + s - 1},${y + s + 1}`;
  }
}

export default function ConnectionLayer({
  width,
  height,
  boxes,
  pulses,
  onPulseDone,
}: ConnectionLayerProps) {
  const { signals, ink } = usePalette();
  const { signalConns, loopConns } = useMemo(() => {
    const { stack, api, micro, macro, loop } = boxes;
    const signal: Connection[] = [];
    const loopC: Connection[] = [];

    if (api && macro) {
      const r = orthH(
        pt(api.x + api.w, api.y + api.h / 2),
        pt(macro.x, macro.y + macro.h / 2),
      );
      signal.push({ key: 'api-macro', d: r.d, signal: signals.macro, arrow: r.arrow });
    }
    if (macro && stack) {
      const r = orthV(
        pt(macro.x + macro.w / 2, macro.y + macro.h),
        pt(stack.x + stack.w / 2, stack.y),
      );
      signal.push({ key: 'macro-stack', d: r.d, signal: signals.macro, arrow: r.arrow });
    }
    if (micro && stack) {
      const r = orthH(
        pt(micro.x + micro.w, micro.y + micro.h / 2),
        pt(stack.x, stack.y + stack.h / 2),
      );
      signal.push({ key: 'micro-stack', d: r.d, signal: signals.micro, arrow: r.arrow });
    }
    if (stack && api) {
      // Feedback loop routed around the bottom-left perimeter channel.
      const bottomY = height - 10;
      const leftX = 10;
      const a = pt(stack.x + stack.w / 2, stack.y + stack.h);
      const b = pt(api.x, api.y + api.h / 2);
      const d = `M ${a.x} ${a.y} L ${a.x} ${bottomY} L ${leftX} ${bottomY} L ${leftX} ${b.y} L ${b.x} ${b.y}`;
      signal.push({ key: 'stack-api', d, signal: signals.api, arrow: { x: b.x, y: b.y, dir: 'right' } });
    }

    // Event-loop orchestration taps (faint) — hub → every panel top edge.
    if (loop) {
      const hub = pt(loop.x + loop.w / 2, loop.y + loop.h);
      const busY = loop.y + loop.h + 10;
      const named: [string, Box | undefined][] = [
        ['stack', stack],
        ['api', api],
        ['micro', micro],
        ['macro', macro],
      ];
      for (const [name, box] of named) {
        if (!box) continue;
        const px = box.x + box.w / 2;
        const top = box.y;
        const d = `M ${hub.x} ${hub.y} L ${hub.x} ${busY} L ${px} ${busY} L ${px} ${top}`;
        loopC.push({ key: `loop-${name}`, d, signal: null });
      }
    }

    return { signalConns: signal, loopConns: loopC };
  }, [boxes, height, signals]);

  const activeRoutes = useMemo(() => new Set(pulses.map((p) => p.route)), [pulses]);
  const routeById = useMemo(() => {
    const m = new Map<string, Connection>();
    for (const c of signalConns) m.set(c.key, c);
    return m;
  }, [signalConns]);

  if (!width || !height) return null;

  return (
    <>
      <svg
        width={width}
        height={height}
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden
      >
        {/* Orchestration taps from the event loop (very faint, dotted). */}
        {loopConns.map((c) => (
          <path
            key={c.key}
            d={c.d}
            fill="none"
            stroke={ink.INK_LINE}
            strokeWidth={1}
            strokeDasharray="1 5"
            opacity={0.7}
          />
        ))}

        {/* Signal routes. */}
        {signalConns.map((c) => {
          const active = activeRoutes.has(c.key as RouteKey);
          const color = c.signal ? c.signal.color : ink.INK_LINE;
          return (
            <g key={c.key}>
              <path
                d={c.d}
                fill="none"
                stroke={active ? color : ink.INK_LINE}
                strokeWidth={active ? 2 : 1.4}
                strokeDasharray={active ? undefined : '5 4'}
                className={active ? undefined : 'animate-dashMarch'}
                opacity={active ? 1 : 0.9}
              />
              {c.arrow && (
                <polygon
                  points={arrowPoints(c.arrow.x, c.arrow.y, c.arrow.dir)}
                  fill={color}
                  opacity={active ? 1 : 0.9}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Travelling signal pulses, above panels so they stay visible. */}
      <div className="pointer-events-none absolute inset-0 z-20">
        {pulses.map((p) => {
          const conn = routeById.get(p.route);
          if (!conn) return null;
          const color = conn.signal ? conn.signal.color : ink.INK;
          return (
            <div
              key={p.id}
              className="signal-dot"
              onAnimationEnd={() => onPulseDone(p.id)}
              style={{
                offsetPath: `path("${conn.d}")`,
                background: color,
                boxShadow: `0 0 0 3px ${conn.signal?.tint ?? ink.INK_FAINT}`,
                animation: 'signalTravel 720ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
              }}
            />
          );
        })}
      </div>
    </>
  );
}
