import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// ── Studio build config ──────────────────────────────────────────────────────
// DEV (`npm run dev`): standard Vite module server — fast HMR, real npm deps
//   (PixiJS, @esotericsoftware/spine-pixi-v8, gsap).
// BUILD (`npm run build`): `vite-plugin-singlefile` inlines JS + CSS into ONE
//   dist/index.html so the upload is a self-contained frontend with NO external
//   resources (Stake Engine constraint #7). Image/font assets live in /public
//   and ship as bundled LOCAL files alongside the HTML — Stake allows bundled
//   local assets; it only forbids external URLs / CDNs.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    // Keep large images/fonts as local files rather than base64-bloating the HTML.
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 4000,
  },
  server: { host: true, port: 5173, open: false },
  // The ported game references assets by relative path (assets/...) — served from /public.
  publicDir: 'public',
});
