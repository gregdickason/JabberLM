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
      // multi-page: the main app and the standalone interpretability lab
      input: { main: 'index.html', lab: 'lab.html' },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
