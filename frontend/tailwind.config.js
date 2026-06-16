/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0d1117',
        panel: '#161b22',
        border: '#21262d',
        accent: '#00e5a0',
        'accent-dim': '#00b37d',
        danger: '#f85149',
        warning: '#d29922',
        muted: '#8b949e',
        text: '#e6edf3',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
