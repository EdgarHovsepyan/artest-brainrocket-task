#!/usr/bin/env bash
# Slice the UI control sprite sheet into clean transparent button frames.
# Usage: bash tools/slice-ui.sh [path/to/ui-sheet.(jpeg|png)]
# Source: 4-col grid (512px cells) of acid-yellow buttons on black, with baked
# labels under rows 2-3 (cropped out via a shorter cell height).
set -euo pipefail

SHEET="${1:-assets/ui/source-sheet.jpeg}"
OUT="assets/ui"
FRAMES="$OUT/frames"
CELL_W=512
CROP_H=410 # < 512 to exclude baked label text
FIT=240
FUZZ="16%"

command -v magick >/dev/null || { echo "ERROR: ImageMagick not found"; exit 1; }
[ -f "$SHEET" ] || { echo "ERROR: sheet not found: $SHEET"; exit 1; }
mkdir -p "$FRAMES"

# (col row name)
MAP=(
  "0 0 ui_spin" "1 0 ui_stop" "2 0 ui_spin_round"
  "0 1 ui_minus" "1 1 ui_plus"
  "0 2 ui_sound_on" "1 2 ui_sound_off" "2 2 ui_turbo_off" "3 2 ui_turbo_on"
  "0 3 ui_menu" "1 3 ui_close" "2 3 ui_info"
)
for entry in "${MAP[@]}"; do
  read -r c r name <<< "$entry"
  x=$((c * CELL_W)); y=$((r * 512))
  magick "$SHEET" -crop "${CELL_W}x${CROP_H}+${x}+${y}" +repage \
    -fuzz "$FUZZ" -transparent black -trim +repage \
    -resize "${FIT}x${FIT}" -background none -gravity center -extent 256x256 \
    "PNG32:$FRAMES/${name}.png"
  echo "  → ${name}.png"
done
echo "DONE → $FRAMES/*.png"
