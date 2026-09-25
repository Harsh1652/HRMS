import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxy = {
  '/api': { target: 'http://localhost:4000', changeOrigin: true },
}

const allowedHosts = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev']

export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy, allowedHosts },
  preview: { proxy: apiProxy, allowedHosts },
})
