/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // relative asset paths: works on GitHub Pages under any repo name (no router)
  test: { include: ['tests/**/*.test.ts'] },
  build: {
    chunkSizeWarningLimit: 600, // the lazy three.js chunk is ~500 kB minified
    rollupOptions: {
      input: {
        main: 'index.html',
        help: 'help/index.html',
        helpEs: 'help/es.html',
      },
    },
  },
})
