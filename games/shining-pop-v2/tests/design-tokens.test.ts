// Shared design-token contract (Gregory: data-driven, single source of truth +
// Schell: consistency lens). games/design-tokens.json is the canonical brand
// palette; this test fails CI if the Cocos palette (PAL) or the ceremony tier
// colours drift from it — so a colour change must be made in ONE place and the
// two engines can never silently diverge. Reads the JSON from disk (no import
// assertions needed) and compares against the live config.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAL } from '../assets/scripts/view/palette';
import { VIEW_CONFIG } from '../assets/scripts/view/view-config';

const HERE = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(HERE, '..', '..', 'design-tokens.json'), 'utf8')) as {
  brand: Record<string, string>;
  ceremonyTiers: Record<string, string>;
};

test('Cocos palette (PAL) matches the canonical brand tokens', () => {
  for (const [key, hex] of Object.entries(tokens.brand)) {
    assert.equal(
      (PAL as Record<string, unknown>)[key],
      hex,
      `PAL.${key} (${(PAL as Record<string, unknown>)[key]}) drifted from design-tokens.json (${hex})`,
    );
  }
});

test('ceremony tier colours match the canonical tier tokens', () => {
  for (const tier of VIEW_CONFIG.ceremony.tiers) {
    const expected = tokens.ceremonyTiers[tier.name];
    assert.ok(expected, `design-tokens.json has no colour for tier ${tier.name}`);
    assert.equal(
      tier.color,
      expected,
      `ceremony tier ${tier.name} colour (${tier.color}) drifted from design-tokens.json (${expected})`,
    );
  }
});

test('every brand token is a valid 6-digit hex', () => {
  for (const hex of [...Object.values(tokens.brand), ...Object.values(tokens.ceremonyTiers)]) {
    assert.match(hex, /^#[0-9a-fA-F]{6}$/, `invalid token colour: ${hex}`);
  }
});
