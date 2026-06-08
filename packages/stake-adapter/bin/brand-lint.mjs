#!/usr/bin/env node
// Fails if a shipped artifact contains platform/competitor brand tokens.
// Usage: artest-brand-lint <file> [<file> ...]
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: artest-brand-lint <file> [<file> ...]');
  process.exit(2);
}
const banned = /\b(stake|pascal|betconstruct)\b/i;
let failed = false;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const hits = [];
  lines.forEach((l, i) => {
    if (banned.test(l)) hits.push(`${i + 1}: ${l.trim().slice(0, 100)}`);
  });
  if (hits.length) {
    failed = true;
    console.error(`brand-lint FAIL (${hits.length}) in ${file}:`);
    hits.slice(0, 20).forEach((h) => console.error('  ' + h));
  } else {
    console.log(`brand-lint OK: ${file}`);
  }
}
process.exit(failed ? 1 : 0);
