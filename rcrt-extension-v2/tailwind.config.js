/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0072f5',
        secondary: '#7828c8',
        success: '#17c964',
        warning: '#f5a524',
        error: '#f31260',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
  darkMode: 'class',
}

