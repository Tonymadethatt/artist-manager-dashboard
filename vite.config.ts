import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE')
  const siteOrigin = (env.VITE_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '')

  /** Netlify/build CI sets `process.env`; `loadEnv` only reads `.env` files — merge so client bundle gets offsets/caps. */
  const envRecord = env as Record<string, string | undefined>
  const viteEnvString = (key: string) =>
    JSON.stringify(String((process.env[key] ?? envRecord[key] ?? '').trim()))

  return {
    define: {
      'import.meta.env.VITE_RESEND_USAGE_DAY_OFFSET': viteEnvString('VITE_RESEND_USAGE_DAY_OFFSET'),
      'import.meta.env.VITE_RESEND_USAGE_MONTH_OFFSET': viteEnvString('VITE_RESEND_USAGE_MONTH_OFFSET'),
      'import.meta.env.VITE_RESEND_DAILY_EMAIL_CAP': viteEnvString('VITE_RESEND_DAILY_EMAIL_CAP'),
      'import.meta.env.VITE_RESEND_MONTHLY_EMAIL_CAP': viteEnvString('VITE_RESEND_MONTHLY_EMAIL_CAP'),
    },
    plugins: [
    react(),
    tailwindcss(),
    {
      name: 'social-card-absolute-url',
      transformIndexHtml(html) {
        if (!siteOrigin) return html
        const abs = `${siteOrigin}/social-card.png`
        return html
          .replace(/content="\/social-card\.png"/g, `content="${abs}"`)
      },
    },
    ],
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
      // Mirrors production Netlify redirect: /agreements/:slug → public-agreement-pdf (needs `netlify dev`).
      '/agreements': {
        target: process.env.VITE_NETLIFY_FUNCTIONS_URL ?? 'http://127.0.0.1:8888',
        changeOrigin: true,
        rewrite: path => {
          const slug = path.replace(/^\/agreements\//, '').split('?')[0] ?? ''
          return `/.netlify/functions/public-agreement-pdf?slug=${encodeURIComponent(slug)}`
        },
      },
      // Mirrors production: /performance-report/:token → serve-performance-report-html (needs `netlify dev`).
      '/performance-report': {
        target: process.env.VITE_NETLIFY_FUNCTIONS_URL ?? 'http://127.0.0.1:8888',
        changeOrigin: true,
        rewrite: p => {
          const token = p.replace(/^\/performance-report\//, '').split('?')[0] ?? ''
          return `/.netlify/functions/serve-performance-report-html?token=${encodeURIComponent(token)}`
        },
      },
    },
    },
  }
})
