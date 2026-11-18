/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F4F5F7',
          card: '#FFFFFF',
          border: '#E2E8F0',
          orange: '#F97316',
          'orange-hover': '#EA580C',
          navy: '#0F172A',
          muted: '#64748B',
          success: '#16A34A',
          'success-soft': '#10B981',
          danger: '#DC2626',
          'danger-soft': '#EF4444',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        dark: {
          950: '#070a10',
          900: '#0a0e17',
          850: '#0f1420',
          800: '#151b2b',
          700: '#1e2638',
        },
        obsidian: {
          primary: '#F97316',
          secondary: '#38BDF8',
          tertiary: '#22C55E',
          neutral: '#0B0F17',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Syne"', 'sans-serif'],
      },
    }
  },
  plugins: []
}
