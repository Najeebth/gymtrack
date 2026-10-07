import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'GymTrack - Workout Progress Tracker',
        short_name: 'GymTrack',
        description: 'Track workouts, sets, reps and progress - works offline.',
        theme_color: '#0369a1',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Take over immediately instead of waiting for all tabs to close
        skipWaiting: true,
        clientsClaim: true,
        // Drop old precaches from previous deploys right away
        cleanupOutdatedCaches: true,
        // Cache the app shell for offline loading, but NOT the HTML itself —
        // the HTML is handled by the navigateFallback/runtimeCaching rules
        // below so every navigation tries the network first and always
        // picks up a fresh deploy instead of a precached shell.
        globPatterns: ['**/*.{js,css,svg,png,ico}'],
        // Disable the plugin's default navigateFallback (it's bound to the
        // now-unprecached index.html) — navigation is handled entirely by
        // the NetworkFirst runtimeCaching rule below instead.
        navigateFallback: null,
        runtimeCaching: [
          {
            // Navigation requests (the HTML shell): always try network first
            // so a new deploy shows up immediately, falling back to the
            // cached shell only when offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gymtrack-shell-cache',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // GET requests to the API: serve from network, fall back to cache when offline
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'gymtrack-api-cache',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
})
