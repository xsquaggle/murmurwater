#!/usr/bin/env python3
"""master_music.py : loops and stings -> public-ready OGG Vorbis (44.1 kHz stereo, about -18 LUFS).
Loops get a plain gain only, so the cut made by loop.py stays sample-exact; stings are trimmed and faded."""
import os, re, subprocess, sys, numpy as np, soundfile as sf
A = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); M = os.path.join(A, 'music'); OUT = os.path.join(M, 'final'); os.makedirs(OUT, exist_ok=True)
TARGET = -18.0
def lufs(path):
    e = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', e)[-1]), float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', e)[-1])
def finish(x, sr, name):
    tmp = os.path.join(OUT, name + '.wav'); sf.write(tmp, x, sr, subtype='PCM_24'); l, pk = lufs(tmp)
    g = TARGET - l
    if pk + g > -1.0: g = -1.0 - pk                    # never push peaks past -1 dBFS; the track then sits a little under the target
    sf.write(tmp, x * 10 ** (g / 20), sr, subtype='PCM_24')
    ogg = os.path.join(OUT, name + '.ogg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-map_metadata', '-1', '-c:a', 'libvorbis', '-q:a', '6', ogg], check=True)
    back = subprocess.run(['ffmpeg', '-v', 'error', '-i', ogg, '-f', 'f32le', '-'], capture_output=True).stdout
    n = len(back) // 4 // x.shape[1]; l2, pk2 = lufs(ogg)
    print(f'{name}.ogg  {len(x) / sr:.3f} s  gain {g:+.1f} dB  {l2:.1f} LUFS  peak {pk2:.1f} dBFS  {os.path.getsize(ogg) / 1e6:.2f} MB  decoded samples {n} vs source {len(x)}' + ('' if n == len(x) else '  <<< LENGTH DIFFERS'))
    os.remove(tmp)
def sting(src, name, end, fade):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ar', '44100', '-ac', '2', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy(); sr = 44100; m = np.abs(x).max(axis=1)
    a = max(0, int(np.argmax(m > m.max() * 10 ** (-40 / 20))) - int(0.01 * sr)); x = x[a: a + int(end * sr)]
    f = int(fade * sr); x[-f:] *= (np.cos(np.linspace(0, np.pi / 2, f)) ** 2)[:, None]; x[:64] *= np.linspace(0, 1, 64)[:, None]
    finish(x, sr, name)
if __name__ == '__main__':
    for n in ('hearthbay-day', 'hearthbay-night', 'gull-point'):
        x, sr = sf.read(os.path.join(M, n + '.loop.wav'), dtype='float32'); finish(x, sr, n)
    sting(os.path.join(M, 'raw', 'sting-quest.a.mp3'), 'sting-quest', 3.6, 0.6)
    sting(os.path.join(M, 'raw', 'sting-rare.a.mp3'), 'sting-rare', 4.0, 1.6)
