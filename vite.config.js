import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/accidents/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/components/')) {
            return 'components';
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
