#!/usr/bin/env python3
"""loop.py in.mp3 out.wav [--min s] [--max s] [--xfade s] [--head s] [--tail s]
Cut a seamless loop from a music track.

The loop is x[a:b] with its last X seconds cross-faded into x[a-X:a], so the end of the file runs into the
start exactly as the original recording runs into a. The only edit is that cross-fade, so a and b are chosen
where the music around b matches the music around a (chroma + timbre + onset pattern), on the beat grid.
Prints the chosen points and how the seam compares with ordinary moments of the track."""
import sys, argparse, numpy as np, soundfile as sf, librosa, subprocess, io
def load(p, sr=44100):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ar', str(sr), '-f', 'wav', '-'], capture_output=True).stdout
    x, sr = sf.read(io.BytesIO(raw), dtype='float32'); return (x if x.ndim == 2 else x[:, None]), sr
def features(m, sr, hop=1024):
    C = librosa.feature.chroma_cqt(y=m, sr=sr, hop_length=hop); M = librosa.feature.mfcc(y=m, sr=sr, n_mfcc=13, hop_length=hop)[1:]
    O = librosa.onset.onset_strength(y=m, sr=sr, hop_length=hop)[None, :]
    z = lambda F: (F - F.mean(axis=1, keepdims=True)) / (F.std(axis=1, keepdims=True) + 1e-9)
    n = min(C.shape[1], M.shape[1], O.shape[1]); return np.vstack([z(C)[:, :n] * 1.5, z(M)[:, :n] * 0.6, z(O)[:, :n] * 1.0]), hop
def make(x, sr, a, b, X):
    """a, b, X in samples."""
    out = x[a:b].copy(); t = np.linspace(0, 1, X, dtype=np.float32)[:, None]
    tailb, pre_a = x[b - X:b], x[a - X:a]
    c = float(np.corrcoef(tailb.mean(axis=1), pre_a.mean(axis=1))[0, 1])       # correlated material wants a linear fade, unrelated an equal-power one
    cc = max(0.0, min(1.0, c)); fo, fi = 1 - t, t
    g = 1 / np.sqrt(fo ** 2 + fi ** 2 + 2 * cc * fo * fi)          # keeps the level steady through the fade for material this correlated
    out[-X:] = (tailb * fo + pre_a * fi) * g; return out, c
def seam_report(loop, sr, X):
    """Spectral flux across the wrap point against the flux everywhere else."""
    m = loop.mean(axis=1); y = np.concatenate([m[-2 * sr:], m[:2 * sr]]); hop = 512
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop)); fl = np.sqrt((np.diff(np.log1p(S * 50), axis=1) ** 2).sum(axis=0))
    mid = (2 * sr) // hop; seam = fl[mid - 3: mid + 3].max()
    Sa = np.abs(librosa.stft(m, n_fft=2048, hop_length=hop)); fa = np.sqrt((np.diff(np.log1p(Sa * 50), axis=1) ** 2).sum(axis=0))
    return float(seam), float(np.median(fa)), float(np.percentile(fa, 90)), float(np.percentile(fa, 99)), float(abs(m[0] - m[-1]))
if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('inp'); ap.add_argument('out'); ap.add_argument('--min', type=float, default=110); ap.add_argument('--max', type=float, default=180)
    ap.add_argument('--xfade', type=float, default=0); ap.add_argument('--head', type=float, default=4); ap.add_argument('--tail', type=float, default=5); ap.add_argument('--win', type=float, default=6)
    ap.add_argument('--a', type=float); ap.add_argument('--b', type=float); ap.add_argument('--norefine', action='store_true'); ap.add_argument('--nophase', action='store_true'); ap.add_argument('--bucket', type=float, default=8); ap.add_argument('--slack', type=float, default=1.25)
    o = ap.parse_args(); x, sr = load(o.inp); m = x.mean(axis=1); dur = len(m) / sr
    F, hop = features(m, sr); fps = sr / hop
    tempo, beats = librosa.beat.beat_track(y=m, sr=sr, hop_length=hop); bt = librosa.frames_to_time(beats, sr=sr, hop_length=hop)
    rhythmic = len(bt) > dur * 0.8; grid = bt if rhythmic else np.arange(0, dur, 0.5)
    W = int(o.win * fps)                                                    # frames compared on each side of the splice
    if o.a is None:
        cands = {}
        A = [t for t in grid if o.head + 1 <= t <= dur * 0.45]; B = [t for t in grid if dur * 0.55 <= t <= dur - o.tail]
        for ta in A:
            ia = int(ta * fps)
            if ia - W < 0: continue
            fa = F[:, ia - W: ia + W]
            for tb in B:
                if not (o.min <= tb - ta <= o.max): continue
                ib = int(tb * fps)
                if ib + W > F.shape[1]: continue
                d = float(np.mean((fa - F[:, ib - W: ib + W]) ** 2)); k = int((tb - ta) // o.bucket)
                if k not in cands or d < cands[k][0]: cands[k] = (d, ta, tb)
        if not cands: sys.exit('no loop found in the requested length range')
        for k in sorted(cands): print('  candidate  length %6.1f s  a %6.2f  b %6.2f  match cost %.3f' % (cands[k][2] - cands[k][1], cands[k][1], cands[k][2], cands[k][0]))
        good = [c for c in cands.values() if c[0] <= min(v[0] for v in cands.values()) * o.slack]      # the longest loop among the near-best matches
        d, ta, tb = max(good, key=lambda c: c[2] - c[1])
    else: ta, tb, d = o.a, o.b, float('nan')
    # refine b against a on the waveform's envelope (within +-60 ms) so beats line up exactly
    a = int(ta * sr); b = int(tb * sr); r = int(0.06 * sr); n = int(1.5 * sr)
    if rhythmic and not o.norefine:
        ea = np.abs(m[a - n: a + n]); eb = np.abs(m[b - n - r: b + n + r]); k = 64
        ea = ea[: len(ea) // k * k].reshape(-1, k).mean(axis=1); ebf = eb[: len(eb) // k * k].reshape(-1, k).mean(axis=1)
        cc = [float(np.dot(ea - ea.mean(), ebf[s: s + len(ea)] - ebf[s: s + len(ea)].mean())) for s in range(0, len(ebf) - len(ea) + 1)]
        b = b - r + int(np.argmax(cc)) * k
    period = float(np.median(np.diff(bt))) if rhythmic else 0
    X = int((o.xfade or (period * 2 if rhythmic else 6.0)) * sr); X = min(X, a)
    if not o.nophase:
        # sustained notes: slide b by up to +-20 ms so the two waveforms are in phase through the fade (no cancellation of drones)
        r2 = int(0.02 * sr); ref = m[a - X: a]; ref = ref - ref.mean(); best = (-2, 0)
        for sft in range(-r2, r2 + 1, 2):
            seg = m[b + sft - X: b + sft]; c2 = float(np.dot(ref, seg - seg.mean()) / (np.linalg.norm(ref) * np.linalg.norm(seg - seg.mean()) + 1e-9))
            if c2 > best[0]: best = (c2, sft)
        b += best[1]
    loop, corr = make(x, sr, a, b, X)
    seam, med, p90, p99, step = seam_report(loop, sr, X)
    mm = loop.mean(axis=1); hp = 512
    flux = lambda sig: np.sqrt((np.diff(np.log1p(np.abs(librosa.stft(sig, n_fft=2048, hop_length=hp)) * 50), axis=1) ** 2).sum(axis=0))
    fl_loop, fl_src = flux(mm), flux(m); fr = lambda t0, t1, F_: F_[max(0, int(t0 * sr / hp)): max(1, int(t1 * sr / hp))]
    L_ = len(mm) / sr; Xs = X / sr
    lv = lambda v: 20 * np.log10(np.sqrt((v ** 2).mean()) + 1e-9)
    print(f'  inside the crossfade: flux max {fr(L_ - Xs, L_ - 0.05, fl_loop).max():.1f}; the same stretch unedited: {fr(b / sr - Xs, b / sr - 0.05, fl_src).max():.1f} (end of loop), {fr(a / sr - Xs, a / sr - 0.05, fl_src).max():.1f} (lead-in to the start); whole loop max {fl_loop[4:-4].max():.1f}')
    print(f'  level in the fade {lv(mm[-X:]):.1f} dB vs just before {lv(mm[-2 * X:-X]):.1f} dB and just after the wrap {lv(mm[:X]):.1f} dB')
    sf.write(o.out, loop, sr, subtype='PCM_24')
    print(f'{o.inp.split("/")[-1]}: {dur:.1f} s, {"beat grid %.1f BPM, %d beats" % (float(np.atleast_1d(tempo)[0]), len(bt)) if rhythmic else "no steady beat"}')
    print(f'  loop a {a / sr:.3f} s  b {b / sr:.3f} s  length {len(loop) / sr:.3f} s' + (f' = {len(loop) / sr / period:.2f} beats' if rhythmic else '') + f'  match cost {d:.3f}  crossfade {X / sr:.2f} s (waveform corr {corr:.2f})')
    print(f'  seam flux {seam:.1f} vs track median {med:.1f}, 90th pct {p90:.1f}, 99th pct {p99:.1f}; sample step at wrap {step:.5f}')
