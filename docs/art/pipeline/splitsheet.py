# Split a turnaround sheet into N views by finding background gaps between figures. Usage: splitsheet.py sheet.png outprefix [n]
import sys
from PIL import Image
import numpy as np
src, prefix = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 4
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(np.int32)
bg = np.median(np.concatenate([a[:8].reshape(-1,3), a[-8:].reshape(-1,3)]), axis=0)
mask = (np.abs(a - bg).sum(axis=2) > 40)
cols = mask.sum(axis=0) > 3
# segments of foreground columns
segs = []; start = None
for x, v in enumerate(cols):
    if v and start is None: start = x
    if not v and start is not None:
        if x - start > 20: segs.append([start, x])
        start = None
if start is not None: segs.append([start, len(cols)])
# merge closest segments until n remain
while len(segs) > n:
    gaps = [segs[i+1][0] - segs[i][1] for i in range(len(segs)-1)]
    i = int(np.argmin(gaps)); segs[i][1] = segs[i+1][1]; del segs[i+1]
print('bg', bg, 'segments', segs)
rows = np.where(mask.sum(axis=1) > 3)[0]; y0, y1 = rows[0], rows[-1]
h = y1 - y0; pad = int(h * 0.06)
Smax = max(max(x1 - x0 for x0, x1 in segs), h) + 2 * pad
for i, (x0, x1) in enumerate(segs):
    w = x1 - x0; S = Smax
    canvas = Image.new('RGB', (S, S), tuple(int(v) for v in bg))
    crop = im.crop((x0, y0, x1, y1))
    canvas.paste(crop, ((S - w) // 2, (S - h) // 2))
    canvas = canvas.resize((1024, 1024), Image.LANCZOS)
    canvas.save(f'{prefix}-{i+1}.png'); print(f'{prefix}-{i+1}.png', w, h)
