/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0f0f1a',
          card: '#1a1a2e',
          border: '#2d2d4e',
          purple: '#7c3aed',
        },
      },
    },
  },
  plugins: [],
}
