import type { Config } from 'tailwindcss';

// Design language: Linear / Stripe Dashboard / Notion
// Soft gray background, white elevated cards, rounded 16-20px, pastel accents.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F5F7', // soft gray app background
        card: '#FFFFFF',
        border: '#E8E8ED',
        ink: {
          DEFAULT: '#1D1D1F',
          muted: '#6E6E73',
          subtle: '#8E8E93',
        },
        accent: {
          purple: '#A78BFA',
          cyan: '#67E8F9',
          mint: '#6EE7B7',
          pink: '#F9A8D4',
        },
      },
      borderRadius: {
        card: '20px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
        'card-hover': '0 2px 6px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
