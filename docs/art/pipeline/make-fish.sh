#!/bin/bash
# make-fish.sh <fish> [cell] [views] : build one fish in three steps (layout, paint, model), check that the build
# repeats byte for byte, and render a contact sheet. The Fen fish come from build-fen-fish.mjs (the default); for the
# Reach fish, set FISHB=build-reach-fish.mjs.
set -e; cd "$(dirname "$0")"; n=$1; O=out; mkdir -p $O; PY=${PY:-../voice/venv/bin/python}
node ${FISHB:-build-fen-fish.mjs} $n $O/$n.glb --layout $O/$n.layout.json --uv $O/$n.uv.svg > /dev/null
$PY paint-atlas.py $O/$n.layout.json $O/$n.png
node ${FISHB:-build-fen-fish.mjs} $n $O/$n.glb $O/$n.png
node ${FISHB:-build-fen-fish.mjs} $n $O/$n.again.glb $O/$n.png > /dev/null; cmp $O/$n.glb $O/$n.again.glb && rm $O/$n.again.glb && echo "repeats byte for byte, $(stat -c %s $O/$n.glb) bytes"
node render.mjs $O/$n.glb $O/$n.sheet.png cell=${2:-384} cols=4 ${3:+views="$3"} | cut -c1-300
