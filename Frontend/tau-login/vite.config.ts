// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const hmrHost = process.env.VITE_HMR_HOST

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    strictPort: false,
    cors: true,
    allowedHosts: ['newlib.tau-edu.kz'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
    ...(hmrHost
      ? {
          hmr: { host: (hmrHost || "newlib.tau-edu.kz"), protocol: "wss", port: Number(process.env.VITE_HMR_PORT ?? 443), clientPort: Number(process.env.VITE_HMR_CLIENT_PORT ?? 443) },
        }
      : {}),
  },
})

