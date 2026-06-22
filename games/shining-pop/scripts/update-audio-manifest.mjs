/* ============================================================================
   Rebuild public/assets/audio/manifest.json from the actual mp3 files after a
   regen — real duration (ffprobe), size, and true peak (ffmpeg volumedetect),
   with the canonical loop flags. The Pixi Sound manager only reads file/id/loop,
   but keeping ms/kb/peak honest matters for review + the Cocos side.
   Run:  node scripts/update-audio-manifest.mjs
   ============================================================================ */
import { readFile, writeFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');
const LOOPS = new Set(['main_base_loop', 'bonus_loop', 'coin_cascade', 'reel_loop']);

const m = JSON.parse(await readFile(join(DIR, 'manifest.json'), 'utf8'));
for (const clip of m.clips) {
  const file = join(DIR, clip.file);
  try {
    const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8', shell: true });
    const dur = parseFloat((d.stdout || '').trim());
    if (dur) clip.ms = Math.round(dur * 1000);
    clip.loop = LOOPS.has(clip.id);
    const s = await stat(file); clip.kb = +(s.size / 1024).toFixed(1);
    const v = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8', shell: true });
    const mm = (v.stderr || '').match(/max_volume:\s*(-?[\d.]+) dB/);
    if (mm) clip.peak = +Math.pow(10, parseFloat(mm[1]) / 20).toFixed(3);
  } catch (e) { console.log('! ' + clip.id + ' ' + e.message); }
}
m.generated = 'elevenlabs-master';
await writeFile(join(DIR, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
console.log(`manifest updated: ${m.clips.length} clips`);
