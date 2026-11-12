#!/usr/bin/env python3
"""sfx_check.py [dir] : what each finished effect sounds like to two listeners that are not people:
AudioSet tags (AST) and, with CLAP, where the sound's own description ranks among the descriptions of all 28 sounds."""
import json, os, sys, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ears
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sfx', 'out')
WHAT = {
    'cast-swish': 'a stick swishing fast through the air, whoosh', 'reel-spin': 'a fishing reel spinning fast, whirring', 'bobber-plop': 'a small object plops into water',
    'nibble': 'a single tiny water drip', 'bite-dunk': 'something pulled under water with a gulp and a small splash', 'hook-set': 'a quick whip swish followed by a short mechanical zip',
    'reel-click': 'a ratchet clicking steadily', 'line-creak': 'a squeaky creak', 'line-snap': 'a string snapping with a twang', 'fish-splash': 'a fish splashing in water',
    'land-splash': 'a big splash and sloshing water', 'coins': 'coins clinking', 'step-wood': 'a footstep on a wooden floor', 'step-cobble': 'a footstep on stone pavement',
    'step-grass': 'a footstep on grass', 'step-sand': 'a footstep on sand', 'ui-open': 'a soft user interface pop', 'ui-close': 'a soft user interface blip', 'ui-click': 'a button click',
    'page-turn': 'turning a page of a book', 'quest-accept': 'a short pleasant chime of bells', 'lamp-ignite': 'a flame igniting with a whoosh of fire', 'oars': 'rowing a boat, an oar stroke in water',
    'gulls': 'a seagull calling', 'waves-lap': 'gentle waves lapping at the shore', 'dock-creak': 'old wood creaking', 'cat-meow': 'a cat meowing', 'cat-purr': 'a cat purring'}
names = list(WHAT); T = ears.embed_text([WHAT[n] for n in names]); out = {}
for f in sorted(os.listdir(D)):
    if not f.endswith('.ogg'): continue
    x, sr = sf.read(os.path.join(D, f), dtype='float32'); base = f.rsplit('_', 1)[0]
    s, pr = ears.match(x, sr, T=T); order = list(np.argsort(s)[::-1]); rank = order.index(names.index(base)) + 1
    tg = ears.tags(x, sr, 4); out[f] = dict(rank=rank, top=names[order[0]], tags=tg)
    print(f"{f:20s} rank {rank:2d} (top: {names[order[0]]:12s} {names[order[1]]:12s}) ", ' '.join(f'{a}:{b}' for a, b in tg), flush=True)
json.dump(out, open(os.path.join(D, 'check.json'), 'w'), indent=1)
