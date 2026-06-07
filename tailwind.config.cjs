/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Height-based breakpoints (raw media queries, not width-based)
        // 2 rows when viewport ≥ 600px tall (cards 200px × 2 + gaps/padding + ~142px chrome = 590px)
        'tall':  { raw: '(min-height: 600px)' },
        // 3 rows when viewport ≥ 800px tall (cards 200px × 3 + gaps/padding + ~142px chrome = 790px)
        'xtall': { raw: '(min-height: 800px)' },
      },
    },
  },
  plugins: [],
}
