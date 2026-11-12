# Perceived age, female / male / child probability and pitch of a 16 kHz mono wav (audeering wav2vec2 age-gender model).
import sys, json, glob, os, numpy as np, soundfile as sf, torch, torch.nn as nn
from transformers import Wav2Vec2Processor
from transformers.models.wav2vec2.modeling_wav2vec2 import Wav2Vec2Model, Wav2Vec2PreTrainedModel

class ModelHead(nn.Module):
    def __init__(self, config, num_labels):
        super().__init__()
        self.dense = nn.Linear(config.hidden_size, config.hidden_size)
        self.dropout = nn.Dropout(config.final_dropout)
        self.out_proj = nn.Linear(config.hidden_size, num_labels)
    def forward(self, features, **kwargs):
        x = self.dropout(features); x = torch.tanh(self.dense(x)); x = self.dropout(x); return self.out_proj(x)

class AgeGenderModel(Wav2Vec2PreTrainedModel):
    def __init__(self, config):
        super().__init__(config)
        self.config = config
        self.wav2vec2 = Wav2Vec2Model(config)
        self.age = ModelHead(config, 1)
        self.gender = ModelHead(config, 3)
        self.post_init()
    def forward(self, input_values):
        h = self.wav2vec2(input_values)[0].mean(dim=1)
        return self.age(h), torch.softmax(self.gender(h), dim=1)

NAME = 'audeering/wav2vec2-large-robust-24-ft-age-gender'
proc = Wav2Vec2Processor.from_pretrained(NAME)
model = AgeGenderModel.from_pretrained(NAME).eval()

def f0_stats(x, sr=16000):
    # autocorrelation pitch on 40 ms frames; voiced if the peak is strong
    n = int(0.04 * sr); hop = int(0.01 * sr); lo, hi = int(sr / 500), int(sr / 60); out = []
    for i in range(0, len(x) - n, hop):
        fr = x[i:i + n] * np.hanning(n)
        if np.sqrt((fr ** 2).mean()) < 0.01: continue
        ac = np.correlate(fr, fr, 'full')[n - 1:]; ac = ac / (ac[0] + 1e-9)
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.5: out.append(sr / k)
    if not out: return None
    a = np.array(out); return float(np.median(a)), float(np.percentile(a, 10)), float(np.percentile(a, 90))

def analyze(path):
    x, sr = sf.read(path, dtype='float32'); assert sr == 16000
    if x.ndim > 1: x = x.mean(axis=1)
    x = x[: sr * 20]
    with torch.no_grad():
        iv = torch.from_numpy(proc(x, sampling_rate=sr)['input_values'][0]).reshape(1, -1)
        age, g = model(iv)
    f0 = f0_stats(x)
    return { 'age': round(float(age[0, 0]) * 100, 1), 'female': round(float(g[0, 0]), 2), 'male': round(float(g[0, 1]), 2), 'child': round(float(g[0, 2]), 2), 'f0': None if f0 is None else [round(v) for v in f0], 'dur': round(len(x) / sr, 1) }

if __name__ == '__main__':
    out = {}
    for p in sorted(glob.glob(sys.argv[1] + '/*.wav')):
        out[os.path.basename(p)[:-4]] = analyze(p)
        print(os.path.basename(p)[:-4], out[os.path.basename(p)[:-4]], flush=True)
    json.dump(out, open(sys.argv[2], 'w'), indent=1)
