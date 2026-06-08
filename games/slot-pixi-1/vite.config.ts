import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file output: JS + CSS inlined into one index.html. The game is
// all-Graphics + system fonts, so there are NO external resources to inline —
// the build satisfies the Stake "self-contained, no external resources" rule by
// construction. (When art is added, a base64 inline step goes here.)
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
  },
  server: { host: true, port: 5173, open: false },
});
