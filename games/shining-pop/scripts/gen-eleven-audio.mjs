/* ============================================================================
   ARTEST | BrainRocket — ElevenLabs audio generator (SHINING POP)
   ----------------------------------------------------------------------------
   Generates master-level SFX + short musical stings via the ElevenLabs
   sound-generation API and writes them OVER the same-named files the game
   already loads (public/assets/audio/<id>.mp3) — so the upgrade is picked up
   with ZERO game-code changes (the Sound manager loads by filename/manifest).

   Style: bright HAPPY candy-pop arcade casino, juicy and satisfying, feel-good
   and celebratory, premium clean dry mix (SFX carry no music bed). Durations
   match manifest.json.

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
const STYLE = 'bright happy candy-pop arcade casino slot, juicy and satisfying, feel-good celebratory, premium, clean dry mix, no music bed';

// id → { dur (s), prompt, influence }. dur matches manifest; clamped to >=0.5.
const BANK = {
  spin_start:      { dur: 0.6, prompt: `playful reel launch whoosh, bubbly candy shimmer rising, short snappy and fun, ${STYLE}` },
  reel_stop:       { dur: 0.5, prompt: `crisp juicy reel-stop pop with a soft bouncy thud, tight and satisfying, ${STYLE}` },
  win_small:       { dur: 0.8, prompt: `cute pleasant small-win sparkle chime, light and happy, ${STYLE}` },
  win_nice:        { dur: 1.2, prompt: `bright cheerful nice-win flourish, uplifting candy bell cascade, ${STYLE}` },
  win_big:         { dur: 1.7, prompt: `triumphant happy big-win fanfare, bright pop chord + sparkling bells + celebratory whoosh, danceable, joyful` },
  win_mega:        { dur: 2.1, prompt: `huge euphoric mega-win stinger, party horns + sparkling cascade + punchy bass, exciting dance-pop celebration, bright major key` },
  win_epic:        { dur: 2.6, prompt: `massive EPIC happy-win celebration, full euphoric dance-pop drop with cheering, party brass + glittering arpeggio cascade + big kick, pure joy and hype` },
  scatter_tick:    { dur: 0.6, prompt: `rising bright scatter anticipation tick, pitched-up bubbly sparkle, fun tension, ${STYLE}` },
  scatter_trigger: { dur: 2.0, prompt: `joyful scatter trigger, bright portal burst with happy sparkle swell, ${STYLE}` },
  wild_land:       { dur: 0.9, prompt: `bouncy juicy wild candy slam landing, satisfying squishy impact + sparkle tail, ${STYLE}` },
  wild_expand:     { dur: 1.2, prompt: `wild expanding bubbly shimmer sweep, fun energy stretching across, ${STYLE}` },
  buy_open:        { dur: 0.8, prompt: `bright fun menu open swoosh, bubbly candy whoosh, ${STYLE}` },
  buy_confirm:     { dur: 1.2, prompt: `confident happy purchase confirm chime, rewarding bright ka-ching, ${STYLE}` },
  buy_select:      { dur: 0.5, prompt: `crisp bubbly tier select tick, juicy confirm, ${STYLE}` },
  mult_reveal:     { dur: 0.8, prompt: `multiplier reveal sparkle pop, bright happy accent, ${STYLE}` },
  retrigger:       { dur: 1.0, prompt: `free-spins retrigger fanfare, exciting bright candy bell burst, party energy, ${STYLE}` },
  anticipation:    { dur: 2.6, prompt: `playful rising anticipation build with bubbly bright swell, fun building excitement, ${STYLE}` },
  near_miss:       { dur: 0.8, prompt: `near-miss tease sting, suspended bright unresolved sparkle, fun not scary, ${STYLE}` },
  impact_braam:    { dur: 1.0, prompt: `big punchy celebratory impact hit, bright and powerful party boom, joyful` },
  shake_thud:      { dur: 0.5, prompt: `punchy low bouncy thud impact, satisfying, ${STYLE}` },
  sticky_lock:     { dur: 0.9, prompt: `sticky symbol lock-in, satisfying juicy candy clunk + happy seal, ${STYLE}` },
  bonus_intro:     { dur: 1.5, prompt: `exciting free-spins bonus start fanfare, bright joyful reveal with party energy, celebratory` },
  bonus_end:       { dur: 2.0, prompt: `free-spins bonus end resolve, happy warm celebratory wind-down with sparkle, joyful` },
  transition_in:   { dur: 1.5, prompt: `fun whoosh transition into bonus, bright candy portal sweep with rising party energy` },
  ui_modal_open:   { dur: 0.7, prompt: `soft bright modal open, bubbly candy rise, ${STYLE}` },
  ui_modal_close:  { dur: 0.55, prompt: `soft bright modal close, bubbly candy descend, ${STYLE}` },
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
