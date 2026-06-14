---
name: slot-audio-sound
description: >-
  Audio/sound-design reference for the Shining Pop slot games (PixiJS
  `shining-pop`, Cocos `shining-pop-v2`). Use when working on the WebAudio bus
  mixer, tiered win stings, music ducking, dynamic/stem music, AV-sync (audio on
  the exact VFX frame), the spin/reel/anticipation/coin SFX, the procedural
  oscillator fallback, sample banks (ElevenLabs gen), or sound-off / WebAudio
  unlock. Completes the toolkit with `slot-game-polish`, `slot-mechanics-animation`,
  `slot-compliance-rgs`. Trigger on: audio / sound / music / sting / mix / SFX /
  ducking / AV-sync for these games.
---

# Slot Audio & Sound — Reference

How sound is wired in both engines, and how to extend it without breaking the
mix. **Audio is half the juice** — a win that doesn't _thump_ doesn't land.

> Rule (Swink): every visual transient has a matched audio transient on the
> **same frame**. Silence on a detonation reads as a bug.

---

## 1. Bus architecture (WebAudio graph)

Both engines route through a gain-node graph: **per-clip → bus → master →
destination.** Four buses, mixed at fixed levels.

_Cocos (`audio-manager.ts`):_ `BusId = music | gameplay | sfx | win`, levels
`BUS_DB = { music:-6, gameplay:-10, sfx:-8, win:-2 }` — **win is loudest** so the
sting cuts through. _Pixi (`shining-pop.game.js`):_ `master` + `busMusic /
busGameplay / busSfx / busWin` gain nodes; `_musicBase` is the music resting
level.

- **gameplay** bus = anticipation/tension layers (sits under everything).
- **sfx** = clicks, reel stops, tally pips, UI.
- **win** = stings + braam (the moment-of-impact bus).
- **music** = base loop + bonus loop.

To add a sound: pick the **right bus** (don't put a win sting on `sfx`), set a
per-clip gain, and route through the bus — never straight to master.

---

## 2. Tiered win stings (the money sound)

The win sting escalates with the tier — _Cocos:_ `['win_small','win_nice',
'win_big','win_mega','win_epic']` on the `win` bus (gain ~0.95). The big-win
**braam** (`impact_braam`) is a separate low boom on the detonation frame,
distinct from the melodic sting. Match the sting tier to the visual ceremony
tier so audio + VFX escalate together (Koster: discriminable tiers).

---

## 3. Ducking (so the sting cuts through)

When a win sting / braam fires, **duck the music bus** (−6 dB for ~400ms, ramp
back) so the moment isn't muddy. _(Open item / ROADMAP #9 — the buses exist;
wire the ramp.)_ Use WebAudio `gain.setTargetAtTime` (smooth) — never a hard
`gain.value` jump (clicks).

---

## 4. AV-sync (audio on the exact frame)

The view exposes hooks the controller fires on the precise frame:
`onDetonate` → braam, `onCountPip` → tally tick, `onCoinGeyser` → coin cascade.
The **count-up** fires a pitch-climbing pip every ~70ms as the number rolls
(rising = "earning"). **Reel stops** pan/pitch per reel (L→R) so the stagger is
heard. Keep audio cues _on the controller side_ (the view stays pure-ish), fired
from the same beat that drives the VFX.

---

## 5. Dynamic music

- **Base loop ↔ bonus loop** swap on feature enter/exit (crossfade ~0.6s; both
  engines have the loops). _(Cocos `playMusic('main_base_loop'|'bonus_loop')`.)_
- **Stem layering** _(open, ROADMAP #16)_ — add a "win-energy" stem that fades in
  during the count-up climax, and a driving "bonus" stem; the bus graph already
  supports it. This is the single biggest music upgrade.
- **Reduced-motion / sound-off** never stops the music graph from being correct —
  just mutes via the master gain (remember the preference).

---

## 6. Procedural fallback + sample bank

- **Procedural voice** — an oscillator stack (`_voice` in Pixi: triangle + octave
  sine for a coin "ding") plays when the sampled bank hasn't decoded yet, so the
  game is never silent on first interaction.
- **Sample bank** — ElevenLabs-generated clips (`scripts/gen-eleven-audio.mjs`,
  `gen-eleven-music.mjs`, `public/assets/audio/manifest.json`); Cocos loads into
  `buffers` keyed by `ClipId`. Regenerate with the gen scripts; keep peaks
  normalized (the manifest tracks `peak`).

---

## 7. WebAudio gotchas

- **Autoplay unlock** — the `AudioContext` is suspended until the first user
  gesture; resume it on first tap/Space (both engines bootstrap this).
- **Decode timing** — `decodeAudioData` is async; gate the sampled layer behind
  "decoded?" and fall back to procedural until ready (don't block the spin).
- **Smooth gains only** — ramp with `setTargetAtTime` / `linearRampToValueAtTime`;
  raw `gain.value` steps click.
- **One context, many sources** — `AudioBufferSourceNode` is single-use; create a
  new one per play (cheap), never reuse.
- **Cap concurrency** — a win flurry can stack stings into a wash; event-queue /
  throttle the `win` bus (ROADMAP #37).

---

## 8. Where it lives

- **Cocos:** `assets/scripts/view/audio-manager.ts` (buses, `playSample`,
  `playMusic`, tiered `win`, ducking hooks).
- **Pixi:** the audio block in `shining-pop.game.js` (~bus graph, `_wrapSample`,
  `_voice`, `_musicBase`).
- **Assets:** `games/shining-pop/scripts/gen-eleven-*.mjs`, audio `manifest.json`.

> Method unchanged: pick the bus → fire on the AV-sync frame → respect sound-off
> → keep it on the controller side. Pairs with `slot-game-polish` (the VFX the
> audio matches).
