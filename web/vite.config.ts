import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

// Three pages, one build. Output lands in dist/ with js/ and css/ folders so
// web.go's embed and the /dist/ route keep serving the same tree.
export default defineConfig({
  plugins: [preact()],
  base: '/dist/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        mailbox: resolve(here, 'src/pages/mailbox/index.html'),
        settings: resolve(here, 'src/pages/settings/index.html'),
        templatehost: resolve(here, 'src/pages/template/index.html'),
      },
      output: {
        // Content hashes in every script and style name, so a browser
        // holding an old build always fetches the new files.
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (a) => (a.name?.endsWith('.css') ? 'css/[name]-[hash].css' : 'static/[name][extname]'),
      },
    },
  },
  server: {
    port: 8081,
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/ws': { target: 'ws://127.0.0.1:8080', ws: true },
    },
  },
});
