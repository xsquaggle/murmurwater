#!/usr/bin/env python3
"""sfx_build.py [name filter ...] : build every sound effect in sfx_manifest.py -> out/<name>_<n>.ogg (mono 44.1 kHz OGG Vorbis).

Each output is a list of parts (a cut of a source recording, optionally sped up or slowed down, filtered and faded) summed at
their offsets, or a synthesised signal, then trimmed to the sound, levelled and encoded. Loops are cut to an exact length with
a crossfade into the audio that precedes the loop start, so the wrap point is the recording's own continuity.
Writes out/index.json (name, seconds, sources, level) for the asset log."""
import io, json, os, re, subprocess, sys
import numpy as np, soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.dirname(HERE)
SR = 44100
OUT = os.path.join(A, 'sfx', 'out')
TARGET = -17.0      # dBFS RMS of the loudest 100 ms of a one-shot
PEAK = -1.0         # dBFS ceiling
LOOP_LUFS = -22.0   # ambience loops


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(A, path), '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def db(v): return 20 * np.log10(max(v, 1e-12))


def fade(x, fi=0.002, fo=0.03):
    x = x.copy(); a, b = min(len(x) // 8, int(fi * SR)), min(len(x) // 4, int(fo * SR))     # a fade never covers more than a quarter of a short clip
    if a > 1: x[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if b > 1: x[-b:] *= np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    return x


def speed(x, r):
    """Play r times faster (pitch and tempo together), like tape."""
    if abs(r - 1) < 1e-6: return x
    return np.interp(np.arange(int(round(len(x) / r))) * r, np.arange(len(x)), x)


def filt(x, hp=None, lp=None):
    if hp: x = signal.sosfiltfilt(signal.butter(2, hp, 'highpass', fs=SR, output='sos'), x)
    if lp: x = signal.sosfiltfilt(signal.butter(2, lp, 'lowpass', fs=SR, output='sos'), x)
    return x


def trim(x, head_db=-45, tail_db=-50, pre=0.003, post=0.02):
    pk = np.abs(x).max()
    if pk <= 0: return x
    n = int(0.002 * SR); e = np.array([np.abs(x[i:i + n]).max() for i in range(0, len(x), n)])
    on = np.where(e > pk * 10 ** (head_db / 20))[0]; off = np.where(e > pk * 10 ** (tail_db / 20))[0]
    a = max(0, on[0] * n - int(pre * SR)); b = min(len(x), (off[-1] + 1) * n + int(post * SR))
    return x[a:b]


def part(p):
    x = load(p['src'])
    a = int(p.get('a', 0) * SR); b = int(p['b'] * SR) if 'b' in p else len(x); x = x[a:b]
    x = speed(x, p.get('speed', 1.0)); x = filt(x, p.get('hp'), p.get('lp'))
    x = fade(x, p.get('fi', 0.002), p.get('fo', 0.03))
    return x * 10 ** (p.get('gain', 0) / 20)


def mix(parts):
    xs = [(int(p.get('at', 0) * SR), part(p)) for p in parts]; n = max(o + len(x) for o, x in xs); y = np.zeros(n)
    for o, x in xs: y[o:o + len(x)] += x
    return y


def loud100(x):
    n = int(0.1 * SR)
    if len(x) <= n: return db(np.sqrt((x ** 2).mean()))
    c = np.concatenate([[0], np.cumsum(x ** 2)]); return db(np.sqrt(((c[n:] - c[:-n]) / n).max()))


def lufs(x):
    buf = io.BytesIO(); sf.write(buf, x, SR, format='WAV', subtype='FLOAT')
    e = subprocess.run(['ffmpeg', '-nostats', '-f', 'wav', '-i', '-', '-af', 'ebur128', '-f', 'null', '-'], input=buf.getvalue(), capture_output=True).stderr.decode()
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', e)[-1])


def level_oneshot(x, offset=0.0):
    g = TARGET + offset - loud100(x); pk = db(np.abs(x).max())
    if pk + g > PEAK: g = PEAK - pk
    return x * 10 ** (g / 20)


def level_loop(x, target=LOOP_LUFS):
    g = target - lufs(np.concatenate([x] * max(1, int(np.ceil(4 * SR / len(x))))))      # short loops are measured repeated
    pk = db(np.abs(x).max())
    if pk + g > PEAK - 2: g = PEAK - 2 - pk
    return x * 10 ** (g / 20)


def loop_cut(src, a, length, xf):
    """x[a:a+length] with its last xf seconds cross-faded (equal power) into x[a-xf:a]."""
    x = load(src); a, n, f = int(a * SR), int(round(length * SR)), int(xf * SR); y = x[a:a + n].copy()
    t = np.linspace(0, np.pi / 2, f); y[-f:] = y[-f:] * np.cos(t) + x[a - f:a] * np.sin(t); return y


def circular(x, **kw):
    """Filter a loop without an edge: filter three copies and keep the middle one."""
    n = len(x); return filt(np.tile(x, 3), **kw)[n:2 * n]


def ring(n, events):
    """Sum clips into an n-sample loop at their offsets, wrapping the tails round the end."""
    y = np.zeros(n)
    for o, x in events:
        idx = (int(o) + np.arange(len(x))) % n; np.add.at(y, idx, x)
    return y


def ffdecoded(path):
    """Length in samples as FFmpeg's Vorbis decoder (the one Chromium uses) returns it."""
    return len(subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-'], capture_output=True).stdout) // 4


def encode(x, name, meta, loop=False):
    """One-shots get 4 ms of silence after the sound: Chromium can return a short Vorbis file up to 128 samples short at the end.
    A loop must come back at exactly its own length, so it is rotated (which does not change a loop) until it does."""
    os.makedirs(OUT, exist_ok=True); ogg = os.path.join(OUT, name + '.ogg'); tmp = ogg + '.tmp.wav'
    if not loop: x = np.concatenate([x, np.zeros(176)])
    for turn in ([0] + [int(len(x) * f) for f in (0.013, 0.029, 0.041, 0.057, 0.073, 0.091, 0.113, 0.137)] if loop else [0]):
        y = np.roll(x, -turn)
        sf.write(tmp, y.astype(np.float32), SR, subtype='PCM_24')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5', ogg], check=True); os.remove(tmp)
        if not loop or ffdecoded(ogg) == len(x): break
    x = y; d, _ = sf.read(ogg, dtype='float32'); ff = ffdecoded(ogg)
    meta.update(file=name + '.ogg', seconds=round(len(x) / SR, 3), samples=len(x), decoded=ff, peak_db=round(float(db(np.abs(d).max())), 1), loud100_db=round(float(loud100(d.astype(np.float64))), 1), bytes=os.path.getsize(ogg))
    if loop: meta['rotated'] = turn
    print(f"{name:18s} {len(x) / SR:7.3f} s  peak {meta['peak_db']:6.1f}  loud {meta['loud100_db']:6.1f}  {meta['bytes'] / 1000:6.1f} kB" + (f'  rotated {turn}' if loop and turn else '') + ('  <<< LOOP LENGTH DIFFERS' if loop and ff != len(x) else ''), flush=True)
    return meta


def main():
    sys.path.insert(0, HERE); import sfx_manifest as M
    want = sys.argv[1:]; index = []; groups = {}
    for item in M.build(sys.modules[__name__]):
        if want and not any(w in item['name'] for w in want): continue
        x = item['make']()
        if not item.get('loop'):
            if item.get('trim', True): x = trim(x)
            x = fade(x, 0.002, item.get('fo', 0.03))
        item['x'] = x; groups.setdefault(item['name'].rsplit('_', 1)[0], []).append(item)
    for base, members in groups.items():
        if members[0].get('loop'):
            for it in members: it['x'] = level_loop(it['x'], it.get('lufs', LOOP_LUFS))
        else:                                               # every variation of a sound ends at the same loudness: the quietest one's, once peaks are capped
            for it in members: it['x'] = level_oneshot(it['x'], it.get('level', 0.0))
            low = min(loud100(it['x']) for it in members)
            for it in members: it['x'] = it['x'] * 10 ** ((low - loud100(it['x'])) / 20)
        for it in members:
            index.append(encode(it['x'], it['name'], {'name': it['name'], 'loop': bool(it.get('loop')), 'sources': it['sources'], 'how': it.get('how', '')}, loop=bool(it.get('loop'))))
    if not want: json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
