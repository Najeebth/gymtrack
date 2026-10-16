import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes: queries remain fresh for 2 min before background revalidation
      gcTime: 1000 * 60 * 10,   // 10 minutes: keep inactive data in cache
      refetchOnWindowFocus: true, // Auto-refetch when user focuses back on the tab
      retry: 1,                 // Retry failed queries once before showing error
    },
  },
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>,
)

// Registers the service worker (auto-updates in the background).
registerSW({ immediate: true })

// Force a page reload when a new service worker takes over,
// ensuring the user instantly sees the new deployment instead of the cached UI.
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
