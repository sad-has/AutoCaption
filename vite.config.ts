import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { devTranscriptionMiddleware } from './scripts/devServerTranscription';

// Vite configuration for the React Renderer Process
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dev-transcription-server',
      configureServer(server) {
        server.middlewares.use(devTranscriptionMiddleware);
      },
    },
  ],
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
