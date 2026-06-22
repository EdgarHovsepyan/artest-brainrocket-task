/* ============================================================================
   ARTEST | BrainRocket — ElevenLabs MASTER sound-bank generator (SHINING POP)
   ----------------------------------------------------------------------------
   Generates the FULL 37-clip candy-pop casino bank (SFX + musical stings via the
   sound-generation API, 2 background loops via the Music API), then MASTERS each
   clip with ffmpeg (loudnorm to a uniform target + snappy trim on UI one-shots),
   writing OVER the same-named files the game already loads
   (public/assets/audio/<id>.mp3) — picked up with ZERO game-code changes (the
   Sound manager loads by manifest filename + handles loop crossfades itself).

   Design (skills: slot-audio-sound + slot-audio-engineer):
     • ONE cohesive bright HAPPY candy-pop arcade-casino voice, premium dry mix.
     • Discriminable win tiers (small→epic) — escalating energy, the win bus mix
       (-2 dB) carries the punch; clips are loudness-normalised so the BUS does
       the relative mix (uniform ~-14 LUFS SFX / ~-16 LUFS loops).
     • Every visual transient gets a matched audio transient (Swink).

   Key resolution (never committed):  env ELEVENLABS_API_KEY  →
     C:/Users/edgar/.claude/.secrets/elevenlabs.env  →  %TEMP%/el.key
   Run:  set -a; . ~/.claude/.secrets/elevenlabs.env; set +a; node scripts/gen-eleven-audio.mjs
         node scripts/gen-eleven-audio.mjs win_big win_epic   (subset)
         node scripts/gen-eleven-audio.mjs --no-master        (skip ffmpeg)
   ============================================================================ */
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const AUDIO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');
const SFX_API = 'https://api.elevenlabs.io/v1/sound-generation';
const MUSIC_API = 'https://api.elevenlabs.io/v1/music';
const SFX_LUFS = -14;     // uniform SFX/sting loudness — bus gains do the relative mix
const LOOP_LUFS = -16;    // background loops sit a touch lower (continuous bed)

async function resolveKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  try {
    const s = await readFile('C:/Users/edgar/.claude/.secrets/elevenlabs.env', 'utf8');
    const m = s.match(/ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)/);
    if (m) return m[1].trim();
  } catch { /* ignore */ }
  try { return (await readFile('C:\\Users\\edgar\\AppData\\Local\\Temp\\el.key', 'utf8')).trim(); } catch { /* ignore */ }
  return null;
}

// Shared style anchor so the whole bank is one cohesive voice.
const S = 'bright happy candy-pop arcade casino slot, juicy and satisfying, feel-good celebratory, premium clean dry punchy mix, no music bed';

// id → { kind:'sfx'|'loop', dur(s) | ms, prompt, trim?, infl? }
const BANK = {
  // ---- reels ----
  spin_start:      { kind: 'sfx', dur: 0.6, prompt: `playful slot reel-launch whoosh — a quick bubbly candy shimmer sweeping upward into a soft airy pop at the top, snappy and inviting, ${S}` },
  reel_loop:       { kind: 'sfx', dur: 1.6, prompt: `smooth continuous slot reel-spin whir — a soft rounded mechanical hum with a gentle bubbly flutter, steady even and seamless, sits quietly under the action, ${S}` },
  reel_stop:       { kind: 'sfx', dur: 0.6, trim: true, prompt: `crisp juicy reel-stop — a tight bouncy candy pop with a soft cushioned thud, clean sharp transient, immediate and satisfying, ${S}` },
  turbo_stop:      { kind: 'sfx', dur: 0.6, trim: true, prompt: `fast snappy TURBO reel-stop — a quick punchy candy click-thud, tighter and faster than a normal stop, crisp short transient, ${S}` },
  // ---- win tiers (escalating, discriminable) ----
  win_small:       { kind: 'sfx', dur: 0.9, prompt: `cute small-win sparkle chime — a light pair of bright bell dings with a tiny shimmer tail, pleasant happy and modest, ${S}` },
  win_nice:        { kind: 'sfx', dur: 1.2, prompt: `cheerful nice-win flourish — an uplifting ascending candy-bell cascade with a bright glockenspiel run and a soft sparkle, rewarding, ${S}` },
  win_big:         { kind: 'sfx', dur: 1.7, infl: 0.4, prompt: `triumphant big-win fanfare — a bright major pop-chord stab with shimmering bells, a celebratory rising whoosh and a punchy kick, danceable and joyful, bright major key` },
  win_mega:        { kind: 'sfx', dur: 2.1, infl: 0.4, prompt: `huge euphoric mega-win stinger — party brass horns, a glittering arpeggio cascade, punchy sub bass and a crowd-cheer lift, exciting dance-pop celebration, bright major key` },
  win_epic:        { kind: 'sfx', dur: 2.7, infl: 0.4, prompt: `massive EPIC win celebration — a full euphoric dance-pop drop with cheering, party brass blasts, a big kick and a glittering bell cascade rising to a sparkling climax, pure joy and hype, bright major key` },
  // ---- win feedback ----
  coin_cascade:    { kind: 'sfx', dur: 2.0, prompt: `a rich continuous cascade of coins pouring and clinking — bright metallic candy coins tumbling in a steady shimmering stream, joyful payout, even and seamless, ${S}` },
  impact_braam:    { kind: 'sfx', dur: 1.0, infl: 0.4, prompt: `a big punchy celebratory impact boom — a bright powerful candy bass hit with a short sparkle burst on top, the detonation accent for a big win, joyful not dark` },
  tally_pip:       { kind: 'sfx', dur: 0.6, trim: true, prompt: `a single tiny count-up tick — one crisp bright candy blip, very short and clean, a pip of a rising score tally, ${S}` },
  // ---- features ----
  mult_reveal:     { kind: 'sfx', dur: 0.9, prompt: `a multiplier reveal — a bright rising whoosh into a crisp sparkly pop-ding with a magical shimmer, exciting accent, ${S}` },
  retrigger:       { kind: 'sfx', dur: 1.1, prompt: `a free-spins retrigger fanfare — an exciting bright candy-bell burst with a quick celebratory horn and sparkle, "more spins!", party energy, ${S}` },
  anticipation:    { kind: 'sfx', dur: 2.6, prompt: `a playful rising anticipation build — a bubbly bright tension swell climbing with a shimmering riser and a soft pulse, fun building excitement, not scary, ${S}` },
  near_miss:       { kind: 'sfx', dur: 0.9, prompt: `a near-miss tease — a suspended bright unresolved sparkle that hangs, a cute "oooh almost" wobble, playful tension, ${S}` },
  scatter_tick:    { kind: 'sfx', dur: 0.6, prompt: `a rising scatter-land tick — a pitched-up bubbly sparkle ping that climbs, fun anticipation, each one higher, ${S}` },
  scatter_trigger: { kind: 'sfx', dur: 2.0, prompt: `a joyful scatter trigger — a bright magical portal burst with a happy sparkle swell and a chime cascade, "bonus unlocked!", ${S}` },
  wild_land:       { kind: 'sfx', dur: 0.9, prompt: `a bouncy juicy wild landing — a satisfying squishy candy slam with a soft gummy impact and a sparkle tail, ${S}` },
  wild_expand:     { kind: 'sfx', dur: 1.2, prompt: `a wild expanding sweep — a bubbly bright shimmer stretching and growing across the reel with an energetic swell, ${S}` },
  shake_thud:      { kind: 'sfx', dur: 0.6, trim: true, prompt: `a punchy low bouncy thud — a soft rounded candy impact with a quick cushioned bounce, tactile feedback, ${S}` },
  sticky_lock:     { kind: 'sfx', dur: 0.9, prompt: `a sticky-symbol lock-in — a satisfying juicy candy clunk with a happy click-seal and a tiny shimmer, "locked!", ${S}` },
  // ---- bonus / transitions ----
  bonus_intro:     { kind: 'sfx', dur: 1.6, infl: 0.4, prompt: `an exciting free-spins bonus-start fanfare — a bright joyful reveal with an ascending chime run and party sparkle, "free spins!", celebratory` },
  bonus_end:       { kind: 'sfx', dur: 2.0, infl: 0.4, prompt: `a free-spins bonus-end resolve — a happy warm celebratory wind-down with a satisfied chime and a soft sparkle settle, rewarding` },
  transition_in:   { kind: 'sfx', dur: 1.5, prompt: `a fun whoosh transition into the bonus — a bright candy portal sweep with rising party energy and a sparkle arrival` },
  // ---- buy bonus ----
  buy_open:        { kind: 'sfx', dur: 0.8, prompt: `a bright fun buy-bonus menu open — a bubbly candy whoosh-rise with a soft chime, inviting, ${S}` },
  buy_select:      { kind: 'sfx', dur: 0.6, trim: true, prompt: `a crisp bubbly buy-tier select tick — a juicy short confirm pop, ${S}` },
  buy_confirm:     { kind: 'sfx', dur: 1.2, prompt: `a confident happy purchase-confirm — a rewarding bright ka-ching with a sparkle and a satisfying chord, "bought!", ${S}` },
  // ---- UI ----
  ui_modal_open:   { kind: 'sfx', dur: 0.7, prompt: `a soft bright modal/panel open — a gentle bubbly candy rise with a light chime, ${S}` },
  ui_modal_close:  { kind: 'sfx', dur: 0.6, prompt: `a soft bright modal/panel close — a gentle bubbly candy descend with a soft tap, ${S}` },
  ui_bet:          { kind: 'sfx', dur: 0.6, trim: true, prompt: `a tiny bet-adjust click — a crisp soft candy tick, very short, satisfying button feedback, ${S}` },
  ui_click:        { kind: 'sfx', dur: 0.6, trim: true, prompt: `a generic UI button click — a crisp bright candy tick, very short and clean, satisfying, ${S}` },
  // ---- musical stings (sound-gen, melodic) ----
  main_intro:      { kind: 'sfx', dur: 4.0, infl: 0.35, prompt: `upbeat happy casino intro sting — a bright cheerful rising chime swell blossoming into a joyful candy-pop fanfare, sparkling and inviting, major key, premium` },
  main_tension:    { kind: 'sfx', dur: 4.0, infl: 0.35, prompt: `a playful rising-excitement musical bed — bright bouncy anticipation building with a climbing arpeggio and a shimmer riser, happy and energetic, fun not scary, premium` },
  main_bigwin:     { kind: 'sfx', dur: 5.0, infl: 0.35, prompt: `a triumphant happy big-win musical swell — a euphoric candy dance-pop celebration with bright brass stabs, sparkling bells and a four-on-the-floor groove, party hype, joyful and uplifting, premium` },
  // ---- background loops (Music API) ----
  main_base_loop:  { kind: 'loop', ms: 26000, prompt: `Upbeat happy casino slot background music, feel-good candy-pop dance groove, bouncy four-on-the-floor house beat around 118 BPM, bright plucky synths, shimmering glockenspiel bells, warm sub bass and crisp claps, playful and infectious (makes you want to keep spinning), major key, clean premium mix, seamless loop.` },
  bonus_loop:      { kind: 'loop', ms: 24000, prompt: `High-energy euphoric free-spins casino music, driving festival dance groove around 128 BPM, pumping four-on-the-floor kick, uplifting supersaw chords and sparkling arpeggios, party hype and celebration, bright candy-pop colors, punchy and danceable, major key, premium, seamless loop.` },
};

const NO_MASTER = process.argv.includes('--no-master');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function master(file, lufs, trim) {
  // single-pass loudnorm to a uniform target + true-peak ceiling; snappy trim on UI one-shots.
  const af = [];
  if (trim) af.push('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.01:stop_periods=1:stop_threshold=-45dB:stop_silence=0.06');
  af.push(`loudnorm=I=${lufs}:TP=-1.0:LRA=11`);
  const tmp = file.replace(/\.mp3$/, '.__m.mp3');
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-af', af.join(','), '-c:a', 'libmp3lame', '-b:a', '160k', tmp], { stdio: 'ignore', shell: true });
  if (r.status === 0) { spawnSync('cmd', ['/c', 'move', '/y', tmp.replace(/\//g, '\\'), file.replace(/\//g, '\\')], { stdio: 'ignore', shell: true }); return true; }
  return false;
}

async function genSfx(id, spec, key) {
  const res = await fetch(SFX_API, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: spec.prompt, duration_seconds: Math.max(0.5, spec.dur), prompt_influence: spec.infl ?? 0.5 }),
  });
  if (!res.ok) { console.log(`✗ ${id}  HTTP ${res.status}  ${(await res.text().catch(() => '')).slice(0, 140)}`); return false; }
  const out = join(AUDIO_DIR, `${id}.mp3`);
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  let tag = `${spec.dur}s`;
  if (!NO_MASTER) tag += master(out, SFX_LUFS, spec.trim) ? `  ✓master ${SFX_LUFS}LUFS${spec.trim ? '+trim' : ''}` : '  (master skipped)';
  console.log(`✓ ${id}.mp3  ${tag}`);
  return true;
}

async function genLoop(id, spec, key) {
  const res = await fetch(MUSIC_API, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: spec.prompt, music_length_ms: spec.ms }),
  });
  if (!res.ok) { console.log(`✗ ${id}  (music) HTTP ${res.status}  ${(await res.text().catch(() => '')).slice(0, 140)}`); return false; }
  const out = join(AUDIO_DIR, `${id}.mp3`);
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  let tag = `loop ${spec.ms}ms`;
  if (!NO_MASTER) tag += master(out, LOOP_LUFS, false) ? `  ✓master ${LOOP_LUFS}LUFS` : '  (master skipped)';
  console.log(`✓ ${id}.mp3  ${tag}`);
  return true;
}

const key = await resolveKey();
if (!key) { console.error('No ELEVENLABS_API_KEY (env / ~/.claude/.secrets/elevenlabs.env / %TEMP%/el.key)'); process.exit(1); }
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ids = (only.length ? only : Object.keys(BANK)).filter((id) => BANK[id]);
console.log(`Generating ${ids.length} clips → ${AUDIO_DIR}  (master: ${NO_MASTER ? 'OFF' : 'ON'})\n`);
let ok = 0, fail = 0;
for (const id of ids) {
  const spec = BANK[id];
  try { ((spec.kind === 'loop' ? await genLoop(id, spec, key) : await genSfx(id, spec, key))) ? ok++ : fail++; }
  catch (e) { console.log(`✗ ${id}  ${e.message}`); fail++; }
  await sleep(spec.kind === 'loop' ? 1500 : 700);
}
console.log(`\nDone. ${ok} ok, ${fail} failed.`);
