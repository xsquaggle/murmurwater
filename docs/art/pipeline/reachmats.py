"""reachmats.py : painted materials for Saltbone Reach (mats.py takes them into its table): weathered bone, limpets,
a gull's nest and its eggs, a cushion of sea-thrift; and for Tryworks Landing a dry-stone wall of slate, the tarred
clinker planking of an upturned boat, glass net floats, old brick, canvas.

Bone is painted by place, not by patch: paint_spec hands it `geo`, where every pixel of the patch lies on the model
(geomap.mjs writes that map from the builder), and the paint is noise in space, so it does not stretch where a patch
is wide for the bone it wraps, has no seam where two patches meet, is green where the bone stands in the sea and
carries its lichen high up, however the patch is laid out. Needs paintkit.py beside it.
"""
import numpy as np
from scipy.stats import norm
from paintkit import hexc, mix, smooth, fbm, stretch, shade, strokes, speckle, blur, chips, masonry, linemask


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


def bone(H, W, seed=0, geo=None, axis=None, tide=None, lichen=None, raw=0.0, end=None, cracks=1.0, pits=1.0, ppm=64.0, at=(0.0, 6.0, 0.0), sockets=(), **_):
    """Old bone left out in the weather: cream, stained and bleached, cracked along its length and pitted.
    axis    the bone's middle line [[x, y, z], ...]: cracks run along it (without one they run up and down)
    tide    {"top": m, "limpets": n}: the bone stands in the sea at y = 0: dark green below, a grey-green film with
            weed, barnacles and n limpets up to about `top` metres
    lichen  {"lo": m, "hi": m, "amount": 0..1}: orange lichen in dabs, none below lo and all of `amount` above hi
    raw     0..1: a broken face, darker and full of holes
    end     {"c": [x, z], "r": m}: the flat end of a drum of bone about that upright line: rings, and a spongy middle
    sockets [{"c": [x, y, z], "r": m}, ...]: hollows (an eye's socket) that go dark toward their middles"""
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

    for sk in sockets:                                                 # the dark of a socket, deepest in its middle, with a lit lip round it
        d = np.linalg.norm(P - np.asarray(sk['c'], float), axis=-1) / sk['r']
        img = mix(img, mix(HOLE, hexc('#2A2219'), smooth(0.7 - d, 0, 0.5)), 0.95 * smooth(1.0 - d, 0, 0.35))
        img = mix(img, WHITE, 0.35 * np.exp(-((d - 1.12) / 0.08) ** 2) * smooth(P[..., 1] - sk['c'][1], -0.2 * sk['r'], 0.4 * sk['r']))
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


# ------------------------------------------------------------------------------------------------ Tryworks Landing
SLATE = ('#6C727C', '#7B8089', '#5C626D', '#878B90', '#6A6C76', '#8E9093', '#7F7B74', '#646B70')
MOSSY, MOSS_D = hexc('#6F8448'), hexc('#3F5232')


def _yx(H, W):
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    xx = (np.arange(W)[None, :] + 0.5) / W * np.ones((H, 1))
    return yy, xx, 1 - yy


def _per(ids, seed):
    """A number 0..1 for every stone or brick (by its id)."""
    return (np.sin(ids * 12.9898 + seed * 1.37) * 43758.5453) % 1.0


def _growth(img, H, W, seed, v, lichen, moss, tile_x, j=None):
    """What grows on a wall by the sea: moss low down and in the joints, grey crusts, dabs of orange lichen higher up."""
    n = stretch(fbm(H, W, max(2, H / 30), max(2, W / 30), seed + 21, 3, 0.55, tile_x=tile_x))
    if moss:
        m = smooth(n + 0.9 * (0.30 - v) + (0.10 * j if j is not None else 0), 0.84 - 0.24 * moss, 0.98 - 0.24 * moss)
        img = mix(img, mix(MOSS_D, MOSSY, stretch(fbm(H, W, max(2, H / 9), max(2, W / 9), seed + 22, 2, tile_x=tile_x))), 0.85 * m)
    if lichen:                                                           # dabs a hand's breadth across, gathered in places
        gate = smooth(stretch(fbm(H, W, max(2, H / 70), max(2, W / 70), seed + 23, 2, tile_x=tile_x)), 0.50, 0.80)
        dab = stretch(fbm(H, W, max(2, H / 13), max(2, W / 13), seed + 24, 2, 0.45, tile_x=tile_x))
        img = mix(img, CRUST, 0.6 * smooth(dab, 0.97 - 0.14 * lichen, 1.02 - 0.14 * lichen) * (0.25 + 0.75 * gate))
        gate2 = smooth(stretch(fbm(H, W, max(2, H / 80), max(2, W / 80), seed + 26, 2, tile_x=tile_x)), 0.55, 0.85)
        dab2 = stretch(fbm(H, W, max(2, H / 11), max(2, W / 11), seed + 25, 2, 0.45, tile_x=tile_x))
        d = smooth(dab2, 0.97 - 0.14 * lichen, 1.03 - 0.14 * lichen) * gate2 * smooth(v, 0.2, 0.6)
        img = mix(img, mix(LICHEN, LICHEN_L, smooth(d, 0.6, 1.0)), 0.9 * d)
    return img


def drystone(H, W, seed=0, ppm=120.0, course=(0.10, 0.23), block=(0.22, 0.62), lichen=0.5, moss=0.5, stones=SLATE, gap='#1E2026', tile_x=False, **_):
    """A dry-stone wall of slate, foot at the bottom of the patch (ppm = pixels to a metre): thin courses of split
    stone laid without mortar, dark in the gaps, a stone here and there stained with rust; moss low down and lichen."""
    img, f = masonry(H, W, ppm, seed, course=course, block=block, stones=stones, mortar=gap, joint=1.5, warp=2.6, bevel=2.4, lit=0.30, shd=0.34,
                     chip=0.45, rnd=4.0, tone=(0.80, 1.15), tile_x=tile_x)
    yy, xx, v = _yx(H, W)
    cleft = strokes(H, W, seed + 5, 'x', 9, 120, tile_x=tile_x)                      # slate splits in sheets: fine lines along every stone
    img = shade(img, 0.93 + 0.12 * cleft)
    r = _per(f['id'], seed)
    img = mix(img, hexc('#8C7458'), 0.42 * (r > 0.88) * (1 - f['j']))                # iron in the stone
    img = mix(img, hexc('#A9ADAE'), 0.30 * (r < 0.10) * (1 - f['j']))                # a pale one
    img = shade(img, 1 - 0.30 * np.clip(blur(f['j'], 2.2, wrap_x=tile_x) - f['j'], 0, 1))      # each stone shades the gap's edges
    return _growth(img, H, W, seed, v, lichen, moss, tile_x, f['j'])


def brickwork(H, W, seed=0, ppm=150.0, lichen=0.3, moss=0.6, rust=0.0, tile_x=False, **_):
    """Old brick laid in lime, foot at the bottom of the patch: soft reds gone brown and grey, the mortar worn back,
    salt in pale blooms, moss in the joints and low down. rust: 0..1, stains run down from the top edge (iron above)."""
    reds = ('#7C4E42', '#6E463C', '#845546', '#643F38', '#89604F', '#724A40', '#6E534D', '#7E5C52')
    img, f = masonry(H, W, ppm, seed, course=(0.082, 0.088), block=(0.225, 0.235), stones=reds, mortar='#8B8778', joint=1.5, warp=1.2, bevel=1.8,
                     lit=0.16, shd=0.22, chip=0.10, rnd=2.5, tone=(0.84, 1.12), tile_x=tile_x)
    yy, xx, v = _yx(H, W)
    img = shade(img, 0.93 + 0.12 * stretch(fbm(H, W, max(2, H / 5), max(2, W / 5), seed + 5, 2, tile_x=tile_x)))
    img = mix(img, hexc('#B9B2A2'), 0.30 * smooth(stretch(fbm(H, W, max(2, H / 40), max(2, W / 40), seed + 6, 3, tile_x=tile_x)), 0.62, 0.92) * (1 - f['j']))     # salt
    if rust:
        run = strokes(H, W, seed + 7, 'y', 5, 34, tile_x=tile_x)
        img = mix(img, hexc('#8A4A22'), rust * 0.75 * smooth(run + 0.9 * (v - 0.72), 0.55, 0.95))
    img = shade(img, 1 - 0.22 * np.clip(blur(f['j'], 1.6, wrap_x=tile_x) - f['j'], 0, 1))
    return _growth(img, H, W, seed, v, lichen, moss, tile_x, f['j'])


TAR, TAR_L, TAR_B, BARE, SALT = hexc('#24211F'), hexc('#413C38'), hexc('#3C444C'), hexc('#7C7366'), hexc('#9A9B96')


def tarred(H, W, seed=0, strakes=5, ppm=130.0, worn=0.35, lichen=0.3, moss=0.4, rivets=0.16, tile_x=False, **_):
    """The planking of an upturned clinker boat under forty years of tar, unrolled: `strakes` planks along x, the
    gunwale at the bottom of the patch and the keel at the top (ppm = pixels to a metre along it). Each plank's upper
    edge is the one that stands proud: it is worn to the wood and carries a row of rivets; grey where the weather has
    been, green toward the gunwale, a little lichen."""
    yy, xx, v = _yx(H, W)
    rs = np.random.default_rng(seed)
    f = v * strakes
    k = np.minimum(f.astype(int), strakes - 1)
    t = f - k                                                              # 0 at a plank's lower edge, 1 at its upper edge
    px = H / strakes
    g = strokes(H, W, seed, 'x', 16, 120, tile_x=tile_x)
    img = mix(TAR, TAR_L, 0.15 + 0.6 * g)
    img = mix(img, TAR_B, 0.45 * smooth(stretch(fbm(H, W, max(2, H / 60), max(2, W / 90), seed + 1, 3, tile_x=tile_x)), 0.45, 0.9))      # a blue sheen where the tar is thick
    img = shade(img, rs.uniform(0.86, 1.16, strakes)[k])
    for i in range(strakes):                                                # butt joints: one or two to a plank
        for x0 in rs.uniform(0.06, 0.94, rs.integers(1, 3)):
            d = np.abs(xx - x0) * W
            on = (k == i)
            img = shade(img, 1 - 0.6 * on * np.exp(-(d / 1.2) ** 2))
            img = mix(img, BARE, 0.35 * on * np.exp(-((d - 2.4) / 1.2) ** 2))
    bias = 0.55 * np.exp(-((1 - t) * px / 5.0)) + 0.25 * smooth(v, 0.5, 1.0)
    m = chips(H, W, (max(3, H / 10), max(6, W / 14)), seed + 3, amount=0.07 * worn / 0.35, tile_x=tile_x, crisp=0.05, bias=bias)
    wood = mix(BARE, hexc('#5C5348'), 0.6 * strokes(H, W, seed + 4, 'x', 10, 140, tile_x=tile_x))
    img = mix(img, wood, 0.85 * m)
    img = mix(img, SALT, 0.26 * smooth(stretch(fbm(H, W, max(2, H / 50), max(2, W / 50), seed + 5, 3, tile_x=tile_x)) + 0.3 * (v - 0.5), 0.6, 0.95))   # weathered grey, more toward the keel
    img = shade(img, 1 - 0.34 * np.exp(-(t * px / 3.5) ** 2))               # dirt lies where a plank meets the ledge of the one below
    img = mix(img, hexc('#A39B8C'), 0.55 * np.exp(-((1 - t) * px / 1.5) ** 2))      # the proud edge catches the light
    if rivets:                                                              # a row of rivets through the lap, under that edge
        step = rivets * ppm
        dx = (xx * W + 0.37 * step * k) % step - step / 2
        dy = (1 - t) * px - min(7.0, 0.2 * px)
        dot = np.exp(-(np.hypot(dx, dy) / 1.5) ** 2)
        img = shade(img, 1 - 0.5 * np.exp(-(np.hypot(dx - 1.0, dy - 1.2) / 2.2) ** 2) * (1 - dot))
        img = mix(img, hexc('#8FA596'), 0.8 * dot)
    runs = strokes(H, W, seed + 6, 'y', 4, 60, tile_x=tile_x)
    img = shade(img, 1 - 0.10 * smooth(runs, 0.55, 0.9))
    img = _growth(img, H, W, seed, v, lichen, moss, tile_x)
    return img


def floatglass(H, W, seed=0, colour='#5FA892', net=5, tile_x=True, **_):
    """A glass net float, unrolled (u round it, v from its foot to its top): thick sea-green glass, paler where the
    light comes through, darker at top and bottom, bubbles; in a bag of tarred twine with `net` meshes round it."""
    yy, xx, v = _yx(H, W)
    c = hexc(colour)
    img = mix(c * 0.55, c, smooth(np.sin(np.pi * v), 0.1, 0.9))
    img = mix(img, mix(c, np.ones(3), 0.55), 0.55 * np.exp(-(((v - 0.36) / 0.20) ** 2)) * (0.6 + 0.4 * stretch(fbm(H, W, 3, 6, seed, tile_x=tile_x))))
    img = shade(img, 0.92 + 0.12 * stretch(fbm(H, W, 4, 8, seed + 1, tile_x=tile_x)))
    img = mix(img, np.ones(3), 0.55 * speckle(H, W, seed + 2, 0.004, (0.8, 1.1), tile_x=tile_x))                    # bubbles
    for u0 in (0.2, 0.7):                                                                                           # the sky in the glass
        img = mix(img, np.ones(3), 0.7 * np.exp(-(((xx - u0) / 0.035) ** 2 + ((v - 0.66) / 0.10) ** 2)))
    a, b = (xx * net + v * net * 0.5) % 1.0, (xx * net - v * net * 0.5) % 1.0
    d = np.minimum(np.minimum(a, 1 - a), np.minimum(b, 1 - b)) * W / net
    w = max(1.1, W / 110.0)
    twine = np.exp(-(d / w) ** 2)
    twine = np.maximum(twine, smooth(v, 0.90, 0.94))                                                              # the bag is gathered at the top
    img = shade(img, 1 - 0.35 * np.exp(-((d - 1.8 * w) / (1.4 * w)) ** 2) * (1 - twine))
    return mix(img, mix(hexc('#3A2C1E'), hexc('#7C6642'), 0.5 + 0.5 * np.sin((xx * W + yy * H) * 1.3)), 0.95 * twine)


def canvas(H, W, seed=0, colour='#C9B990', seams=3, along='y', stain=0.4, tar=0.0, tile_x=False, **_):
    """Old canvas: a weave, `seams` sewn seams (they run along y, or x), stains and mildew. tar: 0..1, blackened with
    tar toward the bottom of the patch (a storm cone is dipped point first)."""
    yy, xx, v = _yx(H, W)
    c = hexc(colour)
    img = shade(c * np.ones((H, W, 3)), 0.90 + 0.18 * stretch(fbm(H, W, 3, 3, seed, tile_x=tile_x)))
    weave = 0.5 + 0.5 * np.sin(yy * H * 2.1) * np.sin(xx * W * 2.1)
    img = shade(img, 0.965 + 0.07 * weave)
    if seams:
        a, n = (xx, W) if along == 'y' else (yy, H)
        f = a * seams
        d = np.abs(f - np.round(f)) * n / seams
        img = shade(img, 1 - 0.28 * np.exp(-(d / 1.4) ** 2))
        st = (np.sin((yy if along == 'y' else xx) * (H if along == 'y' else W) * 0.9) > 0.1)
        img = mix(img, mix(c, np.ones(3), 0.5), 0.5 * np.exp(-((d - 3.2) / 1.2) ** 2) * st)
    img = mix(img, hexc('#7E7A62'), stain * 0.6 * smooth(stretch(fbm(H, W, 5, 5, seed + 1, 3, tile_x=tile_x)), 0.55, 0.92))
    img = mix(img, hexc('#5C6450'), stain * 0.5 * smooth(speckle(H, W, seed + 2, 0.004, (1.4, 2.6), tile_x=tile_x), 0.4, 0.7))
    if tar:
        img = mix(img, TAR_L * 0.9, tar * smooth(0.45 - v + 0.25 * (stretch(fbm(H, W, 3, 8, seed + 3, 2, tile_x=tile_x)) - 0.5), -0.1, 0.25))
    return img


def trypot(H, W, seed=0, crack=None, rust=0.85, moss=0.3, tile_x=True, **_):
    """A great iron try-pot gone to rust, unrolled (u round it, v up its outside, over the rim and down inside): rust in
    blotches and runs, the rim worn smooth and darker, moss where water lies. crack: u of a crack that runs down from
    the rim (the top third of the patch) through the wall."""
    from mats import iron                                               # mats imports this file, so not at the top
    yy, xx, v = _yx(H, W)
    img = iron(H, W, seed, rust=rust, tile_x=tile_x, hammered=0.7)
    img = mix(img, hexc('#5A2E1A'), 0.35 * smooth(stretch(fbm(H, W, max(2, H / 20), max(2, W / 20), seed + 7, 3, tile_x=tile_x)), 0.55, 0.9))
    img = mix(img, mix(MOSS_D, MOSSY, 0.5), moss * smooth(stretch(fbm(H, W, max(2, H / 18), max(2, W / 30), seed + 8, 3, tile_x=tile_x)) - 0.6 * np.abs(v - 0.62), 0.55, 0.8))
    if crack is not None:
        rs = np.random.default_rng(seed + 9)
        pts = []
        for i in range(9):
            t = i / 8
            pts.append(((crack + 0.012 * rs.normal() * (i > 0)) * W, (0.18 + 0.55 * t) * H))

        m = linemask(H, W, [pts], width=max(1.6, W / 260))
        img = shade(img, 1 - 0.35 * np.clip(blur(m, 2.5, wrap_x=tile_x), 0, 1))
        img = mix(img, hexc('#120E0C'), 0.95 * m)
        img = mix(img, hexc('#9A4E26'), 0.6 * np.clip(blur(m, 1.2, wrap_x=tile_x) - m, 0, 1) * 3)
    return img


def skimmer(H, W, seed=0, holes=6, **_):
    """The pan of a skimmer seen face on, filling the patch: a disc of rusted iron punched full of holes."""
    from mats import iron
    yy, xx, v = _yx(H, W)
    img = iron(H, W, seed, rust=0.9)
    r = np.hypot(xx - 0.5, yy - 0.5) * 2
    gx, gy = (xx * holes * 1.15) % 1.0 - 0.5, (yy * holes * 1.15) % 1.0 - 0.5
    hole = smooth(0.24 - np.hypot(gx, gy), -0.02, 0.02) * (r < 0.8)
    img = mix(img, hexc('#0E0B0A'), 0.9 * hole)
    return mix(img, hexc('#4A2A1A'), 0.6 * smooth(r, 0.86, 0.98))


def wrapped(H, W, seed=0, colour='#D8CCA8', turns=5, ties=(0.25, 0.62), tile_x=True, **_):
    """Sailcloth wound round something and tied, unrolled (u round it, v along it): strips laid on a slant, each overlapping
    the last with a shadow under its edge, clean but old, and a few turns of tarred twine at every height in `ties`."""
    yy, xx, v = _yx(H, W)
    c = hexc(colour)
    img = shade(c * np.ones((H, W, 3)), 0.92 + 0.14 * stretch(fbm(H, W, 3, 4, seed, tile_x=tile_x)))
    img = shade(img, 0.97 + 0.06 * (0.5 + 0.5 * np.sin(yy * H * 2.2) * np.sin(xx * W * 2.2)))
    f = (xx + v * turns) % 1.0                                                                      # 0 at one strip's edge, 1 where the next lies over it
    img = shade(img, 0.80 + 0.20 * smooth(f, 0.0, 0.25))
    img = mix(img, mix(c, np.ones(3), 0.45), 0.6 * np.exp(-((1 - f) * W / 2.0) ** 2))
    img = mix(img, hexc('#9A8E70'), 0.35 * smooth(stretch(fbm(H, W, 5, 5, seed + 1, 3, tile_x=tile_x)), 0.6, 0.92))
    for t in ties:
        d = np.abs(v - t) * H
        band = smooth(4.5 - d, -0.8, 0.8)
        lay = 0.5 + 0.5 * np.sin((xx * W * 0.9 + d * 2.0))
        img = shade(img, 1 - 0.35 * np.exp(-((d - 5.5) / 2.0) ** 2))
        img = mix(img, mix(hexc('#2E2418'), hexc('#6C5636'), lay), 0.95 * band)
    return img


def reefrock(H, W, seed=0, geo=None, top=1.0, ppm=40.0, at=(0.0, 0.0, 0.0), **_):
    """Dark slate rock of a reef, painted by place like bone (geo): beds that dip across it, blocky and cracked, grey
    crusts above the sea, and below `top` metres the tide: a grey-green film, weed, barnacles, dark green under water."""
    g = geo or flatgeo(H, W, ppm, at)
    P, N = g['pos'], g['nrm']
    Y, up = P[..., 1], N[..., 1]
    big, mid = fbm3(P, 3.0, seed, 3), fbm3(P, 0.8, seed + 1, 3)
    img = mix(hexc('#4A5059'), hexc('#6E737A'), 0.25 + 0.6 * big)
    img = shade(img, 0.88 + 0.22 * mid)
    bed = (Y + 0.18 * P[..., 0] - 0.07 * P[..., 2]) / 0.55 + 0.8 * fbm3(P, 2.0, seed + 2, 2)
    f = bed - np.floor(bed)
    img = shade(img, 1 - 0.30 * np.exp(-(f / 0.07) ** 2))                         # the partings between beds
    img = mix(img, hexc('#8A8F94'), 0.35 * np.exp(-((f - 0.12) / 0.05) ** 2) * smooth(up, -0.2, 0.6))
    img = mix(img, hexc('#9CA0A2'), 0.30 * smooth(up, 0.3, 0.9))                 # tops paler
    crust = smooth(noise3(P, 0.3, seed + 3) * fbm3(P, 1.4, seed + 4, 2), 0.50, 0.58) * smooth(Y, top + 0.3, top + 1.2)
    img = mix(img, CRUST, 0.55 * crust)
    rag = (fbm3(P, (1.0, 2.0, 1.0), seed + 5, 3) - 0.5) * 0.8 * top
    img = mix(img, FILM, 0.85 * smooth(top + rag - Y, 0.0, 0.4 * top))
    img = mix(img, mix(SEA, DEEP, smooth(-Y, 0.2, 2.3)), 0.92 * smooth(-Y, -0.08, 0.25))
    w = fbm3(P, (0.25, 1.6, 0.25), seed + 6, 3)
    band = smooth(Y, -2.0, -0.6) * (1 - smooth(Y, 0.4 * top, 0.95 * top))
    wm = smooth(w + 0.4 * band - 0.35, 0.50, 0.62) * smooth(band, 0.0, 0.25)
    img = mix(img, mix(WEED, WEED_L, 0.8 * smooth(noise3(P, 0.12, seed + 7), 0.45, 0.8)), 0.9 * wm)
    zone = np.exp(-((Y - 0.5 * top) / (0.6 * top)) ** 2)
    img = mix(img, SHELL, 0.8 * smooth(noise3(P, 0.08, seed + 8), 0.80, 0.86) * zone * (1 - wm))
    return shade(img, 1 - 0.16 * smooth(0.35 - Y, 0, 0.35) * (Y > -0.05))


# ------------------------------------------------------------------------------------------------ the Tally Stone
CUT_OLD, CUT_NEW = hexc('#9CA2A8'), hexc('#CDD1D5')        # a cut is paler than the face: weathered, or new


def _seg(a, b, ax, ay, bx, by):
    """Distance from points (a, b) to segments (ax, ay)-(bx, by), where along it (0..1), and the offset across it."""
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy + 1e-12
    t = np.clip(((a - ax) * dx + (b - ay) * dy) / L2, 0, 1)
    ox, oy = a - (ax + t * dx), b - (ay + t * dy)
    return np.hypot(ox, oy), t, ox, oy


def slate(H, W, seed=0, ppm=440.0, x0=0.0, y0=0.0, crown=None, floor=0.8, side=0.07, top=0.08, group=(0.17, 0.21), stroke=(0.03, 0.14, 0.016),
          drift=0.04, era=(0.0, 1.0), fresh=0.1, left=0, part=5, cuts=True, layers='x', lichen=0.45, moss=0.3, tile_x=False, **_):
    """A face of split slate, its foot at the bottom of the patch (ppm = pixels to a metre; x0, y0 = where the patch's
    bottom left corner lies on the face, in metres). With `cuts` it is cut with tallies in fives, four strokes and one
    across, row on row from the top down as a ledger is kept, from `floor` (metres up the face) to `top` under the crown
    (the top edge, [[x, y], ...] left to right) and `side` in from either edge: `group` is the width of a five's place
    and the pitch of the rows, `stroke` the spacing, height and width of a stroke. Each row was cut on one day by one
    hand, so it has its own tilt and wanders up and down (by about `drift`), and its fives sit unevenly. The cuts are
    pale in the grey face; they run from era[0] (old: worn, broken, grimed and grown over) to era[1] (new); the last
    `fresh` of them are bright new cuts. The last `left` places are not cut yet, and the newest five has only `part`
    strokes. Lit from the upper left. Without `cuts`, plain slate whose layers run along `layers` (an edge shows them)."""
    yy, xx, v = _yx(H, W)
    X, Y = x0 + xx * W / ppm, y0 + v * H / ppm
    big = stretch(fbm(H, W, max(2, H / 90), max(2, W / 90), seed, 3, 0.55, tile_x=tile_x))
    img = mix(hexc('#565C66'), hexc('#7C818A'), 0.25 + 0.55 * big)
    img = mix(img, hexc('#6A6660'), 0.25 * smooth(stretch(fbm(H, W, max(2, H / 40), max(2, W / 40), seed + 1, 3, tile_x=tile_x)), 0.6, 0.9))      # a brown cast in places
    img = shade(img, 0.93 + 0.12 * strokes(H, W, seed + 2, layers, 7, 220, tile_x=tile_x))                       # the cleavage
    img = shade(img, 1 - 0.09 * smooth(strokes(H, W, seed + 3, 'y' if layers == 'x' else 'x', 5, 60, tile_x=tile_x), 0.55, 0.9))     # rain runs
    young = np.zeros((H, W))
    if cuts:
        gw, gp = group
        sp, sh, sw = stroke
        span = W / ppm - 2 * side
        cols = int(span // gw)
        xs = x0 + side + (span - cols * gw) / 2
        cx, cy = (np.array([c[0] for c in crown]), np.array([c[1] for c in crown])) if crown else (np.array([x0, x0 + W / ppm]), np.full(2, y0 + H / ppm))
        y_top = float(cy.max()) - top
        rows = int((y_top - floor) // gp)
        gx = xs + np.arange(cols) * gw
        roof = np.minimum(np.interp(gx, cx, cy), np.interp(gx + gw, cx, cy)) - top
        ok = (y_top - np.arange(rows)[:, None] * gp) <= roof[None, :]
        order = (np.cumsum(ok.ravel()) - 1).reshape(rows, cols)
        N = int(ok.sum()) - left
        wide = 3 * sp + sw                                                      # the four strokes, side to side
        mid = xs + cols * gw / 2
        r0, c0 = np.floor((y_top - Y) / gp).astype(int), np.floor((X - xs) / gw).astype(int)
        best, g, tb = np.full((H, W), 9.0), np.zeros((H, W)), np.zeros((H, W))
        L = np.array([-1.0, 1.0]) / np.sqrt(2)                                  # toward the light
        for dr in (-1, 0, 1):                                                   # a five may lean or drift into the next place
            for dc in (-1, 0, 1):
                r, c = r0 + dr, c0 + dc
                inside = (r >= 0) & (r < rows) & (c >= 0) & (c < cols)
                rc, cc = np.clip(r, 0, rows - 1), np.clip(c, 0, cols - 1)
                n = order[rc, cc]
                live = inside & ok[rc, cc] & (n < N)
                t = era[0] + (era[1] - era[0]) * n / max(1, N - 1)              # how new each five is
                gid = rc * 131 + cc
                h = [_per(gid * 7 + k, seed + 40) for k in range(6)]
                hand = [_per(rc * 17 + k, seed + 43) for k in range(4)]         # the row's own tilt and wander
                px = xs + (cc + 0.5) * gw
                fx = px - wide / 2 + (h[0] - 0.5) * 0.24 * gw + (hand[0] - 0.5) * 0.12 * gw
                fy = (y_top - (rc + 1) * gp + (gp - sh) / 2 + drift * ((hand[1] - 0.5) * 2.2 * (px - mid) / max(0.3, mid - xs)
                      + 0.8 * np.sin(px * (3.0 + 3.0 * hand[2]) + 6.28 * hand[3])) + (h[1] - 0.5) * 0.35 * drift)
                a, b = X - fx, Y - fy                                           # in the five: across from its left, up from its foot
                lean, tall = (hand[2] - 0.5) * 0.14 + (h[2] - 0.5) * 0.10, 0.88 + 0.18 * h[3]
                ends = []
                for i in range(4):
                    ji = (_per(gid * 7 + 10 + i, seed + 41) - 0.5)
                    ax, hi = i * sp + ji * 0.25 * sp + sw / 2, sh * tall * (1 + 0.08 * ji)
                    ay = 0.04 * sh * (_per(gid * 7 + 20 + i, seed + 41) - 0.5)
                    ends.append((ax, ay, ax + hi * np.sin(lean + ji * 0.12), ay + hi * np.cos(lean + ji * 0.12)))
                ends.append((ends[0][0] - 0.55 * sp, 0.18 * sh, ends[3][0] + 0.75 * sp, sh * tall * (0.80 + 0.1 * (h[4] - 0.5))))
                strokes_in = np.where(n == N - 1, part, 5)
                for i, (ax, ay, bx, by) in enumerate(ends):
                    d, s_, ox, oy = _seg(a, b, ax, ay, bx, by)
                    w = (sw * (0.9 if i == 4 else 1.0)) * (0.45 + 0.55 * np.sqrt(np.clip(np.sin(np.pi * s_), 0, 1)))  # a chisel cut tapers to its ends
                    d = d / w + 9.0 * (i >= strokes_in) + 9.0 * ~live
                    nearer = d < best
                    g = np.where(nearer, -(ox * L[0] + oy * L[1]) / w, g)      # > 0 on the wall that faces the light
                    tb = np.where(nearer, t, tb)
                    best = np.where(nearer, d, best)
        cut = best < 8.0
        wear = smooth(stretch(fbm(H, W, max(2, H / 14), max(2, W / 14), seed + 42, 2, tile_x=tile_x)) + 0.7 * tb, 0.30, 0.55)
        m = cut * smooth(1 - best, 0.0, 0.3) * (0.6 + 0.4 * wear)
        new = smooth(tb, era[1] - fresh * (era[1] - era[0]) - 1e-6, era[1] - 0.3 * fresh * (era[1] - era[0])) * (fresh > 0)
        young = cut * new
        grime = smooth(stretch(fbm(H, W, max(2, H / 25), max(2, W / 25), seed + 44, 2, tile_x=tile_x)), 0.4, 0.8) * (1 - tb)
        inner = mix(mix(img, CUT_OLD, 0.55 + 0.35 * tb - 0.25 * grime), CUT_NEW, new)       # weathered pale grey, greyer where grimed; bright where new
        img = mix(img, shade(inner, 0.9 + 0.22 * np.clip(g, -1, 1)), m)
        rim = smooth(1.5 - best, 0, 0.5) * (1 - smooth(1 - best, 0.0, 0.3)) * cut
        img = mix(img, hexc('#3E434A'), 0.35 * rim * np.clip(-g, 0, 1))                    # the shadowed lip of a cut
        dust = cut * new * smooth(2.5 - best, 0, 1.2)
        img = mix(img, hexc('#A3A9AF'), 0.25 * dust)
        young = np.clip(blur(young.astype(float), 6, wrap_x=tile_x) * 3, 0, 1)
    grown = _growth(img, H, W, seed, v, lichen, moss, tile_x)
    return mix(img, grown, 1 - 0.85 * young)


# ------------------------------------------------------------------------------------------------ the mark on the ninth rib
_FONT = {                                                                # capitals as strokes in a box 0.6 wide and 1 high (y up)
    'N': [[(0, 0), (0, 1), (0.6, 0), (0.6, 1)]], 'I': [[(0.3, 0), (0.3, 1)]], 'E': [[(0.6, 1), (0, 1), (0, 0), (0.6, 0)], [(0, 0.5), (0.45, 0.5)]],
    'O': [[(0.3, 0), (0.08, 0.1), (0, 0.5), (0.08, 0.9), (0.3, 1), (0.52, 0.9), (0.6, 0.5), (0.52, 0.1), (0.3, 0)]],
    'U': [[(0, 1), (0, 0.25), (0.1, 0.05), (0.3, 0), (0.5, 0.05), (0.6, 0.25), (0.6, 1)]], 'T': [[(0, 1), (0.6, 1)], [(0.3, 1), (0.3, 0)]],
    'F': [[(0.6, 1), (0, 1), (0, 0)], [(0, 0.5), (0.45, 0.5)]], 'C': [[(0.6, 0.85), (0.45, 1), (0.15, 1), (0, 0.8), (0, 0.2), (0.15, 0), (0.45, 0), (0.6, 0.15)]],
    'Y': [[(0, 1), (0.3, 0.5), (0.6, 1)], [(0.3, 0.5), (0.3, 0)]], 'R': [[(0, 0), (0, 1), (0.45, 1), (0.6, 0.85), (0.6, 0.65), (0.45, 0.5), (0, 0.5)], [(0.3, 0.5), (0.6, 0)]],
    'S': [[(0.6, 0.85), (0.45, 1), (0.15, 1), (0, 0.85), (0, 0.65), (0.15, 0.5), (0.45, 0.5), (0.6, 0.35), (0.6, 0.15), (0.45, 0), (0.15, 0), (0, 0.15)]],
    'L': [[(0, 1), (0, 0), (0.6, 0)]], '.': [[(0.3, 0), (0.3, 0.07)]], ',': [[(0.32, 0.08), (0.22, -0.14)]], ' ': []}


def _letters(text, x0, y0, h, rs=None, shake=0.0, gap=0.32):
    """Poly-lines in pixels (y down) for `text` written from (x0, y0 = its foot), letters `h` pixels high; `shake`
    moves every point a little (a hand with a knife), by `rs`."""
    out, x = [], x0
    for ch in text:
        for ln in _FONT[ch]:
            out.append([(x + (px + (rs.normal() * shake if rs is not None else 0)) * h, y0 - (py + (rs.normal() * shake if rs is not None else 0)) * h) for px, py in ln])
        x += (0.6 + gap) * h if ch != ' ' else 0.6 * h
    return out


def _width(text, h, gap=0.32):
    return sum(((0.6 + gap) * h if ch != ' ' else 0.6 * h) for ch in text) - gap * h


def ribplate(H, W, seed=0, big='NINE', small=('IN FOR NINE, OUT FOR NINE.', 'COUNT IT YOURSELF. I.F.'), **_):
    """A brass plate seen face on, filling the patch, kept bright by somebody's sleeve: dark in its corners and round
    its four screws, an engraved border, `big` cut deep across it and, under that, `small` scratched in with a knife."""
    from mats import brass
    yy, xx, v = _yx(H, W)
    rs = np.random.default_rng(seed)
    img = brass(H, W, seed, top=0.1, patina=0.25, verdigris=0.0)
    edge = np.minimum(np.minimum(xx, 1 - xx) * W, np.minimum(yy, 1 - yy) * H)
    rub = np.exp(-(((xx - 0.5) / 0.32) ** 2 + ((yy - 0.45) / 0.36) ** 2))
    img = mix(img, hexc('#F2D27C'), 0.55 * rub)                                                        # bright where it is rubbed
    img = mix(img, hexc('#5E4A22'), 0.6 * smooth(14 - edge, 0, 14) * (1 - rub))                       # tarnish in from the edges
    img = mix(img, hexc('#6E9A82'), 0.5 * smooth(5 - edge, 0, 5) * smooth(stretch(fbm(H, W, 6, 6, seed + 3, 2)), 0.5, 0.8))
    img = shade(img, 1 - 0.35 * np.exp(-(edge / 2.5) ** 2))                                          # the bevel
    def cut(lines, wid, depth, lip):                                                                    # engrave: a dark groove with a bright lower lip
        m = linemask(H, W, lines, wid)
        lo = linemask(H, W, [[(x + 0.5 * wid, y + 0.5 * wid) for x, y in ln] for ln in lines], wid)
        nonlocal img
        img = mix(img, hexc('#FFE9A8'), lip * np.clip(lo - m, 0, 1))
        img = mix(img, hexc('#3A2A12'), depth * m)
    m = int(0.075 * H)
    cut([[(m, m), (W - m, m), (W - m, H - m), (m, H - m), (m, m)]], 1.6, 0.8, 0.7)
    h = 0.3 * H
    cut(_letters(big, (W - _width(big, h)) / 2, 0.47 * H, h), max(2.0, H / 45), 0.9, 0.8)
    for k, line in enumerate(small):
        hs = min(0.085 * H, 0.82 * W / max(1, _width(line, 1.0)))
        cut(_letters(line, (W - _width(line, hs)) / 2 + rs.normal() * 2, (0.66 + 0.13 * k) * H, hs, rs, 0.03), max(1.0, H / 200), 0.6, 0.35)
    for cx, cy in ((0.045, 0.07), (0.955, 0.07), (0.045, 0.93), (0.955, 0.93)):                       # four screws, their slots every which way
        d = np.hypot((xx - cx) * W, (yy - cy) * H)
        r0 = 0.032 * H
        img = mix(img, hexc('#7A6030'), smooth(r0 - d, -0.8, 0.8))
        img = mix(img, hexc('#E8C878'), 0.6 * smooth(r0 - d, -0.8, 0.8) * smooth(-((xx - cx) * W + (yy - cy) * H), 0, r0))
        a = rs.uniform(0, np.pi)
        along = np.abs(-(xx - cx) * W * np.sin(a) + (yy - cy) * H * np.cos(a))
        img = mix(img, hexc('#2A1E0C'), 0.9 * smooth(0.9 - along, -0.5, 0.5) * (d < 0.8 * r0))
        img = shade(img, 1 - 0.35 * np.exp(-((d - r0 - 1.2) / 1.0) ** 2))
    return img


def fray(H, W, seed=0, **_):
    """The frayed end of a rope as a fan of loose yarns, root at the bottom of the patch, cut out against nothing (the
    tips go to the colour of old hemp, not to clear: the model's strands are cut to the yarn)."""
    yy, xx, v = _yx(H, W)
    yarn = 0.5 + 0.5 * np.sin(xx * W * 1.3 + 3 * stretch(fbm(H, W, 3, 6, seed)))
    img = mix(hexc('#6A5A40'), hexc('#C2AE86'), 0.3 + 0.6 * yarn)
    return shade(img, 0.75 + 0.35 * v)


REACH = {'bone': bone, 'limpet': limpet, 'gullnest': gullnest, 'gullegg': gullegg, 'thriftdome': thriftdome, 'thrifthead': thrifthead,
         'drystone': drystone, 'brickwork': brickwork, 'tarred': tarred, 'floatglass': floatglass, 'canvas': canvas, 'trypot': trypot, 'skimmer': skimmer, 'wrapped': wrapped, 'reefrock': reefrock,
         'slate': slate, 'ribplate': ribplate, 'fray': fray}
