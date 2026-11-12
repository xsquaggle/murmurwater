# check.py <mp3 dir> <out.json> [filters...] : check every take or finished file against the script:
# perceived age and child probability, pitch, pace, transcript match, silence at both ends, loudness and peak
import sys, glob, os, json, subprocess, re, difflib, tempfile, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze as A
from faster_whisper import WhisperModel
R = os.path.dirname(os.path.abspath(__file__))
LINES = {l['key']: l for l in json.load(open(os.environ.get('VOICE_LINES') or os.path.join(R, '..', '..', '..', 'voice', 'voice-lines.json')))['lines']}
wm = WhisperModel(os.environ.get('WM', 'small.en'), device='cpu', compute_type='int8', cpu_threads=4)
def norm(t):
    # spoken numbers come back as digits, and British spellings as American: compare on a common form
    t = t.lower().replace('harbor', 'harbour')
    for a, b in ((r'four hundred and fifty', '450'), (r'four[- ]fifty', '450'), (r'\$?4[.-]50', '450'), (r'\bnine\b', '9'), (r'\bten\b', '10')): t = re.sub(a, b, t)
    return re.sub(r'[^a-z0-9]', '', t)
def edges(x, sr, thr_db=-45):
    # first / last 10 ms frame above the threshold (relative to full scale)
    n = int(sr * 0.01); fr = np.array([np.sqrt((x[i:i + n] ** 2).mean() + 1e-12) for i in range(0, len(x) - n, n)])
    on = np.where(20 * np.log10(fr) > thr_db)[0]
    return (0, 0) if not len(on) else (on[0] * 0.01, (len(fr) - 1 - on[-1]) * 0.01)
WD = os.environ.get('W16') or tempfile.mkdtemp(prefix='voice16-')   # 16 kHz copies, also the input of spk.py
os.makedirs(WD, exist_ok=True); print('16 kHz copies in', WD)
out = {}; only = sys.argv[3:]
for p in sorted(glob.glob(sys.argv[1] + '/**/*.mp3', recursive=True)):
    rel = os.path.relpath(p, sys.argv[1])[:-4]
    if only and not any(o in rel for o in only): continue
    key = re.sub(r'\.t\d+$', '', rel).replace('__', '/')
    w = os.path.join(WD, rel.replace('/', '__') + '.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-ac', '1', '-ar', '16000', w], check=True)
    r = A.analyze(w)
    x, sr = sf.read(w, dtype='float32')
    segs = list(wm.transcribe(x, beam_size=5, language='en', condition_on_previous_text=False, word_timestamps=True)[0])
    text = ' '.join(s.text.strip() for s in segs); words = [w_ for s in segs for w_ in s.words]
    want = LINES[key]['text']
    r['text'] = text; r['sim'] = round(difflib.SequenceMatcher(None, norm(text), norm(want)).ratio(), 3)
    r['wps'] = round(len(words) / max(0.1, words[-1].end - words[0].start), 2) if words else 0
    r['lead'], r['tail'] = [round(v, 2) for v in edges(x, sr)]
    r['maxgap'] = round(max([b.start - a.end for a, b in zip(words, words[1:])] or [0]), 2)
    lu = subprocess.run(['ffmpeg', '-nostats', '-i', p, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', lu); pk = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', lu)
    r['lufs'] = float(m[-1]) if m else None; r['peak'] = float(pk[-1]) if pk else None
    out[rel] = r
    flag = '' if r['sim'] >= 0.97 else '  <<< CHECK'
    print(f"{rel:36s} age {r['age']:5.1f} F{r['female']:.2f} M{r['male']:.2f} C{r['child']:.2f} f0 {r['f0']} dur {r['dur']} wps {r['wps']} lead {r['lead']} tail {r['tail']} gap {r['maxgap']} {r['lufs']} LUFS pk {r['peak']} sim {r['sim']}{flag}\n      {text}", flush=True)
json.dump(out, open(sys.argv[2], 'w'), indent=1)
