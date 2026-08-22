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
      // multi-page: main app, interpretability lab, plain-language explainer, the
      // "how a transformer works" guided learn page, the tool-use/harness demo, the
      // capstone, and `embed` — one demo on its own, for embedding in someone else's site
      input: {
        main: 'index.html',
        lab: 'lab.html',
        explain: 'explain.html',
        learn: 'learn.html',
        harness: 'harness.html',
        capstone: 'capstone.html',
        embed: 'embed.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
