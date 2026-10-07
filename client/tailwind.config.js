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
          'danger-soft': '#EF4444'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
}
