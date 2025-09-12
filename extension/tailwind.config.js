/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/sidepanel/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          750: '#263344',
          850: '#18202f',
        }
      },
      maxWidth: {
        '85%': '85%',
      }
    },
  },
  plugins: [],
}


