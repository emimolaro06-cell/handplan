/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde institucional Defensa y Justicia
        dj: {
          50:  '#f0faf0',
          100: '#d6f0d6',
          200: '#a8dfa8',
          300: '#6dc56d',
          400: '#3da83d',
          500: '#1e8a1e',
          600: '#166f16',
          700: '#125712',
          800: '#0d420d',
          900: '#072d07',
        },
        // Amarillo/dorado del escudo
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
      fontFamily: {
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        body:    ['"Inter"',   'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
