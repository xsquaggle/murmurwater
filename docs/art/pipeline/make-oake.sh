#!/bin/bash
# make-oake.sh [cell] [views] [focus] : build Captain Oake whole and render a sheet.
#   0. make-oake-rig.mjs makes the biped's skeleton short and broad and adds the joints that close her hands and the
#      joint Pipe: oake-rig.json
#   1. build-oake.mjs lays out the atlas, paint-atlas.py paints it (oakemats.py and the others), build-oake.mjs writes
#      the skinned figure at rest: out/oake.glb
#   2. borrow-clips.mjs carries the player's idle over to her skeleton as `base_idle` (the sway of the body only)
#   3. author-anim.mjs bakes her own clips on top of it (oake-clips.mjs: idle, talk, wave) and drops `base_idle`:
#      out/oake.anim.glb, the file the game loads (public/models/characters/oake.glb)
# The whole chain is run twice and must repeat byte for byte.
# PLAYER=<player.glb> says where the player's model is (default: the game's, seen from docs/art/pipeline). STATIC=1 stops after step 1.
set -e; cd "$(dirname "$0")"; O=out; mkdir -p $O; PY=${PY:-../voice/venv/bin/python}
PLAYER=${PLAYER:-../../../public/models/characters/player.glb}
node make-oake-rig.mjs biped-rig.json oake-rig.json > /dev/null
chain() {   # chain <suffix>: out/oake<suffix>.glb and out/oake<suffix>.anim.glb
  node build-oake.mjs $O/oake$1.glb $O/oake.png $ONLY | tail -1 | cut -c1-260
  [ -n "$STATIC" ] && return 0
  node borrow-clips.mjs $O/oake$1.glb $O/oake$1.base.glb "base_idle=$PLAYER#idle" > /dev/null
  node author-anim.mjs $O/oake$1.base.glb $O/oake$1.anim.glb oake-clips.mjs --fingers 0 --drop base_idle | grep -v '^prune' | cut -c1-260
  rm $O/oake$1.base.glb
}
node build-oake.mjs $O/oake.glb --layout $O/oake.layout.json --uv $O/oake.uv.svg $ONLY > /dev/null
$PY paint-atlas.py $O/oake.layout.json $O/oake.png
chain ""
if [ -z "$STATIC" ]; then chain .again > /dev/null
  cmp $O/oake.glb $O/oake.again.glb && cmp $O/oake.anim.glb $O/oake.again.anim.glb && rm $O/oake.again.glb $O/oake.again.anim.glb && echo "repeats byte for byte, $(stat -c %s $O/oake.anim.glb) bytes"; fi
node render.mjs $O/oake.glb $O/oake.sheet.png cell=${1:-512} cols=3 views="${2:-0,5;35,10;90,5;180,10;-35,30;0,-15}" focus=${3:-0,0.80,0,0.95} | cut -c1-260
