/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        raas: {
          maroon: {
            DEFAULT: '#4A0E17',
            light: '#6E1424',
            dark: '#2E050D',
            deep: '#1A0307',
          },
          gold: {
            DEFAULT: '#E5A93C',
            light: '#F5C768',
            dark: '#B87B1D',
          },
          marigold: {
            DEFAULT: '#F58220',
            light: '#FFA347',
            dark: '#CC610A',
          },
          cream: '#FFF9F0',
        }
      },
      fontFamily: {
        display: ['var(--font-cinzel)', 'serif'],
        sans: ['var(--font-outfit)', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
