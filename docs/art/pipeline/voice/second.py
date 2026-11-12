# second.py <dir of finished files> : second listener (larger recogniser) over the finished files, compared with the script
import sys, os, json, re, glob, difflib, subprocess, io, soundfile as sf
from faster_whisper import WhisperModel
R = os.path.dirname(os.path.abspath(__file__))
LINES = {l['key']: l for l in json.load(open(os.environ.get('VOICE_LINES') or os.path.join(R, '..', '..', '..', 'voice', 'voice-lines.json')))['lines']}
wm = WhisperModel('medium.en', device='cpu', compute_type='int8', cpu_threads=4)
def norm(t):
    # spoken numbers come back as digits, and British spellings as American: compare on a common form
    t = t.lower().replace('harbor', 'harbour')
    for a, b in ((r'four hundred and fifty', '450'), (r'four[- ]fifty', '450'), (r'\$?4[.-]50', '450'), (r'\bnine\b', '9'), (r'\bten\b', '10')): t = re.sub(a, b, t)
    return re.sub(r'[^a-z0-9]', '', t)
bad = 0
for k, l in LINES.items():
    p = os.path.join(sys.argv[1], k + '.mp3')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', '16000', '-f', 'wav', '-'], capture_output=True).stdout
    x, sr = sf.read(io.BytesIO(raw), dtype='float32')
    t = ' '.join(s.text.strip() for s in wm.transcribe(x, beam_size=5, language='en', condition_on_previous_text=False)[0])
    r = difflib.SequenceMatcher(None, norm(t), norm(l['text'])).ratio()
    if r < 0.985: bad += 1; print(f'{k}  {r:.3f}\n   heard : {t}\n   script: {l["text"]}', flush=True)
print('checked', len(LINES), 'differences', bad)
