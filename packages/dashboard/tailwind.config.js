import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0b0d',
        surface: '#111318',
        elevated: '#1a1d24',
        border: '#1e2330',
        'text-primary': '#e8eaf0',
        'text-secondary': '#7a8099',
        'text-muted': '#4a5066',
        'accent-green': '#00ff88',
        'accent-amber': '#ffaa00',
        'accent-red': '#ff3355',
        'accent-blue': '#4488ff',
        'accent-purple': '#aa66ff',
      },
    },
  },
  plugins: [],
} satisfies Config
