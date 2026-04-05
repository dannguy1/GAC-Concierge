import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8501,
    strictPort: true,
    host: true,
    proxy: {
      '/v1': 'http://127.0.0.1:8000',
      '/images': 'http://127.0.0.1:8000',
      '/downloaded_images': 'http://127.0.0.1:8000',
    }
  }
})
