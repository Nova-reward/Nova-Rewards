/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    // Explicit breakpoints matching the three required design widths
    screens: {
      sm:  '375px',   // mobile
      md:  '768px',   // tablet
      lg:  '1024px',  // desktop
      xl:  '1280px',  // wide desktop
      '2xl': '1536px',
    },
    extend: {
      colors: {
        brand: {
          dark:   '#0f0f1a',
          card:   '#1a1a2e',
          border: '#2d2d4e',
          purple: '#7c3aed',
        },
      },
      // Minimum 44×44px touch targets (WCAG 2.5.5)
      minHeight: { touch: '44px' },
      minWidth:  { touch: '44px' },
      spacing:   { touch: '44px' },
    },
  },
  plugins: [
    // Touch-target utility: adds min-h-[44px] min-w-[44px] in one class
    function ({ addUtilities }) {
      addUtilities({
        '.touch-target': {
          'min-height': '44px',
          'min-width':  '44px',
        },
      });
    },
  ],
};
