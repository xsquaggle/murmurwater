#!/bin/bash
# make-fish.sh <fish> [cell] [views] : build one of the Fen fish (build-fen-fish.mjs) in three steps (layout, paint,
# model), check that the build repeats byte for byte, and render a contact sheet.
set -e; cd "$(dirname "$0")"; n=$1; O=out; mkdir -p $O; PY=${PY:-../voice/venv/bin/python}
node build-fen-fish.mjs $n $O/$n.glb --layout $O/$n.layout.json --uv $O/$n.uv.svg > /dev/null
$PY paint-atlas.py $O/$n.layout.json $O/$n.png
node build-fen-fish.mjs $n $O/$n.glb $O/$n.png
node build-fen-fish.mjs $n $O/$n.again.glb $O/$n.png > /dev/null; cmp $O/$n.glb $O/$n.again.glb && rm $O/$n.again.glb && echo "repeats byte for byte, $(stat -c %s $O/$n.glb) bytes"
node render.mjs $O/$n.glb $O/$n.sheet.png cell=${2:-384} cols=4 ${3:+views="$3"} | cut -c1-300
