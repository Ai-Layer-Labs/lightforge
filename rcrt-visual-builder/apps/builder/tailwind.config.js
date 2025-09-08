const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/management/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/heroui-breadcrumbs/src/**/*.{js,ts,jsx,tsx}',
    '../../node_modules/.pnpm/@heroui+theme*/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
    '../../node_modules/.pnpm/@heroui+*/node_modules/@heroui/*/dist/**/*.js'
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            background: "#0a0a0a",
            foreground: "#ffffff",
            primary: {
              DEFAULT: "#0072f5",
              foreground: "#ffffff",
            },
            focus: "#0072f5",
          },
        },
      },
    }),
  ],
};
