/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: {
          light: '#F9E6A8',
          DEFAULT: '#F2A900',
          amber: '#F2A900',
          deep: '#CC6F00',
          bronze: '#CC6F00',
          espresso: '#4D2A00',
        },
        espresso: {
          50: '#fcfaf6',
          100: '#F9E6A8',
          200: '#f6dc84',
          300: '#F2A900',
          400: '#CC6F00',
          500: '#995300',
          600: '#733f00',
          700: '#4D2A00',
          800: '#2b1700',
          900: '#1c1206',
          950: '#120b02',
        },
      },
    },
  },
  plugins: [],
}