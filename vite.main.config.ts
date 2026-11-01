import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite / Rollup configuration for Electron Main Process
export default defineConfig({
  build: {
    target: 'node20',
    ssr: true,
    lib: {
      entry: resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: resolve(__dirname, 'dist/main'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: [
        'electron',
        'path',
        'fs',
        'fs/promises',
        'os',
        'child_process',
        'url',
        'events',
        'crypto',
        'stream',
        'util',
      ],
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
