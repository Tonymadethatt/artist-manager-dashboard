import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Forward Netlify functions when using `netlify dev` (default API port 8888).
  // Without this, Vite on :5173 returns 404 for `/.netlify/functions/*` and artist emails never send locally.
  server: {
    proxy: {
      '/.netlify/functions': {
        target: process.env.VITE_NETLIFY_FUNCTIONS_URL ?? 'http://127.0.0.1:8888',
        changeOrigin: true,
      },
      '/venue-email-ack': {
        target: process.env.VITE_NETLIFY_FUNCTIONS_URL ?? 'http://127.0.0.1:8888',
        changeOrigin: true,
        rewrite: (p) => {
          const token = p.replace(/^\/venue-email-ack\//, '').split('/')[0] ?? ''
          return `/.netlify/functions/venue-email-ack?token=${encodeURIComponent(token)}`
        },
      },
    },
  },
})
