"""boatmats.py : paint for boats that are built in code (puffin.mjs, build-puffin*.mjs): painted planking, a hull seen
from the side in bands by height, a name board, a round badge with a puffin on it, a porthole, wickerwork, sailcloth;
and for her wreck: any material after forty years in the weather (`aged`), a nest of reed, a moorhen's egg.
mats.py adds these to its table, so a boat's layout names them like any other material.
"""
import numpy as np
from scipy import ndimage as ndi
from paintkit import hexc, mix, smooth, fbm, stretch, blur, strokes, shade, speckle, polymask, linemask, chips

BONE, INK, CORAL, BOTTOM = '#EFE3C8', '#2B2634', '#E0685F', '#7E4038'
OILED = ('#9A6A44', '#6B452B', '#C08E60')           # oiled wood: body, grain, light


def _grid(H, W):
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    xx = (np.arange(W)[None, :] + 0.5) / W * np.ones((H, 1))
    return yy, xx, 1 - yy


def _paint(H, W, seed, colour, tile_x=False, strong=1.0):
    """One colour of brushed paint: long strokes along x, soft clouds."""
    img = hexc(colour) * np.ones((H, W, 3))
    img = shade(img, 1 - 0.07 * strong + 0.14 * strong * strokes(H, W, seed, 'x', 20, 120, tile_x=tile_x))
    return shade(img, 0.955 + 0.09 * stretch(fbm(H, W, max(2, H / 70), max(2, W / 70), seed + 1, tile_x=tile_x)))


def _oiled(H, W, seed, tile_x=False, along='x'):
    c, d, l = [hexc(s) for s in OILED]
    g = strokes(H, W, seed, along, 6, 80, tile_x=tile_x)
    img = mix(c, d, 0.08 + 0.5 * g)
    return mix(img, l, 0.35 * stretch(fbm(H, W, 3, 3, seed + 1, tile_x=tile_x)) * (1 - g))


def _laps(img, yy, planks, seed, lap=0.5, first=False):
    """Planks that run along x and lap over the one below: each its own tone, a line and a shadow under every lap, light
    on the edge that stands out. first: the top plank has a lap above it too."""
    H = img.shape[0]
    f = yy * planks
    k = np.minimum(f.astype(int), planks - 1)
    t = f - k                                                   # 0 at a plank's upper edge, 1 at its lower edge
    px = H / planks
    tones = np.random.default_rng(seed + 2).uniform(0.955, 1.035, planks)
    img = shade(img, tones[k])
    has = (k > 0) | first
    img = shade(img, 1 - has * (0.22 * lap * np.exp(-t * px / (0.20 * px)) + 0.50 * np.exp(-(t * px / 1.3) ** 2)))
    last = k == planks - 1
    img = mix(img, np.ones(3), (~last) * 0.16 * lap * np.exp(-((1 - t) * px / (0.16 * px)) ** 2))
    return img, t * px, (1 - t) * px


def planked(H, W, seed=0, colour=BONE, planks=4, lap=0.5, wear=0.2, under='#8A6A4F', grime=0.0, first=False, tile_x=False, **_):
    """Painted planking that runs along x: brushed paint, laps (see _laps), paint worn off along the plank edges where
    `under` shows (wear 0..1), grime rising from the bottom edge."""
    yy, xx, v = _grid(H, W)
    img = _paint(H, W, seed, colour, tile_x)
    d_top = d_bot = None
    if planks:
        img, d_top, d_bot = _laps(img, yy, planks, seed, lap, first)
    if wear:
        bias = 0 if d_bot is None else 0.45 * np.exp(-d_bot / 3.0) + 0.2 * np.exp(-d_top / 4.0)
        m = chips(H, W, (max(3, H / 14), max(6, W / 20)), seed + 5, amount=0.05 * wear / 0.2, tile_x=tile_x, bias=bias)
        img = mix(img, hexc(under) * (0.85 + 0.3 * strokes(H, W, seed + 6, 'x', 6, 80, tile_x=tile_x))[..., None], 0.9 * m)
        img = shade(img, 1 - 0.18 * np.clip(blur(m, 1.6, wrap_x=tile_x) - m, 0, 1) * 3)
    if grime:
        img = mix(img, hexc('#6C6A4E'), grime * smooth(1 - v, 0.55, 1.0) * (0.5 + 0.5 * stretch(fbm(H, W, 3, 9, seed + 7, tile_x=tile_x))))
    return img


def antifoul(H, W, seed=0, colour=BOTTOM, slime=0.25, tile_x=False, **_):
    """Bottom paint: dull, a little scoured along the boat, greenish slime in patches toward its upper edge."""
    yy, xx, v = _grid(H, W)
    img = _paint(H, W, seed, colour, tile_x, strong=1.5)
    img = shade(img, 0.9 + 0.2 * stretch(fbm(H, W, 3, 10, seed + 3, tile_x=tile_x)))
    img = mix(img, hexc('#5E6A45'), slime * smooth(stretch(fbm(H, W, 4, 12, seed + 4, tile_x=tile_x)) + 0.35 * v, 0.62, 0.95))
    return img


def bands(H, W, seed=0, ys=(-0.5, 1.0), wl=(-0.04, 0.07), bottom=BOTTOM, boot=CORAL, colour=BONE, planks=0, top=None, top_colour=INK,
          wood_from=None, wear=0.15, tile_x=False, **_):
    """A hull seen from the side or from astern, by height: ys = (height of the bottom edge, of the top edge) in metres.
    Bottom paint below wl[0], the boot-top up to wl[1], `colour` above it (in `planks` planks), from height `top` a band
    of top_colour (the sheer strake), from wood_from up oiled wood."""
    yy, xx, v = _grid(H, W)
    y = ys[0] + (ys[1] - ys[0]) * v
    px = H / (ys[1] - ys[0])                                      # pixels to a metre
    hi = top if top is not None else (wood_from if wood_from is not None else ys[1])
    img = _paint(H, W, seed, colour, tile_x)
    if planks:
        t = np.clip((hi - y) / max(1e-6, hi - wl[1]), 0, 1)       # 0 at the top of the paint, 1 at the boot-top
        sub, _, _ = _laps(img, t, planks, seed, 0.5)
        img = np.where(((y > wl[1]) & (y < hi))[..., None], sub, img)
    if wear:
        m = chips(H, W, (max(3, H / 16), max(4, W / 16)), seed + 5, amount=0.03 * wear / 0.15, tile_x=tile_x)
        img = mix(img, hexc('#8A6A4F'), 0.85 * m)
    edge = lambda at: smooth(y, at - 0.6 / px, at + 0.6 / px)
    if top is not None:
        img = mix(img, _paint(H, W, seed + 11, top_colour, tile_x), edge(top))
    if wood_from is not None:
        img = mix(img, _oiled(H, W, seed + 12, tile_x, 'y'), edge(wood_from))
    img = mix(_paint(H, W, seed + 13, boot, tile_x), img, edge(wl[1]))
    img = mix(antifoul(H, W, seed + 14, bottom, tile_x=tile_x), img, edge(wl[0]))
    img = shade(img, 1 - 0.25 * np.exp(-((y - wl[0]) * px / 1.2) ** 2) - 0.2 * np.exp(-((y - wl[1]) * px / 1.0) ** 2))
    return img


# ---- block capitals as polygons, in units of the letter's height: {letter: (width, [polygon, ...], [hole, ...])}
def _arc(cx, cy, rx, ry, a0, a1, n=10):
    return [(cx + rx * np.cos(np.radians(a0 + (a1 - a0) * i / n)), cy + ry * np.sin(np.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


S = 0.23                                                          # the weight of a stroke
GLYPHS = {
    'P': (0.80, [[(0, 0), (S, 0), (S, 1), (0, 1)], [(S, 1), (0.46, 1)] + _arc(0.46, 0.71, 0.34, 0.29, 90, -90) + [(S, 0.42)]], [[(S, 0.80), (0.44, 0.80)] + _arc(0.44, 0.71, 0.13, 0.09, 90, -90) + [(S, 0.62)]]),
    'U': (0.84, [[(0, 1), (S, 1), (S, 0.40)] + _arc(0.42, 0.40, 0.42 - S, 0.40 - S * 0.9, 180, 360) + [(0.84 - S, 1), (0.84, 1), (0.84, 0.40)] + _arc(0.42, 0.40, 0.42, 0.40, 0, -180)], []),
    'F': (0.72, [[(0, 0), (S, 0), (S, 1), (0, 1)], [(S, 1 - S * 0.9), (0.72, 1 - S * 0.9), (0.72, 1), (S, 1)], [(S, 0.44), (0.60, 0.44), (0.60, 0.44 + S * 0.85), (S, 0.44 + S * 0.85)]], []),
    'I': (S, [[(0, 0), (S, 0), (S, 1), (0, 1)]], []),
    'N': (0.86, [[(0, 0), (S, 0), (S, 1), (0, 1)], [(0.86 - S, 0), (0.86, 0), (0.86, 1), (0.86 - S, 1)], [(0, 1), (S + 0.06, 1), (0.86, 0), (0.86 - S - 0.06, 0)]], []),
}


def lettering(H, W, seed=0, text='PUFFIN', ink=BONE, ground=None, margin=0.2, gap=0.2, worn=0.12, rim=0.0, **_):
    """A name board: oiled wood (or `ground`, a paint colour) with a word in block capitals drawn as polygons, no font.
    margin: the room above and below the letters as a part of the board's height; rim: a painted line round the board."""
    yy, xx, v = _grid(H, W)
    img = _oiled(H, W, seed) if ground is None else _paint(H, W, seed, ground)
    h = H * (1 - 2 * margin)
    widths = [GLYPHS[c][0] for c in text]
    total = sum(widths) + gap * (len(text) - 1)
    k = min(h, (W * 0.90) / total)                                # pixels to a letter height
    x = (W - total * k) / 2
    base = (H + k) / 2
    polys, holes = [], []
    for c, w in zip(text, widths):
        put = lambda poly: [(x + px * k, base - py * k) for px, py in poly]
        polys += [put(p) for p in GLYPHS[c][1]]
        holes += [put(p) for p in GLYPHS[c][2]]
        x += (w + gap) * k
    m = polymask(H, W, polys) * (1 - polymask(H, W, holes) if holes else 1)
    sh = np.roll(np.roll(m, 2, 0), 1, 1)                          # the letters are cut in: a little shade under their upper edges
    img = shade(img, 1 - 0.25 * np.clip(sh - m, 0, 1))
    wornm = smooth(stretch(fbm(H, W, 6, 16, seed + 3)), 0.7, 0.98)
    img = mix(img, hexc(ink), m * (1 - worn * 3 * wornm) * (0.9 + 0.1 * strokes(H, W, seed + 4, 'x', 8, 60)))
    if rim:
        d = np.minimum(np.minimum(yy, 1 - yy) * H, np.minimum(xx, 1 - xx) * W)
        img = mix(img, hexc(ink), 0.9 * smooth(d, rim * H * 0.7, rim * H) * (1 - smooth(d, rim * H * 1.5, rim * H * 1.8)))
    return img


def badge(H, W, seed=0, ground=BONE, ring=INK, band=CORAL, **_):
    """A round badge that fills the patch: a puffin standing, looking to the right, on a pale ground inside two rings."""
    yy, xx, v = _grid(H, W)
    r = np.hypot(xx - 0.5, yy - 0.5) * 2
    img = _paint(H, W, seed, ground)
    P = lambda pts: [(px * W, (1 - py) * H) for px, py in pts]
    ell = lambda cx, cy, rx, ry, tilt=0, n=28: [(cx + rx * np.cos(a) * np.cos(tilt) - ry * np.sin(a) * np.sin(tilt), cy + rx * np.cos(a) * np.sin(tilt) + ry * np.sin(a) * np.cos(tilt)) for a in np.linspace(0, 2 * np.pi, n, endpoint=False)]
    lay = lambda polys, colour, k=1.0: mix(img, hexc(colour), k * polymask(H, W, [P(p) for p in polys]))
    img = lay([[(0.40, 0.20), (0.47, 0.20), (0.47, 0.155), (0.52, 0.14), (0.36, 0.14)], [(0.50, 0.20), (0.57, 0.20), (0.58, 0.155), (0.64, 0.14), (0.47, 0.14)]], '#E8742C')      # feet
    img = lay([ell(0.455, 0.40, 0.175, 0.235, 0.22)], '#22202A')                                                    # back
    img = lay([[(0.33, 0.27), (0.25, 0.20), (0.36, 0.22), (0.43, 0.25)]], '#22202A')                                 # tail
    img = lay([ell(0.525, 0.365, 0.105, 0.175, 0.16)], '#F6EFE0')                                                   # belly
    img = lay([ell(0.40, 0.42, 0.075, 0.165, 0.30)], '#3A3742')                                                     # wing
    img = lay([ell(0.545, 0.685, 0.125, 0.125)], '#22202A')                                                         # head
    img = lay([ell(0.585, 0.672, 0.082, 0.088)], '#F6EFE0')                                                         # cheek
    img = lay([[(0.640, 0.745), (0.86, 0.640), (0.650, 0.590)]], '#E8742C')                                         # bill
    img = lay([[(0.640, 0.745), (0.715, 0.710), (0.705, 0.603), (0.650, 0.590)]], '#56627A')                        # its grey root
    img = lay([[(0.705, 0.716), (0.725, 0.706), (0.716, 0.604), (0.698, 0.600)]], '#F2D06B')
    img = lay([ell(0.598, 0.700, 0.017, 0.017, 0, 12)], '#22202A')                                                  # eye
    img = lay([[(0.585, 0.722), (0.612, 0.722), (0.598, 0.742)]], '#C8473D')
    img = mix(img, hexc(band), smooth(r, 0.80, 0.82) * (1 - smooth(r, 0.86, 0.88)))
    img = mix(img, hexc(ring), smooth(r, 0.885, 0.905))
    return img


def porthole(H, W, seed=0, glass='#24313A', **_):
    """A porthole face on: a brass rim with four dogs, dark glass with the sky in it."""
    yy, xx, v = _grid(H, W)
    r = np.hypot(xx - 0.5, yy - 0.5) * 2
    a = np.arctan2(0.5 - yy, xx - 0.5)
    g = mix(hexc(glass), hexc('#7FA7B0'), 0.55 * smooth(v, 0.35, 0.95) * (0.6 + 0.4 * stretch(fbm(H, W, 2, 2, seed))))
    g = mix(g, hexc('#EAF6F4'), 0.5 * np.exp(-((r - 0.42) / 0.07) ** 2) * smooth(np.cos(a - 2.2), 0.6, 1.0))
    brass = mix(hexc('#C9A24A'), hexc('#8A6A2A'), 0.5 * stretch(fbm(H, W, 3, 3, seed + 1)))
    brass = shade(brass, 0.8 + 0.45 * smooth(np.cos(a - 2.0), -1, 1))
    img = mix(g, brass, smooth(r, 0.60, 0.64))
    img = shade(img, 1 - 0.35 * np.exp(-((r - 0.62) / 0.03) ** 2) - 0.3 * smooth(r, 0.94, 1.0))
    img = mix(img, hexc('#6B4F1E'), 0.7 * np.exp(-((r - 0.81) / 0.035) ** 2) * (np.cos(4 * a) > 0.93))
    return img


def wicker(H, W, seed=0, rows=12, ribs=9, colour='#B08A54', dark='#4E3A24', tile_x=True, gapy=0.16, **_):
    """Basketwork: `rows` withies woven along x over and under `ribs` uprights; every other row goes the other way."""
    yy, xx, v = _grid(H, W)
    f = yy * rows
    k = f.astype(int)
    t = f - k
    over = np.sin(2 * np.pi * (xx * ribs / 2 + 0.5 * (k % 2)))    # +1 where this row is over an upright, -1 where it is under
    c, d = hexc(colour), hexc(dark)
    tone = np.random.default_rng(seed).uniform(0.86, 1.1, rows + 1)[np.minimum(k, rows)]
    img = c * np.ones((H, W, 3)) * tone[..., None]
    img = shade(img, 0.72 + 0.34 * smooth(over, -0.9, 0.9))
    img = shade(img, 0.86 + 0.2 * np.sin(np.pi * t) ** 0.6)        # round withies
    img = mix(img, d, 0.85 * (smooth(np.abs(t - 0.5), 0.5 - gapy / 2, 0.5)))
    img = mix(img, d, 0.5 * np.exp(-(over / 0.16) ** 2) * 0.6)     # the crossings
    return shade(img, 0.94 + 0.12 * stretch(fbm(H, W, 6, 20, seed + 1, tile_x=tile_x)))


def sailcloth(H, W, seed=0, colour='#8E4B35', cloths=7, along='y', seam='#5E2F22', reefs=(), patch=None, patch_colour='#E6D8B6', worn=0.3, tabling=0.03, outline=None, **_):
    """Tanned sailcloth. `cloths` panels sewn side by side (their seams run along y, or along x), a doubled edge all
    round (tabling), rows of reef points at the heights `reefs` (0..1 up the patch), faded where the sun and the salt
    have been. patch: (x, y, width, height) of a sewn-on patch, 0..1 with y up, in patch_colour. outline: the sail's
    own outline [(x, y), ...] (0..1, y up) when it does not fill the patch: the tabling then follows it."""
    yy, xx, v = _grid(H, W)
    c = hexc(colour)
    img = c * np.ones((H, W, 3))
    img = shade(img, 0.90 + 0.2 * stretch(fbm(H, W, 3, 3, seed)))
    img = mix(img, hexc('#B9785A'), worn * 0.6 * smooth(stretch(fbm(H, W, 5, 5, seed + 1)), 0.5, 0.95))            # faded places
    weave = 0.5 + 0.5 * np.sin(yy * H * 1.9) * np.sin(xx * W * 1.9)
    img = shade(img, 0.975 + 0.05 * weave)
    a = xx if along == 'y' else yy
    n = W if along == 'y' else H
    f = a * cloths
    k = np.minimum(f.astype(int), cloths - 1)
    img = shade(img, np.random.default_rng(seed + 2).uniform(0.94, 1.06, cloths)[k])
    d = np.minimum(f - k, 1 - (f - k)) * n / cloths
    img = mix(img, hexc(seam), 0.55 * np.exp(-(d / 1.6) ** 2))
    img = mix(img, hexc('#C99A78'), 0.35 * np.exp(-((d - 4.0) / 1.4) ** 2) * (np.sin((yy if along == 'y' else xx) * (H if along == 'y' else W) * 0.9) > 0.2))   # stitches
    e = np.minimum(np.minimum(xx, 1 - xx) * W, np.minimum(yy, 1 - yy) * H)
    if outline:
        e = ndi.distance_transform_edt(polymask(H, W, [[(x * W, (1 - y) * H) for x, y in outline]]) > 0.5)
        e = np.where(e > 0, e, 1e3)                                             # outside the sail the cloth just goes on (nothing shows there)
    tb = tabling * min(H, W)
    img = shade(img, 1 - 0.14 * (1 - smooth(e, tb * 0.9, tb)))
    img = mix(img, hexc(seam), 0.5 * np.exp(-((e - tb) / 1.3) ** 2))
    for ry in reefs:
        band = np.exp(-(((v - ry) * H) / 4.5) ** 2)
        img = shade(img, 1 - 0.10 * band)
        pts = [[((i + 0.5) / (cloths * 2) * W, (1 - ry) * H - 2), ((i + 0.5) / (cloths * 2) * W + 1.5, (1 - ry) * H + max(9, H * 0.035))] for i in range(cloths * 2)]
        img = mix(img, hexc('#E3D3AE'), 0.9 * linemask(H, W, pts, 2.2))
    if patch:
        px, py, pw, ph = patch
        inx, iny = np.abs(xx - (px + pw / 2)) / (pw / 2), np.abs(v - (py + ph / 2)) / (ph / 2)
        inside = (inx < 1) & (iny < 1)
        pc = hexc(patch_colour) * (0.9 + 0.2 * stretch(fbm(H, W, 4, 4, seed + 9)))[..., None]
        img = np.where(inside[..., None], pc * (0.975 + 0.05 * weave)[..., None], img)
        de = np.minimum((1 - inx) * pw / 2 * W, (1 - iny) * ph / 2 * H)
        st = inside & (np.abs(de - 5) < 1.4) & (np.sin((xx * W + yy * H) * 0.8) > 0.0)
        img = mix(img, hexc('#6E5A40'), 0.8 * st)
        img = shade(img, 1 - 0.25 * (~inside) * np.exp(-(np.maximum(np.maximum(inx - 1, 0) * pw / 2 * W, np.maximum(iny - 1, 0) * ph / 2 * H) / 2.5) ** 2))
    return img


def _age(img, seed, v, algae=0.4, lichen=0.25, fade=0.3, low=0.5, droppings=0.0, tile_x=False):
    """Forty years in the weather: colour gone grey-green, algae in blotches (more toward the patch's lower edge by
    `low`) with runs below them, spots of ochre and pale lichen, and what birds leave from the top edge down."""
    H, W = img.shape[:2]
    grey = img.mean(axis=2, keepdims=True) * np.ones(3)
    img = mix(img, mix(grey, hexc('#A4A694'), 0.5), fade)
    n1 = stretch(fbm(H, W, max(2, H / 90), max(2, W / 90), seed + 21, 3, tile_x=tile_x))
    runs = strokes(H, W, seed + 22, 'y', 6, 40, tile_x=tile_x)
    a = smooth(n1 + low * (0.5 - v) * 1.2, 0.42, 0.85)
    img = mix(img, hexc('#5E6E42'), algae * a * (0.55 + 0.45 * runs))
    img = mix(img, hexc('#2F3A26'), 0.5 * algae * smooth(n1 + low * (0.5 - v), 0.80, 1.0))
    if lichen:
        k = lichen / 0.25
        img = mix(img, hexc('#C2A248'), 0.80 * smooth(speckle(H, W, seed + 23, 0.0011 * k, (1.6, 3.4), tile_x=tile_x), 0.45, 0.75))
        img = mix(img, hexc('#B4BBA2'), 0.60 * smooth(speckle(H, W, seed + 24, 0.0009 * k, (2.0, 4.0), tile_x=tile_x), 0.45, 0.75))
    if droppings:
        d = speckle(H, W, seed + 25, 0.0004 * droppings / 0.2, (1.6, 3.2), tile_x=tile_x)
        run = np.maximum.accumulate(d * (np.random.default_rng(seed + 26).uniform(0.3, 1.0, (1, W)) > 0.5), axis=0) * np.exp(-np.cumsum(np.ones((H, 1)), axis=0) / (H * 0.5))
        img = mix(img, hexc('#DCDACD'), 0.7 * smooth(np.maximum(d, 0.6 * run), 0.45, 0.75))
    return img


def aged(H, W, seed=0, of='wood', algae=0.4, lichen=0.25, fade=0.3, low=0.5, droppings=0.0, tile_x=False, **kw):
    """Any other material (`of`, with its own options) after forty years in the weather: see _age."""
    from mats import PAINT
    img = PAINT[of](H, W, seed=seed, tile_x=tile_x, **kw)
    return _age(img, seed, _grid(H, W)[2], algae, lichen, fade, low, droppings, tile_x)


def nest(H, W, seed=0, tile_x=True, **_):
    """A nest of reed: dead stems wound round and round (they run along x, a little every way), a few still green."""
    rs = np.random.default_rng(seed)
    img = hexc('#463824') * np.ones((H, W, 3))
    img = shade(img, 0.85 + 0.3 * stretch(fbm(H, W, 4, 8, seed, tile_x=tile_x)))
    for colour, n, width in (('#6E5A38', 70, 2.8), ('#9C8450', 90, 2.2), ('#C9B57A', 60, 1.7), ('#7C8A4A', 22, 1.8)):
        lines = []
        for _ in range(max(4, int(n * W * H / (256 * 128)))):
            x, y, a, L = rs.uniform(0, W), rs.uniform(0, H), rs.normal(0, 0.32), rs.uniform(0.12, 0.34) * W
            dx, dy, bend = np.cos(a) * L / 2, np.sin(a) * L / 2, rs.normal(0, 0.05) * L
            pts = [(x - dx, y - dy), (x, y + bend), (x + dx, y + dy)]
            lines += [pts, [(px - W, py) for px, py in pts], [(px + W, py) for px, py in pts]] if tile_x else [pts]
        m = linemask(H, W, lines, width)
        img = shade(img, 1 - 0.5 * np.clip(blur(m, 1.6, wrap_x=tile_x) - m, 0, 1))
        img = mix(img, hexc(colour), 0.92 * m)
    return img


def egg(H, W, seed=0, tile_x=True, **_):
    """A moorhen's egg: buff, with red-brown spots and a few grey ones."""
    img = hexc('#DCCFA9') * np.ones((H, W, 3))
    img = shade(img, 0.94 + 0.12 * stretch(fbm(H, W, 3, 3, seed, tile_x=tile_x)))
    img = mix(img, hexc('#6B3F2A'), 0.85 * smooth(speckle(H, W, seed + 1, 0.016, (1.2, 3.0), tile_x=tile_x), 0.30, 0.55))
    return mix(img, hexc('#8C8478'), 0.5 * smooth(speckle(H, W, seed + 2, 0.008, (1.5, 3.0), tile_x=tile_x), 0.30, 0.55))


BOAT = {'planked': planked, 'antifoul': antifoul, 'bands': bands, 'lettering': lettering, 'badge': badge, 'porthole': porthole, 'wicker': wicker, 'sailcloth': sailcloth, 'aged': aged, 'nest': nest, 'egg': egg}
