#!/bin/bash
# hollis-sheets.sh : the four contact sheets of Mister Hollis (out/sheets/hollis*.webp, each 1536 px wide)
# Aboard he is shown on the Puffin at `Crew2`, with a white line where the game hangs his line (sit) and a red slab where it
# hangs his catch (pull): make-linemark.mjs out/linemark.glb; make-linemark.mjs out/fishmark.glb fish. Run it from a folder called `tools`.
cd "$(dirname "$0")"; M=out/hollis.anim.glb; S=out/sheets; mkdir -p $S; T=$(mktemp -d); CH=${CH:-/home/user/murmurwater/public/models/characters}
one() { node render.mjs $M $T/$1.png cell=384 cols=1 clip=${4:-idle} times=${5:-0.3} views="$2" focus=$3 >/dev/null; }
one a "0,5" 0,1.02,0,1.15; one b "35,10" 0,1.02,0,1.15; one c "90,5" 0,1.02,0,1.15; one d "180,10" 0,1.02,0,1.15
one e "12,4" 0,1.70,0,0.36; one f "-145,14" 0,1.02,0,1.15; one g "-62,16" -0.36,0.80,0,0.34; one h "62,22" 0.11,1.36,0.18,0.30 idle 0.70
convert \( $T/a.png $T/b.png $T/c.png $T/d.png +append \) \( $T/e.png $T/f.png $T/g.png $T/h.png +append \) -append -quality 88 $S/hollis.webp
row() { node render.mjs $M $T/r$1.png cell=256 cols=6 clip=$2 times=$3 views="$4" focus=$5 >/dev/null; convert $T/r$1.png -gravity NorthWest -fill white -pointsize 20 -annotate +8+6 "$2" $T/r$1.png; }
row 1 idle 0.12,0.37,0.57,0.63,0.70,0.84 "22,8" 0,1.05,0,1.2; row 2 talk 0.12,0.3,0.46,0.62,0.68,0.9 "22,8" 0,1.05,0,1.2; row 3 wave 0.12,0.3,0.4,0.5,0.6,0.86 "22,8" 0,1.05,0,1.2
convert $T/r1.png $T/r2.png $T/r3.png -append -quality 88 $S/hollis-clips.webp
ab() { node render.mjs $M $T/s$1.png cell=256 cols=6 clip=$2 times=$3 views="$4" focus=$5 "add=/tools/out/puffin.glb@-0.70,0.25,-0.62,-90" hide=HullMask attach=/tools/out/$6.glb socket=LineHand >/dev/null; convert $T/s$1.png -gravity NorthWest -fill white -pointsize 20 -annotate +8+6 "$2" $T/s$1.png; }
ab 1 sit 0.001,0.2,0.36,0.52,0.8,0.9 "-90,12" -0.1,0.9,0.12,0.8 linemark; ab 2 pull 0.001,0.24,0.38,0.56,0.8,0.94 "20,15" -0.1,0.9,0.15,0.8 fishmark; ab 3 pull 0.001,0.24,0.38,0.56,0.8,0.94 "-60,50" -0.1,0.9,0.15,0.8 fishmark
convert $T/s1.png $T/s2.png $T/s3.png -append -quality 88 $S/hollis-aboard.webp
CELL=256 CLIP=idle TIME=0.3 FOCUS=0,1.0,0,1.18 ./lineup.sh $T/l1.png "0,5" $CH/wick.glb $CH/mara.glb $CH/player.glb $M $CH/calloway.glb $CH/pell.glb
CELL=256 CLIP=idle TIME=0.3 FOCUS=0,1.0,0,1.18 ./lineup.sh $T/l2.png "35,10" $CH/wick.glb $CH/mara.glb $CH/player.glb $M $CH/calloway.glb $CH/pell.glb
convert $T/l1.png $T/l2.png -append -resize 1536x -quality 88 $S/hollis-lineup.webp
rm -rf $T; identify $S/hollis*.webp | cut -c1-90
