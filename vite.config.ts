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
      // multi-page: main app, interpretability lab, plain-language explainer,
      // and the "how a transformer works" guided learn page
      input: { main: 'index.html', lab: 'lab.html', explain: 'explain.html', learn: 'learn.html' },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
