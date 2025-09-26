/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/sidepanel/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          750: '#263344',
          850: '#18202f',
        },
        white: {
          DEFAULT: '#ffffff',
        },
        black: {
          DEFAULT: '#000000',
        }
      },
      backgroundColor: {
        'white/5': 'rgba(255, 255, 255, 0.05)',
        'white/10': 'rgba(255, 255, 255, 0.1)',
        'white/20': 'rgba(255, 255, 255, 0.2)',
        'white/30': 'rgba(255, 255, 255, 0.3)',
        'white/40': 'rgba(255, 255, 255, 0.4)',
        'white/50': 'rgba(255, 255, 255, 0.5)',
        'white/60': 'rgba(255, 255, 255, 0.6)',
        'white/70': 'rgba(255, 255, 255, 0.7)',
        'black/20': 'rgba(0, 0, 0, 0.2)',
        'blue-500/5': 'rgba(59, 130, 246, 0.05)',
        'blue-500/10': 'rgba(59, 130, 246, 0.1)',
        'blue-500/20': 'rgba(59, 130, 246, 0.2)',
        'blue-500/30': 'rgba(59, 130, 246, 0.3)',
        'blue-500/50': 'rgba(59, 130, 246, 0.5)',
        'purple-500/10': 'rgba(168, 85, 247, 0.1)',
        'purple-500/20': 'rgba(168, 85, 247, 0.2)',
        'purple-500/30': 'rgba(168, 85, 247, 0.3)',
        'pink-500/10': 'rgba(236, 72, 153, 0.1)',
        'red-500/20': 'rgba(239, 68, 68, 0.2)',
      },
      textColor: {
        'white/30': 'rgba(255, 255, 255, 0.3)',
        'white/40': 'rgba(255, 255, 255, 0.4)',
        'white/50': 'rgba(255, 255, 255, 0.5)',
        'white/60': 'rgba(255, 255, 255, 0.6)',
        'white/70': 'rgba(255, 255, 255, 0.7)',
      },
      borderColor: {
        'white/10': 'rgba(255, 255, 255, 0.1)',
        'white/20': 'rgba(255, 255, 255, 0.2)',
        'blue-500/50': 'rgba(59, 130, 246, 0.5)',
      },
      placeholderColor: {
        'white/40': 'rgba(255, 255, 255, 0.4)',
      },
      maxWidth: {
        '85%': '85%',
      }
    },
  },
  plugins: [],
}


