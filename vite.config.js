import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The secure API (Bakong, Resend, admin) runs in /server on port 8787.
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } },
  },
})
