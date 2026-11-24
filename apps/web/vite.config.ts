import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  // Absolute base: the app is a SPA served from the domain root, so deep links
  // like /trf/123 must resolve assets from "/" rather than relative to the URL.
  base: '/',
  plugins: [react()],
  // Same-origin /api like production (Caddy strips the prefix there too).
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
