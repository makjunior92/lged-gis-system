/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sidebar / brand palette tuned to the LGED mockup screenshots.
        brand: {
          50:  '#eef7f7',
          100: '#d5ebeb',
          500: '#2c5f5f',  // sidebar background
          600: '#234d4d',
          700: '#1a3b3b',
          800: '#102828',
        },
        accent: {
          500: '#1e88e5',  // primary CTA blue from mockups
          600: '#1976d2',
        },
        danger: {
          500: '#e53935',
        },
        success: {
          500: '#22c55e',
        },
      },
      fontFamily: {
        // Inter for Latin, Noto Sans Bengali for Bangla glyphs — browser falls
        // back automatically when a code point is missing in the first font.
        sans: ['Inter', '"Noto Sans Bengali"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        bn: ['"Noto Sans Bengali"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
