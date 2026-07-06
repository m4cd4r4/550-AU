/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        spike: fileURLToPath(new URL('spike.html', import.meta.url))
      }
    }
  },
  test: {
    include: ['tests/**/*.test.ts']
  }
});
