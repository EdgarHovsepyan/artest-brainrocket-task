/* ============================================================================
   ARTEST | BrainRocket — ElevenLabs ELEGANT music + celebration generator
   ----------------------------------------------------------------------------
   The bg loop was a "happy lofi" procedural loop; the brief is ELEGANT, clean,
   premium casino — dark crystal-cathedral mood, classy not cheerful. Generates
   seamless-ish music loops via the Music API + elegant win/intro stings via the
   sound-generation API, written into public/assets/audio/.

   Loops are saved as <id>.mp3 (wired to the Sound loader as mp3 loops in a
   follow-up — the .wav originals stay until then). Key read from the out-of-repo
   file (never committed). Run: node scripts/gen-eleven-music.mjs [ids...]
   ============================================================================ */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KEY_FILE = 'C:\\Users\\edgar\\AppData\\Local\\Temp\\el.key';
const AUDIO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');
const SFX = 'https://api.elevenlabs.io/v1/sound-generation';
const MUSIC = 'https://api.elevenlabs.io/v1/music';

// loops via Music API (ms); elegant + premium, classy not cheerful.
const LOOPS = {
  main_base_loop: { ms: 26000, prompt: 'Elegant refined casino slot background music, dark crystalline cathedral atmosphere, sophisticated and hypnotic, slow evolving warm pads with subtle shimmering crystal bells and deep cinematic bass, premium and immersive, classy and restrained (NOT cheerful, NOT lofi), magenta-violet villain mood, seamless loop.' },
  bonus_loop:     { ms: 24000, prompt: 'Elegant intense free-spins casino music, driving crystalline energy, premium cinematic electronic-orchestral, sophisticated pulsing rhythm with shimmering arpeggios and powerful bass, building excitement, classy and high-end, magenta-violet mood, seamless loop.' },
};
// elegant stings via SFX API (s)
const STINGS = {
  main_intro:   { dur: 4.0, prompt: 'Elegant cinematic slot intro sting, crystalline reveal swell rising to a refined chime, premium, classy, magenta-violet crystal mood' },
  main_tension: { dur: 4.0, prompt: 'Elegant rising tension musical bed, suspenseful crystalline build, cinematic, refined' },
  main_bigwin:  { dur: 5.0, prompt: 'Elegant triumphant big-win musical swell, cinematic orchestral with crystal shimmer and warm brass, celebratory but classy and premium' },
  win_big:      { dur: 1.7, prompt: 'Elegant big-win flourish, refined orchestral crystal shimmer + warm swell, premium, classy, magenta mood' },
  win_mega:     { dur: 2.1, prompt: 'Elegant mega-win orchestral stinger, sophisticated choir + crystal cascade + cinematic bass, grand but refined, premium' },
  win_epic:     { dur: 2.6, prompt: 'Elegant EPIC win cinematic crescendo, full refined orchestra + choir + shimmering crystal cascade, awe and grandeur, classy premium magenta-villain' },
};

async function genMusic(id, key) {
  const r = await fetch(MUSIC, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: LOOPS[id].prompt, music_length_ms: LOOPS[id].ms }) });
  if (!r.ok) { console.log(`✗ ${id} (music) HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 140)}`); return false; }
  await writeFile(join(AUDIO_DIR, id + '.mp3'), Buffer.from(await r.arrayBuffer()));
  console.log(`✓ ${id}.mp3 (music ${LOOPS[id].ms}ms)`); return true;
}
async function genSting(id, key) {
  const r = await fetch(SFX, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: STINGS[id].prompt, duration_seconds: STINGS[id].dur, prompt_influence: 0.4 }) });
  if (!r.ok) { console.log(`✗ ${id} (sfx) HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 140)}`); return false; }
  await writeFile(join(AUDIO_DIR, id + '.mp3'), Buffer.from(await r.arrayBuffer()));
  console.log(`✓ ${id}.mp3 (sting ${STINGS[id].dur}s)`); return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (await readFile(KEY_FILE, 'utf8')).trim();
const only = process.argv.slice(2);
const loopIds = Object.keys(LOOPS).filter((id) => !only.length || only.includes(id));
const stingIds = Object.keys(STINGS).filter((id) => !only.length || only.includes(id));
let ok = 0, fail = 0;
for (const id of loopIds) { try { (await genMusic(id, key)) ? ok++ : fail++; } catch (e) { console.log(`✗ ${id} ${e.message}`); fail++; } await sleep(1500); }
for (const id of stingIds) { try { (await genSting(id, key)) ? ok++ : fail++; } catch (e) { console.log(`✗ ${id} ${e.message}`); fail++; } await sleep(900); }
console.log(`\nDone. ${ok} ok, ${fail} failed.`);
