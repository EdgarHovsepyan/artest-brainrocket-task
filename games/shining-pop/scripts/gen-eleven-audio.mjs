/* ============================================================================
   ARTEST | BrainRocket — ElevenLabs audio generator (SHINING POP)
   ----------------------------------------------------------------------------
   Generates master-level SFX + short musical stings via the ElevenLabs
   sound-generation API and writes them OVER the same-named files the game
   already loads (public/assets/audio/<id>.mp3) — so the upgrade is picked up
   with ZERO game-code changes (the Sound manager loads by filename/manifest).

   Style: dark elegant crystal/gem casino, magenta "villain" mood, premium,
   clean dry mix (SFX carry no music bed). Durations match manifest.json.

   The API key is read from a file OUTSIDE the repo (never committed):
     C:\\Users\\edgar\\AppData\\Local\\Temp\\el.key
   Run:  node scripts/gen-eleven-audio.mjs            (all)
         node scripts/gen-eleven-audio.mjs win_big    (one or more ids)
   ============================================================================ */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KEY_FILE = 'C:\\Users\\edgar\\AppData\\Local\\Temp\\el.key';
const AUDIO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');
const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation';

// Shared style anchor so the whole bank is cohesive.
const STYLE = 'dark elegant crystal-gem casino slot, magenta villain mood, premium, clean dry mix, no music bed';

// id → { dur (s), prompt, influence }. dur matches manifest; clamped to >=0.5.
const BANK = {
  spin_start:      { dur: 0.6, prompt: `magical reel launch whoosh, crystalline shimmer rising, short snappy, ${STYLE}` },
  reel_stop:       { dur: 0.5, prompt: `crisp gem reel-stop click with a soft glassy thud, tight, ${STYLE}` },
  win_small:       { dur: 0.8, prompt: `gentle pleasant small-win sparkle chime, light, ${STYLE}` },
  win_nice:        { dur: 1.2, prompt: `bright crystalline nice-win flourish, uplifting bell cascade, ${STYLE}` },
  win_big:         { dur: 1.7, prompt: `triumphant big-win fanfare, gem shimmer + warm brass swell, magenta energy, cinematic` },
  win_mega:        { dur: 2.1, prompt: `huge epic mega-win orchestral stinger, choir hit + crystal cascade + deep bass, cinematic, magenta villain grandeur` },
  win_epic:        { dur: 2.6, prompt: `massive cinematic EPIC win explosion, full choir + brass braam + sub bass + shattering crystal cascade, awe, magenta villain` },
  scatter_tick:    { dur: 0.6, prompt: `rising crystalline scatter anticipation tick, pitched-up sparkle, tension, ${STYLE}` },
  scatter_trigger: { dur: 2.0, prompt: `magical scatter trigger, portal opening burst with shimmering crystal swell, ${STYLE}` },
  wild_land:       { dur: 0.9, prompt: `heavy magical wild crystal slam landing, weighty impact + shimmer tail, ${STYLE}` },
  wild_expand:     { dur: 1.2, prompt: `wild expanding shimmer sweep, energy stretching across, ${STYLE}` },
  buy_open:        { dur: 0.8, prompt: `premium menu open swoosh, glassy crystal whoosh, ${STYLE}` },
  buy_confirm:     { dur: 1.2, prompt: `confident purchase confirm chime, rewarding gem ka-ching, ${STYLE}` },
  buy_select:      { dur: 0.5, prompt: `crisp tier select tick, glassy confirm, ${STYLE}` },
  mult_reveal:     { dur: 0.8, prompt: `multiplier reveal sparkle pop, bright magical accent, ${STYLE}` },
  retrigger:       { dur: 1.0, prompt: `free-spins retrigger fanfare, exciting crystal bell burst, ${STYLE}` },
  anticipation:    { dur: 2.6, prompt: `tense rising anticipation drone with shimmering crystal swell, building suspense, ${STYLE}` },
  near_miss:       { dur: 0.8, prompt: `near-miss tension sting, suspended unresolved shimmer, ${STYLE}` },
  impact_braam:    { dur: 1.0, prompt: `deep cinematic braam impact hit, dark powerful, magenta villain` },
  shake_thud:      { dur: 0.5, prompt: `heavy low screen-shake thud impact, punchy, ${STYLE}` },
  sticky_lock:     { dur: 0.9, prompt: `sticky symbol lock-in, satisfying crystal clunk + magical seal, ${STYLE}` },
  bonus_intro:     { dur: 1.5, prompt: `dramatic free-spins bonus start braam, dark majestic crystal reveal, magenta villain, cinematic` },
  bonus_end:       { dur: 2.0, prompt: `free-spins bonus end resolve, triumphant warm wind-down with shimmer, cinematic` },
  transition_in:   { dur: 1.5, prompt: `whoosh transition into bonus, crystal portal sweep with rising energy, cinematic` },
  ui_modal_open:   { dur: 0.7, prompt: `soft premium modal open, glassy crystal rise, ${STYLE}` },
  ui_modal_close:  { dur: 0.55, prompt: `soft premium modal close, glassy crystal descend, ${STYLE}` },
};

async function gen(id, key) {
  const spec = BANK[id];
  if (!spec) { console.log(`! skip ${id} (not in bank)`); return false; }
  const body = JSON.stringify({
    text: spec.prompt,
    duration_seconds: Math.max(0.5, spec.dur),
    prompt_influence: spec.influence ?? 0.45,
  });
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.log(`✗ ${id}  HTTP ${res.status}  ${txt.slice(0, 160)}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const out = join(AUDIO_DIR, `${id}.mp3`);
  await writeFile(out, buf);
  console.log(`✓ ${id}.mp3  ${(buf.length / 1024).toFixed(1)} KB  (${spec.dur}s)`);
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const key = (await readFile(KEY_FILE, 'utf8')).trim();
const only = process.argv.slice(2);
const ids = only.length ? only : Object.keys(BANK);
console.log(`Generating ${ids.length} clips → ${AUDIO_DIR}\n`);
let ok = 0, fail = 0;
for (const id of ids) {
  try { (await gen(id, key)) ? ok++ : fail++; }
  catch (e) { console.log(`✗ ${id}  ${e.message}`); fail++; }
  await sleep(800); // gentle pacing to avoid rate limits
}
console.log(`\nDone. ${ok} ok, ${fail} failed.`);
