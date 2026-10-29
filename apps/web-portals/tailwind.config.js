/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          bg: '#090A0F',
          surface: '#11131C',
          card: '#151824',
          border: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.04)',
        },
        telemetry: {
          cyan: '#06B6D4',
          light: '#22D3EE',
          glow: 'rgba(6, 182, 212, 0.25)',
        },
        profit: {
          emerald: '#10B981',
          light: '#34D399',
          glow: 'rgba(16, 185, 129, 0.25)',
        },
        anomaly: {
          rose: '#F43F5E',
          light: '#FB7185',
          glow: 'rgba(244, 63, 94, 0.25)',
        },
        alert: {
          amber: '#F59E0B',
          light: '#FBBF24',
        },
        ai: {
          violet: '#8B5CF6',
          light: '#A78BFA',
          glow: 'rgba(139, 92, 246, 0.25)',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -3px rgba(6, 182, 212, 0.35)',
        'glow-emerald': '0 0 20px -3px rgba(16, 185, 129, 0.35)',
        'glow-rose': '0 0 20px -3px rgba(244, 63, 94, 0.35)',
        'glow-violet': '0 0 20px -3px rgba(139, 92, 246, 0.35)',
        'card-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
}
