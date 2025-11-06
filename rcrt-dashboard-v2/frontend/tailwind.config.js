import { heroui } from '@heroui/react';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // RCRT Brand Colors
        'rcrt-primary': '#00f5ff',
        'rcrt-secondary': '#8a2be2', 
        'rcrt-accent': '#00ff88',
        'rcrt-warning': '#ffa500',
        'rcrt-danger': '#ff6b6b',
        
        // Dark theme palette
        'dark': {
          50: '#f8fafc',
          100: '#f1f5f9', 
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        
        // Node type colors
        'node': {
          'breadcrumb': '#64748b',
          'agent': '#00f5ff',
          'agent-definition': '#8a2be2',
          'tool': '#ffa500', 
          'secret': '#ff6b6b',
          'chat': '#00ff88'
        },
        
        // Connection type colors
        'connection': {
          'creation': '#00ff88',
          'subscription': '#0099ff',
          'tool-response': '#ffa500',
          'agent-thinking': '#ff6b6b',
          'secret-usage': '#ff6b6b'
        }
      },
      
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor' },
          '100%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        }
      },
      
      backdropBlur: {
        xs: '2px',
      },
      
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      }
    },
  },
  plugins: [
    // HeroUI plugin (must come first)
    heroui({
      defaultTheme: "dark",
      themes: {
        dark: {
          colors: {
            background: "#0f1117",
            foreground: "#ffffff",
            content1: "#1a1d2e",
            content2: "#252938",
            content3: "#2d3348",
            content4: "#363b55",
            default: {
              DEFAULT: "#3a3f5c",
              foreground: "#ffffff",
            },
            primary: {
              DEFAULT: "#00f5ff",
              foreground: "#000000",
            },
            secondary: {
              DEFAULT: "#a855f7",
              foreground: "#ffffff",
            },
            success: {
              DEFAULT: "#10b981",
              foreground: "#000000",
            },
            warning: {
              DEFAULT: "#f59e0b",
              foreground: "#000000",
            },
            danger: {
              DEFAULT: "#ef4444",
              foreground: "#ffffff",
            },
          },
        },
      },
    }),
    // Add custom utilities
    function({ addUtilities }) {
      const newUtilities = {
        '.glass': {
          'background': 'rgba(255, 255, 255, 0.1)',
          'backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.glass-dark': {
          'background': 'rgba(0, 0, 0, 0.3)',
          'backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.gradient-rcrt': {
          'background': 'linear-gradient(135deg, #0f0f0f, #1a1a2e)',
        },
        '.gradient-node': {
          'background': 'linear-gradient(135deg, rgba(100, 116, 139, 0.1), rgba(100, 116, 139, 0.05))',
        },
        '.text-glow': {
          'text-shadow': '0 0 10px currentColor',
        }
      }
      
      addUtilities(newUtilities)
    }
  ],
}
