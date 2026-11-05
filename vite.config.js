import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // `npm run build:demo` makes the browser-only demo for GitHub Pages (served from /pos-software/)
  base: mode === 'demo' ? '/pos-software/' : '/',
  build: { chunkSizeWarningLimit: 1000 }, // the single ~680 kB bundle is fine for a local app
  server: {
    port: 5173,
    // During development the API runs separately on port 3001
    proxy: { '/api': 'http://localhost:3001' },
  },
}))
