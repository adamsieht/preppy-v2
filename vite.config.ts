import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart(args) {
          args.startup()
        },
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'koffi'],
            },
          },
        },
      },
      {
        // Worker thread for off-main-thread raw printing via koffi FFI.
        // Output lands in dist/main alongside index.js, so the main bundle can
        // resolve it via path.join(__dirname, 'printerWorker.js').
        entry: 'src/main/services/printerWorker.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            // Built after the main entry — must not wipe its index.js output.
            emptyOutDir: false,
            rollupOptions: {
              external: ['koffi'],
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@preload': path.resolve(__dirname, 'src/preload'),
    },
  },
  build: {
    outDir: 'dist/renderer',
  },
})
