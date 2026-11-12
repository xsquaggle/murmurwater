"""survey.py dir ... : one line per audio file under each dir: length, channels, peak, number of events, top tags."""
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ears
from listen_music import load
from events import find_events
for d in sys.argv[1:]:
    fs = []
    for r, _, names in os.walk(d):
        for n in sorted(names):
            if n.lower().endswith(('.wav', '.ogg', '.flac', '.mp3')): fs.append(os.path.join(r, n))
    for p in sorted(fs):
        try: x, sr = load(p)
        except Exception as e: print(p, 'ERR', e); continue
        m = ears.mono(x); ev = find_events(m, sr)
        print(f"{os.path.relpath(p, d)[-58:]:58s} {len(m)/sr:6.2f}s sr{sr} ch{1 if x.ndim==1 else x.shape[1]} pk{20*np.log10(np.abs(m).max()+1e-9):6.1f} ev{len(ev):2d} ", ' '.join(f'{a}:{b}' for a, b in ears.tags(m, sr, 4)), flush=True)
