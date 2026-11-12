"""ears.py : what a clip sounds like, without hearing it.
  tags(x, sr)            -> top AudioSet labels (AST)
  match(x, sr, texts)    -> CLAP audio-text similarity for each text (softmax over the texts given)"""
import numpy as np, torch, librosa
from transformers import ASTFeatureExtractor, ASTForAudioClassification, ClapModel, ClapProcessor
_ast = _clap = None
def _load_ast():
    global _ast
    if _ast is None:
        n = 'MIT/ast-finetuned-audioset-10-10-0.4593'; _ast = (ASTFeatureExtractor.from_pretrained(n), ASTForAudioClassification.from_pretrained(n).eval())
    return _ast
def _load_clap():
    global _clap
    if _clap is None:
        n = 'laion/clap-htsat-unfused'; _clap = (ClapProcessor.from_pretrained(n), ClapModel.from_pretrained(n).eval())
    return _clap
def mono(x): return x if x.ndim == 1 else x.mean(axis=1)
def tags(x, sr, k=6):
    fe, m = _load_ast(); y = librosa.resample(mono(x).astype(np.float32), orig_sr=sr, target_sr=16000)
    if len(y) < 16000: y = np.pad(y, (0, 16000 - len(y)))
    with torch.no_grad(): p = torch.sigmoid(m(**fe(y, sampling_rate=16000, return_tensors='pt')).logits)[0]
    top = torch.topk(p, k); return [(m.config.id2label[int(i)], round(float(v), 2)) for v, i in zip(top.values, top.indices)]
def embed_audio(x, sr):
    pr, m = _load_clap(); y = librosa.resample(mono(x).astype(np.float32), orig_sr=sr, target_sr=48000)
    with torch.no_grad():
        o = m.get_audio_features(**pr(audio=[y], sampling_rate=48000, return_tensors='pt'))
        o = o if isinstance(o, torch.Tensor) else o.pooler_output
    return torch.nn.functional.normalize(o, dim=-1)[0]
def embed_text(texts):
    pr, m = _load_clap()
    with torch.no_grad():
        o = m.get_text_features(**pr(text=texts, return_tensors='pt', padding=True))
        o = o if isinstance(o, torch.Tensor) else o.pooler_output
    return torch.nn.functional.normalize(o, dim=-1)
def match(x, sr, texts=None, T=None):
    a = embed_audio(x, sr); T = embed_text(texts) if T is None else T
    s = T @ a; return s.numpy(), torch.softmax(s * 30, dim=0).numpy()
if __name__ == '__main__':
    import sys, soundfile as sf
    for p in sys.argv[1:]:
        x, sr = sf.read(p, dtype='float32'); print(p.split('/')[-1], tags(x, sr))
