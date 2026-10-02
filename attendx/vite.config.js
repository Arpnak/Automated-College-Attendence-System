import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST API → Node.js gateway
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // WebSocket connections for live sessions → gateway WS upgrade
      '/sessions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
