#!/bin/bash
# make-puffin.sh [cell] : build the Puffin's hull and her rig, check that each repeats byte for byte, and render them
# together: under sail, the sail on the other side, furled, and the hull alone from above.
set -e; cd "$(dirname "$0")"; O=out; mkdir -p $O; PY=${PY:-../voice/venv/bin/python}; c=${1:-512}
for n in puffin puffin-rig; do
  node build-$n.mjs $O/$n.glb --layout $O/$n.layout.json --uv $O/$n.uv.svg --sockets $O/$n.json > /dev/null
  $PY paint-atlas.py $O/$n.layout.json $O/$n.png
  node build-$n.mjs $O/$n.glb $O/$n.png | cut -c1-260
  node build-$n.mjs $O/$n.again.glb $O/$n.png > /dev/null; cmp $O/$n.glb $O/$n.again.glb && rm $O/$n.again.glb && echo "$n repeats byte for byte, $(stat -c %s $O/$n.glb) bytes"
done
at=$(node -e "const s=JSON.parse(require('fs').readFileSync('$O/puffin.json'));console.log(s.MastStep.join(','))")
r() { node render.mjs $O/puffin.glb $O/puffin.$1.png cell=$c cols=${4:-2} hide=HullMask add="/tools/$O/puffin-rig.glb@$at" morph=$2 views="$3" focus=${5:-0,2.5,-0.1,3.6} > /dev/null; }
r sail 1,0 "55,8;145,14" & r lee -1,0 "-35,12;-125,10" & r furl 0,1 "55,8;150,22" & wait
node render.mjs $O/puffin.glb $O/puffin.deck.png cell=$c cols=2 hide=HullMask views="160,35;-25,40" focus=0,0.4,-0.2,2.6 > /dev/null
echo "sheets: $O/puffin.{sail,lee,furl,deck}.png"
