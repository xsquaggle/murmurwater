#!/bin/bash
# biscuit-sheets.sh [models dir] : the two clip sheets of Biscuit the cat (out/sheets/biscuit-clips.webp, biscuit-sit-clips.webp, 1536 px wide).
# A row is six moments of one clip from one view; its label gives the clip and the moments in seconds. Run it from a folder called `tools`.
cd "$(dirname "$0")"; CH=${1:-/home/user/murmurwater/public/models/characters}; S=out/sheets; mkdir -p $S; T=$(mktemp -d); n=0
row() { # model clip length "t1,..,t6 in seconds" view [focus]
  n=$((n+1)); local f=$T/$(printf %02d $n).png
  local fr=$(node -e "console.log(process.argv[1].split(',').map(x=>Math.min(0.9999,Math.max(0.0001,x/process.argv[2])).toFixed(4)).join(','))" "$4" "$3")
  node render.mjs $CH/$1.glb $f cell=256 cols=6 clip=$2 times=$fr views="$5" ${6:+focus=$6} >/dev/null
  convert $f -gravity NorthWest -fill white -pointsize 20 -annotate +8+6 "$2  $(echo $4 | sed 's/,/  /g') s" $f; }
row biscuit walk 0.72 "0,0.13,0.26,0.39,0.52,0.65" "35,12"
row biscuit idle 4 "0,0.7,1.4,2.1,2.8,3.5" "35,12"
row biscuit swat 1 "0.03,0.13,0.2,0.36,0.52,0.8" "-65,10"
row biscuit swat 1 "0.03,0.13,0.2,0.36,0.52,0.8" "30,14"
convert $T/01.png $T/02.png $T/03.png $T/04.png -append -quality 88 $S/biscuit-clips.webp; rm $T/*.png; n=0
row biscuit-sit sit 5 "0,0.9,1.8,2.7,3.6,4.5" "35,12"
row biscuit-sit watch 2.4 "0,0.33,0.72,1.13,1.56,2.05" "-60,14"
row biscuit-sit watch 2.4 "0,0.33,0.72,1.13,1.56,2.05" "-70,12" -0.05,0.05,0.08,0.12
row biscuit-sit eat 2.5 "0.05,0.25,0.6,1.34,2.0,2.35" "-60,14"
row biscuit-sit eat 2.5 "0.05,0.25,0.6,1.34,2.0,2.35" "35,14"
convert $T/01.png $T/02.png $T/03.png $T/04.png $T/05.png -append -quality 88 $S/biscuit-sit-clips.webp
rm -rf $T; identify $S/biscuit-clips.webp $S/biscuit-sit-clips.webp | cut -c1-80
