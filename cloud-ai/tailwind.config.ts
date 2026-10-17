import type { Config } from 'tailwindcss'

/**
 * Cloud AI design tokens.
 *
 * Surfaces are translucent white/blue glass over a nature wallpaper. The accent
 * ramp is a CSS-variable driven aurora palette so the Settings screen can
 * re-tint the whole app (cyan -> blue -> violet -> teal) without rebuilding.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aurora: {
          cyan: 'var(--aurora-cyan, #22d3ee)',
          blue: 'var(--aurora-blue, #3b82f6)',
          violet: 'var(--aurora-violet, #8b5cf6)',
          teal: 'var(--aurora-teal, #14b8a6)',
        },
        cloud: {
          50: '#f7fbff',
          100: '#eef6ff',
          200: '#dbeafe',
          300: '#bfdbfe',
          400: '#93c5fd',
          500: '#60a5fa',
          600: '#3b82f6',
          700: '#2563eb',
          800: '#1d4ed8',
          900: '#1e3a8a',
        },
        ink: {
          DEFAULT: 'var(--ink, #0f172a)',
          soft: 'var(--ink-soft, #334155)',
          muted: 'var(--ink-muted, #64748b)',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          'Inter',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', '"Cascadia Code"', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        window: '1.25rem',
      },
      boxShadow: {
        glass: '0 18px 50px -20px rgba(15, 23, 42, 0.45), inset 0 1px 0 rgba(255,255,255,0.55)',
        float: '0 30px 70px -30px rgba(15, 23, 42, 0.55)',
        glow: '0 0 0 1px rgba(255,255,255,0.35), 0 0 32px -6px var(--glow-color, rgba(59,130,246,0.55))',
        lift: '0 22px 45px -22px rgba(15, 23, 42, 0.5)',
      },
      backdropBlur: {
        glass: '24px',
      },
      keyframes: {
        aurora: {
          '0%': { transform: 'translate3d(-6%, -4%, 0) scale(1.05)' },
          '50%': { transform: 'translate3d(6%, 4%, 0) scale(1.12)' },
          '100%': { transform: 'translate3d(-6%, -4%, 0) scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        aurora: 'aurora 24s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 6s ease infinite',
        'pulse-ring': 'pulseRing 1.8s ease-out infinite',
        rise: 'rise 0.4s ease-out both',
      },
    },
  },
  plugins: [],
}

export default config
