#!/bin/bash
# lineup.sh out.png view model.glb ... : the same view of several characters side by side, at one scale.
O=$1; V=$2; shift 2; T=$(mktemp -d); i=0; fs=""
for m in "$@"; do f=$T/$i.png; node "$(dirname "$0")/render.mjs" "$m" $f cell=${CELL:-520} cols=1 views="$V" focus=${FOCUS:-0,0.87,0,1.02} ${CLIP:+clip=$CLIP times=${TIME:-0.3}} >/dev/null; fs="$fs $f"; i=$((i+1)); done
convert $fs +append "$O"; rm -rf $T
