/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./web/index.html",
    "./web/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gauge-steel': 'var(--gauge-steel)',
        'ink': 'var(--ink)',
        'calibration-blue': 'var(--calibration-blue)',
        'verified-green': 'var(--verified-green)',
        'stamp-amber': 'var(--stamp-amber)',
        'stamp-amber-text': 'var(--stamp-amber-text)',
        'seal-break-red': 'var(--seal-break-red)',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'sans-serif'],
        heading: ['"Bricolage Grotesque"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
