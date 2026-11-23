"""reachmats.py : painted materials for Saltbone Reach (mats.py takes them into its table): weathered bone, limpets,
a gull's nest and its eggs, a cushion of sea-thrift.

Bone is painted by place, not by patch: paint_spec hands it `geo`, where every pixel of the patch lies on the model
(geomap.mjs writes that map from the builder), and the paint is noise in space, so it does not stretch where a patch
is wide for the bone it wraps, has no seam where two patches meet, is green where the bone stands in the sea and
carries its lichen high up, however the patch is laid out. Needs paintkit.py beside it.
"""
import numpy as np
from scipy.stats import norm
from paintkit import hexc, mix, smooth, fbm, stretch, shade, strokes, speckle


# ------------------------------------------------------------------------------------------------ noise in space
def noise3(P, cell, seed):
    """Smooth value noise 0..1 at points P (..., 3) in metres; cell = the size of a lattice cell (a number or (x, y, z))."""
    T = np.random.default_rng(seed).random((32, 32, 32))
    Q = P / (np.asarray(cell, float) * np.ones(3)) + 512.0 + 3.7 * (seed % 11)
    i = np.floor(Q).astype(int)
    f = Q - i
    f = f * f * (3 - 2 * f)
    a, b = i % 32, (i + 1) % 32
    out = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                out = out + w * T[(b if dx else a)[..., 0], (b if dy else a)[..., 1], (b if dz else a)[..., 2]]
    return out


def fbm3(P, cell, seed, octaves=3, gain=0.5):
    """Layered noise in space, spread over 0..1 by a fixed rule (not by the patch's own spread, as paintkit.stretch
    does): two patches of one model then meet without a seam. About 2 % of it is cut off at either end."""
    cell = np.asarray(cell, float) * np.ones(3)
    out, amp, tot, sq = 0.0, 1.0, 0.0, 0.0
    for k in range(octaves):
        out = out + amp * noise3(P, cell, seed + 31 * k)
        tot += amp
        sq += amp * amp
        amp *= gain
        cell = cell / 2
    return np.clip(0.5 + (out / tot - 0.5) / (4.0 * 0.1855 * np.sqrt(sq) / tot), 0, 1)


def level(amount):
    """The level above which fbm3 lies over about `amount` of a surface."""
    return float(np.clip(0.5 + 0.25 * norm.ppf(1 - amount), 0.02, 0.98))


def flatgeo(H, W, ppm=64.0, at=(0.0, 6.0, 0.0)):
    """A patch nobody mapped: a flat board facing +Z, its bottom left corner at `at`."""
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    xx = (np.arange(W)[None, :] + 0.5) / W * np.ones((H, 1))
    pos = np.stack([at[0] + xx * W / ppm, at[1] + (1 - yy) * H / ppm, at[2] + 0 * xx], -1)
    return dict(pos=pos, nrm=np.stack([0 * xx, 0 * xx, 1 + 0 * xx], -1), on=np.ones((H, W), bool))


def unbend(P, axis):
    """Points beside a bent bone, as they would lie if its middle line `axis` ([[x, y, z], ...]) were pulled straight
    up the y axis: (across, along, across). Cracks and grain painted in these run along the bone."""
    A = np.asarray(axis, float)
    seg = A[1:] - A[:-1]
    L = np.linalg.norm(seg, axis=1)
    T = seg / L[:, None]
    s0 = np.concatenate([[0], np.cumsum(L)])
    n = np.cross(T[0], [0, 0, 1.0])                                   # a frame carried along the line without twisting
    if np.linalg.norm(n) < 0.3:
        n = np.cross(T[0], [1.0, 0, 0])
    frames = []
    for t in T:
        n = n - t * np.dot(n, t)
        n = n / np.linalg.norm(n)
        frames.append((n, np.cross(t, n)))
    best = np.full(P.shape[:-1], 1e18)
    out = np.zeros(P.shape)
    for k in range(len(seg)):
        d = P - A[k]
        along = np.clip(d @ T[k], 0 if k else -1e9, L[k] if k < len(seg) - 1 else 1e9)
        r = d - along[..., None] * T[k]
        dist = (r * r).sum(-1)
        take = dist < best
        best = np.where(take, dist, best)
        q = np.stack([r @ frames[k][0], s0[k] + along, r @ frames[k][1]], -1)
        out = np.where(take[..., None], q, out)
    return out


# ------------------------------------------------------------------------------------------------ bone
CREAM, WARM, GREY, WHITE, GRIME = hexc('#E9DEC3'), hexc('#D6C296'), hexc('#C4BFAE'), hexc('#F7F0DE'), hexc('#A3977B')
CRACK, PIT, MARROW, HOLE = hexc('#5E5444'), hexc('#85785F'), hexc('#B49E78'), hexc('#5F4F3A')
LICHEN, LICHEN_L, LICHEN_R, CRUST = hexc('#DB8A2A'), hexc('#F1B646'), hexc('#E6CB7C'), hexc('#B4BC9A')
FILM, SEA, DEEP, WEED, WEED_L, SHELL, SHELL_D = hexc('#7F9272'), hexc('#5B7059'), hexc('#2F433C'), hexc('#3B472E'), hexc('#6C6636'), hexc('#D8D2BC'), hexc('#7E7862')


def bone(H, W, seed=0, geo=None, axis=None, tide=None, lichen=None, raw=0.0, end=None, cracks=1.0, pits=1.0, ppm=64.0, at=(0.0, 6.0, 0.0), **_):
    """Old bone left out in the weather: cream, stained and bleached, cracked along its length and pitted.
    axis    the bone's middle line [[x, y, z], ...]: cracks run along it (without one they run up and down)
    tide    {"top": m, "limpets": n}: the bone stands in the sea at y = 0: dark green below, a grey-green film with
            weed, barnacles and n limpets up to about `top` metres
    lichen  {"lo": m, "hi": m, "amount": 0..1}: orange lichen in dabs, none below lo and all of `amount` above hi
    raw     0..1: a broken face, darker and full of holes
    end     {"c": [x, z], "r": m}: the flat end of a drum of bone about that upright line: rings, and a spongy middle"""
    g = geo or flatgeo(H, W, ppm, at)
    P, N = g['pos'], g['nrm']
    Y, up = P[..., 1], N[..., 1]
    Q = unbend(P, axis) if axis else P
    big, mid = fbm3(P, 1.7, seed, 3), fbm3(P, 0.42, seed + 1, 3)
    img = mix(CREAM, WARM, 0.60 * smooth(big, 0.40, 0.92))
    img = mix(img, GREY, 0.55 * smooth(1 - big, 0.50, 0.95) * (0.4 + 0.6 * mid))
    img = shade(img, 0.92 + 0.13 * mid)
    run = fbm3(P, (0.20, 2.4, 0.20), seed + 2, 3)                      # what the rain has run down the upright faces
    steep = smooth(1 - np.abs(up), 0.25, 0.8)
    img = mix(img, GRIME, 0.34 * smooth(run, 0.58, 0.92) * steep)
    img = mix(img, WHITE, 0.30 * smooth(1 - run, 0.60, 0.95) * steep)
    img = mix(img, WHITE, 0.42 * smooth(up, 0.15, 0.9))                 # bleached where it looks at the sky
    img = mix(img, GRIME, 0.50 * smooth(-up, 0.05, 0.85))               # and dull underneath
    grain = fbm3(Q, (0.07, 1.6, 0.07), seed + 3, 2)                     # a fine grain along the bone
    img = shade(img, 0.95 + 0.09 * grain)

    if end:                                                             # the end of a drum: growth rings, a spongy middle
        rr = np.hypot(P[..., 0] - end['c'][0], P[..., 2] - end['c'][1]) / end['r']
        flat = smooth(np.abs(up), 0.55, 0.85)
        ring = 0.5 + 0.5 * np.sin(2 * np.pi * (rr * 5.5 + 0.9 * fbm3(P, 0.5, seed + 4, 2)))
        img = shade(img, 1 - 0.16 * flat * smooth(ring, 0.55, 0.95) * smooth(rr, 0.25, 0.5))
        raw = np.maximum(raw, 0.85 * flat * (1 - smooth(rr + 0.12 * (mid - 0.5), 0.34, 0.46)))
    raw = np.asarray(raw, float) * np.ones((H, W))
    if raw.max() > 0:                                                   # broken bone: darker, a sponge of holes
        holes = smooth(noise3(P, 0.03, seed + 5) + 0.2 * noise3(P, 0.015, seed + 6), 0.64, 0.76)
        sponge = mix(mix(MARROW, WARM, 0.45 * mid), HOLE, 0.62 * holes)
        sponge = shade(sponge, 0.86 + 0.2 * fbm3(P, 0.3, seed + 6, 2))
        img = mix(img, sponge, raw)

    def crack(cell, w, gate_cell, gate, k, s):                          # a level line of noise, shown only here and there, is a crack
        c = fbm3(Q, cell, s, 2)
        show = smooth(fbm3(Q, gate_cell, s + 1, 2), gate, gate + 0.12)
        line = np.exp(-((c - 0.5) / w) ** 2) * show
        lit = np.exp(-((c - 0.5 - 2.4 * w) / (1.3 * w)) ** 2) * show
        return mix(mix(img, WHITE, 0.30 * k * lit), CRACK, np.clip(0.9 * k * line, 0, 1))
    if cracks:
        img = crack((0.75, 4.2, 0.75), 0.016, (1.1, 3.0, 1.1), 0.50, cracks, seed + 7)            # long ones
        img = crack((0.30, 1.3, 0.30), 0.020, (0.8, 1.6, 0.8), 0.64, 0.45 * cracks, seed + 9)      # a web of short ones
    if pits:
        gather = 0.25 + 0.75 * smooth(fbm3(P, 1.0, seed + 11, 2), 0.35, 0.75)
        pit = smooth(noise3(P, 0.065, seed + 12), 0.80, 0.87) * gather + 0.35 * smooth(noise3(P, 0.17, seed + 13), 0.86, 0.91)
        img = mix(img, PIT, np.clip(0.62 * pits * pit, 0, 1) * (1 - 0.7 * raw))

    crust = smooth(noise3(P, 0.16, seed + 14) * fbm3(P, 0.9, seed + 15, 2), 0.50, 0.58) * smooth(Y, 1.5, 3.0)      # grey lichen in small crusts, anywhere above the sea
    img = mix(img, CRUST, 0.55 * crust * (1 - raw))
    if lichen:
        zone = smooth(Y, lichen['lo'], lichen['hi']) * (0.45 + 0.55 * smooth(up, -0.5, 0.5))
        f = fbm3(P, 0.50, seed + 16, 3, 0.55) - 0.55 * (1 - zone)
        lvl = level(lichen.get('amount', 0.15))
        m = smooth(f, lvl - 0.035, lvl + 0.035) * smooth(zone, 0.02, 0.3)
        heart = smooth(f, lvl + 0.03, lvl + 0.16)
        dab = mix(LICHEN_R, LICHEN, 0.35 + 0.65 * heart)
        dab = mix(dab, LICHEN_L, 0.7 * smooth(noise3(P, 0.09, seed + 17), 0.55, 0.8) * heart)
        img = mix(img, dab, 0.94 * m)

    if tide:
        top = tide.get('top', 1.1)
        rag = (fbm3(P, (0.55, 1.2, 0.55), seed + 20, 3) - 0.5) * 0.9 * top
        film = smooth(top + rag - Y, 0.0, 0.5 * top)
        img = mix(img, mix(FILM, CREAM, 0.22 * mid), 0.88 * film)
        under = smooth(-Y, -0.08, 0.25)
        img = mix(img, mix(SEA, DEEP, smooth(-Y, 0.2, 2.3)), 0.92 * under)
        w = fbm3(P, (0.13, 1.0, 0.13), seed + 21, 3)                     # weed hanging in strands, thickest between the tides
        band = smooth(Y, -2.0, -0.7) * (1 - smooth(Y, 0.40 * top, 0.95 * top))
        wm = smooth(w + 0.38 * band - 0.35, 0.50, 0.62) * smooth(band, 0.0, 0.25)
        img = mix(img, mix(WEED, WEED_L, 0.8 * smooth(noise3(P, 0.07, seed + 22), 0.45, 0.8)), 0.9 * wm)
        img = shade(img, 1 - 0.14 * smooth(0.35 - Y, 0, 0.35) * (Y > -0.05))                        # wet just above the water
        zone = np.exp(-((Y - 0.5 * top) / (0.55 * top)) ** 2)
        img = mix(img, SHELL, 0.85 * smooth(noise3(P, 0.055, seed + 23), 0.80, 0.86) * zone * (1 - wm))  # barnacles
        n = int(tide.get('limpets', 0))
        if n:
            rs = np.random.default_rng(seed + 24)
            ok = np.argwhere(g['on'] & (Y > 0.05) & (Y < top + 0.35))
            lo, hi = tide.get('size', (0.08, 0.13))
            for k in (rs.choice(len(ok), min(n, len(ok)), replace=False) if len(ok) else []):
                c, nc = P[ok[k][0], ok[k][1]], N[ok[k][0], ok[k][1]]
                t1 = np.cross(nc, [0, 1.0, 0] if abs(nc[1]) < 0.9 else [1.0, 0, 0])
                t1 = t1 / np.linalg.norm(t1)
                t2 = np.cross(nc, t1)
                r = rs.uniform(lo, hi)
                e = (P - c) / r
                x, y = e @ t1, (e @ t2) * rs.uniform(1.0, 1.3)                         # a little longer than wide
                d = np.hypot(np.hypot(x, y), e @ nc)
                ribs = 0.5 + 0.5 * np.cos(np.arctan2(y, x) * 10 + rs.uniform(0, 6))
                img = mix(img, SHELL_D, 0.80 * smooth(1.14 - d, 0, 0.16))             # its shadow, then the shell
                shell = shade(mix(mix(SHELL, WARM, 0.35), SHELL_D, 0.40 * smooth(d, 0.45, 0.95)), 0.84 + 0.22 * ribs * smooth(d, 0.15, 0.5))
                img = mix(img, shell, smooth(0.93 - d, 0, 0.14))
                img = mix(img, WHITE, 0.45 * smooth(0.26 - d, 0, 0.22))
    return img


def limpet(H, W, seed=0, **_):
    """A limpet seen from above, filling the patch: a pale cone, ribs out from the top, rings of growth, a dark foot."""
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    xx = (np.arange(W)[None, :] + 0.5) / W * np.ones((H, 1))
    r, a = np.hypot(xx - 0.5, yy - 0.5) * 2, np.arctan2(yy - 0.5, xx - 0.5)
    img = mix(mix(SHELL, WARM, 0.25), SHELL_D, 0.55 * smooth(r, 0.55, 1.0))
    img = shade(img, 0.90 + 0.14 * np.cos(a * 11 + 2.0 * fbm(H, W, 3, 3, seed)) * smooth(r, 0.12, 0.4))
    img = shade(img, 1 - 0.07 * smooth(np.sin(r * 16.0), 0.5, 0.95))
    img = mix(img, WHITE, 0.5 * smooth(0.22 - r, 0, 0.16))
    img = mix(img, FILM, 0.35 * smooth(fbm(H, W, 4, 4, seed + 1), 0.5, 0.8))
    return mix(img, hexc('#4A4A3A'), 0.8 * smooth(r, 0.93, 1.0))


# ------------------------------------------------------------------------------------------------ a nest and its eggs
def gullnest(H, W, seed=0, tile_x=True, **_):
    """A gull's nest, unrolled: dry weed and twigs laid round and round, a few pale straws, down in the cup (the top of the patch)."""
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    a = strokes(H, W, seed, 'x', 9, 46, tile_x=tile_x)
    b = strokes(H, W, seed + 1, 'x', 5, 90, tile_x=tile_x)
    img = mix(hexc('#3A2E22'), hexc('#7A6446'), smooth(a, 0.25, 0.7))
    img = mix(img, hexc('#B79F6E'), 0.75 * smooth(b, 0.72, 0.92))
    img = mix(img, hexc('#4E5A3A'), 0.45 * smooth(fbm(H, W, 3, 8, seed + 2, 3, tile_x=tile_x), 0.6, 0.85))
    return mix(img, hexc('#D9D4C6'), 0.55 * smooth(0.30 - yy, 0, 0.3) * smooth(fbm(H, W, 6, 14, seed + 3, 2, tile_x=tile_x), 0.4, 0.7))


def gullegg(H, W, seed=0, colour='#B9C7A8', tile_x=True, **_):
    """A gull's egg, unrolled: olive buff, blotched with umber, more toward the big end (the bottom of the patch)."""
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    img = shade(hexc(colour) * np.ones((H, W, 3)), 0.94 + 0.1 * fbm(H, W, 3, 3, seed, tile_x=tile_x))
    blot = smooth(fbm(H, W, 5, 7, seed + 1, 3, 0.6, tile_x=tile_x) + 0.12 * yy, 0.60, 0.68)
    return mix(img, hexc('#4A3A2A'), 0.85 * blot)


# ------------------------------------------------------------------------------------------------ sea-thrift
def thriftdome(H, W, seed=0, tile_x=True, tone=('#35512F', '#5C8246', '#8FB060'), **_):
    """A cushion of thrift, unrolled, foot at the bottom of the patch: a tight mound of narrow leaves, dark at the foot
    and lighter on top, a few brown ones among them."""
    lo, mid, hi = [hexc(t) for t in tone]
    v = 1 - (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    img = mix(lo, mid, smooth(v, 0.0, 0.55))
    img = mix(img, hi, smooth(v, 0.5, 1.0) * 0.85)
    tuft = stretch(fbm(H, W, max(2, H / 7), max(4, W / 7), seed + 1, 3, 0.6, tile_x=tile_x))       # rosettes of leaves: dabs, not stripes (stripes kink where the dome's faces meet)
    img = shade(img, 0.84 + 0.26 * tuft)
    img = mix(img, hi * 1.05, 0.45 * smooth(tuft, 0.62, 0.9) * smooth(v, 0.15, 0.7))
    img = mix(img, lo, 0.35 * smooth(1 - tuft, 0.7, 0.95))
    img = mix(img, hi, 0.5 * speckle(H, W, seed, 0.05, (0.8, 1.0), tile_x=tile_x) * smooth(v, 0.1, 0.5))
    return mix(img, hexc('#8A7A48'), 0.55 * smooth(fbm(H, W, max(2, H / 9), max(4, W / 9), seed + 2, 2, tile_x=tile_x), 0.72, 0.86) * (1 - 0.6 * v))


def thrifthead(H, W, seed=0, n=12, tone=('#C65C8E', '#E889B0', '#F7BCD2'), **_):
    """n heads of thrift side by side, each a round pink tuft: deeper underneath (the bottom of the patch), pale on top."""
    lo, mid, hi = [hexc(t) for t in tone]
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    xx = (np.arange(W)[None, :] + 0.5) / W * np.ones((H, 1))
    k = np.minimum((xx * n).astype(int), n - 1)
    rs = np.random.default_rng(seed)
    v = 1 - yy
    img = mix(lo, mid, smooth(v, 0.0, 0.55))
    img = mix(img, hi, smooth(v, 0.45, 1.0))
    img = shade(img, rs.uniform(0.90, 1.10, n)[k])
    img = mix(img, hexc('#D9A6E0'), (0.22 * rs.random(n))[k])           # some heads lean toward lilac
    return mix(img, hi * 1.04, 0.5 * speckle(H, W, seed + 1, 0.06, (0.9, 1.1)))


REACH = {'bone': bone, 'limpet': limpet, 'gullnest': gullnest, 'gullegg': gullegg, 'thriftdome': thriftdome, 'thrifthead': thrifthead}
