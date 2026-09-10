#!/usr/bin/env bash
# Lager kontaktark per render-serie i vinkelrekkefølge (direction 0..95).
# Rutenett 12 kolonner x 8 rader, radvis: index = rad*12 + kolonne, vinkel = index * 3.75 grader.
# Krever ffmpeg. ImageMagick/PIL finnes ikke pa denne maskinen.
set -euo pipefail
ROOT="${1:-$HOME/klienter/placy/lillebytunet}"
OUT="$ROOT/contact-sheets"
mkdir -p "$OUT"
for d in "$ROOT"/renders/*/; do
  s=$(basename "$d")
  ffmpeg -y -hide_banner -loglevel error \
    -pattern_type glob -i "$d*.webp" \
    -vf "scale=320:180,tile=12x8:margin=6:padding=3:color=0x1b1b1b" \
    -frames:v 1 -q:v 6 "$OUT/$s.jpg"
  printf '  %-10s %s (%s)\n' "$s" "$(basename "$OUT/$s.jpg")" "$(du -h "$OUT/$s.jpg" | cut -f1)"
done
