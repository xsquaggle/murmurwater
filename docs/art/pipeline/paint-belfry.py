"""paint-belfry.py : paints the 2048 px atlas of props/belfry.glb in code. Original work, no generation job.
Usage: python paint-belfry.py <layout.json from build-belfry.mjs --layout> <out.png>
"""
import sys
import numpy as np
from scipy import ndimage as ndi
from paintkit import (Atlas, hexc, mix, smooth, fbm, stretch, blur, shift, emboss, strokes, shade, paintify, speckle,
                      linemask, polymask, masonry)

layout, out = sys.argv[1:3]
A = Atlas(layout, base='#55524E')
L = A.layout
Yd, O = L['Y'], L['OPEN']
PPM = 160.0

MORTAR, DRESSED = hexc('#4A464C'), hexc('#B6AF9F')
WET, ALGAE = hexc('#2B3633'), hexc('#56643A')
WEED_D, WEED_M, WEED_L, WEED_HI = hexc('#26291A'), hexc('#474522'), hexc('#6B612A'), hexc('#A39440')
BARN = hexc('#D8D2BE')
LICHEN_O, LICHEN_P = hexc('#C9A548'), hexc('#B7C0A0')
DEEP_T, DEEP_B = hexc('#35554A'), hexc('#10262B')
OAK, OAK_D, OAK_L = hexc('#6A5440'), hexc('#3E3024'), hexc('#8E7558')
IRON, IRON_L, RUST = hexc('#35322F'), hexc('#5D5A55'), hexc('#8A4C28')
BRONZE, BRONZE_L, BRONZE_HI, BRONZE_D = hexc('#6A4E2C'), hexc('#8F7040'), hexc('#C9A662'), hexc('#35271A')
VERD, VERD_L, VERD_D = hexc('#58A892'), hexc('#9AD6C2'), hexc('#2E5E52')
SLATES = ('#4E5A66', '#56626B', '#465059', '#575466', '#52605A', '#606A74', '#434C58', '#4A5560')


def rows_cols(H, W):
    return (np.arange(H)[:, None] + 0.5) / H, (np.arange(W)[None, :] + 0.5) / W


def opening(SX, Yf):
    """Metres outside the opening (negative inside) for points sx across a face and y up it."""
    w, RR, sp, sill = O['w'], O['RR'], Yd['spring'], Yd['sill']
    ax = np.abs(SX)
    d = np.where(Yf >= sp, np.hypot(ax - (w / 2 - RR), Yf - sp) - RR, ax - w / 2)
    return np.where(Yf < sill, np.maximum(ax - w / 2, sill - Yf), d)


def dress(img, SX, Yf, seed, ring=True):
    """Dressed stone round an opening: jamb stones, voussoirs and a sill, and the dark of the opening itself."""
    w, RR, sp, sill, ARC = O['w'], O['RR'], Yd['spring'], Yd['sill'], O['ARC']
    ax = np.abs(SX)
    d = opening(SX, Yf)
    H, W = img.shape[:2]
    px = 1 / PPM
    if ring:
        # jambs: stones 0.25 m high, alternately long and short
        ji = np.floor((Yf - sill) / 0.25)
        jband = np.where(ji % 2 == (SX > 0), 0.34, 0.20)
        in_j = (Yf >= sill) & (Yf < sp) & (d >= 0) & (d < jband)
        jl = np.minimum(np.abs((Yf - sill) / 0.25 - np.round((Yf - sill) / 0.25)) * 0.25, np.abs(d - jband))
        # arch: six voussoirs a side
        th = np.arctan2(Yf - sp, ax - (w / 2 - RR)) / ARC * 6
        in_a = (Yf >= sp) & (d >= 0) & (d < 0.25)
        al = np.minimum(np.abs(th - np.round(th)) * ARC / 6 * (RR + d), np.abs(d - 0.25))
        # sill
        in_s = (Yf < sill) & (Yf >= sill - 0.16) & (ax < w / 2 + 0.16)
        sl = np.minimum(np.minimum(np.abs(Yf - (sill - 0.16)), np.abs(ax - (w / 2 + 0.16))), np.abs(ax - 0.02) + 0.004)
        zone = in_j | in_a | in_s
        dist = np.where(in_j, jl, np.where(in_a, al, sl))
        stone = np.where(in_j, ji + 10 * (SX > 0), np.where(in_a, np.round(th + 0.5) + 40 * (SX > 0), 90.0)) + np.floor((SX + 1.6 + np.arange(W)[None, :] / PPM - (SX + 1.6)) / 3.2) * 7
        tone = 0.90 + 0.16 * ((np.sin(stone * 12.9898 + seed) * 43758.5453) % 1)
        dr = DRESSED * (tone * (0.95 + 0.10 * stretch(fbm(H, W, H / 30, W / 30, seed, 3))))[..., None]
        img = mix(img, dr, zone * 1.0)
        img = mix(img, MORTAR, zone * smooth(1.6 * px - dist, -0.7 * px, 0.7 * px))
        img = mix(img, hexc('#D8D2C2'), 0.5 * zone * np.exp(-(d / (1.5 * px)) ** 2))                   # the arris catches the light
    img = mix(img, hexc('#17161C'), smooth(-d, 0, 1.5 * px))
    return img


def weeds(img, H, W, seed, n, yr=(0.05, 1.45), wrap=True, deep=False, ppm=PPM):
    """Three layers of wrack: clumps of ribbons that hang from one holdfast, broad in the middle and round at the tip,
    thicker near the water. n = clumps per layer. Rows are metres above the bottom edge of the patch."""
    rs = np.random.default_rng(seed)
    sc = ppm / PPM
    for li in range(3):
        polys = []
        for _ in range(n):
            yc = yr[0] + (yr[1] - yr[0]) * rs.random() ** (1.0 if deep else 1.8)
            xc = rs.random() * W
            for _ in range(rs.integers(3, 7)):
                x0, y0 = xc + rs.uniform(-9, 9) * sc, H - yc * ppm + rs.uniform(-5, 5) * sc
                ln, w = rs.uniform(0.18, 0.55) * ppm * (0.6 + 0.4 * min(1.0, yc / 0.5 + 0.3)), rs.uniform(2.6, 5.2) * sc
                ph, amp, fr, drift = rs.uniform(0, 6.28), rs.uniform(2, 7) * sc, rs.uniform(2.5, 5.0), rs.uniform(-16, 16) * sc
                left, right = [], []
                for i in range(10):
                    t = i / 9
                    cx, cy = x0 + drift * t + amp * np.sin(ph + fr * t) * t, y0 + ln * t
                    hw = w * (0.28 + 0.72 * np.sin(np.pi * t ** 0.75)) if i < 9 else 0.3 * w
                    left.append((cx - hw, cy))
                    right.append((cx + hw, cy))
                poly = left + right[::-1]
                for sh in ((0, -W, W) if wrap else (0,)):
                    if sh == 0 or (min(q[0] for q in poly) + sh < W and max(q[0] for q in poly) + sh > 0):
                        polys.append([(x + sh, y) for x, y in poly])
        M = polymask(H, W, polys, 3)
        lit, shd = emboss(M, 1)
        img = shade(img, 1 - 0.55 * blur(shift(M, 3, 2), 1.6) * (1 - M))
        c = mix(WEED_D, [WEED_M, WEED_M, WEED_L][li], [0.3, 0.7, 0.9][li] * (0.5 + 0.5 * stretch(fbm(H, W, max(2, H / 30), max(2, W / 30), seed + li, 2, tile_x=wrap))))
        img = mix(img, c, M)
        img = mix(img, WEED_HI, 0.5 * lit * M * (0.35 + 0.3 * li))
        img = shade(img, 1 - 0.4 * shd * M)
    return img


def tide(img, Yf, seed, wrap=True, n=60, ppm=PPM):
    """Everything the sea does to the lowest metre and a half of stone: wet dark, a film of algae, barnacles, weed."""
    H, W = img.shape[:2]
    nz = stretch(fbm(H, W, H / 60, W / 60, seed, 3, tile_x=wrap))
    img = mix(img, WET, 0.78 * smooth(0.5 - Yf + 0.2 * (nz - 0.5), 0, 0.5))
    g = np.clip(1 - Yf / 1.6, 0, 1) ** 0.8 * (0.5 + 0.5 * nz)
    img = mix(img, ALGAE, 0.62 * g * smooth(1.62 - Yf - 0.35 * nz, 0, 0.12))
    cl = smooth(stretch(fbm(H, W, H / 34, W / 34, seed + 1, 2, tile_x=wrap)), 0.58, 0.72) * smooth(Yf, 0.10, 0.22) * (1 - smooth(Yf, 0.95, 1.25))
    dots = smooth(speckle(H, W, seed + 2, 0.035, (1.5, 1.5), tile_x=wrap), 0.30, 0.48) * cl
    lit, shd = emboss(dots, 1, wrap_x=wrap)
    img = shade(img, 1 - 0.5 * shd * (1 - dots))
    img = mix(img, BARN, 0.92 * dots)
    img = shade(img, 1 - 0.25 * smooth(dots, 0.85, 1.0))                                              # each barnacle's mouth
    return weeds(img, H, W, seed + 3, n, wrap=wrap, ppm=ppm)


def stains(img, Yf, seed, top, wrap=True, lichen=True):
    """Rain streaks under whatever juts out at height `top`, and lichen where the sea does not reach."""
    H, W = img.shape[:2]
    run = strokes(H, W, seed, 'y', 3, 64, tile_x=wrap)
    img = shade(img, 1 - 0.26 * smooth(run, 0.45, 0.9) * smooth(Yf, top - 1.6, top))
    if lichen:
        n1 = stretch(fbm(H, W, H / 13, W / 13, seed + 1, 3, tile_x=wrap))
        n2 = stretch(fbm(H, W, H / 10, W / 10, seed + 2, 3, tile_x=wrap))
        high = smooth(Yf, 1.3, 1.8)
        where = smooth(stretch(fbm(H, W, max(2, H / 120), max(2, W / 120), seed + 3, 2, tile_x=wrap)), 0.45, 0.75)
        img = mix(img, LICHEN_O, 0.48 * smooth(n1, 0.84, 0.90) * high * where)
        img = mix(img, LICHEN_P, 0.40 * smooth(n2, 0.84, 0.90) * high * (1 - where))
    return img


def wall():
    H, W = A.size('wall')
    img, f = masonry(H, W, PPM, 200, corners=[0, 512, 1024, 1536, 2048], tile_x=True)
    y = (H - np.arange(H) - 0.5) / PPM
    Yf = y[:, None] * np.ones((1, W))
    SX = (((np.arange(W) + 0.5) / PPM) % 3.2 - 1.6)[None, :] * np.ones((H, 1))
    img = mix(img, hexc('#C2BBA9'), 0.20 * smooth(0.10 - (1.6 - np.abs(SX)), 0, 0.10) * (1 - f['j']))    # worn, paler quoins at the corners
    img = dress(img, SX, Yf, 210)
    img = stains(img, Yf, 220, Yd['top'])
    img = shade(img, 1 - 0.22 * smooth(run_under(H, W, 221), 0.4, 0.9) * smooth(Yf, 0.9, Yd['string'][0]) * (Yf < Yd['string'][0]))
    # moss in the joints low down, shadow under the string course and the cornice, the wall a little darker toward the sea
    img = mix(img, hexc('#5E7040'), 0.5 * f['j'] * smooth(2.6 - Yf, 0, 1.6))
    img = shade(img, 1 - 0.34 * np.exp(-((Yd['string'][0] - Yf) / 0.09) ** 2) * (Yf < Yd['string'][0]))
    img = shade(img, 1 - 0.42 * np.exp(-((Yd['top'] - Yf) / 0.10) ** 2))
    img = shade(img, 0.90 + 0.10 * smooth(Yf, 0.5, 3.5))
    cracks = [[(300, 20), (310, 70), (296, 120), (318, 170), (312, 230)], [(1210, 10), (1196, 60), (1215, 110), (1204, 175)], [(1740, 300), (1752, 350), (1738, 400), (1760, 470), (1750, 520)],
              [(820, 330), (806, 380), (824, 440)]]
    cm = linemask(H, W, cracks, 1.6)
    img = shade(img, 1 - 0.7 * cm)
    img = mix(img, hexc('#CFC8B8'), 0.35 * shift(cm, 1, 1) * (1 - cm))
    img = tide(img, Yf, 230)
    return paintify(img, 3, wrap_x=True)


def run_under(H, W, seed):
    return strokes(H, W, seed, 'y', 4, 80, tile_x=True)


def deepen(img, depth, seed, wrap=True):
    """Stone under water: at the surface the wet dark of the waterline, then green going to dark blue-green with
    depth (0 at the surface, 1 at the foot)."""
    H, W = img.shape[:2]
    g = img.mean(-1, keepdims=True)
    deep = mix(img, g * hexc('#7FA090') * 1.25, 0.85)
    deep = mix(deep * 0.75, mix(DEEP_T, DEEP_B, depth), 0.45 + 0.4 * depth)
    deep = mix(deep, WEED_D, 0.5 * smooth(stretch(fbm(H, W, max(2, H / 30), max(2, W / 40), seed, 3, tile_x=wrap)), 0.55, 0.8))
    top = mix(mix(img, WET, 0.78), ALGAE, 0.3)
    return mix(top, deep, smooth(depth, 0.0, 0.22))


def under():
    H, W = A.size('under')
    big, _ = masonry(480, W, PPM, 300, corners=[0, 512, 1024, 1536, 2048], tile_x=True)
    big = weeds(big, 480, W, 301, 110, yr=(0.2, 3.0), deep=True)
    img = ndi.zoom(big, (H / 480, 1, 1), order=1)
    depth = ((np.arange(H)[:, None] + 0.5) / H) * np.ones((1, W))
    return deepen(img, depth, 302)


def band(name, seed, underside, front, top=None):
    """A moulded course: v 0..0.25 its underside, 0.25..0.8 its face, 0.8..1 the weathered slope on top."""
    H, W = A.size(name)
    img, f = masonry(H, W, PPM, seed, course=(1.0, 1.0), block=(0.6, 1.1), corners=[0, 512, 1024, 1536, 2048], quoin=(0.5, 0.8), stones=('#B2AB9B', '#A8A294', '#BAB3A2', '#A39E94'), warp=1.0, lit=0.0, shd=0.0, chip=0.0, rnd=1.0, tile_x=True)
    v = 1 - (np.arange(H)[:, None] + 0.5) / H
    k = np.where(v < 0.25, underside[0] + (underside[1] - underside[0]) * v / 0.25, np.where(v < 0.8, front, top or front))
    img = shade(img, k * np.ones((1, W)))
    img = mix(img, hexc('#E2DCCB'), 0.55 * np.exp(-((v - 0.78) / 0.04) ** 2) * np.ones((1, W)))            # the upper arris
    img = shade(img, 1 - 0.30 * np.exp(-((v - 0.26) / 0.03) ** 2) * np.ones((1, W)))
    n = stretch(fbm(H, W, 2, W / 20, seed + 5, 3, tile_x=True))
    img = mix(img, LICHEN_O, 0.45 * smooth(n, 0.86, 0.92) * (v > 0.3))
    img = mix(img, hexc('#E9E6DA'), 0.6 * smooth(stretch(fbm(H, W, 2, W / 12, seed + 6, 2, tile_x=True)), 0.86, 0.92) * (v > 0.55))   # droppings
    img = shade(img, 1 - 0.22 * smooth(strokes(H, W, seed + 7, 'y', 2, 70, tile_x=True), 0.5, 0.9) * (v < 0.8))
    return img


def inner(k):
    H, W = A.size('inner0')
    img, f = masonry(H, W, PPM, 400 + k)
    rr, cc = rows_cols(H, W)
    Yf = (Yd['floor'] + (1 - rr) * (Yd['eaves'] - Yd['floor'])) * np.ones((1, W))
    SX = ((0.5 - cc) * 2 * L['AI']) * np.ones((H, 1))
    img = dress(img, SX, Yf, 410 + k, ring=False)
    d = opening(SX, Yf)
    img = mix(img, hexc('#C9C2B2'), 0.4 * np.exp(-(np.clip(d, 0, 9) / 0.012) ** 2) * (d >= 0))
    img = mix(img, hexc('#3A3C48'), 0.42)                                                     # the room is in shade
    img = shade(img, 0.62 + 0.38 * smooth(Yd['eaves'] - Yf, 0, 1.3))                           # darker under the roof
    edge = np.minimum(cc, 1 - cc) * W
    img = shade(img, 1 - 0.35 * np.exp(-(edge / 14) ** 2) * np.ones((H, 1)))
    img = shade(img, 1 - 0.30 * np.exp(-((Yf - Yd['floor']) / 0.10) ** 2))
    run = strokes(H, W, 420 + k, 'y', 3, 30)
    img = mix(img, hexc('#D9D6CA'), 0.16 * smooth(run, 0.90, 0.98) * smooth(Yf, 2.3, 3.3))
    return paintify(img, 3)


def reveal():
    H, W = A.size('reveal')
    img, f = masonry(H, W, PPM, 500, course=(0.6, 0.6), block=(0.22, 0.30), stones=('#B2AB9B', '#A8A294', '#BAB3A2'), chip=0.1, rnd=3.0, warp=1.2)
    rr, cc = rows_cols(H, W)
    jamb = (Yd['spring'] - Yd['sill']) / L['revealLen']
    k = np.where((cc < jamb) | (cc > 1 - jamb), 0.92, 0.70 + 0.12 * np.abs(cc - 0.5) / (0.5 - jamb))      # the soffit is in shade
    img = shade(img, k * np.ones((H, 1)))
    img = shade(img, 0.72 + 0.28 * (1 - rr) * np.ones((1, W)))                                             # lighter toward the outside
    img = mix(img, hexc('#5E7040'), 0.4 * f['j'])
    return img


def sill():
    H, W = A.size('sill')
    img, f = masonry(H, W, PPM, 510, course=(0.6, 0.6), block=(0.6, 0.8), stones=('#BDB6A5', '#B3AC9C'), chip=0.0, rnd=3.0, warp=1.0)
    rr, cc = rows_cols(H, W)
    img = mix(img, hexc('#6F8F4E'), 0.55 * smooth(stretch(fbm(H, W, 3, 8, 511, 3)), 0.6, 0.8) * smooth(0.5 - rr, 0, 0.5))    # moss toward the room
    img = mix(img, hexc('#E4E1D4'), 0.6 * smooth(stretch(fbm(H, W, 8, 20, 512, 2)), 0.90, 0.95))                           # droppings
    return shade(img, 0.92)


def floor():
    H, W = A.size('floor')
    img, f = masonry(H, W, W / (2 * L['AI']), 520, course=(0.42, 0.6), block=(0.5, 0.95), stones=('#7C7A76', '#86827A', '#74767A'), chip=0.3, lit=0.16, shd=0.2)
    rr, cc = rows_cols(H, W)
    edge = np.minimum(np.minimum(rr, 1 - rr) * H * np.ones((1, W)), np.minimum(cc, 1 - cc) * W * np.ones((H, 1)))
    img = shade(img, 0.62 + 0.38 * smooth(edge, 0, 44))
    img = mix(img, hexc('#2E3230'), 0.5 * smooth(stretch(fbm(H, W, 4, 4, 521, 3)), 0.55, 0.8))             # damp
    img = mix(img, hexc('#DAD7CA'), 0.7 * smooth(speckle(H, W, 522, 0.0012, (2.4, 2.4)), 0.3, 0.6) * smooth(100 - np.hypot((cc - 0.56) * W, (rr - 0.5) * H), 0, 45))
    img = mix(img, hexc('#5E7040'), 0.45 * f['j'])
    return paintify(shade(img, 0.8), 3)


BPPM = 372 / 2.52                       # the buttress patch: side | front | side unrolled, 2.52 m across
BCOR = [0, int(round(0.95 * BPPM)), int(round(1.57 * BPPM)), 372]


def butt():
    H, W = A.size('butt')
    img, f = masonry(H, W, BPPM, 530, corners=BCOR, quoin=(0.34, 0.24), block=(0.3, 0.5))
    Yf = ((H - np.arange(H) - 0.5) / BPPM)[:, None] * np.ones((1, W))
    img = stains(img, Yf, 531, 1.8, wrap=False, lichen=False)
    img = mix(img, hexc('#5E7040'), 0.5 * f['j'] * smooth(2.6 - Yf, 0, 1.6))
    cc = (np.arange(W)[None, :] + 0.5)
    img = shade(img, np.where(cc < BCOR[1], 0.90, np.where(cc < BCOR[2], 1.0, 0.84)) * np.ones((H, 1)))
    img = tide(img, Yf, 532, wrap=False, n=12, ppm=BPPM)
    return paintify(img, 3)


def butt_low():
    H, W = A.size('buttLow')
    hb = int(round(3.0 * BPPM))
    big, _ = masonry(hb, 372, BPPM, 540, corners=BCOR, quoin=(0.34, 0.24), block=(0.3, 0.5))
    big = weeds(big, hb, 372, 541, 20, yr=(0.2, 3.0), wrap=False, deep=True, ppm=BPPM)
    img = ndi.zoom(big, (H / hb, W / 372, 1), order=1)
    return deepen(img, ((np.arange(H)[:, None] + 0.5) / H) * np.ones((1, W)), 542, wrap=False)


def weathering():
    """The sloping top of a buttress stage: a slab in the tide's reach, green and weedy."""
    H, W = A.size('slope')
    img, f = masonry(H, W, PPM, 550, course=(0.5, 0.5), block=(0.5, 0.7), stones=('#A8A294', '#9C988C', '#B0A999'), chip=0.2, rnd=3.0)
    n = stretch(fbm(H, W, 3, 4, 551, 3))
    img = mix(img, ALGAE, 0.40 + 0.30 * n)
    img = mix(img, WET, 0.45 * smooth(n, 0.3, 0.8))
    img = mix(img, BARN, 0.8 * smooth(speckle(H, W, 552, 0.02, (1.5, 1.5)), 0.35, 0.5) * smooth(n, 0.5, 0.7))
    return shade(img, 1.0)


def slab(name, seed, k=1.0, moss=0.5):
    H, W = A.size(name)
    img, f = masonry(H, W, PPM, seed, course=(0.5, 0.5), block=(0.5, 0.7), stones=('#B0A999', '#A6A092', '#B8B1A0'), chip=0.2, rnd=3.0)
    rr, cc = rows_cols(H, W)
    img = mix(img, hexc('#6F8F4E'), moss * smooth(stretch(fbm(H, W, 3, 4, seed + 1, 3)), 0.55, 0.8) * smooth(0.6 - rr, 0, 0.6))
    img = mix(img, LICHEN_O, 0.5 * smooth(stretch(fbm(H, W, 5, 6, seed + 2, 3)), 0.8, 0.88))
    return shade(img, k)


def roof(k):
    H, W = A.size('roof0')
    ppm = W / (2 * L['E'])
    img, f = masonry(H, W, ppm, 600 + k, course=(0.20, 0.22), block=(0.24, 0.29), stones=SLATES, mortar='#22262C', joint=1.1, warp=1.0, bevel=2.2,
                     lit=-0.32, shd=-0.20, chip=0.35, rnd=1.5, tone=(0.82, 1.14))
    rr, cc = rows_cols(H, W)
    rs = np.random.default_rng(610 + k)
    ids = f['id']
    gone = np.isin(ids, rs.choice(np.arange(1, ids.max() + 1), size=int(ids.max() * 0.06), replace=False))
    lath = mix(hexc('#2A2320'), hexc('#6C5642'), smooth(np.sin(rr * H / 14.7 * 2 * np.pi), 0.55, 0.8) * np.ones((1, W)))
    img = mix(img, lath, gone * (1 - f['j']))
    img = shade(img, 1 - 0.5 * gone * np.exp(-(f['e'] / 3.0) ** 2))
    low = smooth(rr, 0.35, 1.0)
    n1 = stretch(fbm(H, W, 5, 8, 620 + k, 3))
    img = mix(img, hexc('#6F8F4E'), 0.70 * smooth(n1 * (0.72 + 0.34 * low * np.ones((1, W))), 0.80, 0.87) * (1 - gone))
    img = mix(img, LICHEN_P, 0.42 * smooth(stretch(fbm(H, W, 30, 48, 630 + k, 2)), 0.93, 0.96) * (1 - gone))
    img = mix(img, LICHEN_O, 0.45 * smooth(stretch(fbm(H, W, 26, 42, 640 + k, 2)), 0.95, 0.975) * (1 - gone))
    img = shade(img, 1 - 0.20 * smooth(strokes(H, W, 650 + k, 'y', 3, 60), 0.5, 0.9))
    half = 0.5 * rr                                                    # the face is a triangle with its apex at the top
    d = (half - np.abs(cc - 0.5)) * W
    img = mix(img, hexc('#6C757D'), smooth(9 - d, 0, 2) * np.ones((H, 1)))
    img = shade(img, [1.0, 0.92, 0.86, 0.95][k] * (0.92 + 0.10 * (1 - rr)) * np.ones((1, W)))
    return paintify(img, 3)


def roof_under():
    H, W = A.size('roofUnder')
    rr, cc = rows_cols(H, W)
    img = mix(hexc('#241F1C'), hexc('#44382C'), stretch(fbm(H, W, 20, 4, 700, 3)) * 0.8) * np.ones((H, W, 3))
    img = shade(img, 1 - 0.3 * smooth(np.sin(rr * 16 * 2 * np.pi), 0.8, 1.0) * np.ones((1, W)))
    for x in L['rafters']:
        for sg in (-1, 1):
            c = 0.5 + sg * x / (2 * L['E'])
            bar = np.exp(-(((cc - c) * W) / 3.2) ** 2) * np.ones((H, 1))
            img = mix(img, hexc('#77614A'), 0.9 * bar)
    return img


def bell():
    H, W = A.size('bell')
    prof = np.array(L['bell'])
    tot = np.hypot(np.diff(prof[:, 0]), np.diff(prof[:, 1])).sum()
    v = 1 - (np.arange(H) + 0.5) / H
    y = np.interp(v, prof[:, 2], prof[:, 1])
    r = np.interp(v, prof[:, 2], prof[:, 0])
    vv = np.linspace(0, 1, 400)
    ny = np.interp(v, vv, np.clip(-np.gradient(np.interp(vv, prof[:, 2], prof[:, 0]), vv) / tot, -1, 1))
    Yf = y[:, None] * np.ones((1, W))
    n = stretch(fbm(H, W, 5, 12, 800, 4, tile_x=True))
    img = mix(BRONZE, BRONZE_L, 0.55 * n)
    img = mix(img, BRONZE_D, 0.5 * smooth(stretch(fbm(H, W, 9, 20, 801, 3, tile_x=True)), 0.5, 0.85))
    img = shade(img, 0.93 + 0.1 * strokes(H, W, 802, 'x', 8, 90, tile_x=True))
    # moulding wires: raised lines round the bell, lit above and shaded below; a band of worn letters under the shoulder
    for yy in (-0.925, -0.83, -0.80, -0.40, -0.37, -0.30):
        img = mix(img, BRONZE_HI, 0.75 * np.exp(-((Yf - yy - 0.004) / 0.004) ** 2))
        img = shade(img, 1 - 0.5 * np.exp(-((Yf - yy + 0.006) / 0.005) ** 2))
    rs = np.random.default_rng(803)
    xs = np.arange(W)[None, :]
    letters = np.zeros((H, W))
    x = 6.0
    while x < W - 10:
        wd = rs.uniform(5, 9)
        box = (xs > x) & (xs < x + wd) & (Yf > -0.362) & (Yf < -0.308)
        cut = rs.random() < 0.5
        letters += box * (1 - 0.8 * ((xs > x + 2) & (xs < x + wd - 2) & ((Yf > -0.345) if cut else (Yf < -0.325))))
        x += wd + rs.uniform(3, 6) + (14 if rs.random() < 0.15 else 0)
    letters = blur(np.clip(letters, 0, 1), 0.6, wrap_x=True)
    img = mix(img, BRONZE_HI, 0.6 * letters)
    # verdigris: runs from the shoulder, pooled under the wires and round the lip, patches everywhere
    run = strokes(H, W, 810, 'y', 4, 60, tile_x=True)
    pat = stretch(fbm(H, W, 6, 14, 811, 4, tile_x=True))
    top = smooth(Yf, -0.75, -0.22)
    vmask = smooth(run * (0.45 + 0.55 * top) + 0.55 * pat, 0.62, 0.84)
    vmask = np.maximum(vmask, 0.8 * smooth(pat, 0.45, 0.75) * np.exp(-((Yf + 0.90) / 0.05) ** 2))
    for yy in (-0.83, -0.80, -0.40, -0.37, -0.30):
        vmask = np.maximum(vmask, 0.85 * np.exp(-((Yf - yy + 0.012) / 0.006) ** 2) * smooth(pat, 0.25, 0.6))
    vmask = np.maximum(vmask, 0.8 * letters * smooth(pat, 0.3, 0.6) * 0)
    vcol = mix(VERD, VERD_L, stretch(fbm(H, W, 12, 30, 812, 3, tile_x=True)) * 0.8)
    vcol = mix(vcol, VERD_D, 0.6 * smooth(stretch(fbm(H, W, 7, 16, 813, 3, tile_x=True)), 0.55, 0.9))
    lit, shd = emboss(vmask, 1, wrap_x=True)
    img = mix(img, vcol, 0.92 * vmask)
    img = shade(img, 1 - 0.3 * shd)
    # the crown is dark and dirty, white runs of droppings from the top, the lip worn bright
    img = mix(img, BRONZE_D, 0.6 * smooth(Yf, -0.20, -0.16))
    img = mix(img, hexc('#E4E2D6'), 0.7 * smooth(strokes(H, W, 820, 'y', 3, 26, tile_x=True), 0.88, 0.97) * smooth(Yf, -0.6, -0.2))
    img = mix(img, BRONZE_HI, 0.5 * np.exp(-((Yf + 0.972) / 0.012) ** 2) * (1 - 0.6 * vmask))
    img = shade(img, (0.80 + 0.26 * ny)[:, None])
    return paintify(img, 3, wrap_x=True)


def bell_in():
    H, W = A.size('bellIn')
    rr, cc = rows_cols(H, W)
    v = 1 - rr
    img = mix(hexc('#1C2220'), hexc('#4B6A5C'), (0.15 + 0.85 * v ** 2) * np.ones((1, W)) * (0.7 + 0.3 * stretch(fbm(H, W, 4, 8, 830, 3, tile_x=True))))
    return mix(img, BRONZE_D, 0.4 * smooth(stretch(fbm(H, W, 5, 10, 831, 3, tile_x=True)), 0.5, 0.8))


def iron(name, seed, worn=None):
    H, W = A.size(name)
    rr, cc = rows_cols(H, W)
    img = mix(IRON, IRON_L, 0.6 * stretch(fbm(H, W, max(2, H / 16), max(2, W / 16), seed, 3)))
    img = mix(img, RUST, 0.8 * smooth(stretch(fbm(H, W, max(2, H / 10), max(2, W / 10), seed + 1, 3)), 0.45, 0.8))
    img = mix(img, hexc('#C07A3A'), 0.5 * smooth(stretch(fbm(H, W, max(2, H / 6), max(2, W / 6), seed + 2, 2)), 0.78, 0.9))
    if worn:
        img = mix(img, hexc('#7A766E'), 0.7 * smooth(1 - rr, worn[0], worn[0] + 0.05) * (1 - smooth(1 - rr, worn[1], worn[1] + 0.05)) * np.ones((1, W)))
    return img


def wood():
    H, W = A.size('wood')
    rr, cc = rows_cols(H, W)
    g = strokes(H, W, 840, 'x', 5, 150)
    img = mix(OAK, OAK_D, 0.25 + 0.6 * g)
    img = mix(img, OAK_L, 0.4 * stretch(fbm(H, W, 3, 10, 841, 3)))
    bnd = np.floor(rr * 4)
    img = shade(img, np.choose(bnd.astype(int).clip(0, 3), [0.72, 0.86, 1.08, 0.92]) * np.ones((1, W)))        # band 3 (rows at the top) is the upper face
    img = shade(img, 1 - 0.55 * smooth(strokes(H, W, 842, 'x', 3, 200), 0.86, 0.95))                           # checks along the grain
    img = shade(img, 1 - 0.35 * np.exp(-(((rr * 4) % 1 - 0.5) / 0.5 * 8 - 7.2).clip(-9, 9) ** 2) * np.ones((1, W)))
    return img


def hip():
    H, W = A.size('hip')
    rr, cc = rows_cols(H, W)
    img = mix(hexc('#5C656D'), hexc('#8A939A'), stretch(fbm(H, W, 2, 20, 850, 3, tile_x=True)))
    img = mix(img, hexc('#C9CFD2'), 0.5 * smooth(stretch(fbm(H, W, 3, 30, 851, 2, tile_x=True)), 0.75, 0.9))
    return shade(img, 1 - 0.3 * smooth(np.sin(cc * 14 * 2 * np.pi), 0.92, 1.0) * np.ones((H, 1)))


def headstock():
    H, W = A.size('headstock')
    rr, cc = rows_cols(H, W)
    g = strokes(H, W, 860, 'x', 5, 160)
    img = mix(hexc('#5E4834'), hexc('#33271D'), 0.2 + 0.65 * g)
    img = mix(img, hexc('#80664A'), 0.35 * stretch(fbm(H, W, 3, 8, 861, 3)))
    bnd = np.floor(rr * 4).astype(int).clip(0, 3)
    img = shade(img, np.choose(bnd, [0.70, 0.95, 1.10, 0.95]) * np.ones((1, W)))                              # rows from the top: underside, a side, the top, the other side
    for c in (0.14, 0.38, 0.62, 0.86):
        strap = smooth(0.022 - np.abs(cc - c), 0, 0.004) * np.ones((H, 1))
        ir = iron('headstock', 870)
        img = mix(img, ir, strap)
        img = shade(img, 1 - 0.4 * np.exp(-(((np.abs(cc - c) - 0.026) * W) / 2.0) ** 2) * np.ones((H, 1)))
        for b in range(4):
            bolt = np.exp(-(np.hypot((cc - c) * W, (rr - (b + 0.5) / 4) * H) / 2.6) ** 2)
            img = mix(img, hexc('#8E8A82'), 0.9 * bolt)
    return img


def head_end():
    H, W = A.size('headEnd')
    rr, cc = rows_cols(H, W)
    d = np.hypot(cc - 0.45, rr - 0.55)
    img = mix(hexc('#6A533C'), hexc('#3B2D21'), 0.5 + 0.5 * np.sin(d * 70 + 4 * fbm(H, W, 3, 3, 880, 2))) * np.ones((H, W, 3))
    return shade(img, 0.9)


def frond():
    H, W = A.size('frond')
    rr, cc = rows_cols(H, W)
    img = mix(WEED_D, WEED_M, stretch(fbm(H, W, 10, 4, 890, 3))) * np.ones((H, W, 3))
    img = mix(img, WEED_L, 0.55 * np.exp(-(((cc - 0.5) * W) / 6.0) ** 2) * np.ones((H, 1)))               # the midrib
    img = mix(img, WEED_D, 0.6 * smooth(np.abs(cc - 0.5), 0.3, 0.5) * np.ones((H, 1)))
    img = mix(img, WEED_HI, 0.55 * smooth(speckle(H, W, 891, 0.005, (2.4, 2.4)), 0.35, 0.6))               # bladders
    return shade(img, 0.8 + 0.3 * rr * np.ones((1, W)))                                                    # darker at the root (the top row)


def barnacle():
    H, W = A.size('barnacle')
    rr, cc = rows_cols(H, W)
    d = np.hypot((cc - 0.5) * 2, (rr - 0.5) * 2)
    a = np.arctan2(rr - 0.5, cc - 0.5)
    img = mix(hexc('#E2DDCB'), hexc('#A9A592'), 0.5 + 0.5 * np.sin(a * 9)) * np.ones((H, W, 3))
    img = mix(img, hexc('#8E8C7C'), smooth(d, 0.5, 1.2)[..., None] if False else smooth(d, 0.5, 1.2))
    return mix(img, hexc('#2A2B28'), smooth(0.28 - d, 0, 0.1))


def slate_edge():
    H, W = A.size('slate')
    rr, cc = rows_cols(H, W)
    img = mix(hexc('#3F4852'), hexc('#59646E'), stretch(fbm(H, W, 3, 8, 900, 3))) * np.ones((H, W, 3))
    return shade(img, 1 - 0.4 * smooth(np.sin(cc * 13 * 2 * np.pi), 0.9, 1.0) * np.ones((H, 1)))


A.paste('wall', wall())
A.paste('under', under())
A.paste('string', band('string', 310, (0.50, 0.62), 0.98, 1.10))
A.paste('cornice', band('cornice', 320, (0.48, 0.74), 1.0))
for k in range(4):
    A.paste('inner%d' % k, inner(k))
    A.paste('roof%d' % k, roof(k))
A.paste('floor', floor())
A.paste('butt', butt())
A.paste('buttLow', butt_low())
A.paste('slope', weathering())
A.paste('wallTop', slab('wallTop', 560, 0.5, 0.2))
A.paste('reveal', reveal())
A.paste('sill', sill())
A.paste('roofUnder', roof_under())
A.paste('bell', bell())
A.paste('bellIn', bell_in())
A.paste('clapper', iron('clapper', 910, worn=(0.72, 0.90)))
A.paste('iron', iron('iron', 920))
A.paste('wood', wood())
A.paste('hip', hip())
A.paste('headstock', headstock())
A.paste('headEnd', head_end())
A.paste('frond', frond())
A.paste('barnacle', barnacle())
A.paste('slate', slate_edge())
print(A.save(out))
