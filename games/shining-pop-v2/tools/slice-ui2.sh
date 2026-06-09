#!/usr/bin/env bash
# Re-slice Atlas A (5x5 UI controls) into clean transparent button frames.
# Fixes the earlier crop that clipped round/rounded buttons. Background black is
# removed by CORNER FLOODFILL (keeps the black button interior, unlike
# -transparent black); the label band under each button is dropped via a crop
# height < cell. Overwrites assets/resources/ui2/*.png in place (keeps .meta).
# Usage: bash tools/slice-ui2.sh [atlas.jpeg]
set -euo pipefail
A="${1:-assets/atlas-sources/atlas_A_ui_controls_5x5.jpeg}"
OUT="assets/resources/ui2"
CW=408   # crop width  (cell ≈ 409.6)
FUZZ="16%"
# Each 410px cell stacks: top-bleed of the previous row's label (~0-50px),
# the BUTTON (~65-350px), then this cell's own label (~360-410px). Row 0 has no
# top bleed (button sits higher), so it uses a full-top, taller band.

command -v magick >/dev/null || { echo "ERROR: ImageMagick not found"; exit 1; }
[ -f "$A" ] || { echo "ERROR: atlas not found: $A"; exit 1; }

# Row-major UI atlas slice. The base game only consumes spin_idle / spin_active
# (see assets/scripts/view/slot-view.ts); the rest are sliced for completeness.
NAMES=(
  spin_idle spin_active stop auto_idle auto_active
  minus_idle minus_active plus_idle plus_active bet_deck
  turbo_idle turbo_active sound_on_idle sound_on_active sound_muted
  menu_closed menu_open info_idle info_active settings
  balance bet win buy_idle buy_active
)

i=0
for name in "${NAMES[@]}"; do
  r=$((i / 5)); c=$((i % 5))
  x=$(printf '%.0f' "$(echo "$c*409.6" | bc -l)")
  ybase=$(printf '%.0f' "$(echo "$r*409.6" | bc -l)")
  if [ "$r" -eq 0 ]; then y=$ybase; ch=325; else y=$((ybase + 55)); ch=300; fi
  magick "$A" -crop ${CW}x${ch}+${x}+${y} +repage \
    -alpha set -fuzz "$FUZZ" -fill none \
    -draw "alpha 1,1 floodfill" -draw "alpha $((CW - 2)),1 floodfill" \
    -draw "alpha 1,$((ch - 2)) floodfill" -draw "alpha $((CW - 2)),$((ch - 2)) floodfill" \
    -trim +repage -resize 240x240 -background none -gravity center -extent 256x256 \
    "PNG32:$OUT/${name}.png"
  echo "  ✓ ${name}  (r$r c$c)"
  i=$((i + 1))
done
echo "DONE → $OUT (25 frames re-sliced, .meta preserved)"
