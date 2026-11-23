"""finds_judge.py [name ...] : what the sounds of "things fished up" are, to the two listeners in ears.py: tags, the rank of each
sound's own description among all the sounds, how well a few other descriptions fit, the level over time, and the tags of each stretch."""
import os, sys, numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); A = os.path.dirname(HERE)
import ears, sfx_build as B
src = open(os.path.join(HERE, 'sfx_check.py')).read(); a = src.index('WHAT = {'); b = src.index('}', a) + 1; ns = {}; exec(src[a:b], ns); WHAT = ns['WHAT']; names = list(WHAT); T = ears.embed_text([WHAT[k] for k in names])
EXTRA = {
    'find-drag': ['one long low gulp of water as something sinks slowly', 'a quick bright plop', 'a splash', 'bubbles rising in water', 'a water drip', 'a person swallowing', 'a toilet flush', 'thunder', 'a drum'],
    'haul-knock': ['a dull wooden thud heard under water, with a short low ring', 'a knock on wood', 'a drum', 'a kick drum', 'a door slamming', 'a heartbeat', 'a wooden boat bumping with a dull hollow thud', 'a rock dropped in water', 'a footstep'],
    'haul-snag': ['a heavy thud under water, then a taut line creaking tighter', 'a heavy thud under water', 'a taut rope creaking', 'a fishing rod bending and creaking', 'a door slamming', 'a drum', 'a door creaking open', 'a tree falling', 'a rock dropped in water'],
    'haul-free': ['a soft scrape under water and a few bubbles rising', 'bubbles rising in water', 'a soft scrape', 'something sliding off a rock under water', 'a splash', 'a zipper', 'a sigh', 'pouring water', 'footsteps on sand'],
    'find-surface': ['a heavy box lifted out of the sea, water streaming off it and then dripping', 'a big splash', 'water pouring off something lifted out of water', 'a tap running', 'a toilet flush', 'rain', 'a fish jumping', 'water dripping', 'someone climbing out of a swimming pool'],
    'crate-open': ['a wet wooden crate prised open: a lid levered, a nail squealing, things shifting inside', 'a wooden lid creaking open', 'wood cracking', 'a nail pulled out of wood with a squeal', 'things rattling in a wooden box', 'a door opening', 'coins', 'breaking sticks', 'a gunshot'],
    'relic-found': ['a struck glass ringing for a long time, with a low note under it', 'a small bell with a long tail', 'a wine glass struck', 'a low hum', 'a church bell', 'a doorbell', 'a telephone ringing', 'a synthesizer chord', 'an alarm'],
    'rumour': ['a page turned, then one soft high note', 'a page turning', 'one soft high bell note', 'a notification chime', 'a book closing', 'a whistle', 'an alarm', 'tearing paper'],
    'pearl-set': ['a tiny hard tick and a clear glassy ring', 'a marble set down on wood', 'a wine glass tapped', 'a small bell', 'a coin dropping', 'a click', 'a beep', 'a triangle struck'],
    'pearl-lift': ['a short glassy ring that falls in pitch', 'a wine glass tapped', 'a small bell', 'a coin dropping', 'a beep', 'a whistle sliding down', 'a water drop'],
}
STRETCH = {'haul-knock': ((0, 0.12), (0.1, 0.48)), 'haul-snag': ((0, 0.2), (0.2, 0.95), (0.45, 0.9)), 'haul-free': ((0, 0.3), (0.25, 0.78)), 'find-surface': ((0, 0.3), (0.3, 0.95), (0.95, 1.6)), 'crate-open': ((0, 0.35), (0.3, 0.65), (0.6, 1.0)),
           'relic-found': ((0, 0.4), (0.4, 1.5), (1.5, 3.5)), 'rumour': ((0, 0.45), (0.4, 1.2))}
SEG = ['a violin', 'a squeak', 'a car horn', 'a door creaking', 'a dull thud', 'a drum', 'a knock on wood', 'a bubble', 'a taut rope creaking', 'a fishing rod bending and creaking', 'a creak', 'a soft scrape', 'bubbles rising in water', 'a splash', 'water pouring in a stream', 'water dripping', 'a tap running', 'a wave',
       'wood cracking', 'a nail squealing out of wood', 'things rattling in a box', 'a struck glass ringing', 'a low hum', 'a page turning', 'one soft high note']
want = sys.argv[1:]
for f in sorted(os.listdir(B.OUT)):
    base = f.rsplit('_', 1)[0]
    if not f.endswith('.ogg') or base not in EXTRA or (want and not any(w in f for w in want)): continue
    x, sr = sf.read(os.path.join(B.OUT, f), dtype='float32'); s, _ = ears.match(x, sr, T=T); order = list(np.argsort(s)[::-1]); rank = order.index(names.index(base)) + 1 if base in names else 0
    print(f"{f:22s} {len(x)/sr:6.2f}s rank {rank:2d} (top {names[order[0]]}, {names[order[1]]}, {names[order[2]]})  tags", ' '.join(f'{a}:{b}' for a, b in ears.tags(x, sr, 5)))
    _, p = ears.match(x, sr, texts=EXTRA[base]); print('      ', ' | '.join(f'{e}={v:.2f}' for e, v in sorted(zip(EXTRA[base], p), key=lambda q: -q[1])[:5]))
    n = int(0.1 * sr); print('       rms per 0.1 s:', ' '.join('%.0f' % B.db(float(np.sqrt((x[i:i + n] ** 2).mean()) + 1e-9)) for i in range(0, len(x) - n + 1, n)), ' peak %.1f' % B.db(float(np.abs(x).max())))
    for a, b in STRETCH.get(base, ()):
        seg = x[int(a * sr):int(b * sr)]
        if len(seg) < 0.1 * sr: continue
        _, p = ears.match(seg, sr, texts=SEG); print(f'       {a:4.2f}-{b:4.2f}s', ' '.join(f'{u}:{v}' for u, v in ears.tags(seg, sr, 3)), '||', ' | '.join(f'{e}={v:.2f}' for e, v in sorted(zip(SEG, p), key=lambda q: -q[1])[:3]), flush=True)
