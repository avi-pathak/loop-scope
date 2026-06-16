/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stackHue: '#38bdf8', // sky-400 — call stack frames
        microHue: '#a78bfa', // violet-400 — microtasks
        macroHue: '#fb923c', // orange-400 — macrotasks
        apiHue: '#34d399', // emerald-400 — web apis
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        pulseRing: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(56, 189, 248, 0.5)' },
          '50%': { boxShadow: '0 0 0 8px rgba(56, 189, 248, 0)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
