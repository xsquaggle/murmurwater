"""oakemats.py : painted materials for Captain Brannagh Oake (build-oake.mjs), added to the table in mats.py.
oldface (the front of an old weathered head: a squint, lines, wind-burnt cheeks, a mouth shut on a pipe), melton (the
dense navy wool of a pilot coat), clay (a white clay pipe, browned with use).
A rectangle is painted with its top row first: v = 1 at the top, as in callomats.py; a face patch is the head seen
from the front, `span` metres across and high about height `cy` (callomats.face explains it)."""
import numpy as np
from paintkit import hexc, mix, smooth, fbm, stretch, blur, strokes, shade, speckle, polymask, linemask
from callomats import _shadow, _seam, _border


def _grid(H, W):
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    xx = (np.arange(W)[None, :] + 0.5) / W * np.ones((H, 1))
    return yy, xx, 1 - yy


def oldface(H, W, seed=0, colour='#D29775', blush='#C8604F', brows='#D8D4CC', cy=1.282, span=0.42, eye=(0.062, 1.290), eyeR=(0.0128, 0.0135),
            mouth=(0.0, 1.204), brow=1.326, cheek=(0.088, 1.238), cap=1.385, chin=1.13, pipe=None, **_):
    """The front of an old head that has spent its life in the wind: dark dot eyes with a light in them, half shut under
    heavy lids; thick pale brows; lines across the forehead, at the corners of the eyes and down from the nose; cheeks
    and nose burnt red; a few brown spots; the mouth shut, a little smile in it, and in its right corner (pipe = [x, y])
    the stem of a pipe."""
    yy, xx, v = _grid(H, W)
    x, y = (xx - 0.5) * span, cy - span / 2 + v * span
    px = span / W
    X, Y = (lambda a: (0.5 + a / span) * W), (lambda b: (1 - (b - (cy - span / 2)) / span) * H)
    skin, ink = hexc(colour), hexc('#24191A')
    line = _shadow(colour, 0.58)
    rs = np.random.default_rng(seed)
    img = shade(skin * np.ones((H, W, 3)), 0.95 + 0.08 * stretch(fbm(H, W, max(2, H / 40), max(2, W / 40), seed, 3)))
    img = mix(img, _shadow(colour, 0.45), 0.6 * smooth(y, cap - 0.03, cap + 0.01))                        # the cap's shadow on the brow
    img = mix(img, _shadow(colour, 0.40), 0.25 * smooth(chin + 0.05 - y, 0.0, 0.05))                      # under the jaw
    # wind burn: the cheeks, the nose, the tops of the ears' side of the face, in a broken flush
    flush = np.zeros((H, W))
    for s in (-1, 1):
        flush = np.maximum(flush, np.exp(-np.hypot((x - s * cheek[0]) / 0.040, (y - cheek[1]) / 0.030) ** 2.2))
    flush = np.maximum(flush, 0.85 * np.exp(-((x / 0.026) ** 2 + ((y - 1.255) / 0.026) ** 2)))
    broken = 0.65 + 0.35 * stretch(fbm(H, W, max(4, H / 9), max(4, W / 9), seed + 1, 2))
    img = mix(img, hexc(blush), 0.58 * flush * broken)
    # a few brown spots on the temples and cheeks
    sp = np.zeros((H, W))
    for _i in range(9):
        fx, fy = rs.uniform(0.07, 0.13) * rs.choice([-1, 1]), rs.uniform(1.22, 1.35)
        sp = np.maximum(sp, smooth(rs.uniform(0.0025, 0.0045) - np.hypot(x - fx, y - fy), -1.5 * px, 1.5 * px))
    img = mix(img, _shadow(colour, 0.35, '#7A4A2A'), 0.45 * sp)
    # the nose's shadow under it, and the shadow beside each nostril
    img = mix(img, _shadow(colour, 0.55), 0.40 * np.exp(-((x / 0.026) ** 2 + ((y - 1.236) / 0.008) ** 2)))
    L = []                                                          # every line on the face: [points in metres, width in metres, strength]
    for s in (-1, 1):
        ex, ey = s * eye[0], eye[1]
        # crow's feet: three short lines fanning out from the outer corner
        for a, ln in ((14, 0.020), (-6, 0.024), (-26, 0.018)):
            r0, aa = eyeR[0] + 0.010, np.radians(a)
            L.append(([(ex + s * r0 * np.cos(aa), ey + r0 * np.sin(aa)), (ex + s * (r0 + 0.6 * ln) * np.cos(aa), ey + (r0 + 0.6 * ln) * np.sin(aa) - 0.001),
                       (ex + s * (r0 + ln) * np.cos(aa * 1.25), ey + (r0 + ln) * np.sin(aa * 1.25) - 0.003)], 0.0016, 0.55))
        # a bag under each eye
        t = np.linspace(0, 1, 9)
        L.append(([(ex + s * (-0.012 + 0.030 * k), ey - 0.019 - 0.006 * np.sin(np.pi * k)) for k in t], 0.0018, 0.38))
        # from the wing of the nose down past the corner of the mouth
        L.append(([(s * 0.030, 1.250), (s * 0.041, 1.232), (s * 0.048, 1.214), (s * 0.050, 1.196), (s * 0.046, 1.180)], 0.0024, 0.62))
        # a short line under each corner of the mouth
        L.append(([(s * 0.040, 1.193), (s * 0.044, 1.178), (s * 0.045, 1.166)], 0.0018, 0.40))
    # two long lines across the forehead and a short one, between the brows and the cap
    for yb, w0, a0 in ((brow + 0.020, 0.074, 0.55), (brow + 0.036, 0.062, 0.45)):
        t = np.linspace(-1, 1, 15)
        L.append(([(w0 * k, yb + 0.0035 * np.cos(np.pi * k) + 0.0015 * np.sin(5 * k + seed)) for k in t], 0.0017, a0))
    L.append(([(-0.008, brow - 0.004), (-0.006, brow + 0.010)], 0.0016, 0.45))                    # a frown line between the brows
    L.append(([(0.010, brow - 0.005), (0.008, brow + 0.008)], 0.0015, 0.30))
    for pts, w, a in L:
        pp = [(X(p), Y(q)) for p, q in pts]
        m = linemask(H, W, [pp], w / px)
        img = mix(img, line, a * m)
        img = mix(img, np.minimum(skin * 1.10, 1), 0.30 * a * np.clip(linemask(H, W, [[(p0 + 1.2, q0 - 1.2) for p0, q0 in pp]], 0.8 * w / px) - m, 0, 1))   # a lit edge above each line
    # eyes: small and dark, a light in each, the upper lid heavy across the top of the eye
    for s in (-1, 1):
        ex, ey = s * eye[0], eye[1]
        d = np.hypot((x - ex) / eyeR[0], (y - ey) / eyeR[1])
        aa = px / eyeR[0]
        img = mix(img, _shadow(colour, 0.45), 0.35 * np.exp(-((d - 1.0) / 0.7) ** 2) * (d > 1))
        lidf = lambda xv: ey + 0.40 * eyeR[1] + 0.02 * eyeR[1] * ((xv - ex) / eyeR[0]) * s     # the lid's edge, level across the eye
        lid = lidf(x)
        m = smooth(1.0 - d, -aa, aa) * smooth(lid - y, -px, px)
        img = mix(img, ink, m)
        img = mix(img, hexc('#4A5A66'), 0.55 * m * smooth(ey - y, 0.1 * eyeR[1], 0.9 * eyeR[1]))                 # grey-blue low in the eye
        img = mix(img, np.ones(3), smooth(0.0034 - np.hypot(x - (ex - 0.0040), y - (ey + 0.0010)), -px, px) * m)
        arc = [(X(ex + s * 1.25 * eyeR[0] * np.cos(a)), Y(lidf(ex + s * 1.25 * eyeR[0] * np.cos(a)) + 0.0016 + 0.0026 * np.sin(a))) for a in np.radians(np.linspace(180, 0, 14))]
        img = mix(img, ink, 0.92 * linemask(H, W, [arc], 0.0030 / px))                        # the lid's edge
        flick = [arc[-1], (X(ex + s * (1.25 * eyeR[0] + 0.0065)), Y(lidf(ex + s * 1.25 * eyeR[0]) + 0.0050))]
        img = mix(img, ink, 0.85 * linemask(H, W, [flick], 0.0024 / px))                      # a few lashes flicked out at the outer corner
        fold = [(X(ex + s * 1.15 * eyeR[0] * np.cos(a)), Y(lidf(ex + s * 1.15 * eyeR[0] * np.cos(a)) + 0.0075 + 0.0034 * np.sin(a))) for a in np.radians(np.linspace(165, 10, 12))]
        img = mix(img, line, 0.45 * linemask(H, W, [fold], 0.0018 / px))                       # the fold of the lid above it
    # brows: thick, straight, pale, drooping at their outer ends, drawn in short hairs
    hm = np.zeros((H, W))
    for s in (-1, 1):
        for k in range(26):
            t = (k + 0.5) / 26 + rs.uniform(-0.015, 0.015)
            bx, by = s * (eye[0] - 0.034 + 0.070 * t), brow + 0.005 * np.sin(np.pi * min(1.0, t * 1.2)) - 0.003 * max(0.0, t - 0.7) / 0.3
            hw = 0.0058 * (1 - 0.45 * t)
            yo = rs.uniform(-hw, hw)
            ang = np.radians(rs.uniform(10, 32))
            lnh = rs.uniform(0.007, 0.011)
            hm = np.maximum(hm, linemask(H, W, [[(X(bx - s * 0.4 * lnh * np.cos(ang)), Y(by + yo - 0.4 * lnh * np.sin(ang))), (X(bx + s * 0.6 * lnh * np.cos(ang)), Y(by + yo + 0.6 * lnh * np.sin(ang)))]], 0.0016 / px))
    img = mix(img, _shadow(colour, 0.5), 0.45 * np.clip(blur(hm, 1.5) * 1.5, 0, 1))
    img = mix(img, hexc(brows), 0.95 * hm)
    # the mouth: shut, a thin dark line, the lower lip a little lit, the corners turned up a very little
    mx, my, w = mouth[0], mouth[1], 0.036
    t = np.linspace(-1, 1, 17)
    pts = [(mx + w * k, my + 0.0030 * abs(k) ** 2.4 - 0.0010 * (1 - k * k)) for k in t]
    img = mix(img, _shadow(colour, 0.30, '#A8504A'), 0.55 * smooth(0.0065 - np.abs(y - (my - 0.0075)) - 0.6 * np.maximum(np.abs(x - mx) - 0.6 * w, 0), 0.0, 0.003) * (np.abs(x - mx) < w))   # the lower lip
    img = mix(img, np.minimum(skin * 1.12, 1), 0.35 * np.exp(-(((y - (my - 0.0085)) / 0.0018) ** 2)) * np.exp(-((x - mx) / (0.6 * w)) ** 4))
    img = mix(img, ink * 1.4, 0.85 * linemask(H, W, [[(X(p), Y(q)) for p, q in pts]], 0.0024 / px))
    img = mix(img, _shadow(colour, 0.5), 0.35 * np.exp(-((x / 0.010) ** 2 + ((y - (chin + 0.022)) / 0.006) ** 2)))   # under the lower lip, the chin's dimple
    if pipe:                                                        # the corner of the mouth opened round the stem
        d = np.hypot(x - pipe[0], (y - pipe[1]) * 1.15)
        img = mix(img, _shadow(colour, 0.6), 0.75 * smooth(0.0085 - d, -px, px))
        img = mix(img, ink, 0.7 * smooth(0.0060 - d, -px, px))
    return img


def melton(H, W, seed=0, colour='#27324A', seams=(), hem=0.0, stitched=0, k=1.0, sides='tblr', worn=0.3, flapline=None, holes=None, welts=None, tile_x=False, **_):
    """Melton: a dense felted wool, close and soft, with almost no weave to see: a fine fuzz of fibres over a slow
    mottle, a little paler where it has been rubbed. seams: [[u0, v0, u1, v1, side?], ...]; hem: how far up (0..1) the
    bottom edge is worn; stitched: pixels in from the edge for stitching round the patch; flapline: u of the edge of a
    double-breasted front (its shadow falls to the right of it); holes: [[u, v, radius in pixels], ...] buttonholes
    whose buttons are modelled; welts: [[u0, v0, u1, v1, width in pixels], ...] the edged mouths of slash pockets."""
    yy, xx, v = _grid(H, W)
    c = hexc(colour)
    img = mix(c * 0.86, np.minimum(c * 1.10, 1), stretch(fbm(H, W, max(2, H / 120), max(2, W / 120), seed, 3, tile_x=tile_x)))
    img = shade(img, 0.95 + 0.10 * stretch(fbm(H, W, max(4, H / 5), max(4, W / 5), seed + 1, 2, tile_x=tile_x)))
    img = mix(img, np.minimum(c * 1.45 + 0.06, 1), 0.22 * speckle(H, W, seed + 2, 0.06, (1.0, 1.0), tile_x=tile_x))
    rub = smooth(stretch(fbm(H, W, max(2, H / 50), max(2, W / 50), seed + 3, 3, tile_x=tile_x)), 0.68, 0.95)
    img = mix(img, np.minimum(c * 1.30 + 0.05, 1), 0.35 * worn * rub)
    fold = strokes(H, W, seed + 4, 'x', 6, 40 * max(1.0, H / 512), tile_x=tile_x)
    img = shade(img, 1 - 0.08 * smooth(fold, 0.6, 0.95))
    if hem:
        img = mix(img, np.minimum(c * 1.25 + 0.04, 1), 0.45 * np.exp(-((v / hem) ** 2)))
        img = _seam(img, H, W, [(0.0, (1 - 0.55 * hem) * H), (float(W), (1 - 0.55 * hem) * H)], c, stitch=False, k=k)
    if flapline is not None:
        d = (xx - flapline) * W
        img = shade(img, 1 - 0.38 * np.exp(-(np.maximum(d, 0) / 6.0) ** 2) * (d > -1.5))
        img = mix(img, np.minimum(c * 1.35 + 0.05, 1), 0.55 * np.exp(-((d + 2.5) / 1.5) ** 2))
    for sm in seams:
        img = _seam(img, H, W, [(sm[0] * W, (1 - sm[1]) * H), (sm[2] * W, (1 - sm[3]) * H)], c, stitch=False, side=sm[4] if len(sm) > 4 else 1, k=k)
    for wl in welts or ():
        a, b = np.array([wl[0] * W, (1 - wl[1]) * H]), np.array([wl[2] * W, (1 - wl[3]) * H])
        e = (b - a) / max(1e-6, np.linalg.norm(b - a)); nrm = np.array([e[1], -e[0]]); hw = wl[4] / 2
        poly = [tuple(a + nrm * hw), tuple(b + nrm * hw), tuple(b - nrm * hw), tuple(a - nrm * hw)]
        on = polymask(H, W, [poly])
        img = shade(img, 1 - 0.35 * np.clip(blur(on, 2.0) * 1.8 - on, 0, 1))
        img = mix(img, np.minimum(c * 1.18, 1), on)
        img = mix(img, c * 0.35, 0.9 * linemask(H, W, [[tuple(a - nrm * hw), tuple(b - nrm * hw)]], 1.6 * k))     # the mouth of the pocket
        img = _seam(img, H, W, [tuple(a + nrm * (hw - 2.5 * k)), tuple(b + nrm * (hw - 2.5 * k))], c, stitch=False, k=0.7 * k)
    for h in holes or ():
        d = np.hypot(xx * W - h[0] * W, yy * H - (1 - h[1]) * H) / h[2]
        img = shade(img, 1 - 0.32 * np.exp(-((d - 1.2) / 0.38) ** 2))
    if stitched:
        img = _border(img, H, W, c * 0.9, stitched, 1, k, sides)
    return img


def clay(H, W, seed=0, colour='#ECE4D2', brown='#8A5A3A', burnt=0.0, mouthpiece=0.0, along='y', **_):
    """A white clay pipe: chalky, faintly speckled, browned toward the burnt end (burnt: how far down from the top, 0..1,
    the bowl's lip is darkened) and toward the end that is held in the teeth (mouthpiece: how far up from v = 0)."""
    yy, xx, v = _grid(H, W)
    a = v if along == 'y' else xx
    img = shade(hexc(colour) * np.ones((H, W, 3)), 0.93 + 0.09 * stretch(fbm(H, W, max(2, H / 20), max(2, W / 20), seed, 2)))
    img = mix(img, hexc('#B8AE9A'), 0.35 * speckle(H, W, seed + 1, 0.05, (1.0, 1.0)))
    if burnt:
        img = mix(img, hexc(brown), 0.75 * smooth(a, 1 - burnt, 1.0) * (0.7 + 0.3 * stretch(fbm(H, W, 3, 6, seed + 2, 2))))
    if mouthpiece:
        img = mix(img, hexc(brown), 0.55 * (1 - smooth(a, 0.0, mouthpiece)))
    return img


OAKE = {'oldface': oldface, 'melton': melton, 'clay': clay}
