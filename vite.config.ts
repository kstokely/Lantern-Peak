import { defineConfig } from 'vite';

// base './' so the built site in dist/ opens from any folder or static host.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 4000 },
  server: { port: 5173, strictPort: false },
});
