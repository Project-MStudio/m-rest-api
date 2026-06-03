/** @type {import('tailwindcss').Config} */
// Theme palette lives here so utility classes stay readable (bg-bg, text-accent, ...).
// Softened from the prototype's harsh neon: translucent fills + low-opacity borders.
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './features/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background: warm dark slate-green.
        bg: '#151a17',
        panel: '#1b211d',
        // Softened neon accent.
        accent: '#5ee892',
        // Muted shades for borders and text.
        muted: '#8a978f',
        line: 'rgba(94,232,146,0.18)', // low-opacity green border
        fill: 'rgba(94,232,146,0.16)', // translucent active-button fill
        ok: '#5ee892',
        err: '#ff6b6b',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(94,232,146,0.35)', // soft glow only
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
