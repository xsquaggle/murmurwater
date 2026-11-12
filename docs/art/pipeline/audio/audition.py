"""audition.py : try candidate cuts before they go into the manifest. judge(x, base) prints the CLAP rank of the sound's own
description among all 28 and the AudioSet tags; run as a script it evaluates the specs in CAND."""
import os, sys, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import ears, sfx_build as B
import importlib.util
WHAT = None
def _what():
    global WHAT
    if WHAT is None:
        src = open(os.path.join(HERE, 'sfx_check.py')).read(); a = src.index('WHAT = {'); b = src.index('}', a) + 1; ns = {}; exec(src[a:b], ns); WHAT = ns['WHAT']; WHAT['_T'] = ears.embed_text([v for k, v in WHAT.items()])
    return WHAT
def judge(x, base, name='', extra=None):
    W = _what(); names = [k for k in W if k != '_T']; x = B.fade(B.trim(x)).astype(np.float32)
    s, _ = ears.match(x, B.SR, T=W['_T']); order = list(np.argsort(s)[::-1]); rank = order.index(names.index(base)) + 1
    line = f"{name:34s} {len(x)/B.SR:5.2f}s rank {rank:2d} (top {names[order[0]]:11s} {names[order[1]]:11s}) " + ' '.join(f'{a}:{b}' for a, b in ears.tags(x, B.SR, 4))
    if extra:
        T = ears.embed_text(extra); s2, p2 = ears.match(x, B.SR, T=T); line += ' || ' + ' '.join(f'{e[:18]}={v:.2f}' for e, v in zip(extra, p2))
    print(line, flush=True)
