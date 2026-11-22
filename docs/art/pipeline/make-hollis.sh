#!/bin/bash
# make-hollis.sh [cell] [views] [focus] : build Mister Hollis whole and render a sheet.
#   0. make-hollis-rig.mjs stretches the biped's skeleton to his proportions and adds the joints that close his mittens
#      and the joints Bag and Watch: hollis-rig.json
#   1. build-hollis.mjs lays out the atlas, paint-atlas.py paints it (hollismats.py), build-hollis.mjs writes the
#      skinned figure at rest: out/hollis.glb
#   2. borrow-clips.mjs carries the player's idle over to his skeleton as `base_idle` (the sway of the body only)
#   3. author-anim.mjs bakes his own clips on top of it (hollis-clips.mjs: idle, talk, wave, sit, pull), adds the node
#      `LineHand` and drops `base_idle`: out/hollis.anim.glb, the file the game loads (public/models/characters/hollis.glb)
# The whole chain is run twice and must repeat byte for byte.
# PLAYER=<player.glb> says where the player's model is (default: the game's, seen from docs/art/pipeline). STATIC=1 stops after step 1.
set -e; cd "$(dirname "$0")"; O=out; mkdir -p $O; PY=${PY:-../voice/venv/bin/python}
PLAYER=${PLAYER:-../../../public/models/characters/player.glb}
node make-hollis-rig.mjs biped-rig.json hollis-rig.json > /dev/null
chain() {   # chain <suffix>: out/hollis<suffix>.glb and out/hollis<suffix>.anim.glb
  node build-hollis.mjs $O/hollis$1.glb $O/hollis.png $ONLY | tail -1 | cut -c1-260
  [ -n "$STATIC" ] && return 0
  node borrow-clips.mjs $O/hollis$1.glb $O/hollis$1.base.glb "base_idle=$PLAYER#idle" > /dev/null
  node author-anim.mjs $O/hollis$1.base.glb $O/hollis$1.anim.glb hollis-clips.mjs --fingers 0 --drop base_idle | grep -v '^prune' | cut -c1-260
  rm $O/hollis$1.base.glb
}
node build-hollis.mjs $O/hollis.glb --layout $O/hollis.layout.json --uv $O/hollis.uv.svg $ONLY > /dev/null
$PY paint-atlas.py $O/hollis.layout.json $O/hollis.png
chain ""
if [ -z "$STATIC" ]; then chain .again > /dev/null
  cmp $O/hollis.glb $O/hollis.again.glb && cmp $O/hollis.anim.glb $O/hollis.again.anim.glb && rm $O/hollis.again.glb $O/hollis.again.anim.glb && echo "repeats byte for byte, $(stat -c %s $O/hollis.anim.glb) bytes"; fi
node render.mjs $O/hollis.glb $O/hollis.sheet.png cell=${1:-512} cols=3 views="${2:-0,5;35,10;90,5;180,10;-35,30;0,-15}" focus=${3:-0,1.02,0,1.2} | cut -c1-260
