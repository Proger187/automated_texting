import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  base: './',
  server: {
    watch: {
      // Ignore Puppeteer/WhatsApp cache and auth dirs to prevent spurious hot reloads
      ignored: ['**/.wwebjs_cache/**', '**/.wwebjs_auth/**'],
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'main.ts',
        // bufferutil and utf-8-validate are optional native deps of 'ws'
        // (used by whatsapp-web.js). They don't exist in most installs so
        // we mark them external to prevent Vite from failing on them.
        vite: {
          build: {
            rollupOptions: {
              external: ['bufferutil', 'utf-8-validate', 'instagram-private-api', 'telegram'],
            },
          },
        },
      },
      preload: {
        input: 'preload.ts',
      },
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
