import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Forward /api to the Express server so the app, the API and Swagger can all be
// served from one origin (e.g. a single ngrok tunnel). Set VITE_API_URL=/api to use it.
const apiProxy = {
  '/api': { target: 'http://localhost:4000', changeOrigin: true },
}

// Vite rejects requests for unknown Host headers; allow ngrok's tunnel domains.
const allowedHosts = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy, allowedHosts },
  preview: { proxy: apiProxy, allowedHosts },
})
