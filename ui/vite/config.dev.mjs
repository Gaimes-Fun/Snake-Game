import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

// Get local IP address
const getLocalIP = () => {
  const networks = os.networkInterfaces()
  for (const name of Object.keys(networks)) {
    for (const net of networks[name]) {
      // Skip internal and non-IPv4 addresses
      if (!net.internal && net.family === 'IPv4') {
        return net.address
      }
    }
  }
  return 'localhost'
}

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        react(),
    ],
    server: {
        port: 8080,
        host: true, // Expose to all network interfaces
    }
})
