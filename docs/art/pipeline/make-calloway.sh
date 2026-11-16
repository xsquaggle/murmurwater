#!/bin/bash
# make-calloway.sh [cell] [views] [focus] : build Dr. Calloway whole and render a sheet.
#   1. build-calloway.mjs lays out the atlas, paint-atlas.py paints it (callomats.py), build-calloway.mjs writes the
#      skinned figure at rest: out/calloway.glb
#   2. borrow-clips.mjs carries the player's idle over to her skeleton as `base_idle` (the sway of the body only)
#   3. author-anim.mjs bakes her own clips on top of it (calloway-clips.mjs: idle, talk, wave) and drops `base_idle`:
#      out/calloway.anim.glb, which is the file the game loads (public/models/characters/calloway.glb)
# The whole chain is run twice and must repeat byte for byte.
# PLAYER=<player.glb> says where the player's model is (default: the game's, seen from docs/art/pipeline).
set -e; cd "$(dirname "$0")"; O=out; mkdir -p $O; PY=${PY:-../voice/venv/bin/python}
PLAYER=${PLAYER:-../../../public/models/characters/player.glb}
chain() {   # chain <suffix>: out/calloway<suffix>.glb and out/calloway<suffix>.anim.glb
  node build-calloway.mjs $O/calloway$1.glb $O/calloway.png $ONLY | tail -1 | cut -c1-200
  node borrow-clips.mjs $O/calloway$1.glb $O/calloway$1.base.glb "base_idle=$PLAYER#idle" > /dev/null
  node author-anim.mjs $O/calloway$1.base.glb $O/calloway$1.anim.glb calloway-clips.mjs --fingers 0 --drop base_idle | grep -v '^prune' | cut -c1-200
  rm $O/calloway$1.base.glb
}
node build-calloway.mjs $O/calloway.glb --layout $O/calloway.layout.json --uv $O/calloway.uv.svg $ONLY > /dev/null
$PY paint-atlas.py $O/calloway.layout.json $O/calloway.png
chain ""
chain .again > /dev/null
cmp $O/calloway.glb $O/calloway.again.glb && cmp $O/calloway.anim.glb $O/calloway.again.anim.glb && rm $O/calloway.again.glb $O/calloway.again.anim.glb && echo "repeats byte for byte, $(stat -c %s $O/calloway.anim.glb) bytes"
node render.mjs $O/calloway.glb $O/calloway.sheet.png cell=${1:-512} cols=3 views="${2:-0,5;35,10;90,5;180,10;-35,30;0,-15}" focus=${3:-0,0.87,0,1.02} | cut -c1-200
