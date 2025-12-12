// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const HMR_HOST = process.env.VITE_HMR_HOST
const HMR_CLIENT_PORT = process.env.VITE_HMR_CLIENT_PORT
const HMR_PROTOCOL = (process.env.VITE_HMR_PROTOCOL || 'wss') as 'ws' | 'wss'
const HMR_OVERLAY = (process.env.VITE_HMR_OVERLAY || 'true').toLowerCase() !== 'false'
const PUBLIC_HOST = process.env.VITE_PUBLIC_HOST || 'newlib.tau-edu.kz'

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
    allowedHosts: [PUBLIC_HOST],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
    ...(HMR_HOST
      ? {
          hmr: {
            host: HMR_HOST || PUBLIC_HOST,
            protocol: HMR_PROTOCOL,
            // Use public-facing port for the websocket client (e.g., 443 when behind TLS proxy)
            clientPort: HMR_CLIENT_PORT ? Number(HMR_CLIENT_PORT) : 443,
            path: '/@vite',
            overlay: HMR_OVERLAY,
          },
        }
      : {
          hmr: { overlay: HMR_OVERLAY },
        }),
  },
})

