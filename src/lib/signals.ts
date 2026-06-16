// Shared "signal" design tokens for the technical-blueprint UI. One muted accent
// per signal type, plus the structural ink colors used across every component.
//
// Two palettes are provided: a light drafting-paper theme and a dark "classic
// blueprint" theme (light cyan ink on deep navy). Components read the active
// palette through `usePalette()` so SVG attributes and inline styles — which
// can't use CSS variables directly — also switch with the theme.

export type SignalKind = 'stack' | 'api' | 'micro' | 'macro';

export interface SignalMeta {
  key: SignalKind;
  /** Schematic component label, e.g. shown as [ CALL STACK · LIFO ]. */
  label: string;
  /** Solid accent ink. */
  color: string;
  /** Faint fill behind item blocks. */
  tint: string;
  /** Border color for item blocks. */
  border: string;
}

export interface InkPalette {
  INK: string;
  INK_SOFT: string;
  INK_LINE: string;
  INK_FAINT: string;
}

export interface Palette {
  signals: Record<SignalKind, SignalMeta>;
  ink: InkPalette;
}

function signal(
  key: SignalKind,
  label: string,
  rgb: string,
  tintA: number,
  borderA: number,
): SignalMeta {
  return {
    key,
    label,
    color: `rgb(${rgb})`,
    tint: `rgb(${rgb} / ${tintA})`,
    border: `rgb(${rgb} / ${borderA})`,
  };
}

// Light drafting-paper theme.
export const LIGHT_PALETTE: Palette = {
  signals: {
    stack: signal('stack', 'STACK', '57 73 171', 0.07, 0.45),
    api: signal('api', 'WEB API', '15 118 110', 0.07, 0.45),
    micro: signal('micro', 'MICRO', '109 40 217', 0.07, 0.45),
    macro: signal('macro', 'MACRO', '180 83 9', 0.07, 0.45),
  },
  ink: {
    INK: 'rgb(27 42 74)',
    INK_SOFT: 'rgb(27 42 74 / 0.55)',
    INK_LINE: 'rgb(27 42 74 / 0.22)',
    INK_FAINT: 'rgb(27 42 74 / 0.1)',
  },
};

// Dark "neutral slate" theme: desaturated charcoal surfaces, soft off-white
// ink, and muted accents that read without glare.
export const DARK_PALETTE: Palette = {
  signals: {
    stack: signal('stack', 'STACK', '141 155 232', 0.16, 0.5),
    api: signal('api', 'WEB API', '92 187 173', 0.16, 0.5),
    micro: signal('micro', 'MICRO', '179 150 232', 0.16, 0.5),
    macro: signal('macro', 'MACRO', '224 168 90', 0.16, 0.5),
  },
  ink: {
    INK: 'rgb(226 230 237)',
    INK_SOFT: 'rgb(226 230 237 / 0.55)',
    INK_LINE: 'rgb(226 230 237 / 0.2)',
    INK_FAINT: 'rgb(226 230 237 / 0.1)',
  },
};
