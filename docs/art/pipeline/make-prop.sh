#!/bin/bash
# make-prop.sh <name> [cell] [views] : build a code-built prop in three steps (layout, paint, model), check that the
# build repeats byte for byte, and render a contact sheet. The painter is paint-<name>.py if there is one, else paint-atlas.py.
set -e; cd "$(dirname "$0")"; n=$1; O=out; mkdir -p $O; PY=${PY:-../voice/venv/bin/python}
node build-$n.mjs $O/$n.glb --layout $O/$n.layout.json --uv $O/$n.uv.svg > /dev/null
if [ -f paint-$n.py ]; then $PY paint-$n.py $O/$n.layout.json $O/$n.png; else $PY paint-atlas.py $O/$n.layout.json $O/$n.png; fi
node build-$n.mjs $O/$n.glb $O/$n.png
node build-$n.mjs $O/$n.again.glb $O/$n.png > /dev/null; cmp $O/$n.glb $O/$n.again.glb && rm $O/$n.again.glb && echo "repeats byte for byte, $(stat -c %s $O/$n.glb) bytes"
node render.mjs $O/$n.glb $O/$n.sheet.png cell=${2:-384} cols=4 ${3:+views="$3"} | cut -c1-300
