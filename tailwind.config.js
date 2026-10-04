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
      },
      fontSize: {
        'xs': ['14px', '20px'],
        'sm': ['14px', '20px'],
        'base': ['16px', '24px'],
        'lg': ['18px', '28px'],
        'xl': ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['30px', '36px'],
      }
    },
  },
  plugins: [],
}
