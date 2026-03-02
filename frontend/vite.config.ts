import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/app/' : '/',
  server: {
    proxy: {
      '/api': 'http://localhost:8820',
      '/ws': {
        target: 'ws://localhost:8820',
        ws: true,
      },
    },
  },
}))
