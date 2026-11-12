#!/bin/bash
# clip-sheet.sh model out.png "clip clip ..." [view] [focus] [rod 0|1] [cell]
# One row per clip, six frames across (0, 18, 36, 54, 72, 90 % of the clip). show_catch is drawn with the debug fish, no rod.
# ATTACH=/out/sketchbook.glb (a path under the scratch root) hangs that model on BookSocket for clips named book_*.
M=$1; O=$2; CLIPS=$3; VIEW=${4:-"30,10"}; FOCUS=${5:-""}; ROD=${6:-0}; CELL=${7:-256}
HERE=$(cd "$(dirname "$0")" && pwd)
T=$(mktemp -d); i=0; rows=""
for c in $CLIPS; do
  f=$T/$(printf %03d $i).png; r=$ROD; fish=0
  if [ "$c" = "show_catch" ]; then r=0; fish=1; fi
  args="cell=$CELL cols=6 clip=$c times=0.001,0.18,0.36,0.54,0.72,0.9 views=$VIEW rod=$r fish=$fish"
  [ -n "$FOCUS" ] && args="$args focus=$FOCUS"
  case "$c" in book_*) [ -n "$ATTACH" ] && args="$args attach=$ATTACH socket=BookSocket";; esac
  node "$HERE/render.mjs" "$M" $f $args >/dev/null
  convert $f -gravity NorthWest -fill white -pointsize $((CELL/12)) -annotate +8+6 "$c" $f 2>/dev/null
  rows="$rows $f"; i=$((i+1))
done
convert $rows -append "$O"
rm -rf $T
