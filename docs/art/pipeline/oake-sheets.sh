#!/bin/bash
# oake-sheets.sh : the three contact sheets of Captain Oake (out/sheets/oake*.webp, each 1536 px wide). Run it from a folder called `tools`.
# M=<model> renders another copy of her (default out/oake.anim.glb); CH says where the other characters are.
cd "$(dirname "$0")"; M=${M:-out/oake.anim.glb}; S=out/sheets; mkdir -p $S; T=$(mktemp -d); CH=${CH:-/home/user/murmurwater/public/models/characters}
one() { node render.mjs $M $T/$1.png cell=384 cols=1 clip=${4:-idle} times=${5:-0.03} views="$2" focus=$3 >/dev/null; }
one a "0,5" 0,0.78,0,0.88; one b "35,10" 0,0.78,0,0.88; one c "90,5" 0,0.78,0,0.88; one d "180,10" 0,0.78,0,0.88
one e "12,4" 0,1.26,0.02,0.30; one f "-145,14" 0,0.78,0,0.88; one g "-55,12" -0.16,0.86,0.04,0.40; one h "24,6" -0.06,1.10,0.12,0.34 idle 0.45
convert \( $T/a.png $T/b.png $T/c.png $T/d.png +append \) \( $T/e.png $T/f.png $T/g.png $T/h.png +append \) -append -quality 88 $S/oake.webp
row() { node render.mjs $M $T/r$1.png cell=256 cols=6 clip=$2 times=$3 views="$4" focus=$5 >/dev/null; convert $T/r$1.png -gravity NorthWest -fill white -pointsize 20 -annotate +8+6 "$2" $T/r$1.png; }
row 1 idle 0.05,0.18,0.30,0.45,0.76,0.90 "22,8" 0,0.82,0,0.9; row 2 talk 0.10,0.25,0.40,0.56,0.64,0.85 "22,8" 0,0.82,0,0.9; row 3 wave 0.10,0.30,0.40,0.50,0.60,0.86 "22,8" 0,0.82,0,0.9
convert $T/r1.png $T/r2.png $T/r3.png -append -quality 88 $S/oake-clips.webp
CELL=256 CLIP=idle TIME=0.03 FOCUS=0,1.0,0,1.18 ./lineup.sh $T/l1.png "0,5" $CH/wick.glb $CH/mara.glb $CH/player.glb $M $CH/hollis.glb $CH/calloway.glb $CH/pell.glb
CELL=256 CLIP=idle TIME=0.03 FOCUS=0,1.0,0,1.18 ./lineup.sh $T/l2.png "35,10" $CH/wick.glb $CH/mara.glb $CH/player.glb $M $CH/hollis.glb $CH/calloway.glb $CH/pell.glb
convert $T/l1.png $T/l2.png -append -resize 1536x -quality 88 $S/oake-lineup.webp
rm -rf $T; identify $S/oake*.webp | cut -c1-90
