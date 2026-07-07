/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#1e40af',
          700: '#1e3a5f',
          800: '#1e3260',
          900: '#172554',
        },
        brand: {
          DEFAULT: '#1e3a5f',
          light: '#2d5a8e',
          dark: '#142a45',
        },
      },
    },
  },
  plugins: [],
}
