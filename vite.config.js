import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || 3001
  return {
    plugins: [react()],
    server: {
      // In development the browser talks to /api on the Vite port; Vite forwards it to Express.
      proxy: { '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true } },
    },
  }
})
