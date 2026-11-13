"""paint-pot-float.py : paints the atlas of props/pot-float.glb in code. Original work, no generation job.
Usage: python paint-pot-float.py <layout.json from build-pot-float.mjs --layout> <out.png>
"""
import sys
import numpy as np
from paintkit import (Atlas, hexc, mix, smooth, fbm, stretch, blur, emboss, chips, strokes, shade, tint, paintify,
                      speckle, polymask)

layout, out = sys.argv[1:3]
A = Atlas(layout)
L = A.layout

CREAM, AMBER = hexc('#F1E2C2'), hexc('#F3A23C')
CORK, CORK_D, CORK_L = hexc('#B5855A'), hexc('#7C5636'), hexc('#D6AC7C')
WOOD, WOOD_D = hexc('#93704F'), hexc('#5E4532')
ALGAE, SCUM = hexc('#58724A'), hexc('#3B4734')
BRASS, BRASS_L, BRASS_D, BRASS_DD = hexc('#C8973A'), hexc('#F4D27A'), hexc('#8A6127'), hexc('#553A1A')
BANDS = [(0.018, 0.052), (0.082, 0.116)]            # the two amber bands, heights above the waterline (m)
SEAMS = [-0.105, -0.032, 0.066]              # where the cork slabs meet


def body():
    H, W = A.size('body')
    prof = np.array(L['body'])                       # radius, height, v
    seg = np.hypot(np.diff(prof[:, 0]), np.diff(prof[:, 1]))
    total = seg.sum()
    v = 1 - (np.arange(H) + 0.5) / H
    y = np.interp(v, prof[:, 2], prof[:, 1])
    r = np.interp(v, prof[:, 2], prof[:, 0])
    ny = -np.gradient(np.interp(np.linspace(0, 1, 400), prof[:, 2], prof[:, 0]), np.linspace(0, 1, 400)) / total
    ny = np.interp(v, np.linspace(0, 1, 400), np.clip(ny, -1, 1))
    vlo, vhi = prof[L['cap'][0], 2], prof[L['cap'][1], 2]
    wob = (fbm(1, W, 1, 7, 3, tile_x=True)[0] - 0.5) * 0.010
    wob2 = (fbm(1, W, 1, 9, 4, tile_x=True)[0] - 0.5) * 0.008
    Y = y[:, None] + wob[None, :]
    Y2 = y[:, None] + wob2[None, :]
    V = v[:, None] * np.ones((1, W))

    # cork: a warm base with dark and light grains
    cork = mix(CORK, CORK_L, stretch(fbm(H, W, 7, 14, 10, tile_x=True)) * 0.55)
    cork = mix(cork, CORK_D, speckle(H, W, 11, 0.030, (1.2, 1.2), tile_x=True) * 0.75)
    cork = mix(cork, CORK_L, speckle(H, W, 12, 0.012, (1.0, 1.0), tile_x=True) * 0.6)
    cork = mix(cork, CORK_D, stretch(fbm(H, W, 40, 80, 13, 2, tile_x=True)) * 0.18)

    # paint: cream with two amber bands, brushed round the float
    band = sum(smooth(Y, a - 0.0012, a + 0.0012) * (1 - smooth(Y, b - 0.0012, b + 0.0012)) for a, b in BANDS)
    paint = mix(CREAM, AMBER, band)
    paint = shade(paint, 0.93 + 0.10 * stretch(fbm(H, W, 3, 6, 20, tile_x=True)))
    paint = shade(paint, 0.955 + 0.07 * strokes(H, W, 21, 'x', 10, 120, tile_x=True))
    paint = mix(paint, hexc('#E8B98A'), 0.10 * stretch(fbm(H, W, 5, 9, 22, tile_x=True)) * (1 - band))       # warm stains in the cream

    # chips: more of them at the waterline, along the slab seams and under water
    seam = sum(np.exp(-((Y2 - s) / 0.0016) ** 2) for s in SEAMS)
    near = sum(np.exp(-((Y2 - s) / 0.012) ** 2) for s in SEAMS)
    bias = 0.20 * np.exp(-((Y + 0.004) / 0.03) ** 2) + 0.10 * near + 0.16 * smooth(-Y, 0.0, 0.08)
    chip = chips(H, W, (9, 18), 30, amount=0.15, tile_x=True, crisp=0.012, bias=bias)
    cover = 1 - chip
    img = mix(cork, paint, cover)
    lit, shd = emboss(cover, 2, wrap_x=True)
    img = shade(img, 1 - 0.42 * shd)
    img = mix(img, hexc('#FFF6DE'), 0.45 * lit * cover)
    img = shade(img, 1 - (0.30 * chip + 0.16 * cover) * np.clip(seam, 0, 1))

    # under water: algae, runs of slime; at the waterline a line of scum, and the wet just above it
    deep = smooth(-Y, -0.004, 0.11)
    runs = strokes(H, W, 40, 'y', 5, 30, tile_x=True)
    img = mix(img, ALGAE, deep * (0.34 + 0.34 * runs))
    img = shade(img, 1 - 0.24 * deep)
    flecks = speckle(H, W, 41, 0.0009, (2.6, 2.6), tile_x=True)
    img = mix(img, hexc('#DAD8C2'), smooth(flecks, 0.25, 0.5) * smooth(-Y, 0.015, 0.05) * 0.85)                    # a few barnacles
    img = shade(img, 1 - 0.35 * smooth(flecks, 0.08, 0.25) * (1 - smooth(flecks, 0.25, 0.5)) * smooth(-Y, 0.015, 0.05))
    scum = np.exp(-((Y + 0.006) / 0.0075) ** 2) * (0.55 + 0.45 * stretch(fbm(H, W, 30, 60, 42, 2, tile_x=True)))
    img = mix(img, SCUM, 0.62 * scum)
    img = shade(img, 1 - 0.10 * smooth(0.035 - Y, 0, 0.035) * (Y > -0.004))

    # the wooden end caps: rings round the axis; the lower one is wet and green
    ring = 0.5 + 0.5 * np.sin(2 * np.pi * (r[:, None] * 95 + 1.6 * fbm(H, W, 2, 5, 50, 2, tile_x=True)))
    wood = mix(WOOD, WOOD_D, 0.55 * ring + 0.25 * stretch(fbm(H, W, 60, 12, 51, 2, tile_x=True)))
    wood_lo = shade(mix(wood, ALGAE, 0.45), 0.72)
    img = mix(img, wood_lo, smooth(vlo + 0.004 - V, 0, 0.004))
    img = mix(img, wood, smooth(V - vhi + 0.002, 0, 0.004))
    edge = np.exp(-((V - vhi) / 0.006) ** 2) + np.exp(-((V - vlo) / 0.006) ** 2)
    img = shade(img, 1 - 0.35 * edge)

    # light from above, the rope's shadow round the shoulder, a darker foot
    img = shade(img, (0.86 + 0.20 * ny)[:, None])
    c = L['collar']
    ao = 0.65 * np.exp(-((y[:, None] - c['y']) / 0.017) ** 2) * np.ones((1, W))
    img = mix(img, img * np.array([0.60, 0.50, 0.44]), ao)
    return paintify(img, 3, wrap_x=True)


def rope(wet=False):
    H, W = A.size('rope')
    x = np.arange(W)[None, :] + 0.5
    v = 1 - (np.arange(H)[:, None] + 0.5) / H
    n = fbm(H, W, 6, 64, 60, 3, tile_x=True)
    s = (3 * (x / 96 + v) + 0.35 * (n - 0.5)) % 1.0                   # across one strand: three strands, pitch 96 px
    strand = np.sin(np.pi * s) ** 0.75
    fibre = 0.5 + 0.5 * np.sin(2 * np.pi * (s * 3.0 + 1.2 * n))
    lo, mid, hi = (hexc('#3A3A27'), hexc('#77704A'), hexc('#A39A68')) if wet else (hexc('#5E4329'), hexc('#A9824F'), hexc('#D9B87E'))
    img = mix(lo, mid, smooth(strand, 0.0, 0.55))
    img = mix(img, hi, smooth(strand, 0.55, 1.0) * (0.55 + 0.45 * fibre))
    img = shade(img, 0.90 + 0.10 * fibre)
    img = shade(img, 0.90 + 0.12 * np.sin(2 * np.pi * v))             # v 0.25 is the top of the rope
    if wet:
        img = mix(img, ALGAE, 0.25 * stretch(fbm(H, W, 3, 12, 61, tile_x=True)))
    return img


def staff():
    H, W = A.size('staff')
    v = 1 - (np.arange(H)[:, None] + 0.5) / H
    grain = strokes(H, W, 70, 'y', 4, 60, tile_x=True)
    img = mix(WOOD, WOOD_D, 0.15 + 0.55 * grain)
    img = mix(img, hexc('#B58E63'), 0.35 * stretch(fbm(H, W, 3, 2, 71, tile_x=True)))
    img = shade(img, 0.70 + 0.30 * smooth(v, 0.0, 0.22))             # dark where it goes into the float
    ferrule = smooth(v, 0.84, 0.855)                                  # a brass ferrule under the lantern
    br = mix(BRASS_D, BRASS_L, np.clip(0.5 + 0.5 * np.sin(2 * np.pi * (np.arange(W)[None, :] / W * 3)), 0, 1) * 0.6 + 0.2 * (v > 0.9))
    img = mix(img, br * np.ones((H, W, 3)), ferrule)
    img = shade(img, 1 - 0.4 * np.exp(-((v - 0.845) / 0.012) ** 2))
    return paintify(img, 3, wrap_x=True)


def brass(H, W, seed, light=1.0, top=0.25, edge=3.0, patina=0.35):
    """A sheet of brass: lighter toward its top, a bright line along its upper and left edges, tarnish in blotches."""
    yy = (np.arange(H)[:, None] + 0.5) / H
    xx = (np.arange(W)[None, :] + 0.5) / W
    img = mix(BRASS, BRASS_D, stretch(fbm(H, W, 3, 3, seed)) * 0.55)
    img = mix(img, BRASS_L, top * (1 - yy) * np.ones((1, W)))
    img = mix(img, BRASS_DD, patina * smooth(stretch(fbm(H, W, 5, 5, seed + 1)), 0.55, 0.9))
    img = mix(img, hexc('#7FA08A'), 0.22 * smooth(stretch(fbm(H, W, 7, 7, seed + 2)), 0.78, 0.95))            # a little verdigris
    e = np.maximum(np.exp(-(yy * H / edge) ** 2) * np.ones((1, W)), 0.7 * np.exp(-(xx * W / edge) ** 2) * np.ones((H, 1)))
    img = mix(img, BRASS_L, 0.75 * e)
    d = np.maximum(np.exp(-((1 - yy) * H / edge) ** 2) * np.ones((1, W)), 0.7 * np.exp(-((1 - xx) * W / edge) ** 2) * np.ones((H, 1)))
    img = mix(img, BRASS_DD, 0.6 * d)
    return shade(img, light)


def roof(k):
    H, W = A.size('roof0')
    t = L['roofTop']
    img = brass(H, W, 80 + k, light=[1.0, 0.90, 0.80, 0.94][k], top=0.0, patina=0.45)
    yy = (np.arange(H)[:, None] + 0.5) / H
    xx = (np.arange(W)[None, :] + 0.5) / W
    half = 0.5 * (t + (1 - t) * yy)                                   # the face is a trapezoid: half its width at this row
    d = (half - np.abs(xx - 0.5)) * W                                 # pixels inside the hip edge
    img = mix(img, BRASS_L, 0.25 * (1 - yy) * np.ones((1, W)))                              # lighter toward the ridge
    seamx = np.abs(((xx - 0.5) / (2 * half) + 0.5) * 3 % 1 - 0.5)     # two standing seams down the sheet
    img = shade(img, 1 - 0.30 * np.exp(-(seamx * W * 2 * half / 3 / 1.4) ** 2) * (d > 3))
    img = mix(img, BRASS_L, 0.8 * np.exp(-((d - 2.0) / 2.0) ** 2))                           # the hips catch the light
    img = mix(img, BRASS_L, 0.7 * np.exp(-(((1 - yy) * H - 3) / 2.2) ** 2) * np.ones((1, W)))  # the eaves' edge
    img = shade(img, 1 - 0.35 * np.exp(-(((1 - yy) * H) / 1.6) ** 2) * np.ones((1, W)))
    return paintify(img, 3)


def glass():
    H, W = A.size('glass')
    yy = (np.arange(H)[:, None] + 0.5) / H
    xx = (np.arange(W)[None, :] + 0.5) / W
    d = np.hypot((xx - 0.5) * 1.15, (yy - 0.56))
    img = mix(hexc('#E98A2B'), hexc('#FFC469'), smooth(0.62 - d, 0, 0.35))
    img = mix(img, hexc('#FFE9B0'), smooth(0.36 - d, 0, 0.28))
    flame = np.exp(-(((xx - 0.5) / 0.10) ** 2 + ((yy - 0.60) / 0.17) ** 2))
    img = mix(img, hexc('#FFFBEA'), 0.85 * flame)
    img = shade(img, 0.94 + 0.08 * strokes(H, W, 90, 'y', 5, 40))
    rim = np.minimum(np.minimum(xx, 1 - xx) * W, np.minimum(yy, 1 - yy) * H)
    img = mix(img, hexc('#B8621E'), 0.55 * np.exp(-(rim / 5.0) ** 2))
    return img


def small(name, seed, **kw):
    H, W = A.size(name)
    return paintify(brass(H, W, seed, **kw), 3)


def plate_side():
    H, W = A.size('plateSide')
    parts = [brass(H, W // 4, 100 + k, light=[0.90, 1.0, 0.94, 0.80][k], top=0.2, edge=2.2) for k in range(4)]
    return np.concatenate(parts, 1)


def under(name, glow, base=0.5):
    """An underside: brass in shade, warmed by the lamp where `glow` says so."""
    H, W = A.size(name)
    yy = (np.arange(H)[:, None] + 0.5) / H
    xx = (np.arange(W)[None, :] + 0.5) / W
    img = mix(BRASS_D, BRASS, base * stretch(fbm(H, W, 3, 3, 110)))
    img = mix(img, hexc('#F0A84A'), glow * np.exp(-(np.hypot(xx - 0.5, yy - 0.5) / 0.55) ** 2))
    rim = np.minimum(np.minimum(xx, 1 - xx) * W, np.minimum(yy, 1 - yy) * H)
    return mix(img, BRASS_L, 0.5 * np.exp(-(rim / 2.5) ** 2))


def post():
    H, W = A.size('post')
    yy = (np.arange(H)[:, None] + 0.5) / H
    xx = (np.arange(W)[None, :] + 0.5) / W
    img = brass(H, W, 120, top=0.1, edge=2.5, patina=0.3)
    img = mix(img, hexc('#F0A040'), 0.25 * np.ones((H, W)))                                  # the lamp's light on the frame
    for cy in (0.08, 0.92):
        rivet = np.exp(-(np.hypot((xx - 0.5) * W, (yy - cy) * H) / 3.2) ** 2)
        img = mix(img, BRASS_L, 0.9 * rivet)
        img = shade(img, 1 - 0.5 * np.exp(-(np.hypot((xx - 0.5) * W - 2, (yy - cy) * H - 2.5) / 3.0) ** 2) * (1 - rivet))
    return img


def iron():
    H, W = A.size('eye')
    v = 1 - (np.arange(H)[:, None] + 0.5) / H
    img = mix(hexc('#2F3130'), hexc('#4C4A45'), stretch(fbm(H, W, 3, 10, 130, tile_x=True)))
    img = mix(img, hexc('#8A4A27'), 0.7 * smooth(stretch(fbm(H, W, 5, 14, 131, tile_x=True)), 0.5, 0.85))
    img = mix(img, ALGAE, 0.25)
    return shade(img, 0.85 + 0.2 * np.sin(2 * np.pi * v))


def ring():
    H, W = A.size('ring')
    v = 1 - (np.arange(H)[:, None] + 0.5) / H
    img = mix(BRASS, BRASS_D, stretch(fbm(H, W, 2, 8, 140, tile_x=True)) * 0.5)
    img = mix(img, BRASS_L, 0.55 * smooth(np.sin(2 * np.pi * v), 0.2, 1.0) * np.ones((1, W)))
    return shade(img, 0.82 + 0.2 * np.sin(2 * np.pi * v))


A.paste('body', body())
A.paste('rope', rope(False))
A.paste('ropeWet', rope(True))
A.paste('staff', staff())
for k in range(4):
    A.paste('roof%d' % k, roof(k))
A.paste('roofUnder', under('roofUnder', 0.8))
A.paste('glass', glass())
A.paste('plateTop', under('plateTop', 0.9))
A.paste('plateSide', plate_side())
A.paste('plateUnder', under('plateUnder', 0.0, 0.9))
A.paste('post', post())
A.paste('knob', small('knob', 150, top=0.45))
A.paste('ring', ring())
A.paste('eye', iron())
print(A.save(out))
