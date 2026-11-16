"""fen_judge.py [name ...] : what the Fen sounds are, to the two listeners in ears.py: tags, the rank of each sound's own description
among all the sounds, how well a few other descriptions fit, and for the loops the tags of every six seconds and the level over time."""
import os, sys, numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); A = os.path.dirname(HERE)
import ears, sfx_build as B
src = open(os.path.join(HERE, 'sfx_check.py')).read(); a = src.index('WHAT = {'); b = src.index('}', a) + 1; ns = {}; exec(src[a:b], ns); WHAT = ns['WHAT']; names = list(WHAT); T = ears.embed_text([WHAT[k] for k in names])
EXTRA = {
    'fog-lamp-light': ['a gas lamp lighting with a soft whoomp, then a glass ring', 'a soft whoomp of a gas flame catching', 'a glass chime ringing', 'a notification sound', 'a drum hit', 'a synthesizer note', 'an explosion', 'a door closing'],
    'sea-road-chime': ['a distant bell', 'a small bell rung once far away', 'a glass chime', 'a telephone ringing', 'a synthesizer beep', 'a wine glass struck softly', 'an alarm'],
    'fog-cross': ['wind blowing', 'a low breath of wind', 'a choir humming far away', 'an engine idling', 'a jet aircraft passing', 'ocean waves', 'a ghostly moan'],
    'packet-box': ['a wooden box lid, a rope creak and a bag of coins', 'a wooden lid closing', 'a rope creaking', 'coins in a bag', 'a door slamming', 'footsteps', 'glass breaking'],
    'reed-brush': ['rustling dry reeds and grass', 'a boat moving through tall grass in water', 'crumpling paper', 'footsteps on leaves', 'fire crackling', 'rain'],
    'fen-day': ['frogs croaking in a swamp in daytime', 'insects buzzing', 'birdsong', 'dripping water', 'wind', 'a synthesizer', 'a computer game beep'],
    'echo-buy': ['a glass chime ringing', 'a synthesizer note', 'a notification sound', 'a small bell'], 'quest-accept': ['a glass chime ringing', 'a synthesizer note', 'a notification sound', 'a small bell'], 'bell-toll': ['a church bell', 'a synthesizer note', 'a gong'],
    'fen-night': ['crickets chirping at night', 'frogs croaking at night', 'a low hum far away', 'an owl', 'a synthesizer', 'machinery'],
}
want = sys.argv[1:]
for f in sorted(os.listdir(B.OUT)):
    base = f.rsplit('_', 1)[0]
    if not f.endswith('.ogg') or base not in EXTRA or (want and not any(w in f for w in want)): continue
    x, sr = sf.read(os.path.join(B.OUT, f), dtype='float32'); s, _ = ears.match(x, sr, T=T); order = list(np.argsort(s)[::-1]); rank = order.index(names.index(base)) + 1
    print(f"{f:22s} {len(x)/sr:6.2f}s rank {rank:2d} (top {names[order[0]]}, {names[order[1]]}, {names[order[2]]})  tags", ' '.join(f'{a}:{b}' for a, b in ears.tags(x, sr, 5)))
    _, p = ears.match(x, sr, texts=EXTRA[base]); print('      ', ' | '.join(f'{e}={v:.2f}' for e, v in sorted(zip(EXTRA[base], p), key=lambda q: -q[1])[:5]))
    if len(x) > 20 * sr:
        w = 6 * sr
        for i in range(0, len(x), w):
            seg = x[i:i + w]; print(f'       {i/sr:4.0f}-{(i+w)/sr:3.0f}s rms {B.db(float(np.sqrt((seg**2).mean()))):6.1f} pk {B.db(float(np.abs(seg).max())):6.1f} ', ' '.join(f'{a}:{b}' for a, b in ears.tags(seg, sr, 4)), flush=True)
        n = sr // 2; print('       rms per 0.5 s:', ' '.join('%.0f' % B.db(float(np.sqrt((x[i:i + n] ** 2).mean()))) for i in range(0, len(x) - n + 1, n)))
    else:
        n = int(0.1 * sr); print('       rms per 0.1 s:', ' '.join('%.0f' % B.db(float(np.sqrt((x[i:i + n] ** 2).mean()))) for i in range(0, len(x) - n + 1, n)))
