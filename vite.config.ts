import { defineConfig } from 'vitest/config';

// `base: './'` keeps asset paths relative so the build works under any
// GitHub Pages sub-path (https://<user>.github.io/akvariet/).
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  test: { include: ['tests/**/*.test.ts'] },
});
