"""mats.py : painted materials for props that are built in code, and paint_spec(), which paints every rectangle of a
layout that names a material (the builder's pack() writes "paint": {name: {"mat": ..., options}} into the layout).

Every material is a function (H, W, seed=0, **options) -> float RGB image (H, W, 3), sRGB 0..1, v up = row 0 at the top.
Options every material takes through paint_spec:
  light    multiply the patch (a face that looks away from the light)
  ao       {"top"|"bottom"|"left"|"right": amount}  darken toward that edge (a part that goes into another)
  edge     amount of painted bevel: light along the top and left edges, dark along the bottom and right
  water    [y at the bottom edge, y at the top edge] in metres: the patch stands in water at y = 0 (algae below,
           a line of scum and barnacles at the waterline, wet just above)
  tile_x   the patch runs round something, so its left and right edges must meet
Needs paintkit.py beside it.
"""
import numpy as np
from paintkit import (hexc, mix, smooth, fbm, stretch, blur, emboss, chips, strokes, shade, tint, paintify, speckle,
                      polymask, linemask)

ALGAE, SCUM, BARNACLE = hexc('#58724A'), hexc('#3B4734'), hexc('#DAD8C2')


def grid(H, W):
    """yy 0 at the top row to 1 at the bottom, xx 0 at the left to 1 at the right, v = 1 - yy."""
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    xx = (np.arange(W)[None, :] + 0.5) / W * np.ones((H, 1))
    return yy, xx, 1 - yy


def bevel(img, amount=0.5, px=3.0, hi='#FFFFFF', lo='#000000'):
    H, W = img.shape[:2]
    yy, xx, v = grid(H, W)
    lit = np.maximum(np.exp(-(yy * H / px) ** 2), 0.7 * np.exp(-(xx * W / px) ** 2))
    drk = np.maximum(np.exp(-((1 - yy) * H / px) ** 2), 0.7 * np.exp(-((1 - xx) * W / px) ** 2))
    img = mix(img, hexc(hi), 0.45 * amount * lit)
    return mix(img, hexc(lo), 0.45 * amount * drk)


# ------------------------------------------------------------------------------------------------ metals
def iron(H, W, seed=0, rust=0.45, tile_x=False, hammered=0.5, **_):
    """Old wrought iron: blue-black, hammered, with blotches and runs of rust."""
    yy, xx, v = grid(H, W)
    img = mix(hexc('#33383D'), hexc('#5B6063'), stretch(fbm(H, W, max(2, H / 40), max(2, W / 40), seed, tile_x=tile_x)))
    img = shade(img, 1 - 0.16 * hammered * speckle(H, W, seed + 1, 0.012, (2.2, 2.2), tile_x=tile_x))
    img = mix(img, hexc('#6B7074'), 0.30 * hammered * speckle(H, W, seed + 2, 0.008, (1.6, 1.6), tile_x=tile_x))
    r = stretch(fbm(H, W, max(2, H / 28), max(2, W / 28), seed + 3, 4, 0.55, tile_x=tile_x))
    runs = strokes(H, W, seed + 4, 'y', 4, 26, tile_x=tile_x)
    m = smooth(r + 0.25 * runs, 1.05 - 0.75 * rust, 1.25 - 0.75 * rust)
    img = mix(img, hexc('#7A4426'), 0.85 * m)
    img = mix(img, hexc('#B46A3A'), 0.55 * m * smooth(stretch(fbm(H, W, max(2, H / 9), max(2, W / 9), seed + 5, 2, tile_x=tile_x)), 0.55, 0.9))
    return img


BRASS, BRASS_L, BRASS_D, BRASS_DD = hexc('#C8973A'), hexc('#F4D27A'), hexc('#8A6127'), hexc('#553A1A')


def brass(H, W, seed=0, top=0.25, patina=0.35, verdigris=0.22, tile_x=False, **_):
    """Sheet brass: lighter toward its top, tarnish in blotches, a little verdigris."""
    yy, xx, v = grid(H, W)
    img = mix(BRASS, BRASS_D, stretch(fbm(H, W, 3, 3, seed, tile_x=tile_x)) * 0.55)
    img = mix(img, BRASS_L, top * v)
    img = mix(img, BRASS_DD, patina * smooth(stretch(fbm(H, W, 5, 5, seed + 1, tile_x=tile_x)), 0.55, 0.9))
    img = mix(img, hexc('#7FA08A'), verdigris * smooth(stretch(fbm(H, W, 7, 7, seed + 2, tile_x=tile_x)), 0.78, 0.95))
    return img


def copper(H, W, seed=0, green=0.75, tile_x=False, top=0.2, **_):
    """Old copper gone green: verdigris with the brown metal showing through in patches and dark runs."""
    yy, xx, v = grid(H, W)
    img = mix(hexc('#4E8F7C'), hexc('#7FBFA6'), stretch(fbm(H, W, max(2, H / 36), max(2, W / 36), seed, tile_x=tile_x)))
    img = mix(img, hexc('#A9DBC4'), top * v)
    bare = smooth(stretch(fbm(H, W, max(2, H / 24), max(2, W / 24), seed + 1, 3, tile_x=tile_x)), green, green + 0.18)
    img = mix(img, hexc('#7A4B2E'), 0.9 * bare)
    img = mix(img, hexc('#B9774A'), 0.5 * bare * smooth(stretch(fbm(H, W, max(2, H / 8), max(2, W / 8), seed + 2, 2, tile_x=tile_x)), 0.5, 0.9))
    return shade(img, 1 - 0.22 * strokes(H, W, seed + 3, 'y', 4, 30, tile_x=tile_x) * smooth(yy, 0.2, 1.0))


def floats(H, W, seed=0, n=5, bead=(0.2, 0.8), **_):
    """A string of cork floats on a tarred rope, laid along x: n floats, each between bead[0] and bead[1] of its period.
    v runs round the string; the lower half (v 0.5 to 1) is under water."""
    yy, xx, v = grid(H, W)
    f = (xx * n) % 1.0
    on = smooth(f, bead[0] - 0.02, bead[0] + 0.02) * (1 - smooth(f, bead[1] - 0.02, bead[1] + 0.02))
    c = cork(H, W, seed, tile_x=True)
    m = (f - bead[0]) / (bead[1] - bead[0])
    band = smooth(m, 0.26, 0.30) * (1 - smooth(m, 0.70, 0.74))                              # a band of old white paint round each float
    worn = chips(H, W, (6, 30), seed + 7, amount=0.35, tile_x=True, crisp=0.03)
    c = mix(c, hexc('#E9E2CF'), 0.85 * band * (1 - worn))
    c = shade(c, 1 - 0.32 * np.exp(-(m / 0.07) ** 2) - 0.32 * np.exp(-((1 - m) / 0.07) ** 2))    # darker ends
    r = rope(H, W, seed + 5, wet=True, pitch=max(24, W // (n * 4)))
    img = mix(r, c, on)
    under = smooth(np.abs(v - 0.25), 0.18, 0.30)
    img = mix(img, ALGAE, 0.45 * under)
    return shade(img, 1 - 0.25 * under)


def tin(H, W, seed=0, colour='#8E979A', tile_x=False, **_):
    """Dull tinplate with scuffs and a few spots of rust."""
    c = hexc(colour)
    img = mix(c * 0.82, c * 1.12, stretch(fbm(H, W, 4, 4, seed, tile_x=tile_x)))
    img = shade(img, 0.95 + 0.08 * strokes(H, W, seed + 1, 'x', 8, 70, tile_x=tile_x))
    img = mix(img, hexc('#8A4A27'), 0.6 * smooth(stretch(fbm(H, W, 9, 9, seed + 2, 3, tile_x=tile_x)), 0.8, 0.95))
    return img


# ------------------------------------------------------------------------------------------------ wood, cork, rope
WOODS = {'drift': ('#8A6A4F', '#5E4532', '#B08D68'), 'dark': ('#5A4233', '#3A2A20', '#7A5C46'), 'pale': ('#B79B76', '#8A6F50', '#D8C19A'),
         'grey': ('#8C8578', '#5F594F', '#AEA795'), 'red': ('#8E4A3A', '#5E2E26', '#B46A55'), 'tar': ('#3B332D', '#221D1A', '#5A4E44')}


def wood(H, W, seed=0, planks=0, along='y', tone='drift', weather=0.4, gap=1.6, nails=0, tile_x=False, **_):
    """Weathered wood. planks > 0 lays that many planks side by side (they run `along` y or x), each its own tone,
    with a dark gap between; nails = rows of nail heads across every plank."""
    c, d, l = [hexc(s) for s in WOODS[tone]]
    yy, xx, v = grid(H, W)
    g = strokes(H, W, seed, along, 5, 70, tile_x=tile_x)
    img = mix(c, d, 0.10 + 0.55 * g)
    img = mix(img, l, 0.40 * stretch(fbm(H, W, 3, 3, seed + 1, tile_x=tile_x)) * (1 - g))
    img = mix(img, hexc('#9A968C'), weather * 0.45 * smooth(stretch(fbm(H, W, 6, 6, seed + 2, 3, tile_x=tile_x)), 0.45, 0.9))    # silvered by weather
    if planks:
        rs = np.random.default_rng(seed + 3)
        across = xx if along == 'y' else yy
        n = across.shape[1] if along == 'y' else across.shape[0]
        k = np.minimum((across * planks).astype(int), planks - 1)
        tones = rs.uniform(0.84, 1.12, planks)
        img = shade(img, tones[k])
        f = across * planks - k                                   # 0..1 across one plank
        px = n / planks
        d_edge = np.minimum(f, 1 - f) * px
        img = shade(img, 1 - 0.75 * np.exp(-(d_edge / gap) ** 2))
        img = mix(img, l, 0.30 * np.exp(-((f * px - gap * 2.2) / 1.2) ** 2))             # the lit arris of each plank
        if nails:
            runs = (yy if along == 'y' else xx)
            for r in np.linspace(0.08, 0.92, nails):
                dot = np.exp(-(np.hypot((f - 0.5) * px, (runs - r) * (H if along == 'y' else W)) / 1.9) ** 2)
                img = mix(img, hexc('#2A2422'), 0.8 * dot)
    return img


def endgrain(H, W, seed=0, tone='drift', **_):
    """The sawn end of a post or a log: rings round the middle."""
    c, d, l = [hexc(s) for s in WOODS[tone]]
    yy, xx, v = grid(H, W)
    r = np.hypot(xx - 0.5, yy - 0.5) * 2
    ring = 0.5 + 0.5 * np.sin(2 * np.pi * (r * 7 + 1.2 * fbm(H, W, 3, 3, seed, 2)))
    img = mix(l, d, 0.25 + 0.5 * ring)
    return mix(img, d, 0.5 * smooth(r, 0.75, 1.0))


def cork(H, W, seed=0, tile_x=False, **_):
    img = mix(hexc('#B5855A'), hexc('#D6AC7C'), stretch(fbm(H, W, 7, 14, seed, tile_x=tile_x)) * 0.55)
    img = mix(img, hexc('#7C5636'), speckle(H, W, seed + 1, 0.030, (1.2, 1.2), tile_x=tile_x) * 0.75)
    img = mix(img, hexc('#D6AC7C'), speckle(H, W, seed + 2, 0.012, (1.0, 1.0), tile_x=tile_x) * 0.6)
    return img


def rope(H, W, seed=0, wet=False, pitch=96, tile_x=True, **_):
    """Three-strand rope: u runs along it (the lay repeats every `pitch` pixels), v round it."""
    yy, xx, v = grid(H, W)
    x = xx * W
    n = fbm(H, W, 6, max(2, W // 16), seed, 3, tile_x=tile_x)
    s = (3 * (x / pitch + v) + 0.35 * (n - 0.5)) % 1.0
    strand = np.sin(np.pi * s) ** 0.75
    fibre = 0.5 + 0.5 * np.sin(2 * np.pi * (s * 3.0 + 1.2 * n))
    lo, mid, hi = (hexc('#3A3A27'), hexc('#77704A'), hexc('#A39A68')) if wet else (hexc('#5E4329'), hexc('#A9824F'), hexc('#D9B87E'))
    img = mix(lo, mid, smooth(strand, 0.0, 0.55))
    img = mix(img, hi, smooth(strand, 0.55, 1.0) * (0.55 + 0.45 * fibre))
    img = shade(img, 0.90 + 0.10 * fibre)
    return shade(img, 0.90 + 0.12 * np.sin(2 * np.pi * v))


# ------------------------------------------------------------------------------------------------ light
LAMPS = {  # rim, body, core, flame
    'cyanwhite': ('#4FB9C9', '#BFF6FF', '#E9FDFF', '#FFFFFF'),
    'cyan': ('#1F9E97', '#7FF0E0', '#C6FFF4', '#F4FFFC'),
    'warm': ('#B8621E', '#FFC98A', '#FFE9B0', '#FFFBEA'),
    'amber': ('#B8621E', '#FFC469', '#FFE9B0', '#FFFBEA'),
    'dead': ('#2E3A3A', '#52605E', '#6C7A77', '#7E8B88'),
}


def glass(H, W, seed=0, hue='cyan', panes=1, flame=0.85, **_):
    """A lit lantern pane (also its own glow map): bright in the middle, the colour deepening to the frame.
    panes > 1 repeats it side by side (a glass that runs round a lantern)."""
    rim, body, core, fl = [hexc(s) for s in LAMPS[hue]]
    yy, xx, v = grid(H, W)
    xx = (xx * panes) % 1.0
    d = np.hypot((xx - 0.5) * 1.15, (yy - 0.56))
    img = mix(rim, body, smooth(0.66 - d, 0, 0.32))
    img = mix(img, core, smooth(0.38 - d, 0, 0.28))
    img = mix(img, fl, flame * np.exp(-(((xx - 0.5) / 0.11) ** 2 + ((yy - 0.60) / 0.19) ** 2)))
    img = shade(img, 0.95 + 0.07 * strokes(H, W, seed, 'y', 5, 40))
    e = np.minimum(np.minimum(xx, 1 - xx) * W / panes, np.minimum(yy, 1 - yy) * H)
    return mix(img, rim * 0.8, 0.5 * np.exp(-(e / 4.0) ** 2))


def glow(H, W, seed=0, colour='#7FF0D0', dark='#2E6E63', along='y', tip=1.0, tile_x=False, **_):
    """Something that lights up after dark (moss strands, buds): its colour, paler and brighter toward the tip (v = 1 unless tip = 0)."""
    yy, xx, v = grid(H, W)
    t = v if tip else 1 - v
    c, d = hexc(colour), hexc(dark)
    img = mix(d, c, smooth(t, 0.0, 0.75))
    img = mix(img, mix(c, np.ones(3), 0.55), smooth(t, 0.6, 1.0) * 0.8)
    img = shade(img, 0.86 + 0.2 * strokes(H, W, seed, along, 6, 50, tile_x=tile_x))
    return img


# ------------------------------------------------------------------------------------------------ cloth, paper, flat
def cloth(H, W, seed=0, stripes=('#C8473D', '#F2E3C6'), n=6, along='x', worn=0.3, **_):
    """Striped canvas: n stripes that run along x (side by side down the patch) or along y."""
    yy, xx, v = grid(H, W)
    a = yy if along == 'x' else xx
    k = np.minimum((a * n).astype(int), n - 1)
    cols = np.array([hexc(s) for s in stripes])
    img = cols[k % len(cols)]
    weave = 0.5 + 0.25 * np.sin(2 * np.pi * xx * W / 3.0) + 0.25 * np.sin(2 * np.pi * yy * H / 3.0)
    img = shade(img, 0.93 + 0.07 * weave)
    img = shade(img, 0.90 + 0.14 * stretch(fbm(H, W, 3, 4, seed)))
    return mix(img, hexc('#8C8578'), worn * 0.5 * smooth(stretch(fbm(H, W, 7, 7, seed + 1, 3)), 0.5, 0.95))


def flat(H, W, seed=0, colour='#8A6A4F', var=0.12, grain=0.0, along='y', tile_x=False, **_):
    """One colour with soft variation (and brush strokes if grain > 0)."""
    c = hexc(colour)
    img = shade(c * np.ones((H, W, 3)), 1 - var + 2 * var * stretch(fbm(H, W, max(2, H / 48), max(2, W / 48), seed, tile_x=tile_x)))
    if grain:
        img = shade(img, 1 - grain + 2 * grain * strokes(H, W, seed + 1, along, 6, 70, tile_x=tile_x))
    return img


PAINT = {'iron': iron, 'brass': brass, 'copper': copper, 'floats': floats, 'tin': tin, 'wood': wood, 'endgrain': endgrain, 'cork': cork, 'rope': rope,
         'glass': glass, 'glow': glow, 'cloth': cloth, 'flat': flat}


# ------------------------------------------------------------------------------------------------ what happens to a patch afterwards
def waterline(img, y0, y1, seed=0, tile_x=False, barnacles=1.0):
    """The patch stands in water: y0 and y1 are the heights (m) of its bottom and top edges, the surface is y = 0."""
    H, W = img.shape[:2]
    yy, xx, v = grid(H, W)
    wob = (fbm(1, W, 1, max(2, W // 60), seed, tile_x=tile_x)[0] - 0.5) * 0.05
    Y = y0 + (y1 - y0) * v + wob[None, :]
    ppm = H / max(1e-6, (y1 - y0))
    deep = smooth(-Y, -0.01, 0.35)
    runs = strokes(H, W, seed + 1, 'y', 5, 30, tile_x=tile_x)
    img = mix(img, ALGAE, deep * (0.40 + 0.35 * runs))
    img = shade(img, 1 - 0.30 * deep - 0.25 * smooth(-Y, 0.5, 2.0))
    band = np.exp(-((Y - 0.06) / 0.16) ** 2)                                          # barnacles gather round the waterline
    fl = speckle(H, W, seed + 2, 0.9 / max(30.0, ppm) ** 1.2 * 3.0, (max(1.2, ppm * 0.012), max(1.4, ppm * 0.016)), tile_x=tile_x)
    crust = smooth(fl * (0.35 + 0.9 * band) * barnacles, 0.22, 0.42) * smooth(0.55 - Y, 0, 0.2)
    img = shade(img, 1 - 0.4 * smooth(fl * (0.35 + 0.9 * band) * barnacles, 0.10, 0.22) * (1 - crust))
    img = mix(img, BARNACLE, 0.9 * crust)
    scum = np.exp(-((Y + 0.01) / 0.03) ** 2) * (0.55 + 0.45 * stretch(fbm(H, W, max(2, H // 20), max(2, W // 20), seed + 3, 2, tile_x=tile_x)))
    img = mix(img, SCUM, 0.6 * scum)
    return shade(img, 1 - 0.14 * smooth(0.22 - Y, 0, 0.22) * (Y > -0.01))               # wet just above the water


def finish(img, light=1.0, ao=None, edge=0.0, water=None, seed=0, tile_x=False, soft=3, **_):
    H, W = img.shape[:2]
    yy, xx, v = grid(H, W)
    if water:
        img = waterline(img, water[0], water[1], seed + 50, tile_x)
    if edge:
        img = bevel(img, edge)
    for side, amount in (ao or {}).items():
        t = {'top': yy, 'bottom': 1 - yy, 'left': xx, 'right': 1 - xx}[side]
        img = shade(img, 1 - amount * np.exp(-(t / 0.22) ** 2))
    img = shade(img, light)
    return paintify(img, soft, wrap_x=tile_x) if soft and min(H, W) > 8 else img


def paint_spec(A, skip=(), extra=None):
    """Paint every rectangle of the atlas whose layout entry names a material. extra: {material name: function}."""
    table = dict(PAINT, **(extra or {}))
    done = []
    for name, spec in A.layout.get('paint', {}).items():
        if name in skip or not spec:
            continue
        spec = dict(spec)
        mat = spec.pop('mat')
        H, W = A.size(name)
        img = table[mat](H, W, **spec)
        A.paste(name, finish(img, **spec))
        done.append(name)
    return done
