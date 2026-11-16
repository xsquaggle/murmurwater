"""callomats.py : painted skin, hair, straw and cloth for a person who is built in code (figure.mjs, build-calloway.mjs).
mats.py adds these to its table, so the figure's layout names them like any other material.

A face patch is the head seen from the front, flat: `span` metres across and high, its middle at x = 0 and height `cy`
(the builder projects the front of the head into it), so features are given in metres where they are on the head.
Skin that joins the face (the sides and back of the head) is given the heights of its bottom and top edges (`ys`), so
that the shading that depends on height is the same on both sides of the join.
"""
import numpy as np
from paintkit import hexc, mix, smooth, fbm, stretch, blur, strokes, shade, speckle, polymask, linemask


def _grid(H, W):
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    xx = (np.arange(W)[None, :] + 0.5) / W * np.ones((H, 1))
    return yy, xx, 1 - yy


def _shadow(colour, amount=0.5, to='#8A3F3A'):
    """The colour a skin or cloth has in shade: darker and a little toward a warm red-brown."""
    return mix(hexc(colour), hexc(to) * 0.9, amount)


def _headshade(img, y, colour, top=1.50, chin=1.305):
    """What the head's skin gets by height alone: the hair's shadow toward the top, the jaw's toward the bottom."""
    dark = _shadow(colour, 0.42)
    img = mix(img, dark, 0.55 * smooth(y, top, top + 0.085))
    return mix(img, dark, 0.22 * smooth(chin - y, 0.0, 0.05))


def face(H, W, seed=0, colour='#DDA680', blush='#E57F6C', hair='#3A2A24', cy=1.44, span=0.42, eye=(0.068, 1.447), eyeR=(0.0165, 0.0215),
         mouth=(0.0, 1.348), brow=1.512, cheek=(0.094, 1.385), smile=1.0, freckles=18, lash=True, **_):
    """The front of a head: skin, blush, dot eyes with a light in them, brows, an open smile."""
    yy, xx, v = _grid(H, W)
    x, y = (xx - 0.5) * span, cy - span / 2 + v * span
    px = span / W                                                    # metres to a pixel
    X, Y = (lambda a: (0.5 + a / span) * W), (lambda b: (1 - (b - (cy - span / 2)) / span) * H)
    skin, ink = hexc(colour), hexc('#2A1C1B')
    img = _headshade(skin * np.ones((H, W, 3)), y, colour)
    rs = np.random.default_rng(seed)
    # cheeks: a round blush, strongest in its middle
    for s in (-1, 1):
        d = np.hypot((x - s * cheek[0]) / 0.036, (y - cheek[1]) / 0.027)
        img = mix(img, hexc(blush), 0.62 * np.exp(-d ** 2.4))
    # a little warmth across the nose, and the nose's shadow under it
    img = mix(img, hexc(blush), 0.20 * np.exp(-((x / 0.05) ** 2 + ((y - 1.402) / 0.02) ** 2)))
    img = mix(img, _shadow(colour, 0.5), 0.35 * np.exp(-((x / 0.022) ** 2 + ((y - 1.386) / 0.008) ** 2)))
    # freckles over the cheeks
    fk = np.zeros((H, W))
    for _i in range(freckles):
        fx, fy = rs.uniform(0.026, 0.118) * rs.choice([-1, 1]), cheek[1] + rs.uniform(0.004, 0.036)
        fk = np.maximum(fk, smooth(rs.uniform(0.0016, 0.0027) - np.hypot(x - fx, y - fy), -px, px))
    img = mix(img, _shadow(colour, 0.55, '#8A4A2A'), 0.55 * fk)
    # eyes
    for s in (-1, 1):
        ex, ey = s * eye[0], eye[1]
        d = np.hypot((x - ex) / eyeR[0], (y - ey) / eyeR[1])
        aa = px / eyeR[0]
        img = mix(img, _shadow(colour, 0.5), 0.30 * np.exp(-((d - 1.0) / 0.55) ** 2) * (d > 1))      # the lid's soft edge round the eye
        m = smooth(1.0 - d, -aa, aa)
        img = mix(img, ink, m)
        img = mix(img, hexc('#7A4A32'), 0.60 * m * smooth(ey - y, 0.15 * eyeR[1], 0.95 * eyeR[1]) * smooth(1.0 - d, 0.0, 0.5))      # a warm brown low in the eye
        for hx, hy, hr, ha in ((-0.0052, 0.0090, 0.0056, 1.0), (0.0058, -0.0090, 0.0027, 0.75)):                                # the light in it
            img = mix(img, np.ones(3), ha * smooth(hr - np.hypot(x - (ex + hx), y - (ey + hy)), -px, px) * m)
        if lash:                                                    # the upper lid: a dark line over the eye, flicked out at the outer corner
            arc = [(X(ex + s * 1.10 * eyeR[0] * np.cos(a)), Y(ey + 1.08 * eyeR[1] * np.sin(a))) for a in np.radians(np.linspace(178, 14, 16))]
            arc.append((X(ex + s * (1.10 * eyeR[0] + 0.0085)), Y(ey + 0.52 * eyeR[1])))
            img = mix(img, ink, 0.95 * linemask(H, W, [arc], 0.0036 / px))
    # brows: short, thick at the inner end, arched and lifted
    polys = []
    for s in (-1, 1):
        t = np.linspace(0, 1, 12)
        bx, by = s * (eye[0] - 0.030 + 0.066 * t), brow + 0.0075 * np.sin(np.pi * (0.15 + 0.75 * t)) + 0.002 * t
        hw = 0.0047 * (1 - 0.62 * t ** 1.6)
        polys.append([(X(a), Y(b + c)) for a, b, c in zip(bx, by, hw)] + [(X(a), Y(b - c)) for a, b, c in zip(bx[::-1], by[::-1], hw[::-1])])
    img = mix(img, hexc(hair), 0.96 * polymask(H, W, polys))
    # the mouth: an open smile, its corners turned up; teeth along the top, the tongue low in it
    mx, my, w, deep = mouth[0], mouth[1], 0.035, 0.024 * smile
    q = np.clip((x - mx) / w, -1, 1)
    top = my + 0.004 + 0.010 * q ** 2
    bot = top - deep * np.sqrt(np.clip(1 - q ** 2, 0, 1)) ** 0.9
    f = np.minimum(top - y, y - bot)
    f = np.where(np.abs(x - mx) < w, f, -1.0)
    m = smooth(f, -px, px)
    img = mix(img, _shadow(colour, 0.62), 0.9 * smooth(f, -2.6 * px, -0.4 * px) * (1 - m))            # the lips' line round it
    inside = mix(hexc('#8A3338'), hexc('#6A2428'), smooth(top - y, 0.0, deep))
    tongue = smooth(1 - np.hypot((x - mx) / 0.026, (y - (my + 0.004 - deep + 0.002)) / 0.014), -0.06, 0.06)
    inside = mix(inside, hexc('#E08784'), tongue)
    inside = mix(inside, hexc('#C96F72'), 0.5 * tongue * np.exp(-((x - mx) / 0.0022) ** 2))            # the line down the tongue
    teeth = smooth(0.0098 - (top - y), -px, px)
    inside = mix(inside, hexc('#FAF3E6'), teeth)
    inside = mix(inside, hexc('#D9CDBE'), 0.5 * teeth * smooth(top - y, 0.0065, 0.0098))               # their lower edge, in shade
    img = mix(img, inside, m)
    for s in (-1, 1):                                               # the crease at each corner of the smile
        cx0, cy0 = mx + s * (w + 0.001), my + 0.014
        crease = [(X(cx0 - s * 0.004), Y(cy0 - 0.007)), (X(cx0 + s * 0.002), Y(cy0 + 0.001)), (X(cx0 + s * 0.005), Y(cy0 + 0.009))]
        img = mix(img, _shadow(colour, 0.62), 0.8 * linemask(H, W, [crease], 0.0026 / px))
    return img


def skin(H, W, seed=0, colour='#DDA680', tip=None, tipfrom=0.35, ys=None, var=0.02, tile_x=False, knuckles=0, **_):
    """Plain skin. tip: a colour it turns toward its top edge (the end of a nose, of a finger); ys: [bottom, top] heights
    in metres of a patch that belongs to the head."""
    yy, xx, v = _grid(H, W)
    img = hexc(colour) * np.ones((H, W, 3))
    if ys:
        img = _headshade(img, ys[0] + (ys[1] - ys[0]) * v, colour)
    else:
        img = shade(img, 1 - var + 2 * var * stretch(fbm(H, W, max(2, H / 64), max(2, W / 64), seed, 2, tile_x=tile_x)))
    if tip:
        img = mix(img, hexc(tip), 0.55 * smooth(v, tipfrom, 1.0))
    return img


def hair(H, W, seed=0, colour='#3A2A24', sheen='#6E4A36', along='y', shine=0.5, band=0.6, locks=7, tile_x=True, **_):
    """Hair combed along the patch (along = 'y': from the bottom edge to the top; 'x': round it): broad strands, darker
    partings between locks, and a band of light across the strands."""
    yy, xx, v = _grid(H, W)
    if along == 'x':
        st = strokes(H, W, seed, 'x', 2.5, 22, tile_x=tile_x)
        lk = stretch(fbm(H, W, locks, 1, seed + 1, 2, tile_x=tile_x))
    else:
        st = strokes(H, W, seed, 'y', 2.5, 22 * max(1.0, W / max(H, 1) / 2.0), tile_x=tile_x)
        lk = stretch(fbm(H, W, 1, locks, seed + 1, 2, tile_x=tile_x))
    c, l = hexc(colour), hexc(sheen)
    img = mix(c * 0.90, mix(c, l, 0.30), st)
    img = shade(img, 0.84 + 0.20 * smooth(lk, 0.10, 0.55))                                 # partings
    wob = 0.08 * (lk - 0.5) + 0.03 * (st - 0.5)
    b = np.exp(-(((v - band - wob) / 0.11) ** 2))
    img = mix(img, np.minimum(l * 1.30, 1), shine * b * (0.45 + 0.55 * st))
    return shade(img, 0.88 + 0.12 * smooth(v, 0.0, 0.2))                                   # darker at its under edge


def straw(H, W, seed=0, colour='#DDC98E', coils=12, under=0.0, pitch=1.0, tile_x=True, **_):
    """Plaited straw sewn in coils that run along x (round a hat): v counts the coils. The part of v below `under` is
    the underside of a brim, in the hat's own shade."""
    yy, xx, v = _grid(H, W)
    c = hexc(colour)
    rows = v * coils
    k = np.floor(rows)
    f = rows - k
    ch = H / coils                                                   # a coil's height in pixels
    n = max(8, int(round(W / (ch * pitch))))                         # stitches round the patch
    side = np.where(f < 0.5, 1.0, -1.0)
    ph = xx * n + side * (f - 0.5) * 1.15 + 0.5 * (k % 2)
    cell = np.floor(ph)
    g = ph - cell
    rs = np.random.default_rng(seed)
    tone = rs.uniform(0.86, 1.10, (coils + 2, n + 2))[np.clip(k.astype(int), 0, coils + 1), (cell.astype(int) % n)]
    img = c * np.ones((H, W, 3))
    img = shade(img, tone)
    img = shade(img, 1 - 0.20 * np.exp(-((np.minimum(g, 1 - g) / 0.16) ** 2)))            # between two straws
    img = shade(img, 1 - 0.34 * np.abs(2 * f - 1) ** 3.0)                                   # between two coils
    img = mix(img, np.minimum(c * 1.18, 1), 0.35 * np.exp(-(((f - 0.42) / 0.16) ** 2)) * smooth(np.minimum(g, 1 - g), 0.1, 0.4))   # the light along each coil
    img = shade(img, 0.93 + 0.12 * stretch(fbm(H, W, max(2, H / 80), max(2, W / 80), seed + 1, 3, tile_x=tile_x)))
    img = mix(img, hexc('#B58F54'), 0.28 * smooth(stretch(fbm(H, W, max(2, H / 30), max(2, W / 30), seed + 2, 3, tile_x=tile_x)), 0.6, 0.95))      # weathered patches
    if under:
        u = 1 - smooth(v, under - 0.03, under + 0.03)
        img = mix(img, np.minimum(img * 1.10, 1), u)                                       # the underside: painted lighter, since the light never reaches it
        img = shade(img, 1 - 0.12 * u * np.exp(-(v / (0.45 * under)) ** 2))                 # darker toward the head
    return img


def _dash(H, W, pts, dash=5.0, gap=4.0, width=1.4):
    """Stitches along a poly-line given in pixels: a 0..1 mask of dashes."""
    segs, carry = [], 0.0
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        L = float(np.hypot(x1 - x0, y1 - y0))
        if L < 1e-6:
            continue
        t = -carry
        while t < L:
            a, b = max(t, 0.0), min(t + dash, L)
            if b > a:
                segs.append([(x0 + (x1 - x0) * a / L, y0 + (y1 - y0) * a / L), (x0 + (x1 - x0) * b / L, y0 + (y1 - y0) * b / L)])
            t += dash + gap
        carry = L - (t - dash - gap) - (dash + gap) if t > L else 0.0
        carry = 0.0
    return linemask(H, W, segs, width) if segs else np.zeros((H, W))


def _seam(img, H, W, pts, base, stitch=True, side=1, k=1.0):
    """A sewn seam along a poly-line in pixels: a dark groove, a lit lip beside it, and a row of stitches."""
    c = np.asarray(base, float)
    img = mix(img, c * 0.50, 0.80 * linemask(H, W, [pts], 1.7 * k))
    img = mix(img, np.minimum(c * 1.30 + 0.03, 1), 0.45 * linemask(H, W, [[(x - 1.6 * k, y - 1.6 * k) for x, y in pts]], 1.2 * k))
    if stitch:
        off = [(x + side * 5.0 * k * (y1 - y0) / max(1e-6, np.hypot(x1 - x0, y1 - y0)), y - side * 5.0 * k * (x1 - x0) / max(1e-6, np.hypot(x1 - x0, y1 - y0)))
               for (x, y), (x0, y0), (x1, y1) in zip(pts, [pts[0]] + pts[:-1], pts[1:] + [pts[-1]])]
        d = _dash(H, W, off, 5.0 * k, 3.5 * k, 1.5 * k)
        img = mix(img, np.minimum(c * 1.50 + 0.08, 1), 0.75 * d)
        img = mix(img, c * 0.6, 0.35 * np.clip(np.roll(d, (1, 1), (0, 1)) - d, 0, 1))
    return img


def _border(img, H, W, base, inset=6.0, rows=1, k=1.0, sides='tblr'):
    """Stitching round the edge of a patch, `inset` pixels in (two rows if rows = 2)."""
    for r in range(rows):
        i = inset + r * 4.5 * k
        P = {'t': [(i, i), (W - i, i)], 'b': [(i, H - i), (W - i, H - i)], 'l': [(i, i), (i, H - i)], 'r': [(W - i, i), (W - i, H - i)]}
        for sd in sides:
            d = _dash(H, W, P[sd], 5.0 * k, 3.5 * k, 1.5 * k)
            img = mix(img, np.minimum(np.asarray(base, float) * 1.50 + 0.08, 1), 0.75 * d)
    return img


def waxed(H, W, seed=0, colour='#7C7A4A', seams=(), cinch=None, hem=0.0, creases=1.0, tile_x=False, stitched=0, k=1.0, pleat=False, snap=None, sides='tblr', **_):
    """Waxed cotton: the wax lies unevenly, and every fold the cloth has had shows as a pale line.
    seams: [[u0, v0, u1, v1, side?], ...] sewn seams; cinch: [v, spread] where a belt gathers it; hem: how far up
    (0..1) the bottom edge is worn pale; stitched: pixels in from the edge for a row of stitching all round (a pocket);
    pleat: a box pleat down the middle; snap: [u, v, radius in pixels] a brass snap."""
    yy, xx, v = _grid(H, W)
    c = hexc(colour)
    img = mix(c * 0.84, np.minimum(c * 1.10, 1), stretch(fbm(H, W, max(2, H / 90), max(2, W / 90), seed, 3, tile_x=tile_x)))
    m1 = smooth(strokes(H, W, seed + 1, 'y', 5, 44 * max(1.0, W / 512), tile_x=tile_x), 0.80, 0.97)
    m2 = smooth(strokes(H, W, seed + 2, 'x', 7, 44 * max(1.0, H / 512), tile_x=tile_x), 0.84, 0.98)
    img = mix(img, np.minimum(c * 1.34 + 0.04, 1), 0.34 * creases * np.clip(m1 + 0.7 * m2, 0, 1) * stretch(fbm(H, W, 6, 6, seed + 3, 2, tile_x=tile_x)))
    if cinch:
        g = np.exp(-(((v - cinch[0]) / cinch[1]) ** 2))
        pl = strokes(H, W, seed + 4, 'y', 2.2, 30 * max(1.0, W / 512), tile_x=tile_x)
        img = shade(img, 1 - 0.26 * g * smooth(pl, 0.5, 0.9))
        img = mix(img, np.minimum(c * 1.30, 1), 0.22 * g * smooth(1 - pl, 0.6, 0.95))
    if hem:
        img = mix(img, np.minimum(c * 1.28 + 0.03, 1), 0.5 * np.exp(-((v / hem) ** 2)) * (0.5 + 0.5 * stretch(fbm(H, W, 3, max(4, W / 30), seed + 5, 2, tile_x=tile_x))))
    if pleat:
        img = shade(img, 1 - 0.14 * smooth(0.13 - np.abs(xx - 0.5), 0.0, 0.02))
        for u0 in (0.37, 0.63):
            img = _seam(img, H, W, [(u0 * W, 0.0), (u0 * W, float(H))], c, stitch=False, k=k)
    for sm in seams:
        img = _seam(img, H, W, [(sm[0] * W, (1 - sm[1]) * H), (sm[2] * W, (1 - sm[3]) * H)], c, side=sm[4] if len(sm) > 4 else 1, k=k)
    if stitched:
        img = _border(img, H, W, c, stitched, 2, k, sides)
    if snap:
        d = np.hypot(xx * W - snap[0] * W, yy * H - (1 - snap[1]) * H) / snap[2]
        img = shade(img, 1 - 0.35 * np.exp(-((d - 1.25) / 0.35) ** 2))
        b = mix(hexc('#C8973A'), hexc('#F4D27A'), smooth(0.6 - np.hypot(xx * W - snap[0] * W + 0.3 * snap[2], yy * H - (1 - snap[1]) * H + 0.3 * snap[2]) / snap[2], -0.3, 0.3))
        b = mix(b, hexc('#8A6127'), smooth(d, 0.72, 0.95))
        img = mix(img, b, smooth(1.0 - d, -0.08, 0.08))
    return img


def leather(H, W, seed=0, colour='#8C5C3C', stitch=0, worn=0.4, laces=None, toecap=None, tile_x=False, k=1.0, sides='tblr', strap=None, **_):
    """Leather: mottled, grained, scuffed pale. stitch: pixels in from the edge for a row of stitching;
    laces: {u, v0, v1, n, w} a laced front (eyelets either side of a tongue, the lace crossing between them);
    toecap: v of a seam across the patch; strap: [v, half height] a strap across with a buckle at u = 0.5."""
    yy, xx, v = _grid(H, W)
    c = hexc(colour)
    img = mix(c * 0.78, np.minimum(c * 1.14, 1), stretch(fbm(H, W, max(2, H / 70), max(2, W / 70), seed, 3, tile_x=tile_x)))
    img = shade(img, 1 - 0.10 * speckle(H, W, seed + 1, 0.03, (1.0, 1.0), tile_x=tile_x))
    scuff = smooth(stretch(fbm(H, W, max(2, H / 26), max(2, W / 26), seed + 2, 3, tile_x=tile_x)), 0.70, 0.95)
    img = mix(img, np.minimum(c * 1.45 + 0.05, 1), 0.35 * worn * scuff)
    if toecap is not None:
        img = _seam(img, H, W, [(0.12 * W, (1 - toecap) * H), (0.88 * W, (1 - toecap) * H)], c, k=k)
    if strap:
        on = smooth(strap[1] - np.abs(v - strap[0]), -0.01, 0.01)
        img = mix(img, mix(c * 0.62, c * 0.8, stretch(fbm(H, W, 3, 9, seed + 6, 2))), on)
        img = shade(img, 1 - 0.3 * smooth(strap[1] + 0.035 - np.abs(v - strap[0]), 0, 0.035) * (1 - on))
        bx, by = 0.5 * W, (1 - strap[0]) * H
        fr = np.maximum(np.abs(xx * W - bx) / (strap[1] * H * 1.5), np.abs(yy * H - by) / (strap[1] * H * 1.45))
        img = mix(img, mix(hexc('#C8973A'), hexc('#F4D27A'), smooth(1 - yy * H / max(by, 1) * 0.5, 0.3, 0.7)), smooth(1.0 - fr, -0.05, 0.05) * smooth(fr, 0.52, 0.62))
    if laces:
        u0, v0, v1, n, w = laces['u'], laces['v0'], laces['v1'], laces['n'], laces['w']
        inband = smooth(v, v0 - 0.03, v0) * (1 - smooth(v, v1, v1 + 0.03))
        img = shade(img, 1 - 0.30 * smooth(w * 0.55 - np.abs(xx - u0), 0, 0.012) * inband)                     # the tongue, in shade
        vs = np.linspace(v0 + 0.02, v1 - 0.02, n)
        P = lambda uu, vv: (uu * W, (1 - vv) * H)
        cross = []
        for a, b in zip(vs[:-1], vs[1:]):
            cross += [[P(u0 - w / 2, a), P(u0 + w / 2, b)], [P(u0 + w / 2, a), P(u0 - w / 2, b)]]
        cross += [[P(u0 - w / 2, vs[0]), P(u0 + w / 2, vs[0])]]
        lm = linemask(H, W, cross, 2.6 * k)
        img = shade(img, 1 - 0.35 * np.clip(blur(lm, 1.6) * 1.6 - lm, 0, 1))
        img = mix(img, hexc('#E3D3B0'), 0.95 * lm)
        for vv in vs:
            for sx in (-1, 1):
                d = np.hypot(xx * W - (u0 + sx * w / 2) * W, yy * H - (1 - vv) * H)
                img = mix(img, hexc('#D6A546'), smooth(3.6 * k - d, -0.8, 0.8))
                img = mix(img, hexc('#3A2A20'), smooth(1.5 * k - d, -0.6, 0.6))
    if stitch:
        img = _border(img, H, W, c, stitch, 1, k, sides)
    return img


def plaid(H, W, seed=0, colour='#D8C7A0', lines=('#3FA7A0', '#B5533C'), pitch=26.0, **_):
    """A lining: cream with a tattersall check of thin lines in two colours, taking turns."""
    yy, xx, v = _grid(H, W)
    c = hexc(colour)
    img = shade(c * np.ones((H, W, 3)), 0.94 + 0.10 * stretch(fbm(H, W, max(2, H / 40), max(2, W / 40), seed, 2)))
    for ax, n in ((xx * W, W), (yy * H, H)):
        k = ax / pitch
        i = np.floor(k + 0.5)
        f = np.abs(k - i) * pitch
        for ci, col in enumerate(lines):
            img = mix(img, hexc(col), 0.55 * np.exp(-(f / 1.3) ** 2) * (i % len(lines) == ci))
    weave = 0.5 + 0.25 * np.sin(2 * np.pi * xx * W / 3.0) + 0.25 * np.sin(2 * np.pi * yy * H / 3.0)
    return shade(img, 0.95 + 0.05 * weave)


def dots(H, W, seed=0, colour='#7A6390', dot='#F2E3C6', pitch=20.0, r=0.2, fold=0.5, tile_x=False, **_):
    """A neckerchief: one colour with small pale dots in a diamond pattern, and soft folds along it."""
    yy, xx, v = _grid(H, W)
    c = hexc(colour)
    img = shade(c * np.ones((H, W, 3)), 0.90 + 0.14 * stretch(fbm(H, W, max(2, H / 36), max(2, W / 36), seed, 2, tile_x=tile_x)))
    gx, gy = xx * W / pitch, yy * H / pitch
    a, b = (gx + gy) / 1.0, (gx - gy) / 1.0
    d = np.hypot(a - np.round(a), b - np.round(b))
    img = mix(img, hexc(dot), 0.9 * smooth(r - d, -0.05, 0.05))
    f = strokes(H, W, seed + 1, 'x', 3, 9, tile_x=tile_x)
    return shade(img, 1 - 0.22 * fold * smooth(f, 0.45, 0.9))


def tape(H, W, seed=0, colour='#EDBE3F', marks=60, **_):
    """A tailor's measuring tape hanging down: yellow, a tick at every mark from its left edge (longer at every fifth,
    right across at every tenth, with a red figure beside it), and a brass tip at each end."""
    yy, xx, v = _grid(H, W)
    c = hexc(colour)
    img = shade(c * np.ones((H, W, 3)), 0.93 + 0.12 * stretch(fbm(H, W, max(3, H / 30), 2, seed, 2)))
    k = v * marks
    idx = np.round(k).astype(int)
    f = np.abs(k - idx) * H / marks
    length = np.where(idx % 10 == 0, 0.86, np.where(idx % 5 == 0, 0.52, 0.30))
    img = mix(img, hexc('#2A2422'), 0.85 * np.exp(-(f / 0.9) ** 2) * (xx > 0.12) * (xx < 0.12 + length))
    num = (idx % 10 == 0) & (np.abs(k - idx + 0.33) * H / marks < 2.2) & (xx > 0.55) & (xx < 0.88)
    img = np.where(num[..., None], hexc('#B33A2E'), img)
    img = shade(img, 1 - 0.18 * (np.exp(-(xx / 0.08) ** 2) + np.exp(-((1 - xx) / 0.08) ** 2)))
    tip = (v < 0.014) | (v > 0.986)
    return np.where(tip[..., None], mix(hexc('#C8973A'), hexc('#F4D27A'), xx)[..., :], img)


def hand(H, W, seed=0, colour='#DDA680', tip='#E57F6C', **_):
    """A mitten of a hand, unrolled: u round it (its two flat faces at u = 0.25 and 0.75), v from the wrist to the
    finger tips. The fingers are drawn: three lines down each face."""
    yy, xx, v = _grid(H, W)
    img = hexc(colour) * np.ones((H, W, 3))
    dark = _shadow(colour, 0.5)
    img = mix(img, hexc(tip), 0.28 * smooth(v, 0.72, 1.0))
    for u0 in (0.25, 0.75):
        for i, du in enumerate((-0.078, 0.0, 0.078)):
            g = np.exp(-(((xx - u0 - du) * W / 1.5) ** 2)) * smooth(v, 0.50 + 0.03 * (i != 1), 0.60) * (1 - smooth(v, 0.955, 0.985))
            img = mix(img, dark, 0.85 * g)
        img = mix(img, dark, 0.20 * np.exp(-(((v - 0.52) / 0.035) ** 2)) * np.exp(-(((xx - u0) / 0.13) ** 2)) * (0.5 + 0.5 * np.cos((xx - u0) * 2 * np.pi / 0.078)))    # knuckles
    return img


def lens(H, W, seed=0, **_):
    """A magnifying glass seen face on: pale glass, lighter toward one side, with a glint."""
    yy, xx, v = _grid(H, W)
    r = np.hypot(xx - 0.5, yy - 0.5) * 2
    img = mix(hexc('#D6EEE6'), hexc('#8FC7C0'), smooth(r, 0.1, 1.0))
    img = mix(img, hexc('#6FA9A6'), 0.5 * smooth(xx + yy, 0.9, 1.6))
    a = np.arctan2(yy - 0.5, xx - 0.5)
    img = mix(img, np.ones(3), 0.85 * np.exp(-((r - 0.62) / 0.07) ** 2) * smooth(np.cos(a + 2.3), 0.55, 0.9))
    return img


def buckle(H, W, seed=0, colour='#8C5C3C', **_):
    """A brass belt buckle face on: a frame with the belt showing through it, and its prong."""
    yy, xx, v = _grid(H, W)
    img = leather(H, W, seed, colour)
    fr = np.maximum(np.abs(xx - 0.5) / 0.5, np.abs(yy - 0.5) / 0.5)
    b = mix(hexc('#C8973A'), hexc('#F4D27A'), smooth(1.2 - xx - yy, -0.3, 0.5))
    b = mix(b, hexc('#8A6127'), 0.6 * smooth(fr, 0.86, 1.0))
    on = np.maximum(smooth(fr, 0.56, 0.62), smooth(0.075 - np.abs(yy - 0.5), -0.01, 0.01) * (xx > 0.28))
    img = shade(img, 1 - 0.4 * np.clip(blur(on, 2.5) - on, 0, 1) * 2)
    return mix(img, b, on)


CALLO = {'face': face, 'skin': skin, 'hair': hair, 'straw': straw, 'waxed': waxed, 'leather': leather, 'plaid': plaid, 'dots': dots, 'tape': tape, 'hand': hand,
         'lens': lens, 'buckle': buckle}
