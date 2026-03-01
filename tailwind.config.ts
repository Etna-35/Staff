import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shell: '#f5f1e8',
        ink: '#231f1a',
        clay: '#d97757',
        citrus: '#efb431',
        pine: '#2d6a4f',
        fog: '#ece5d8',
      },
      boxShadow: {
        card: '0 18px 40px rgba(35, 31, 26, 0.08)',
      },
      borderRadius: {
        panel: '1.5rem',
      },
      fontFamily: {
        display: ['"Avenir Next"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"SF Pro Display"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;

