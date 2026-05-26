import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',   // escuchar en todas las interfaces → accesible desde la red
    strictPort: true,
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' http://localhost:4000 http://192.168.1.17:4000 ws://localhost:5173 ws://192.168.1.17:5173 ws://0.0.0.0:5173",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
      ].join('; ')
    }
  },
  optimizeDeps: {
    force: true,
    include: ['react','react-dom','react-dom/client','react-router-dom','chart.js','react-chartjs-2']
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react','react-dom','react-router-dom'],
          charts: ['chart.js','react-chartjs-2']
        }
      }
    }
  }
})
