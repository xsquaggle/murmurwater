#!/usr/bin/env python3
"""process.py [--all-takes] [filters] : chosen raw take -> tuned, trimmed, levelled MP3 in final/<key>.mp3
Raw takes are raw/<speaker>__<line>.t<n>.mp3 (written by add.py); takes.json says which take each line uses.
Per speaker: Mara as recorded; Pell 6 % lower in pitch and formants and about 10 % slower; Wick pitch and formants up 10 % (child voice)."""
import json, os, subprocess, sys, re, numpy as np, soundfile as sf
R = os.path.dirname(os.path.abspath(__file__))
TAKES = json.load(open(os.path.join(R, 'takes.json')))
raw = lambda key, take: os.path.join(R, 'raw', key.replace('/', '__') + f'.t{take}.mp3')
FX = {
    'mara': 'highpass=f=70',
    'pell': 'highpass=f=50,asetrate=44100*0.94,aresample=44100:resampler=soxr,atempo=0.96',
    'wick': 'highpass=f=90,asetrate=44100*1.10,aresample=44100:resampler=soxr,atempo=0.936',
}
TARGET, LIMIT = -16.0, 0.84            # LUFS, limiter ceiling (-1.5 dBFS)
LEAD, TAIL = 0.03, 0.08                # seconds of room kept before the first and after the last sound
def lufs(path):
    e = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', e)[-1])
def trim(x, sr, thr_db=-48.0):
    """Cut to the speech itself. x is already near the target level, so the threshold is absolute.
    Short blips separated from the speech by silence (some recordings end with a click) are not speech."""
    n = int(sr * 0.005); fr = np.array([np.sqrt((x[i:i + n] ** 2).mean() + 1e-12) for i in range(0, len(x) - n + 1, n)])
    act = 20 * np.log10(fr) > thr_db
    runs = []; i = 0
    while i < len(act):
        if act[i]:
            j = i
            while j < len(act) and act[j]: j += 1
            if runs and i - runs[-1][1] < 16: runs[-1][1] = j          # gaps under 80 ms belong to the same sound
            else: runs.append([i, j])
            i = j
        else: i += 1
    while len(runs) > 1 and runs[-1][1] - runs[-1][0] < 10: runs.pop()      # drop blips under 50 ms at the end
    while len(runs) > 1 and runs[0][1] - runs[0][0] < 10: runs.pop(0)       # and at the start
    a, b = runs[0][0] * n, runs[-1][1] * n
    pad = np.zeros(int(0.3 * sr), dtype=x.dtype); x = np.concatenate([pad, x[:b + int(TAIL * sr)] if b + int(TAIL * sr) <= len(x) else np.concatenate([x[:len(x)], pad])]); a += len(pad); b += len(pad)
    y = x[a - int(LEAD * sr): b + int(TAIL * sr)].copy(); fi, fo = int(0.005 * sr), int(0.03 * sr)
    y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo)
    return y
def build(key, take, out):
    who = key.split('/')[0]; src = raw(key, take); tmp = out + '.tmp.wav'; tmp2 = out + '.tmp2.wav'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', FX[who], '-ac', '1', '-ar', '44100', '-c:a', 'pcm_f32le', tmp], check=True)
    x, sr = sf.read(tmp, dtype='float32'); x = x * 10 ** ((TARGET - lufs(tmp)) / 20); sf.write(tmp, trim(x, sr), sr, subtype='FLOAT')
    g = TARGET - lufs(tmp)
    for _ in range(5):                 # the loudness is judged on the encoded file, which is what the game plays
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', f'volume={g:.2f}dB,alimiter=limit={LIMIT}:level=disabled:attack=2:release=40', '-c:a', 'pcm_f32le', tmp2], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp2, '-map_metadata', '-1', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', out], check=True)
        d = TARGET - lufs(out)
        if abs(d) < 0.15: break
        g += d
    os.remove(tmp); os.remove(tmp2)
    return g
if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; alltakes = '--all-takes' in sys.argv
    for key, rec in TAKES.items():
        if args and not any(a in key for a in args): continue
        for t in (range(1, rec['takes_recorded'] + 1) if alltakes else [rec['take']]):
            if not os.path.exists(raw(key, t)): continue
            o = os.path.join(R, 'alt', key.replace('/', '__') + f'.t{t}.mp3') if alltakes else os.path.join(R, 'final', key + '.mp3')
            print(key, 'take', t, 'gain %.1f dB' % build(key, t, o), flush=True)
