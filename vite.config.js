import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {binaryAssetsPlugin} from './scripts/benchmark-assets.js'
const root=fileURLToPath(new URL('.',import.meta.url))
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/accidents/',
  plugins: [react(),binaryAssetsPlugin(root)],
  build: {
    rollupOptions: {
      input: {main:resolve(root,'index.html'),benchmark:resolve(root,'benchmark.html')},
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
