"""events.py file ... : envelope and separate sound events in a clip, with tags for each event."""
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ears
from listen_music import load
def envelope(m, sr, hop=0.005, win=0.02):
    n, h = int(win * sr), int(hop * sr); return np.array([np.sqrt((m[i:i + n] ** 2).mean() + 1e-12) for i in range(0, max(1, len(m) - n), h)])
def find_events(m, sr, rel_db=-32, min_gap=0.12, min_len=0.03, floor_db=-60):
    """Runs of the envelope above (peak + rel_db), merged over gaps shorter than min_gap. Returns [(start s, end s, peak dB)]."""
    hop = 0.005; e = 20 * np.log10(envelope(m, sr, hop)); thr = max(e.max() + rel_db, floor_db); act = e > thr; ev = []; i = 0
    while i < len(act):
        if act[i]:
            j = i
            while j < len(act) and act[j]: j += 1
            if ev and (i - ev[-1][1]) * hop < min_gap: ev[-1][1] = j
            else: ev.append([i, j])
            i = j
        else: i += 1
    return [(a * hop, b * hop, float(e[a:b].max())) for a, b in ev if (b - a) * hop >= min_len]
if __name__ == '__main__':
    for p in sys.argv[1:]:
        x, sr = load(p); m = ears.mono(x); e = 20 * np.log10(envelope(m, sr, 0.05, 0.05))
        print(os.path.basename(p), round(len(m) / sr, 2), 's  peak', round(20 * np.log10(np.abs(m).max()), 1), 'dB  whole:', ears.tags(m, sr, 5))
        print('   env/50ms:', ' '.join('%d' % v for v in e))
        for a, b, pk in find_events(m, sr):
            print(f'   event {a:5.2f}-{b:5.2f} ({b - a:4.2f} s) peak {pk:5.1f} dB ', ears.tags(m[int(a * sr):int(b * sr)], sr, 4))
