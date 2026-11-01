import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite / Rollup configuration for Electron Preload Script
export default defineConfig({
  build: {
    target: 'node20',
    ssr: true,
    lib: {
      entry: resolve(__dirname, 'src/preload/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: resolve(__dirname, 'dist/preload'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ['electron'],
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
