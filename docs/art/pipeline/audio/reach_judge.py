"""reach_judge.py [name ...] : what the Reach's sounds are, to the two listeners in ears.py: tags, the rank of each sound's own description
among all the sounds, how well a few other descriptions fit, the level over time, and the tags of each stretch (every 6 s of a loop)."""
import os, sys, numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import ears, sfx_build as B
src = open(os.path.join(HERE, 'sfx_check.py')).read(); a = src.index('WHAT = {'); b = src.index('}', a) + 1; ns = {}; exec(src[a:b], ns); WHAT = ns['WHAT']; names = list(WHAT); T = ears.embed_text([WHAT[k] for k in names])
EXTRA = {
    'reach-day': ['slow waves breaking on a pebble beach, wind, gulls far off', 'ocean waves on a beach', 'a seagull', 'wind', 'heavy rain', 'traffic', 'a river', 'applause', 'a toilet flush'],
    'reach-night': ['slow waves on pebbles at night and a wire humming in the wind', 'ocean waves', 'a low hum', 'an electrical hum', 'a ship horn', 'wind', 'an engine idling', 'a choir', 'traffic'],
    'storm-rain': ['hard rain falling on the sea', 'heavy rain', 'rain on a roof', 'frying food', 'applause', 'a shower', 'static', 'a waterfall'],
    'storm-wind': ['a gale moaning in the rigging of a ship', 'strong wind howling', 'wind whistling through wires', 'a siren', 'a ghost moaning', 'an engine', 'a jet plane', 'a choir', 'a whale call'],
    'thunder-near': ['a close crack of thunder and a long roll', 'thunder', 'an explosion', 'fireworks', 'a gunshot', 'a door slamming', 'a truck passing'],
    'thunder-far': ['thunder rolling far away', 'thunder', 'an explosion far away', 'a truck passing', 'an aeroplane overhead', 'a rumble of traffic', 'a drum roll'],
    'lightning-strike': ['lightning striking water with a sharp crack and a hiss of steam', 'a crack', 'a hiss of steam', 'a whip crack', 'a gunshot', 'a splash', 'frying', 'a firework'],
    'struck-water': ['a faint fizz and a high singing note', 'a wine glass singing', 'tinnitus', 'a kettle', 'a beep', 'frying', 'an alarm', 'a high whistle'],
    'storm-cone': ['a pulley block squeaking and a soft thump of canvas', 'a squeak', 'a door creaking', 'a thump', 'a mouse squeak', 'a bird chirp', 'a rope creaking'],
    'swell-boom': ['a deep hollow boom of a wave in a sea cave, then water sucked back out', 'a wave crashing', 'an explosion', 'a drum', 'thunder', 'a toilet flush', 'a door slamming'],
}
STRETCH = {'lightning-strike': ((0, 0.12), (0.1, 0.4), (0.3, 1.6)), 'storm-cone': ((0, 0.45), (0.45, 1.0)), 'swell-boom': ((0, 1.2), (1.1, 3.1)), 'thunder-near': ((0, 0.6), (0.6, 3.0), (3.0, 6.0))}
SEG = ['a crack', 'a hiss of steam', 'a splash', 'thunder', 'a squeak', 'a thump', 'a flap of cloth', 'a deep boom', 'water sucked back', 'a wave', 'a gulp', 'an explosion', 'a gunshot', 'rain', 'wind', 'a siren', 'a seagull', 'a hum']
want = sys.argv[1:]
for f in sorted(os.listdir(B.OUT)):
    base = f.rsplit('_', 1)[0]
    if not f.endswith('.ogg') or base not in EXTRA or (want and not any(w in f for w in want)): continue
    x, sr = sf.read(os.path.join(B.OUT, f), dtype='float32'); s, _ = ears.match(x, sr, T=T); order = list(np.argsort(s)[::-1]); rank = order.index(names.index(base)) + 1
    print(f"{f:22s} {len(x)/sr:6.2f}s rank {rank:2d} (top {names[order[0]]}, {names[order[1]]}, {names[order[2]]})  tags", ' '.join(f'{a}:{b}' for a, b in ears.tags(x, sr, 5)))
    _, p = ears.match(x, sr, texts=EXTRA[base]); print('      ', ' | '.join(f'{e}={v:.2f}' for e, v in sorted(zip(EXTRA[base], p), key=lambda q: -q[1])[:5]))
    loop = len(x) / sr > 5.9 and base.split('-')[0] in ('reach', 'storm', 'struck')
    w = 2.0 if loop else 0.25; n = int(w * sr)
    print(f'       rms per {w} s:', ' '.join('%.0f' % B.db(float(np.sqrt((x[i:i + n] ** 2).mean()) + 1e-9)) for i in range(0, len(x) - n + 1, n)), ' peak %.1f' % B.db(float(np.abs(x).max())))
    for a, b in (tuple((k, k + 6) for k in range(0, int(len(x) / sr) - 2, 6)) if loop else STRETCH.get(base, ())):
        seg = x[int(a * sr):int(b * sr)]
        if len(seg) < 0.1 * sr: continue
        _, p = ears.match(seg, sr, texts=SEG); print(f'       {a:4.2f}-{b:4.2f}s', ' '.join(f'{u}:{v}' for u, v in ears.tags(seg, sr, 3)), '||', ' | '.join(f'{e}={v:.2f}' for e, v in sorted(zip(SEG, p), key=lambda q: -q[1])[:3]))
