import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Kept apart from vite.config.js on purpose: tests don't need the PWA plugin
// (service worker, manifest) or the dev proxy.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Don't process CSS (Tailwind) in tests; class names are still on the elements
    css: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/**/*.d.ts', 'src/types/**'],
    },
  },
});
