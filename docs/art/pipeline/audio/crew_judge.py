"""crew_judge.py [name ...] : what the sounds of "hands aboard" are, to the two listeners in ears.py: tags, the rank of each sound's own
description among all the sounds, how well a few other descriptions fit, the level over time, and for the long ones the tags of each stretch."""
import os, sys, numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); A = os.path.dirname(HERE)
import ears, sfx_build as B
src = open(os.path.join(HERE, 'sfx_check.py')).read(); a = src.index('WHAT = {'); b = src.index('}', a) + 1; ns = {}; exec(src[a:b], ns); WHAT = ns['WHAT']; names = list(WHAT); T = ears.embed_text([WHAT[k] for k in names])
EXTRA = {
    'cat-catch': ['a small splash, a wet slap on wood and a cat chirruping', 'a small splash', 'a wet fish slapping on a wooden deck', 'a cat chirruping, a short trill', 'a cat meowing', 'a hand clap', 'a punch', 'a door slamming', 'a dog barking'],
    'cat-eat': ['a cat eating crunchy food and purring', 'a cat purring', 'a small animal chewing and crunching', 'a person eating an apple', 'crumpling paper', 'footsteps on gravel', 'an engine idling', 'snoring'],
    'hollis-catch': ['cloth rubbing, a drip, then a low breathy voice saying ah', 'a low breathy voice saying ah', 'a man sighing', 'a ghost moaning', 'a choir singing one note', 'a synthesizer note', 'a foghorn', 'wind', 'a cow mooing', 'an engine'],
    'hollis-thin': ['a long breath out with a low voice fading away', 'a long sigh', 'a ghost moaning', 'a choir singing one note', 'a synthesizer note', 'wind', 'a foghorn', 'an engine slowing down', 'snoring'],
    'hollis-thick': ['a breath in, then a low voice arriving', 'a person inhaling', 'a ghost moaning', 'a choir singing one note', 'a synthesizer note swelling', 'wind', 'a foghorn', 'an engine starting', 'snoring'],
    'crew-basket-full': ['a wicker basket creaking, then two knocks on wood', 'a wicker basket creaking', 'two knocks on wood', 'a door creaking open', 'knocking on a door', 'a drum', 'breaking sticks', 'footsteps'],
    'boatyard': ['a boatyard: hammering on wood, sawing, planing, then a boat sliding into the water', 'a carpenter working with hand tools', 'hammering on wood', 'sawing wood', 'a big splash', 'construction machinery', 'a car crash', 'footsteps', 'thunder'],
    'sloop-sail': ['a big canvas sail filling with wind with a thump, and a wooden creak', 'a sail flapping in the wind', 'a flag flapping', 'a wooden creak', 'thunder', 'an explosion', 'a door slamming', 'wind', 'a tent in the wind'],
}
STRETCH = {'boatyard_1': ((0, 1.45), (1.45, 2.7), (2.68, 3.9), (3.75, 4.4), (4.3, 6.0), (3.75, 6.0)), 'cat-catch_1': ((0, 0.3), (0.28, 0.56), (0.55, 1.0)), 'cat-catch_2': ((0, 0.28), (0.26, 0.54), (0.5, 1.2)),
           'hollis-catch_1': ((0, 0.55), (0.6, 1.8)), 'hollis-catch_2': ((0, 0.55), (0.6, 1.8)), 'crew-basket-full_1': ((0, 0.45), (0.44, 1.0)), 'sloop-sail_1': ((0, 0.62), (0.6, 1.4)), 'hollis-thin_1': ((0, 1.3), (1.3, 3.2)), 'hollis-thick_1': ((0, 1.0), (1.0, 3.2))}
SEG = ['a mallet knocking on wood', 'sawing wood with a hand saw', 'a hand plane shaving wood', 'something heavy dragged across wood', 'a big splash', 'a boat sliding into the water', 'a wave washing in', 'a small splash', 'a wet slap', 'a cat chirruping',
       'cloth rubbing', 'a water drip', 'a low breathy voice saying ah', 'a person breathing out', 'a person breathing in', 'a creak', 'a knock on wood', 'a sail filling with a thump']
want = sys.argv[1:]
for f in sorted(os.listdir(B.OUT)):
    base = f.rsplit('_', 1)[0]
    if not f.endswith('.ogg') or base not in EXTRA or (want and not any(w in f for w in want)): continue
    x, sr = sf.read(os.path.join(B.OUT, f), dtype='float32'); s, _ = ears.match(x, sr, T=T); order = list(np.argsort(s)[::-1]); rank = order.index(names.index(base)) + 1 if base in names else 0
    print(f"{f:22s} {len(x)/sr:6.2f}s rank {rank:2d} (top {names[order[0]]}, {names[order[1]]}, {names[order[2]]})  tags", ' '.join(f'{a}:{b}' for a, b in ears.tags(x, sr, 5)))
    _, p = ears.match(x, sr, texts=EXTRA[base]); print('      ', ' | '.join(f'{e}={v:.2f}' for e, v in sorted(zip(EXTRA[base], p), key=lambda q: -q[1])[:5]))
    n = int(0.1 * sr); print('       rms per 0.1 s:', ' '.join('%.0f' % B.db(float(np.sqrt((x[i:i + n] ** 2).mean()))) for i in range(0, len(x) - n + 1, n)))
    for a, b in STRETCH.get(f[:-4], ()):
        seg = x[int(a * sr):int(b * sr)]
        if len(seg) < 0.1 * sr: continue
        _, p = ears.match(seg, sr, texts=SEG); print(f'       {a:4.2f}-{b:4.2f}s', ' '.join(f'{u}:{v}' for u, v in ears.tags(seg, sr, 3)), '||', ' | '.join(f'{e}={v:.2f}' for e, v in sorted(zip(SEG, p), key=lambda q: -q[1])[:3]), flush=True)
