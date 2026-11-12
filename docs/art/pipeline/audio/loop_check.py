#!/usr/bin/env python3
"""loop_check.py file.ogg ... : is the wrap point of a loop audible? Compares the spectral change across the wrap
with the change between neighbouring frames everywhere else in the loop, and the sample step at the wrap with ordinary sample steps."""
import sys, numpy as np, soundfile as sf, librosa
for p in sys.argv[1:]:
    x, sr = sf.read(p, dtype='float32'); x = x if x.ndim == 1 else x.mean(axis=1); n = len(x)
    y = np.concatenate([x, x]); S = np.abs(librosa.stft(y, n_fft=1024, hop_length=256, center=False)); L = np.log1p(30 * S)
    flux = np.sqrt((np.diff(L, axis=1) ** 2).sum(axis=0)); fr = (n - 1024) // 256
    inside = flux[4:fr - 4]; wrap = flux[fr - 2: fr + 6].max()
    step = abs(float(x[0] - x[-1])); typ = np.percentile(np.abs(np.diff(x)), 99)
    print(f"{p.split('/')[-1]:18s} {n / sr:7.3f} s ({n} samples)  wrap flux {wrap:5.1f} vs inside median {np.median(inside):5.1f}, 95th pct {np.percentile(inside, 95):5.1f}, max {inside.max():5.1f}  | wrap step {step:.4f} vs 99th pct step {typ:.4f}")
