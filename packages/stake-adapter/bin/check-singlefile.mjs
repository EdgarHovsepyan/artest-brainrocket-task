#!/usr/bin/env node
// Fails if a single-file build references any EXTERNAL resource (Stake rule).
// Usage: artest-check-singlefile <index.html>
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: artest-check-singlefile <index.html>');
  process.exit(2);
}
const text = readFileSync(file, 'utf8');
// Inert attribution / spec namespaces that are allowed to appear as text.
const allow = /(w3\.org|pixijs\.com|gsap\.com|greensock\.com)/i;
// Flag only RESOURCE-LOADING sites (scripts/styles/fonts/images), NOT runtime
// API endpoints (e.g. the RGS url the platform passes in) — those are required.
const patterns = [
  /(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)/gi,
  /url\(\s*["']?(https?:\/\/[^"')]+)/gi,
  /@import\s+["'](https?:\/\/[^"']+)/gi,
  /\bimport\s*\(\s*["'](https?:\/\/[^"']+)/gi,
];
const found = [];
for (const re of patterns) for (const m of text.matchAll(re)) found.push(m[1]);
const bad = [...new Set(found)].filter((u) => !allow.test(u));
if (bad.length) {
  console.error(`single-file FAIL: ${bad.length} external resource(s) in ${file}`);
  bad.slice(0, 20).forEach((u) => console.error('  ' + u));
  process.exit(1);
}
console.log(`single-file OK: no external resources in ${file}`);
