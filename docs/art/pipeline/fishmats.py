"""fishmats.py : painted skins, fins and eyes for the fish that are built in code (fish.mjs, build-fen-fish.mjs).
mats.py adds these to its table, so a fish's layout names them like any other material.

A skin patch is one side of the fish unrolled: u runs from the lips (left) to the root of the tail (right), v from the
belly line (bottom) to the back line (top). Both sides of the fish use the same patch. `ratio` (given by the builder)
is how many pixels of v cover the same distance on the fish as one pixel of u, so that round things come out round.
A fin patch has its rays running up it: u across the rays, v from the root (bottom) to the edge (top).
An eye patch is the eye seen face on, the nose to its left.
"""
import numpy as np
from paintkit import hexc, mix, smooth, fbm, stretch, blur, strokes, shade, speckle, polymask, linemask


def _grid(H, W):
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    xx = (np.arange(W)[None, :] + 0.5) / W * np.ones((H, 1))
    return yy, xx, 1 - yy


def _band(v, lo, hi, soft=0.05):
    return smooth(v, lo - soft, lo + soft) * (1 - smooth(v, hi - soft, hi + soft))


def _round(H, W, ratio, u, v, cu, cv, r):
    """Distance from (cu, cv) in units of r, where r is a fraction of the patch's width; round on the fish."""
    return np.hypot((u - cu) * W, (v - cv) * H / ratio) / (r * W)


def _line(H, W, pts, width):
    return linemask(H, W, [[(a * W, (1 - b) * H) for a, b in pts]], width)


def _scales(H, W, nu, ratio):
    """Overlapping scales, their free edges toward the tail: (rim, face, shadow), each 0..1. nu scales fit along the patch."""
    yy, xx, v = _grid(H, W)
    cw = W / nu
    U, V = xx * W / cw, v * H / (cw * ratio)
    k = np.floor(U / 0.5)
    off = 0.5 * (k % 2)
    d = np.hypot(U - 0.5 * k, V - (np.round(V - off) + off))            # 0 at a scale's middle, 0.5 at its edge
    rim = np.exp(-((d - 0.5) / 0.06) ** 2)
    face = np.exp(-((d - 0.34) / 0.12) ** 2) * (d < 0.5)
    shadow = np.exp(-np.clip(d - 0.5, 0, None) / 0.09) * (d >= 0.5)
    return rim, face, shadow


def _lantern(H, W, u=(0.2, 0.8), top=0.46, ribs=7, rib_w=2.4, longs=(0.5,), **_):
    """A lantern let into the belly: (inside, frame, depth). inside = the glass; frame = hoops, ribs and rim; depth = 1 in
    the middle of the glass falling to its edge."""
    yy, xx, v = _grid(H, W)
    uc, hw = (u[0] + u[1]) / 2, (u[1] - u[0]) / 2
    q = np.clip(1 - ((xx - uc) / hw) ** 2, 0, 1)
    vt = top * q ** 0.42                                                 # its upper edge
    inside = smooth(vt - v, -0.012, 0.012) * (np.abs(xx - uc) < hw)
    frame = np.zeros((H, W))
    if ribs:                                                             # hoops round it
        k = (xx - u[0]) / (u[1] - u[0]) * ribs
        frame = np.exp(-(((k - np.round(k)) * (u[1] - u[0]) / ribs * W) / rib_w) ** 2)
    for f in longs:
        frame = frame + np.exp(-(((v - vt * f) * H) / rib_w) ** 2)
    rim = np.exp(-(((v - vt) * H) / (rib_w * 1.5)) ** 2) * (np.abs(xx - uc) < hw + 0.01)
    frame = np.clip(frame * inside + rim, 0, 1)
    depth = q * np.clip(1 - 0.6 * v / max(top, 1e-6), 0, 1)
    return inside, frame, depth


def _pores(H, W, ratio, v=0.56, n=9, u=(0.22, 0.9), r=0.008, arch=0.0, **_):
    yy, xx, vv = _grid(H, W)
    out = np.zeros((H, W))
    for k in range(n):
        t = (k + 0.5) / n
        cu = u[0] + (u[1] - u[0]) * t
        out = np.maximum(out, 1 - smooth(_round(H, W, ratio, xx, vv, cu, v + arch * np.sin(np.pi * t), r * (1 - 0.45 * t)), 0.7, 1.2))
    return out


def _inner(H, W, poly, soft=6):
    return blur(polymask(H, W, [[(a * W, (1 - b) * H) for a, b in poly]]), soft)


def fishskin(H, W, seed=0, back='#3F6B4A', flank='#8FB36A', belly='#E9E3C2', split=(0.30, 0.66), blend=(0.10, 0.12), wob=0.03, vary=0.10,
             tail=None, head=None, bars=None, mottle=None, bark=None, spots=None, scales=None, line=None, gill=None, mouth=None, lip=None,
             blobs=None, eye=None, socket=None, spine=None, inner=None, lantern=None, pores=None, marks=None, sheen=0.10, under=0.14, sheen_colour=None, ratio=1.0, **_):
    """One side of a fish. Every part is optional:
    tail    {back, flank, belly, u: (from, to)}: the three colours change to these toward the tail
    head    {to, colour, amount}: the head, as far back as u = to, takes this colour
    bars    {n, colour, u: (from, to), width, low, high, tilt, wob, uneven, taper, amount}: upright bars
    mottle  [{colour, amount, cells: (cy, cx), cut: (lo, hi), v: (lo, hi)}]: blotches
    bark    {dark, light, amount, length, fine}: furrows running along the fish
    spots   {colour, n, r, u, v, amount}: round spots
    scales  {nu, colour, amount, lit, shadow, u0, v: (lo, hi)}
    line    {v, colour, amount, w, u: (from, to), arch}: the lateral line
    gill    {u, bend, v: (lo, hi), colour, amount, w}
    mouth   {to, v, v1, curl, w, colour}: a closed mouth, a line from the lips back to its corner
    lip     {to, colour, amount}
    blobs   [{u, v, r, squash, colour, amount, soft}]: soft round marks (a cheek, something seen through the skin)
    eye     [u, v, r] and socket {colour, amount, grow}: a shadow for the eye to sit in
    spine   {v, arch, colour, amount, ribs, u: (from, to), reach, w}: a backbone seen through the skin
    inner   {poly: [[u, v], ...], colour, amount, soft}: a shape inside the fish
    lantern {u, top, ribs, glass, core, frame}: a lantern for a belly
    pores   {v, n, u, r, colour, amount}: a row of round pores
    marks   [{lines: [[[u, v], ...], ...], colour, w, amount, halo: {colour, w, soft, amount}}]: lines drawn on the skin
            (ribs, zigzags, a scar, a fork of lightning), each with a soft halo under it if it has one
    sheen_colour: the colour of the sheen along the upper flank (white if not given)
    """
    yy, xx, v = _grid(H, W)
    u = xx
    wv = (fbm(H, W, 1, 6, seed) - 0.5) * 2 * wob

    def base(bk, fl, be):
        img = mix(hexc(be), hexc(fl), smooth(v + wv, split[0] - blend[0], split[0] + blend[0]))
        return mix(img, hexc(bk), smooth(v + wv, split[1] - blend[1], split[1] + blend[1]))
    img = base(back, flank, belly)
    if tail:
        u0, u1 = tail.get('u', (0.3, 0.9))
        img = mix(img, base(tail.get('back', back), tail.get('flank', flank), tail.get('belly', belly)), smooth(u, u0, u1))
    img = shade(img, 1 - vary / 2 + vary * stretch(fbm(H, W, 3, 7, seed + 1)))
    if head:
        lo, hi = head.get('v', (-1, 2))
        img = mix(img, hexc(head['colour']), head.get('amount', 0.5) * (1 - smooth(u, head['to'] - head.get('soft', 0.04), head['to'] + head.get('soft', 0.04))) * _band(v, lo, hi))
    if bark:
        g = strokes(H, W, seed + 10, 'x', bark.get('length', 5), bark.get('fine', 60))
        on = _band(v, *bark.get('v', (0.25, 2)), 0.08) * bark.get('amount', 0.7)
        img = mix(img, hexc(bark.get('dark', '#3A3324')), on * smooth(g, 0.52, 0.78))
        img = mix(img, hexc(bark.get('light', '#8F8A5C')), 0.7 * on * smooth(1 - g, 0.62, 0.86))
    for i, m in enumerate(mottle if isinstance(mottle, list) else [mottle] if mottle else []):
        cy, cx = m.get('cells', (5, 12))
        lo, hi = m.get('cut', (0.55, 0.72))
        n = stretch(fbm(H, W, cy, cx, seed + 30 + i, 3))
        img = mix(img, hexc(m['colour']), m.get('amount', 0.6) * smooth(n, lo, hi) * _band(v, *m.get('v', (-1, 2)), 0.08) * _band(u, *m.get('u', (-1, 2)), 0.05))
    if bars:
        b = bars
        n = b.get('n', 6)
        u0, u1 = b.get('u', (0.2, 0.95))
        rs = np.random.default_rng(seed + 20)
        t = (u - u0) / (u1 - u0) * n + b.get('tilt', 0.0) * (v - 0.5) + (fbm(H, W, 4, 3, seed + 21) - 0.5) * 2 * b.get('wob', 0.15)
        idx = np.clip(np.floor(t), 0, n - 1).astype(int)
        wd = b.get('width', 0.45) * (1 + (rs.random(n) - 0.5) * 2 * b.get('uneven', 0.3))[idx]
        if b.get('taper'):
            wd = wd * (1 - b['taper'] * (1 - v))
        m = 1 - smooth(np.abs(t - np.floor(t) - 0.5), wd / 2 - b.get('soft', 0.06), wd / 2 + b.get('soft', 0.06))
        m = m * (t >= 0) * (t <= n) * _band(v, b.get('low', 0.3), b.get('high', 2), b.get('fade', 0.12))
        img = mix(img, hexc(b['colour']), b.get('amount', 0.8) * m)
    if spots:
        s = spots
        rs = np.random.default_rng(seed + 40)
        (u0, u1), (v0, v1) = s.get('u', (0.25, 0.95)), s.get('v', (0.4, 0.95))
        m = np.zeros((H, W))
        for _k in range(s.get('n', 12)):
            cu, cv, r = rs.uniform(u0, u1), rs.uniform(v0, v1), s.get('r', 0.02) * rs.uniform(0.6, 1.2)
            m = np.maximum(m, 1 - smooth(_round(H, W, ratio, u, v, cu, cv, r), 0.75, 1.15))
        img = mix(img, hexc(s['colour']), s.get('amount', 0.8) * m)
    if scales:
        s = scales
        rim, face, shd = _scales(H, W, s.get('nu', 18), ratio)
        on = smooth(u, s.get('u0', 0.2) - 0.03, s.get('u0', 0.2) + 0.03) * _band(v, *s.get('v', (0.14, 2)), 0.06)
        img = shade(img, 1 + on * (s.get('lit', 0.08) * face - s.get('shadow', 0.14) * shd))
        img = mix(img, hexc(s.get('colour', '#1A1A1A')), s.get('amount', 0.3) * rim * on)
    if inner:
        img = mix(img, hexc(inner.get('colour', '#10201A')), inner.get('amount', 0.6) * _inner(H, W, inner['poly'], inner.get('soft', 6)))
    if spine:
        s = spine
        u0, u1 = s.get('u', (0.2, 0.97))
        us = np.linspace(u0, u1, 40)
        vs = s['v'] + s.get('arch', 0.03) * np.sin(np.pi * (us - u0) / (u1 - u0))
        m = _line(H, W, list(zip(us, vs)), s.get('w', 2.4))
        n = s.get('ribs', 0)
        ribs = []
        for k in range(n):
            t = (k + 0.5) / n
            uk = u0 + (u1 - u0) * (0.04 + 0.62 * t)
            vk = s['v'] + s.get('arch', 0.03) * np.sin(np.pi * (uk - u0) / (u1 - u0))
            ln = s.get('reach', 0.3) * np.sin(np.pi * (0.12 + 0.88 * t)) ** 0.7
            ribs.append([(uk + 0.035 * q * q, vk - ln * q) for q in np.linspace(0, 1, 8)])
            ribs.append([(uk + 0.03 * q, vk + 0.55 * ln * q) for q in np.linspace(0, 1, 5)])
        if ribs:
            m = np.maximum(m, 0.6 * linemask(H, W, [[(a * W, (1 - b) * H) for a, b in r] for r in ribs], s.get('w', 2.4) * 0.5))
        img = mix(img, hexc(s.get('colour', '#5A8A88')), s.get('amount', 0.7) * m)
    if lantern:
        inside, frame, depth = _lantern(H, W, **lantern)
        glass = mix(hexc(lantern.get('glass', '#8FE9DA')), hexc(lantern.get('core', '#E9FFF6')), depth ** 1.5)
        img = mix(img, glass, inside)
        img = mix(img, hexc(lantern.get('frame', '#173A40')), lantern.get('frame_amount', 0.9) * frame)
    if line:
        ln = line
        u0, u1 = ln.get('u', (0.2, 0.98))
        us = np.linspace(u0, u1, 40)
        m = _line(H, W, [(a, ln['v'] + ln.get('arch', 0.0) * np.sin(np.pi * (a - u0) / (u1 - u0))) for a in us], ln.get('w', 1.8))
        img = mix(img, hexc(ln.get('colour', '#1A1A1A')), ln.get('amount', 0.35) * m)
    if pores:
        img = mix(img, hexc(pores.get('colour', '#4A2F6E')), pores.get('amount', 0.85) * _pores(H, W, ratio, **pores))
    for b in blobs or []:
        d = np.hypot((u - b['u']) * W, (v - b['v']) * H / ratio / b.get('squash', 1.0)) / (b['r'] * W)
        img = mix(img, hexc(b['colour']), b.get('amount', 0.6) * (1 - smooth(d, 1 - b.get('soft', 0.5), 1 + b.get('soft', 0.5))))
    for mk in marks or []:
        halo, line = _marks(H, W, mk)
        if mk.get('halo'):
            img = mix(img, hexc(mk['halo']['colour']), mk['halo'].get('amount', 0.4) * halo)
        img = mix(img, hexc(mk['colour']), mk.get('amount', 0.9) * line)
    if gill:
        g = gill
        v0, v1 = g.get('v', (0.16, 0.80))
        vs = np.linspace(v0, v1, 24)
        us = g['u'] - g.get('bend', 0.035) * ((vs - (v0 + v1) / 2) / ((v1 - v0) / 2)) ** 2
        m = _line(H, W, list(zip(us, vs)), g.get('w', 2.2))
        img = shade(img, 1 - 0.22 * g.get('amount', 0.5) * 2 * blur(np.roll(m, 4, 1), 3.0))                # the cover's shadow on the flank
        img = mix(img, np.ones(3), 0.16 * g.get('amount', 0.5) * 2 * blur(np.roll(m, -4, 1), 2.5))            # light on its edge
        img = mix(img, hexc(g.get('colour', '#1A1A1A')), g.get('amount', 0.5) * m)
    if eye and socket:
        d = _round(H, W, ratio, u, v, eye[0], eye[1], eye[2] * socket.get('grow', 1.5))
        img = mix(img, hexc(socket.get('colour', '#1A1A1A')), socket.get('amount', 0.35) * (1 - smooth(d, 0.55, 1.0)))
    if lip:
        img = mix(img, hexc(lip['colour']), lip.get('amount', 0.8) * (1 - smooth(u, lip['to'] * 0.6, lip['to'] * 1.4)) * _band(v, *lip.get('v', (-1, 2)), 0.06))
    if mouth:
        m = mouth
        ts = np.linspace(0, 1, 18)
        pts = [(m['to'] * t, m['v'] + (m.get('v1', m['v']) - m['v']) * t + m.get('curl', 0.0) * t ** 3) for t in ts]
        img = mix(img, hexc(m.get('colour', '#2A1A1A')), m.get('amount', 0.85) * _line(H, W, pts, m.get('w', 2.4)))
    img = mix(img, hexc(sheen_colour) if sheen_colour else np.ones(3), sheen * np.exp(-((v - 0.76) / 0.05) ** 2) * smooth(u, 0.06, 0.2) * (1 - smooth(u, 0.7, 0.96)))
    return shade(img, 1 - under * np.exp(-(v / 0.09) ** 2))


def _marks(H, W, mk):
    """A mark's (halo, line) masks, 0..1; its lines are in patch units (u from the lips, v up from the belly line)."""
    lines = [[(a * W, (1 - b) * H) for a, b in ln] for ln in mk['lines']]
    line = linemask(H, W, lines, mk.get('w', 2.0))
    h = mk.get('halo')
    halo = blur(linemask(H, W, lines, h.get('w', 3 * mk.get('w', 2.0))), h.get('soft', 2.5)) if h else np.zeros((H, W))
    return halo, line


def skinglow(H, W, seed=0, allover=None, scales=None, rim=None, lantern=None, inner=None, pores=None, blobs=None, bars=None, marks=None, ratio=1.0, **_):
    """What a skin gives off after dark (black where nothing glows). allover {colour, amount, v: (lo, hi)}; rim {colour,
    amount} lights the edges of `scales`; lantern, inner, pores and blobs as in fishskin (inner darkens)."""
    yy, xx, v = _grid(H, W)
    u = xx
    out = np.zeros((H, W, 3))
    if allover:
        a = allover
        out = out + hexc(a['colour']) * (a.get('amount', 0.2) * _band(v, *a.get('v', (-1, 2)), 0.1) * (0.8 + 0.4 * stretch(fbm(H, W, 3, 7, seed + 1))))[..., None]
    if scales and rim:
        r, face, shd = _scales(H, W, scales.get('nu', 18), ratio)
        on = smooth(u, scales.get('u0', 0.2) - 0.03, scales.get('u0', 0.2) + 0.03) * _band(v, *scales.get('v', (0.14, 2)), 0.06)
        out = out + hexc(rim['colour']) * (rim.get('amount', 0.5) * r * on)[..., None]
    if inner:
        out = out * (1 - inner.get('amount', 0.6) * _inner(H, W, inner['poly'], inner.get('soft', 6)))[..., None]
    if lantern:
        inside, frame, depth = _lantern(H, W, **lantern)
        g = mix(hexc(lantern.get('glow', '#7FE9D2')), hexc(lantern.get('hot', '#F2FFF4')), depth ** 1.6)
        out = mix(out, g * (0.45 + 0.55 * depth)[..., None], inside)
        out = out * (1 - lantern.get('frame_dark', 0.92) * frame)[..., None]
    if pores:
        out = out + hexc(pores.get('glow', '#B58CFF')) * (pores.get('lit', 0.6) * _pores(H, W, ratio, **pores))[..., None]
    for b in blobs or []:
        d = np.hypot((u - b['u']) * W, (v - b['v']) * H / ratio / b.get('squash', 1.0)) / (b['r'] * W)
        out = out + hexc(b['colour']) * (b.get('amount', 0.6) * (1 - smooth(d, 1 - b.get('soft', 0.5), 1 + b.get('soft', 0.5))))[..., None]
    for mk in marks or []:                                               # a mark that glows: its line at `lit`, its halo at halo.amount
        if 'glow' not in mk:
            continue
        halo, line = _marks(H, W, mk)
        out = out + hexc(mk['glow']) * (mk.get('lit', 0.6) * line + (mk['halo'].get('lit', 0.25) * halo if mk.get('halo') else 0))[..., None]
    return np.clip(out, 0, 1)


def fin(H, W, seed=0, colour='#E8A23A', tip=None, root=None, rays=6, ray='#9A5A1E', ray_w=1.8, ray_amount=0.6, pleat=0.10, rim=None, band=None, fade=None, dip=0.28, **_):
    """A fin: `rays` rays from the root (bottom) to the edge (top), the first and last on the patch's sides.
    rim {colour, w, amount}: a band along the edge; band {colour, v: (lo, hi), amount}: a band across the rays;
    fade {colour, u: (from, to)}: the whole fin turns to this colour along its root; dip: how dark it is at the root."""
    yy, xx, v = _grid(H, W)
    img = hexc(colour) * np.ones((H, W, 3))
    if root:
        img = mix(hexc(root), img, smooth(v, 0.0, 0.5))
    if tip:
        img = mix(img, hexc(tip), smooth(v, 0.4, 1.0))
    if fade:
        img = mix(img, hexc(fade['colour']), fade.get('amount', 1.0) * smooth(xx, *fade.get('u', (0, 1))))
    k = xx * rays
    f = np.abs(k - np.round(k)) * W / rays                               # pixels from the nearest ray
    img = shade(img, 1 + pleat * np.cos(2 * np.pi * k))                  # lighter on the rays, darker in the folds between
    if band:
        img = mix(img, hexc(band['colour']), band.get('amount', 0.7) * _band(v, *band.get('v', (0.4, 0.6)), 0.05))
    img = mix(img, hexc(ray), ray_amount * np.exp(-(f / ray_w) ** 2) * (1 - 0.45 * v))
    if rim:
        w = rim.get('w', 0.16)
        img = mix(img, hexc(rim['colour']), rim.get('amount', 0.9) * smooth(v, 1 - w - 0.05, 1 - w + 0.05))
    img = shade(img, 1 - dip * np.exp(-(v / 0.10) ** 2))                 # darker where it goes into the body
    return shade(img, 0.95 + 0.10 * stretch(fbm(H, W, 3, 3, seed)))


def finglow(H, W, seed=0, colour='#3FE0F0', w=0.16, amount=0.8, rays=0, body=0.0, **_):
    """A fin's glow map: a lit band along its edge, and `body` of the colour over the rest."""
    yy, xx, v = _grid(H, W)
    m = amount * smooth(v, 1 - w - 0.05, 1 - w + 0.05) + body * smooth(v, 0.05, 0.5)
    if rays:
        k = xx * rays
        m = m * (0.75 + 0.25 * np.cos(2 * np.pi * k))
    return hexc(colour) * np.clip(m, 0, 1)[..., None]


def eye(H, W, seed=0, iris='#D9A23A', pupil=0.50, iris_r=0.72, white='#F6F2E8', ring='#191516', shine=1.0, **_):
    """An eye seen face on: a dark lid line, the white, an iris with a dark edge, the pupil, and two glints (the big one up and toward the nose)."""
    yy, xx, v = _grid(H, W)
    X, Y = (xx - 0.5) / 0.48, (yy - 0.5) / 0.48
    r = np.hypot(X, Y)
    img = shade(hexc(white) * np.ones((H, W, 3)), 1 - 0.20 * smooth(r, 0.45, 0.95))
    ir = hexc(iris)
    streak = 0.5 + 0.5 * np.sin(np.arctan2(Y, X) * 22 + 6 * fbm(H, W, 3, 3, seed))
    disc = mix(ir * 0.72, np.minimum(ir * 1.25, 1), (0.35 + 0.65 * streak) * smooth(r, pupil * 0.8, iris_r))
    disc = shade(disc, 1 - 0.25 * smooth(Y, 0.1, -0.6))                 # the lid shades the top of the iris
    img = mix(img, disc, 1 - smooth(r, iris_r - 0.03, iris_r + 0.03))
    img = mix(img, ir * 0.4, 0.8 * np.exp(-((r - iris_r) / 0.045) ** 2))
    img = mix(img, hexc('#0B0A0C'), 1 - smooth(r, pupil - 0.03, pupil + 0.03))
    if shine:
        img = mix(img, np.ones(3), shine * (1 - smooth(np.hypot(X + 0.27, Y + 0.30), 0.14, 0.19)))
        img = mix(img, np.ones(3), 0.8 * shine * (1 - smooth(np.hypot(X - 0.25, Y - 0.27), 0.05, 0.085)))
    return mix(img, hexc(ring), smooth(r, 0.88, 0.96))


def eyeglow(H, W, seed=0, colour='#DDF2E0', amount=0.7, r0=0.72, **_):
    yy, xx, v = _grid(H, W)
    r = np.hypot((xx - 0.5) / 0.48, (yy - 0.5) / 0.48)
    return hexc(colour) * (amount * (1 - smooth(r, r0 - 0.05, r0 + 0.05)))[..., None]


def lid(H, W, seed=0, colour='#E4DEEA', crease='#6A5890', w=1.6, **_):
    """A shut eye seen face on (the nose to the left): a lid the colour of the skin, lit from above, and the line where
    the lids meet, curving down."""
    yy, xx, v = _grid(H, W)
    X, Y = (xx - 0.5) / 0.48, (yy - 0.5) / 0.48
    r = np.hypot(X, Y)
    img = shade(hexc(colour) * np.ones((H, W, 3)), (1 - 0.16 * smooth(r, 0.4, 0.95)) * (1 + 0.08 * smooth(-Y, 0.0, 0.8)))
    d = np.abs(Y - (0.12 - 0.3 * X ** 2)) * H * 0.48
    img = shade(img, 1 - 0.12 * np.exp(-((Y - 0.12 + 0.3 * X ** 2 - 0.12) * H * 0.48 / 4.0) ** 2) * (np.abs(X) < 0.8))     # the lower lid's shadow
    return mix(img, hexc(crease), 0.9 * np.exp(-(d / w) ** 2) * smooth(0.85 - np.abs(X), 0, 0.15))


def maw(H, W, seed=0, colour='#9E3A40', deep='#3A1216', tongue='#D9777A', **_):
    """The inside of an open mouth seen from the front: red, darker down the throat, a tongue lying in it."""
    yy, xx, v = _grid(H, W)
    X, Y = (xx - 0.5) / 0.48, (yy - 0.5) / 0.48
    img = mix(hexc(deep), hexc(colour), smooth(np.hypot(X, Y), 0.2, 0.95))
    return mix(img, hexc(tongue), 0.85 * (1 - smooth(np.hypot(X / 0.62, (Y - 0.42) / 0.34), 0.75, 1.0)))


def mosspad(H, W, seed=0, tone=('#3F6B2C', '#79AE46', '#BFE070'), **_):
    """A cushion of bright moss: v = 0 where it meets what it grows on."""
    yy, xx, v = _grid(H, W)
    d, c, l = [hexc(s) for s in tone]
    img = mix(d, c, stretch(fbm(H, W, 7, 7, seed, 3)))
    img = mix(img, l, 0.8 * smooth(stretch(fbm(H, W, 16, 16, seed + 1, 2)), 0.6, 0.9))
    img = mix(img, d * 0.8, 0.5 * speckle(H, W, seed + 2, 0.03, (1.2, 1.4)))
    return shade(img, 0.72 + 0.28 * smooth(v, 0.0, 0.3))


def flower(H, W, seed=0, petals=5, colour='#F7F5EC', heart='#EBC43C', ground='#79AE46', **_):
    """A small flower seen from above, filling the patch: petals, a yellow heart."""
    yy, xx, v = _grid(H, W)
    X, Y = (xx - 0.5) * 2, (yy - 0.5) * 2
    r, a = np.hypot(X, Y), np.arctan2(Y, X)
    edge = 0.52 + 0.46 * np.abs(np.cos(a * petals / 2)) ** 0.7
    img = mix(hexc(ground) * np.ones((H, W, 3)), hexc(colour), 1 - smooth(r, edge - 0.06, edge + 0.02))
    img = shade(img, 1 - 0.16 * smooth(r, 0.75, 0.2) * (r > 0.22))        # the petals are a little grey toward the heart
    return mix(img, hexc(heart), 1 - smooth(r, 0.17, 0.25))


def sprig(H, W, seed=0, tone=('#3E6A35', '#7FA64A', '#C9D68A'), **_):
    """A blade of sedge standing up the patch: darker at the foot, a pale midrib, a yellowing tip."""
    yy, xx, v = _grid(H, W)
    d, c, l = [hexc(s) for s in tone]
    img = mix(d, c, smooth(v, 0.0, 0.6))
    img = mix(img, l, 0.7 * smooth(v, 0.6, 1.0))
    img = mix(img, l, 0.5 * np.exp(-(((xx - 0.5) * W) / 1.6) ** 2))
    return shade(img, 0.92 + 0.12 * strokes(H, W, seed, 'y', 4, 40))


FISH = {'fishskin': fishskin, 'skinglow': skinglow, 'fin': fin, 'finglow': finglow, 'eye': eye, 'eyeglow': eyeglow, 'lid': lid, 'maw': maw,
        'mosspad': mosspad, 'flower': flower, 'sprig': sprig}
