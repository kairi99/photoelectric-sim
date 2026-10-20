/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // relative asset paths: works on GitHub Pages under any repo name (no router)
  test: { include: ['tests/**/*.test.ts'] },
  build: {
    // The lazy 3D chunk (three.js + OrbitControls + the scene) is about 800 kB minified before gzip. It is only fetched when
    // the 3D bench starts, so the main bundle stays small; raise the warning threshold just above it instead of splitting three.js.
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      input: {
        main: 'index.html',
        help: 'help/index.html',
        helpEs: 'help/es.html',
      },
    },
  },
})
