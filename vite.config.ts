/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // relative asset paths: works on GitHub Pages under any repo name (no router)
  test: { include: ['tests/**/*.test.ts'] },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        help: 'help/index.html',
        helpEs: 'help/es.html',
      },
    },
  },
})
