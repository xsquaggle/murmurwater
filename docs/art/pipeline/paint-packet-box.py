"""paint-packet-box.py : paints the atlas of props/packet-box.glb in code. Original work, no generation job.
Usage: python paint-packet-box.py <layout.json from build-packet-box.mjs --layout> <out.png>
Everything is painted from mats.py; then "M.T." and a fish are stencilled on the front. The letters are drawn here as
polygons with the bridges a stencil needs, so no font is used.
"""
import sys
import numpy as np
from paintkit import Atlas, hexc, mix, smooth, fbm, stretch, polymask
from mats import paint_spec

layout, out = sys.argv[1:3]
A = Atlas(layout, base='#4A4640')
paint_spec(A)

x0, y0, x1, y1 = A.rect('front')
H, W = y1 - y0, x1 - x0
fx, fy = A.layout['front']['x'], A.layout['front']['y']           # the face in metres: left to right, bottom to top
px = lambda x, y: ((x - fx[0]) / (fx[1] - fx[0]) * W, (fy[1] - y) / (fy[1] - fy[0]) * H)

# ---- the letters, in units of their height; each is a list of polygons
M = [[(0, 0), (0.2, 0), (0.2, 1), (0, 1)], [(0.7, 0), (0.9, 0), (0.9, 1), (0.7, 1)],
     [(0.222, 1), (0.40, 1), (0.444, 0.55), (0.444, 0.12)], [(0.678, 1), (0.50, 1), (0.456, 0.55), (0.456, 0.12)]]
T = [[(0, 0.8), (0.8, 0.8), (0.8, 1), (0, 1)], [(0.3, 0), (0.5, 0), (0.5, 0.765), (0.3, 0.765)]]
DOT = [[(0, 0), (0.19, 0), (0.19, 0.19), (0, 0.19)]]
word = [(M, 0.0), (DOT, 1.02), (T, 1.34), (DOT, 2.24)]
UNIT, WIDE = 0.125, 2.43                                           # letters 12.5 cm tall
left, base = -WIDE * UNIT / 2, 0.365
polys = [[px(left + (x + off) * UNIT, base + y * UNIT) for x, y in poly] for glyph, off in word for poly in glyph]

# ---- the fish: nose to the left, a body, a gap, a tail; an eye and a gill left unpainted
LEN, MIDY, HALF = 0.32, 0.235, 0.055
n = 24
xs = np.linspace(0, 0.74, n)
half = HALF * np.sin(np.pi * (xs / 0.74) ** 0.72) ** 0.8 * (1 - 0.35 * xs / 0.74)
body = [(x, h) for x, h in zip(xs, half)] + [(x, -h) for x, h in zip(xs[::-1], half[::-1])]
tail = [(0.775, 0.012), (1.0, 0.062), (0.93, 0.0), (1.0, -0.062), (0.775, -0.012)]
fin = [(0.30, HALF * 0.98 + 0.006), (0.50, HALF * 0.86 + 0.034), (0.56, HALF * 0.66 + 0.006)]
F = lambda pts: [px(-LEN / 2 + x * LEN if abs(x) <= 1 else x, MIDY + y) for x, y in pts]
polys += [F(body), F(tail), F(fin)]
mask = polymask(H, W, polys)
eye = px(-LEN / 2 + 0.115 * LEN, MIDY + 0.012)
yy, xx = np.mgrid[0:H, 0:W]
mask *= 1 - np.exp(-(np.hypot(xx - eye[0], yy - eye[1]) / 2.6) ** 4)
gill = px(-LEN / 2 + 0.235 * LEN, MIDY)
mask *= 1 - np.exp(-((xx - gill[0] - 0.012 * (yy - gill[1]) ** 2) / 1.3) ** 2) * (np.abs(yy - gill[1]) < HALF * 0.62 / (fy[1] - fy[0]) * H)

# ---- stencil paint: dark, thin in places, worn off the high grain
worn = stretch(fbm(H, W, 9, 14, 77, 4))
grain = stretch(fbm(H, W, 40, 4, 78, 2))
ink = mask * (0.86 - 0.5 * smooth(worn, 0.55, 0.95)) * (0.8 + 0.2 * grain)
A.img[y0:y1, x0:x1] = mix(A.img[y0:y1, x0:x1], hexc('#1F2A33'), ink)
A.save(out)
print('stencil on front', W, 'x', H, out)
