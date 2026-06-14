/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // served at the domain root (jabberlm.com) on Cloudflare Pages
  base: '/',
  build: {
    rollupOptions: {
      // multi-page: main app, interpretability lab, and plain-language explainer
      input: { main: 'index.html', lab: 'lab.html', explain: 'explain.html' },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
