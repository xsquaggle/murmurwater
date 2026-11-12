"""ev.py [--rel dB] [--gap s] file ... : events (start, end, peak) of each file, without tags."""
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from listen_music import load
from events import find_events, envelope
a = sys.argv[1:]; rel = -30.0; gap = 0.08
if '--rel' in a: i = a.index('--rel'); rel = float(a[i + 1]); del a[i:i + 2]
if '--gap' in a: i = a.index('--gap'); gap = float(a[i + 1]); del a[i:i + 2]
for p in a:
    x, sr = load(p); m = x if x.ndim == 1 else x.mean(axis=1); ev = find_events(m, sr, rel_db=rel, min_gap=gap, min_len=0.02)
    e = 20 * np.log10(envelope(m, sr, 0.1, 0.1))
    print(os.path.basename(p), f'{len(m)/sr:.2f}s', 'events', len(ev)); print('   env/100ms:', ' '.join('%d' % v for v in e[:120]))
    print('   ', '  '.join(f'{s:.2f}-{t:.2f}({pk:.0f})' for s, t, pk in ev[:60]))
