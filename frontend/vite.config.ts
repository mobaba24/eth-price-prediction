import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This proxy is for local development ONLY.
    // In production, Nginx will handle the proxying.
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Your local backend server
        changeOrigin: true,
      },
    },
  },
})
