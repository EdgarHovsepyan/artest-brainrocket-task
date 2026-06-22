/* ============================================================================
   ARTEST | BrainRocket — ElevenLabs audio generator (SHINING POP V2 — Cocos)
   ----------------------------------------------------------------------------
   Regenerates the gameplay SFX + win-sting bank via the ElevenLabs
   sound-generation API, writing OVER the same-named files the game loads
   (build-templates/web-mobile/audio/<id>.mp3) — so a rebuild picks the new
   bank up with no code change to the sample loader (AudioManager loads by id).

   Audio direction (owner brief, candy/sweet-shop slot):
     - SPIN must be a SOFT DAMPING sound, not noise (cozy muffled candy whir).
     - SCATTER reveal must feel cool/magical (sparkling sugar portal).
     - WINS must read like a REAL casino slot win, candy-flavoured + escalating.
     - BONUS TRANSITION must be a soft squishy GUMMY whoosh.
   Cohesive, premium, clean dry mix for SFX; musical + joyful for stings.

   Key is read from OUTSIDE the repo (never committed):
     ~/.claude/.secrets/elevenlabs.env  (ELEVENLABS_API_KEY=...)
   Run:  node tools/gen-eleven-audio.mjs            (all)
         node tools/gen-eleven-audio.mjs win_big reel_loop   (subset)
   ============================================================================ */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

/* global console, process, fetch, Buffer, setTimeout */
const KEY_FILE = join(homedir(), '.claude', '.secrets', 'elevenlabs.env');
const AUDIO_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'build-templates',
  'web-mobile',
  'audio',
);
const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation';

// Cohesion anchors.
const SFX =
  'premium candy sweet-shop slot sound effect, glossy and juicy, clean dry mix, no music bed';
const WIN =
  'premium candy-pop casino slot win, real slot-machine win energy, joyful celebratory, bright major key, satisfying';

// id → { dur (s), prompt, loop?, influence? }
const BANK = {
  // --- SPIN: soft DAMPING, never noisy (owner #1) ---
  reel_loop: {
    dur: 2.6,
    loop: true,
    influence: 0.5,
    prompt: `soft muffled candy reels spinning, gentle dampened low whir, cozy subtle sugar-soft hum, smooth quiet and warm, no harsh buzz, no melody, seamless loop, ${SFX}`,
  },
  spin_start: {
    dur: 0.5,
    influence: 0.4,
    prompt: `gentle soft candy reel launch, dampened airy whoosh, subtle smooth and short, not harsh, ${SFX}`,
  },
  reel_stop: {
    dur: 0.45,
    influence: 0.45,
    prompt: `soft cushioned candy reel stop, gentle dampened jelly pop, plush satisfying settle, no click, ${SFX}`,
  },
  turbo_stop: {
    dur: 0.34,
    influence: 0.45,
    prompt: `quick soft candy reel snap-stop, tight dampened jelly tap, short, ${SFX}`,
  },

  // --- SCATTER: cool / magical (owner #2) ---
  scatter_tick: {
    dur: 0.6,
    influence: 0.4,
    prompt: `magical rising candy sparkle tick, bright pitched-up sugar shimmer, fun building anticipation, ${SFX}`,
  },
  scatter_trigger: {
    dur: 2.0,
    influence: 0.4,
    prompt: `cool magical candy scatter reveal, glittering sweet portal burst with shimmering swell and wonder, exciting and premium, joyful`,
  },

  // --- WINS: real casino candy win, escalating (owner #3) ---
  win_small: {
    dur: 0.8,
    influence: 0.4,
    prompt: `cute pleasant candy small-win chime, light happy sugar sparkle, real slot win ding, ${WIN}`,
  },
  win_nice: {
    dur: 1.2,
    influence: 0.4,
    prompt: `bright cheerful candy nice-win flourish, uplifting sweet bell cascade, satisfying slot win, ${WIN}`,
  },
  win_big: {
    dur: 1.7,
    influence: 0.4,
    prompt: `triumphant candy big-win fanfare, bright pop chord with sparkling sugar bells and a celebratory whoosh, real casino slot big win, ${WIN}`,
  },
  win_mega: {
    dur: 2.1,
    influence: 0.4,
    prompt: `huge euphoric candy mega-win stinger, party horns with glittering cascade and punchy bass, exciting casino jackpot energy, ${WIN}`,
  },
  win_epic: {
    dur: 2.6,
    influence: 0.4,
    prompt: `massive EPIC candy jackpot celebration, full euphoric win with cheering, party brass, glittering arpeggio cascade and a big boom, real casino mega-win hype, pure joy`,
  },
  coin_cascade: {
    dur: 1.5,
    influence: 0.4,
    prompt: `satisfying candy coin payout cascade, sweet bells and pouring sugary coins tumbling, rewarding casino tally, ${WIN}`,
  },
  // BIG-WIN DAMPED sound design (owner): a deep CUSHIONED boom + a warm swelling bed.
  impact_braam: {
    dur: 1.3,
    influence: 0.45,
    prompt: `deep cushioned candy big-win impact boom, soft rounded attack with a weighty sub-bass body and a smooth DAMPED tail, satisfying powerful and premium but never harsh or clicky, ${SFX}`,
  },
  main_bigwin: {
    dur: 2.4,
    influence: 0.4,
    prompt: `warm swelling candy big-win bed, soft rising sugar bloom with gentle shimmer and deep cushioned warmth, premium and damped, celebratory but smooth not harsh, ${WIN}`,
  },

  // --- BONUS TRANSITION: soft squishy GUMMY (owner #4) ---
  transition_in: {
    dur: 1.4,
    influence: 0.45,
    prompt: `soft squishy gummy candy transition whoosh into bonus, dampened sweet portal sweep gently rising, plush smooth and premium, ${SFX}`,
  },
  bonus_intro: {
    dur: 1.5,
    influence: 0.4,
    prompt: `exciting candy free-spins bonus start fanfare, bright joyful sweet reveal, celebratory casino feature unlock, ${WIN}`,
  },
  bonus_end: {
    dur: 2.0,
    influence: 0.4,
    prompt: `warm candy free-spins bonus end resolve, happy celebratory sugar wind-down with gentle sparkle, satisfying, ${WIN}`,
  },
  retrigger: {
    dur: 1.0,
    influence: 0.4,
    prompt: `exciting candy free-spins retrigger burst, bright sweet bell flurry with party energy, ${WIN}`,
  },

  // --- COHESION JUICE ---
  wild_land: {
    dur: 0.8,
    influence: 0.45,
    prompt: `bouncy juicy candy wild landing slam, satisfying squishy gummy impact with a sparkle tail, ${SFX}`,
  },
  sticky_lock: {
    dur: 0.8,
    influence: 0.45,
    prompt: `satisfying candy sticky lock-in, juicy gummy clunk with a happy sugar seal, ${SFX}`,
  },
  anticipation: {
    dur: 2.4,
    influence: 0.4,
    prompt: `playful rising candy anticipation build, soft bubbly sweet swell building gentle excitement, ${SFX}`,
  },
  near_miss: {
    dur: 0.8,
    influence: 0.4,
    prompt: `candy near-miss tease, suspended bright unresolved sugar sparkle, playful not scary, ${SFX}`,
  },
  mult_reveal: {
    dur: 0.8,
    influence: 0.4,
    prompt: `candy multiplier reveal sparkle pop, bright happy sugar accent, ${SFX}`,
  },
};

async function gen(id, key) {
  const spec = BANK[id];
  if (!spec) {
    console.log(`! skip ${id} (not in bank)`);
    return false;
  }
  const payload = {
    text: spec.prompt,
    duration_seconds: Math.max(0.5, spec.dur),
    prompt_influence: spec.influence ?? 0.4,
  };
  if (spec.loop) payload.loop = true;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.log(`x ${id}  HTTP ${res.status}  ${txt.slice(0, 180)}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(join(AUDIO_DIR, `${id}.mp3`), buf);
  console.log(
    `ok ${id}.mp3  ${(buf.length / 1024).toFixed(1)} KB  (${spec.dur}s${spec.loop ? ', loop' : ''})`,
  );
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raw = await readFile(KEY_FILE, 'utf8');
const key = (raw.split('=').slice(1).join('=') || raw).trim();
const only = process.argv.slice(2);
const ids = only.length ? only : Object.keys(BANK);
console.log(`Generating ${ids.length} clips -> ${AUDIO_DIR}\n`);
let ok = 0,
  fail = 0;
for (const id of ids) {
  try {
    if (await gen(id, key)) ok++;
    else fail++;
  } catch (e) {
    console.log(`x ${id}  ${e.message}`);
    fail++;
  }
  await sleep(900);
}
console.log(`\nDone. ${ok} ok, ${fail} failed.`);
