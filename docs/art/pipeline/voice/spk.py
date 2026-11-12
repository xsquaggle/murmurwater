# spk.py <wav16 dir> [filters] : speaker-embedding similarity of every take to its character's centroid
import sys, glob, os, re, numpy as np, soundfile as sf, torch
from speechbrain.inference.speaker import EncoderClassifier
enc = EncoderClassifier.from_hparams(source='speechbrain/spkrec-ecapa-voxceleb', savedir=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'ecapa-spk'))
E = {}
for p in sorted(glob.glob(sys.argv[1] + '/*.wav')):
    n = os.path.basename(p)[:-4]
    if sys.argv[2:] and not any(f in n for f in sys.argv[2:]): continue
    x, sr = sf.read(p, dtype='float32')
    with torch.no_grad(): e = enc.encode_batch(torch.from_numpy(x).unsqueeze(0)).squeeze().numpy()
    E[n] = e / np.linalg.norm(e)
for who in sorted({n.split('__')[0] for n in E}):
    names = [n for n in E if n.startswith(who + '__')]
    M = np.stack([E[n] for n in names]); med = []
    for i, n in enumerate(names):
        others = np.delete(M, i, axis=0); c = others.mean(0); c /= np.linalg.norm(c)
        med.append((float(M[i] @ c), n))
    for s, n in sorted(med): print(f'{s:.3f} {n}')
    print(f'-- {who}: mean {np.mean([s for s, _ in med]):.3f} min {min(med)[0]:.3f}')
# cross-speaker reference
cs = {w: np.mean([E[n] for n in E if n.startswith(w + '__')], 0) for w in {n.split('__')[0] for n in E}}
ks = sorted(cs)
for i in range(len(ks)):
    for j in range(i + 1, len(ks)):
        a, b = cs[ks[i]] / np.linalg.norm(cs[ks[i]]), cs[ks[j]] / np.linalg.norm(cs[ks[j]]); print('centroids', ks[i], ks[j], round(float(a @ b), 3))
