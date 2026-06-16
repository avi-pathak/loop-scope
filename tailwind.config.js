/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Drafting-paper surfaces (driven by CSS variables → theme-reactive).
        paper: 'rgb(var(--paper) / <alpha-value>)',
        paper2: 'rgb(var(--paper2) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        // Structural ink
        ink: 'rgb(var(--ink) / <alpha-value>)',
        inkSoft: 'rgb(var(--ink-soft) / <alpha-value>)',
        inkFaint: 'rgb(var(--ink-faint) / <alpha-value>)',
        // One muted accent per signal type
        stackHue: 'rgb(var(--stack) / <alpha-value>)',
        apiHue: 'rgb(var(--api) / <alpha-value>)',
        microHue: 'rgb(var(--micro) / <alpha-value>)',
        macroHue: 'rgb(var(--macro) / <alpha-value>)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        annotate: ['"Caveat"', 'ui-sans-serif', 'cursive'],
      },
      boxShadow: {
        // Crisp offset "technical print" shadow — no blur.
        draft: '2px 2px 0 0 var(--draft-shadow)',
        draftLg: '3px 3px 0 0 var(--draft-shadow)',
      },
      borderRadius: {
        draft: '3px',
      },
      keyframes: {
        sweep: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        dashMarch: {
          to: { 'stroke-dashoffset': '-16' },
        },
        caretBlink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        typeIn: {
          from: { opacity: '0', transform: 'translateY(-2px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        sweep: 'sweep 8s linear infinite',
        dashMarch: 'dashMarch 1s linear infinite',
        caretBlink: 'caretBlink 1s steps(1) infinite',
        typeIn: 'typeIn 0.18s ease-out',
      },
    },
  },
  plugins: [],
};
