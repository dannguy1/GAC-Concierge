import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8503,
    host: '0.0.0.0',
    allowedHosts: ['gacaiserver', 'localhost'],
    proxy: {
      '/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/downloaded_images': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
