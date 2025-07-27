import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'node18',
    ssr: true,
    outDir: 'dist',
  },
});