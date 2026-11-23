#!/usr/bin/env python3
"""sfx_check.py [dir] : what each finished effect sounds like to two listeners that are not people:
AudioSet tags (AST) and, with CLAP, where the sound's own description ranks among the descriptions of all the sounds."""
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
    'gulls': 'a seagull calling', 'waves-lap': 'gentle waves lapping at the shore', 'dock-creak': 'old wood creaking', 'cat-meow': 'a cat meowing', 'cat-purr': 'a cat purring',
    'sail-flap': 'a sail flapping in the wind', 'hull-wash': 'water running along the hull of a moving boat', 'boat-bump': 'a wooden boat bumping with a dull hollow thud', 'rope-creak': 'a rope creaking under tension',
    'boat-board': 'stepping into a small wooden boat, a thump and a slosh', 'chart-open': 'unrolling a paper map', 'murmur': 'a low eerie wordless hum, a drone',
    'chest-open': 'a wooden chest lid creaking open with a clink of coins',
    'bell-toll': 'one strike of a big deep church bell ringing out', 'pot-set': 'a basket dropped into the sea with a splash and a rope running out',
    'pot-haul': 'hauling a wet basket out of the sea, water pouring off it', 'echo-buy': 'a soft glassy chime, a ding', 'tide-turn': 'a long ocean wave washing in and pulling back',
    'fog-lamp-light': 'a gas lamp lighting with a soft whoomp and a glassy ring', 'sea-road-chime': 'one distant glass bell note ringing far away', 'fog-cross': 'a low gust of wind with an eerie hum under it',
    'packet-box': 'a wooden box lid, a rope creak and a bag of coins', 'reed-brush': 'a boat pushing through reeds, rustling stalks', 'fen-day': 'a marsh by day with frogs, insects and a far bird',
    'fen-night': 'a marsh at night with crickets and deep frogs',
    'cat-catch': 'a small splash, a wet slap on wood and a cat chirruping', 'cat-eat': 'a cat eating crunchy food and purring', 'hollis-catch': 'cloth rubbing, a drip, then a low breathy voice saying ah',
    'hollis-thin': 'a long breath out with a low voice fading away', 'hollis-thick': 'a breath in, then a low voice arriving', 'crew-basket-full': 'a wicker basket creaking, then two knocks on wood',
    'boatyard': 'a boatyard: hammering on wood, sawing, planing, then a boat sliding into the water', 'sloop-sail': 'a big canvas sail filling with wind with a thump, and a wooden creak',
    'find-drag': 'one long low gulp of water as something sinks slowly', 'haul-knock': 'a dull wooden thud heard under water, with a short low ring',
    'haul-snag': 'a heavy thud under water, then a taut line creaking tighter', 'haul-free': 'a soft scrape under water and a few bubbles rising',
    'find-surface': 'a heavy box lifted out of the sea, water streaming off it and then dripping'}
names = list(WHAT); T = ears.embed_text([WHAT[n] for n in names]); out = {}
for f in sorted(os.listdir(D)):
    if not f.endswith('.ogg'): continue
    x, sr = sf.read(os.path.join(D, f), dtype='float32'); base = f.rsplit('_', 1)[0]
    s, pr = ears.match(x, sr, T=T); order = list(np.argsort(s)[::-1]); rank = order.index(names.index(base)) + 1
    tg = ears.tags(x, sr, 4); out[f] = dict(rank=rank, top=names[order[0]], tags=tg)
    print(f"{f:20s} rank {rank:2d} (top: {names[order[0]]:12s} {names[order[1]]:12s}) ", ' '.join(f'{a}:{b}' for a, b in tg), flush=True)
json.dump(out, open(os.path.join(D, 'check.json'), 'w'), indent=1)
