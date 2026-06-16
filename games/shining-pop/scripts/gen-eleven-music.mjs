/* ============================================================================
   ARTEST | BrainRocket — ElevenLabs HAPPY-DANCE casino music + celebration gen
   ----------------------------------------------------------------------------
   Brief: an ACTIVE, looping, FEEL-GOOD casino vibe — upbeat happy dance/house
   groove, bouncy candy-pop energy that makes you want to keep spinning (NOT the
   old dark "elegant villain" mood). Generates seamless music loops via the Music
   API + celebratory win/intro stings via the sound-generation API, into
   public/assets/audio/.

   Loops are saved as <id>.mp3. Key read from the out-of-repo file (never
   committed). Run: node scripts/gen-eleven-music.mjs [ids...]
   ============================================================================ */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KEY_FILE = 'C:\\Users\\edgar\\AppData\\Local\\Temp\\el.key';
const AUDIO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');
const SFX = 'https://api.elevenlabs.io/v1/sound-generation';
const MUSIC = 'https://api.elevenlabs.io/v1/music';

// loops via Music API (ms); upbeat, happy, danceable casino — keep-you-playing groove.
const LOOPS = {
  main_base_loop: {
    ms: 26000,
    prompt:
      'Upbeat happy casino slot background music, feel-good dance-pop groove, bouncy four-on-the-floor house beat at ~120 BPM, bright cheerful plucky synths and shimmering bells, candy-pop arcade energy, warm sub bass and crisp claps, infectious and danceable, joyful and addictive (makes you want to keep spinning), major key, clean and premium, seamless loop.',
  },
  bonus_loop: {
    ms: 24000,
    prompt:
      'High-energy euphoric free-spins casino dance music, driving festival EDM groove at ~128 BPM, pumping four-on-the-floor kick, uplifting supersaw chords and sparkling arpeggios, party hype and celebration, bright happy and exciting, candy-pop colors, punchy and danceable, major key, premium, seamless loop.',
  },
};
// celebratory stings via SFX API (s) — happy, bright, party energy.
const STINGS = {
  main_intro: {
    dur: 4.0,
    prompt:
      'Upbeat happy casino intro sting, bright cheerful rising chime swell into a joyful pop fanfare, sparkling and inviting, candy-pop dance energy, major key, premium',
  },
  main_tension: {
    dur: 4.0,
    prompt:
      'Playful rising excitement musical bed, bright bouncy anticipation build, happy and energetic dance-pop, climbing arpeggio, fun not scary',
  },
  main_bigwin: {
    dur: 5.0,
    prompt:
      'Triumphant happy big-win musical swell, euphoric dance-pop celebration with bright brass stabs, sparkling bells and a four-on-the-floor groove, party hype, joyful and uplifting, premium',
  },
  win_big: {
    dur: 1.7,
    prompt:
      'Happy big-win flourish, bright cheerful pop chord stab with shimmering bells and a celebratory whoosh, danceable, joyful, premium',
  },
  win_mega: {
    dur: 2.1,
    prompt:
      'Euphoric mega-win stinger, uplifting dance-pop hit with party horns, sparkling cascade and punchy bass, exciting and celebratory, bright major key, premium',
  },
  win_epic: {
    dur: 2.6,
    prompt:
      'EPIC happy-win celebration crescendo, full euphoric dance-pop drop with cheering energy, party brass, glittering arpeggio cascade and big kick, pure joy and hype, bright major key, premium',
  },
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
