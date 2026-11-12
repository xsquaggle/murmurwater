#!/bin/bash
# pose-sheet.sh model out.png "clip:time clip:time ..." [views] [focus]
M=$1; O=$2; POSES=$3; VIEWS=${4:-"20,8;-70,8"}; FOCUS=${5:-"0,0.95,0.1,0.85"}
T=$(mktemp -d); i=0; files=""
for p in $POSES; do c=${p%%:*}; t=${p##*:}; IFS=';' read -ra VS <<< "$VIEWS"; for v in "${VS[@]}"; do f=$T/$(printf %03d $i).png; node render.mjs $M $f cell=448 cols=1 clip=$c times=$t views="$v" rod=1 fish=${FISH:-0} focus=$FOCUS >/dev/null; files="$files $f"; i=$((i+1)); done; done
n=$(echo $VIEWS | tr ';' '\n' | wc -l); cols=$(( $(echo $POSES | wc -w) )); 
montage $files -tile ${cols}x -geometry +0+0 $O 2>/dev/null || montage $files -tile x$n -geometry +0+0 $O
rm -rf $T
