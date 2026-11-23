#!/bin/bash
# regress.sh [repo] : after a change to kit.mjs, geomap.mjs, mats.py, paintkit.py or one of the tables mats.py takes in, rebuild every code-built prop, the Fen fish, the
# Puffin with her rig and her wreck, Dr. Calloway and Mister Hollis, and compare each with the file in the repo, byte for byte. One line per model.
cd "$(dirname "$0")"; REPO=${1:-../../..}; O=out/regress; mkdir -p $O; PY=${PY:-../voice/venv/bin/python}; bad=0
one() { # one <name> <repo file> <builder and its first arguments...>
  local n=$1 f=$2; shift 2
  "$@" $O/$n.glb --layout $O/$n.layout.json > /dev/null 2>&1
  if [ -f paint-$n.py ]; then $PY paint-$n.py $O/$n.layout.json $O/$n.png > /dev/null 2>&1; else $PY paint-atlas.py $O/$n.layout.json $O/$n.png > /dev/null 2>&1; fi
  "$@" $O/$n.glb $O/$n.png > /dev/null 2>&1
  if cmp -s $O/$n.glb $f; then echo "same     $n"; else echo "DIFFERS  $n"; bad=1; fi
}
for n in fog-lamp sea-road-light lantern-tree-a lantern-tree-b reeds-a reeds-b lily-glow stilt-hut field-kit packet-box listening-post pot-float belfry puffin-wreck rib-a rib-b vertebra sea-thrift; do one $n $REPO/public/models/props/$n.glb node build-$n.mjs; done
for n in reedling mudlark glassfin sedge-pike glowbelly stilt-gar mossback-tench old-mossglass bottomless-eel the-listener; do one $n $REPO/public/models/fish/$n.glb node build-fen-fish.mjs $n; done
for n in puffin puffin-rig; do one $n $REPO/public/models/boats/$n.glb node build-$n.mjs; done
PLAYER=${PLAYER:-$REPO/public/models/characters/player.glb} ./make-calloway.sh 128 > /dev/null 2>&1
if cmp -s out/calloway.anim.glb $REPO/public/models/characters/calloway.glb; then echo "same     calloway"; else echo "DIFFERS  calloway"; bad=1; fi
PLAYER=${PLAYER:-$REPO/public/models/characters/player.glb} ./make-hollis.sh 128 > /dev/null 2>&1
if cmp -s out/hollis.anim.glb $REPO/public/models/characters/hollis.glb; then echo "same     hollis"; else echo "DIFFERS  hollis"; bad=1; fi
exit $bad
