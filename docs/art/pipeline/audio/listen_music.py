"""listen_music.py file [window s] : what a music file contains over time: AudioSet tags per window, loudness, tempo, key."""
import sys, numpy as np, soundfile as sf, librosa, subprocess, io, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ears
def load(p, sr=44100):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ar', str(sr), '-f', 'wav', '-'], capture_output=True).stdout
    x, sr = sf.read(io.BytesIO(raw), dtype='float32'); return x, sr
KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]); MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
def key(y, sr):
    c = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1); best = max(((np.corrcoef(np.roll(P, i), c)[0, 1], KEYS[i] + n) for i in range(12) for P, n in ((MAJ, ' major'), (MIN, ' minor'))))
    return best[1], round(float(best[0]), 2)
if __name__ == '__main__':
    p = sys.argv[1]; win = float(sys.argv[2]) if len(sys.argv) > 2 else 10
    x, sr = load(p); m = ears.mono(x); print(os.path.basename(p), round(len(m) / sr, 2), 's', 'stereo' if x.ndim > 1 else 'mono')
    tempo, beats = librosa.beat.beat_track(y=m, sr=sr); print('tempo', np.round(tempo, 1), 'beats', len(beats), 'key', key(m, sr))
    for a in np.arange(0, len(m) / sr, win):
        seg = m[int(a * sr): int((a + win) * sr)]
        if len(seg) < sr: continue
        rms = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9); t = ears.tags(seg, sr, 6)
        tp = librosa.beat.beat_track(y=seg, sr=sr)[0] if len(seg) > 4 * sr else [0]
        print(f'{a:6.1f}s  {rms:6.1f} dB  tempo {float(np.atleast_1d(tp)[0]):5.1f}  key {key(seg, sr)[0]:9s} ', ', '.join(f'{n} {v}' for n, v in t if n != 'Music'), flush=True)
