// Architecture invariant (Gregory, "Game Engine Architecture" — strict layering):
// the PURE CORE must never depend on the engine. Nothing under logic/ or model/
// may import 'cc', so the math stays headless-testable and byte-identical across
// both the Cocos and Pixi engines. This test fails CI the moment that boundary
// is crossed — enforcing the invariant the root ESLint can't reach (Cocos
// assets/ are linted in-editor, so they're ignored by the monorepo lint).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, '..', 'assets', 'scripts');

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

// Matches `from 'cc'` / `from "cc"` and `require('cc')` — the Cocos engine entry.
const ENGINE_IMPORT = /\bfrom\s+['"]cc['"]|require\(\s*['"]cc['"]\s*\)/;

for (const layer of ['logic', 'model']) {
  test(`layering: assets/scripts/${layer} imports no engine ('cc')`, () => {
    const files = tsFiles(join(SCRIPTS, layer));
    assert.ok(files.length > 0, `expected .ts files under ${layer}/`);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      assert.ok(
        !ENGINE_IMPORT.test(src),
        `${file} imports 'cc' — the pure core must stay engine-free (Gregory: strict layering)`,
      );
    }
  });
}

// MVC dependency DIRECTION (Gregory + Nystrom): the dependency arrow points one
// way only — controller -> view -> model -> logic. A lower layer importing a
// higher one is a layering inversion (and a future circular-dependency / test
// bug). Assert each forbidden upward edge stays absent.
const importsFrom = (src: string, dir: string) =>
  new RegExp(`from\\s+['"][^'"]*\\b${dir}\\/`).test(src);

const FORBIDDEN: Array<[from: string, to: string[]]> = [
  ['logic', ['model', 'view', 'controller']], // pure core depends on nothing above
  ['model', ['view', 'controller']], // model is below the view
  ['view', ['controller']], // view never reaches up to the controller
];

for (const [layer, forbidden] of FORBIDDEN) {
  test(`layering: assets/scripts/${layer} never imports ${forbidden.join('/')} (one-way deps)`, () => {
    for (const file of tsFiles(join(SCRIPTS, layer))) {
      const src = readFileSync(file, 'utf8');
      for (const up of forbidden) {
        assert.ok(
          !importsFrom(src, up),
          `${file} imports '${up}/' — layering inversion (deps must flow controller→view→model→logic)`,
        );
      }
    }
  });
}
