import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Single self-contained dist/index.html that runs from file:// (double-click).
// base: './' keeps every asset reference relative; singlefile inlines JS/CSS so
// there are no split chunks or classic worker files to fail under file://.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  worker: {
    // Classic/iife inline worker is the most robust from file:// across browsers.
    format: 'iife',
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 8_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
