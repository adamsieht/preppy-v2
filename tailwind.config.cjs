/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Height-based breakpoints (raw media queries, not width-based)
        // 2 rows when viewport ≥ 580px tall (cards need 456px + 122px chrome)
        'tall':  { raw: '(min-height: 580px)' },
        // 3 rows when viewport ≥ 800px tall (cards need 678px + 122px chrome)
        'xtall': { raw: '(min-height: 800px)' },
      },
    },
  },
  plugins: [],
}
