// Vercel's build runs `node scripts/assemble-demo.mjs` from THIS subfolder (the
// project's Root Directory is games/shining-pop). This shim simply delegates to the
// real assembler at the repo root — which resolves the game sources from its OWN
// location (so they're always found) and writes public/ relative to the current
// working directory (so Vercel finds the output here). Keeps the deploy working
// without any dashboard changes.
import '../../../scripts/assemble-demo.mjs';
