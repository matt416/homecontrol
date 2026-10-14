import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: { dedupe: ['zod'] },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8797', changeOrigin: true } },
  },
  build: {
    target: 'chrome106',
    // This Android WebView rejects hex-alpha colors when hosted by a legacy
    // target-SDK app. Emit rgba() so the readability gradients survive.
    cssTarget: 'chrome61',
    cssMinify: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
