#!/usr/bin/env bash
# Slice the holographic symbol SHEET into normalized transparent frames
# + a power-of-two performance atlas + frames.json (Cocos/preview ready).
#
# Usage:  bash tools/slice-symbols.sh [path/to/source-sheet.png]
#
# Requires ImageMagick (`magick`). Source is a 4x4 grid (512px cells) of
# holographic symbols on black. Pipeline per symbol: key black→alpha, trim to
# content, scale to a consistent box, center on a 256x256 cell (uniform bbox).
set -euo pipefail

SHEET="${1:-assets/symbols/source-sheet.png}"
OUT="assets/symbols"
FRAMES="$OUT/frames"
COLS=4            # source grid columns
ROWS=3            # source grid rows (acid Artest sheet is 4x3)
CELL=256          # output frame size (px), square
FIT=216           # max content size inside the cell (consistent visual weight)
FUZZ="14%"        # black-key tolerance (JPEG source)

command -v magick >/dev/null || { echo "ERROR: ImageMagick (magick) not found"; exit 1; }
[ -f "$SHEET" ] || { echo "ERROR: sheet not found: $SHEET"; exit 1; }
mkdir -p "$FRAMES"

# (col row name) — maps the source grid to our symbol IDs. Order = atlas order.
MAP=(
  "0 0 sym_wild"          # ID 0  Wild (holographic star)
  "1 0 sym_h1_crown"      # ID 1
  "2 0 sym_h2_heart"      # ID 2
  "3 0 sym_h3_diamond"    # ID 3
  "0 1 sym_h4_horseshoe"  # ID 4
  "1 1 sym_l1_a"          # ID 5
  "2 1 sym_l2_k"          # ID 6
  "3 1 sym_l3_q"          # ID 7
  "0 2 sym_l4_j"          # ID 8
  "1 2 sym_l5_10"         # ID 9
  "2 2 sym_wild_win"      # Wild win-state variant
)

W=$(magick identify -format "%w" "$SHEET")
H=$(magick identify -format "%h" "$SHEET")
CW=$(( W / COLS )); CH=$(( H / ROWS ))
echo "Sheet ${W}x${H}  cell ${CW}x${CH}"

ORDER=()
for entry in "${MAP[@]}"; do
  read -r c r name <<< "$entry"
  x=$(( c * CW )); y=$(( r * CH ))
  magick "$SHEET" -crop "${CW}x${CH}+${x}+${y}" +repage \
    -fuzz "$FUZZ" -transparent black \
    -trim +repage \
    -resize "${FIT}x${FIT}" \
    -background none -gravity center -extent "${CELL}x${CELL}" \
    "PNG32:$FRAMES/${name}.png"
  ORDER+=("$FRAMES/${name}.png")
  echo "  → ${name}.png"
done

# Build a 1024x1024 (power-of-two) atlas by compositing each frame at its
# 4-column grid position. No montage → no font dependency.
ATLAS="$OUT/symbols-atlas.png"
magick -size 1024x1024 xc:none "PNG32:$ATLAS"
idx=0
for f in "${ORDER[@]}"; do
  col=$(( idx % 4 )); row=$(( idx / 4 ))
  x=$(( col * CELL )); y=$(( row * CELL ))
  magick "$ATLAS" "$f" -geometry "+${x}+${y}" -composite "PNG32:$ATLAS"
  idx=$(( idx + 1 ))
done

# Emit frames.json (deterministic 4-column rects).
{
  echo "{"
  echo "  \"meta\": { \"image\": \"symbols-atlas.png\", \"size\": { \"w\": 1024, \"h\": 1024 }, \"cell\": $CELL },"
  echo "  \"frames\": {"
  i=0; n=${#MAP[@]}
  for entry in "${MAP[@]}"; do
    read -r c r name <<< "$entry"
    col=$(( i % 4 )); row=$(( i / 4 ))
    fx=$(( col * CELL )); fy=$(( row * CELL ))
    comma=","; [ $((i+1)) -eq $n ] && comma=""
    echo "    \"$name\": { \"x\": $fx, \"y\": $fy, \"w\": $CELL, \"h\": $CELL }$comma"
    i=$((i+1))
  done
  echo "  }"
  echo "}"
} > "$OUT/frames.json"

echo "DONE → $OUT/symbols-atlas.png + $FRAMES/*.png + $OUT/frames.json"
