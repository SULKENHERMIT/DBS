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
        navy: {
          950: '#060a12', // ultra deep navy background
          900: '#0b111e', // main dark navy background
          850: '#11192b', // card background
          800: '#18233c', // card border / elevated surface
          700: '#223254', // subtle borders / hover
          600: '#344773',
        },
        brand: {
          teal: '#14b8a6',
          emerald: '#10b981',
          cyan: '#06b6d4',
          rose: '#f43f5e',
          amber: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}
