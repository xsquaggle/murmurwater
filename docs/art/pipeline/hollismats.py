"""hollismats.py : painted materials for Mister Hollis, added to the table in mats.py.
oilskin (oiled cloth: waxed() with the oil's shine and the places where the oil has gone), knit (a striped muffler,
mittens), carpet (the tapestry of a carpet bag), watchface (a pocket watch's dial).
A rectangle is painted with its top row first: v = 1 at the top, as in callomats.py."""
import numpy as np
from paintkit import hexc, mix, smooth, fbm, stretch, blur, strokes, shade, speckle, polymask, linemask
from callomats import waxed, _seam


def _grid(H, W):
    yy = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    xx = (np.arange(W)[None, :] + 0.5) / W * np.ones((H, 1))
    return yy, xx, 1 - yy


def oilskin(H, W, seed=0, colour='#5E8C82', sheen=0.6, bare=0.3, bare_colour='#A9A47E', buttons=None, flapline=None, tile_x=False, **kw):
    """Oiled cloth: waxed cotton with long soft shines down it, and patches where the oil has worn off and the cloth
    shows yellow-grey. buttons: [[u, v, radius in pixels], ...] dark buttonholes with a ring of pull round each (the
    buttons themselves are modelled); flapline: u of the edge of a fly front, which casts a soft shadow to its right."""
    img = waxed(H, W, seed=seed, colour=colour, tile_x=tile_x, **kw)
    yy, xx, v = _grid(H, W)
    c = hexc(colour)
    st = strokes(H, W, seed + 11, 'y', 16, 70 * max(1.0, W / 512), tile_x=tile_x)
    img = mix(img, np.minimum(c * 1.38 + 0.07, 1), 0.26 * sheen * smooth(st, 0.62, 0.96))
    img = shade(img, 1 - 0.10 * sheen * smooth(1 - st, 0.7, 0.98))
    patch = smooth(stretch(fbm(H, W, max(2, H / 130), max(2, W / 130), seed + 12, 3, tile_x=tile_x)), 0.66, 0.92)
    craze = 0.6 + 0.4 * stretch(fbm(H, W, max(4, H / 7), max(4, W / 7), seed + 13, 2, tile_x=tile_x))
    img = mix(img, hexc(bare_colour), 0.55 * bare * patch * craze)
    if flapline is not None:
        d = (xx - flapline) * W
        img = shade(img, 1 - 0.30 * np.exp(-(np.maximum(d, 0) / 5.0) ** 2) * (d > -1.5))
        img = mix(img, np.minimum(c * 1.30 + 0.05, 1), 0.5 * np.exp(-((d + 3.0) / 1.6) ** 2))
    for b in buttons or ():
        d = np.hypot(xx * W - b[0] * W, yy * H - (1 - b[1]) * H) / b[2]
        img = shade(img, 1 - 0.30 * np.exp(-((d - 1.25) / 0.4) ** 2))
    return img


def knit(H, W, seed=0, colour='#EAD9B8', stripes=None, n=6, along='y', wales=14, rows=None, rib=0.0, worn=0.2, tile_x=False, **_):
    """Knitting: wales (columns of V stitches) side by side across the patch, running along `along`. stripes: colours
    that take turns in n bands along the piece (a striped muffler); rib: 0..1, how far up from the bottom a ribbed cuff
    reaches (v, for a mitten: darker furrows between the wales)."""
    yy, xx, v = _grid(H, W)
    a, b = (yy, xx) if along == 'y' else (xx, yy)                    # a runs along the piece, b across it
    La, Lb = (H, W) if along == 'y' else (W, H)
    if stripes:
        cols = np.array([hexc(s) for s in stripes])
        k = np.minimum((a * n).astype(int), n - 1)
        img = cols[k % len(cols)]
    else:
        img = hexc(colour) * np.ones((H, W, 3))
    pitch = Lb / wales                                               # pixels per wale
    rows = rows or max(4, int(round(La / (pitch * 0.8))))
    fb, fa = (b * wales) % 1.0, a * rows
    vee = np.cos(2 * np.pi * (fa - 0.9 * np.abs(fb - 0.5)))        # the two legs of each stitch slope to the middle of the wale
    img = shade(img, 0.90 + 0.10 * vee)
    img = shade(img, 1 - 0.22 * np.exp(-((np.minimum(fb, 1 - fb) * pitch / 1.3) ** 2)))        # the furrow between two wales
    if rib:
        on = 1 - smooth(v if along == 'y' else xx, rib - 0.03, rib + 0.01)
        img = shade(img, 1 - 0.30 * on * smooth(np.cos(2 * np.pi * b * wales / 2.0), 0.2, 0.9))
    img = shade(img, 0.92 + 0.12 * stretch(fbm(H, W, max(2, H / 40), max(2, W / 40), seed, 2, tile_x=tile_x)))
    fuzz = smooth(stretch(fbm(H, W, max(2, H / 14), max(2, W / 14), seed + 1, 3, tile_x=tile_x)), 0.6, 0.95)
    return mix(img, np.minimum(img * 1.25 + 0.05, 1), 0.3 * worn * fuzz[..., None])


def carpet(H, W, seed=0, ground='#7A3B34', cream='#EAD9B8', rose='#D4685F', leaf='#6F8F4E', blue='#3F8F8A', pitch=96.0, border=0.0, tile_x=False, **_):
    """Carpet for a carpet bag: a lattice of diamonds on a madder ground, a rose in every diamond with leaves at its
    corners and a small blue flower where four diamonds meet, all of it woven (a fine grid over everything) and worn
    pale where it rubs. pitch: pixels from rose to rose; border: a plain band of the ground along the bottom (v)."""
    yy, xx, v = _grid(H, W)
    X, Y = xx * W / pitch, yy * H / pitch
    cx, cy = X - np.round(X), Y - np.round(Y)                        # -0.5..0.5 about the nearest rose
    img = hexc(ground) * np.ones((H, W, 3))
    img = shade(img, 0.88 + 0.2 * stretch(fbm(H, W, max(2, H / 60), max(2, W / 60), seed, 2, tile_x=tile_x)))
    d1 = np.abs(cx) + np.abs(cy)
    img = mix(img, hexc(cream), 0.85 * smooth(0.035 - np.abs(d1 - 0.5), -0.012, 0.012))                    # the lattice
    img = mix(img, hexc(blue), 0.9 * smooth(0.075 - np.hypot(np.abs(cx) - 0.5, cy), -0.012, 0.012))        # where diamonds meet, left and right
    img = mix(img, hexc(blue), 0.9 * smooth(0.075 - np.hypot(cx, np.abs(cy) - 0.5), -0.012, 0.012))        # and above and below
    r, th = np.hypot(cx, cy), np.arctan2(cy, cx)
    for a0 in (np.pi / 4, 3 * np.pi / 4, -np.pi / 4, -3 * np.pi / 4):                                      # four leaves
        lx, ly = cx * np.cos(a0) + cy * np.sin(a0), -cx * np.sin(a0) + cy * np.cos(a0)
        img = mix(img, hexc(leaf), 0.9 * smooth(1 - ((lx - 0.2) / 0.11) ** 2 - (ly / 0.045) ** 2, -0.1, 0.25))
    petal = 0.135 + 0.035 * np.cos(5 * th + 0.4)
    img = mix(img, hexc(rose), smooth(petal - r, -0.012, 0.012))
    img = mix(img, np.minimum(hexc(rose) * 1.25 + 0.08, 1), smooth(petal * 0.62 - r, -0.012, 0.012))
    img = mix(img, hexc(cream), smooth(0.04 - r, -0.01, 0.01))
    if border:
        img = mix(img, hexc(ground) * 0.8, smooth(border - v, -0.01, 0.01))
        img = mix(img, hexc(cream), 0.8 * smooth(0.012 - np.abs(v - border), -0.004, 0.004))
    weave = 0.5 + 0.25 * np.sin(2 * np.pi * xx * W / 3.2) + 0.25 * np.sin(2 * np.pi * yy * H / 3.2)
    img = shade(img, 0.90 + 0.10 * weave)
    rub = smooth(stretch(fbm(H, W, max(2, H / 80), max(2, W / 80), seed + 2, 3, tile_x=tile_x)), 0.45, 0.98)
    return mix(img, hexc('#B9A58C'), 0.22 * rub[..., None])


def watchface(H, W, seed=0, dial='#F2E7CC', ink='#2E2A33', rim='#C9A24A', time=(10, 9), **_):
    """A pocket watch's dial, seen square on: brass rim, cream enamel, twelve marks, two hands (time = hour, minute)."""
    yy, xx, v = _grid(H, W)
    px, py = (xx - 0.5) * 2, (0.5 - yy) * 2                          # -1..1, y up
    r, s = np.hypot(px, py), min(H, W) / 2.0
    img = np.ones((H, W, 3)) * hexc(rim)
    img = shade(img, 0.8 + 0.4 * smooth(py - px, -1.4, 1.4))
    img = mix(img, hexc(dial), smooth(0.80 - r, -0.02, 0.02))
    img = shade(img, 1 - 0.18 * smooth(r, 0.62, 0.80) * (r < 0.80))
    marks, hands = [], []
    P = lambda rr, a: ((0.5 + 0.5 * rr * np.sin(a)) * W, (0.5 - 0.5 * rr * np.cos(a)) * H)
    for i in range(12):
        a = 2 * np.pi * i / 12
        marks.append([P(0.60 if i % 3 == 0 else 0.66, a), P(0.74, a)])
    img = mix(img, hexc(ink), 0.9 * linemask(H, W, marks, max(1.2, s * 0.045)))
    ah, am = 2 * np.pi * ((time[0] % 12) + time[1] / 60.0) / 12, 2 * np.pi * time[1] / 60.0
    img = mix(img, hexc(ink), linemask(H, W, [[P(-0.08, ah), P(0.40, ah)]], max(1.6, s * 0.075)))
    img = mix(img, hexc(ink), linemask(H, W, [[P(-0.10, am), P(0.62, am)]], max(1.3, s * 0.05)))
    return mix(img, hexc(rim), smooth(0.07 - r, -0.02, 0.02))


def label(H, W, seed=0, card='#EFE6CC', ink='#4A4350', **_):
    """A luggage label: a buff card with its corners cut, an eyelet at the top and three lines of handwriting."""
    yy, xx, v = _grid(H, W)
    img = hexc(card) * np.ones((H, W, 3))
    img = shade(img, 0.92 + 0.12 * stretch(fbm(H, W, 4, 4, seed, 2)))
    d = np.hypot((xx - 0.5) * W, (yy - 0.13) * H)
    img = mix(img, hexc('#B08A54'), smooth(0.11 * W - d, -1, 1))
    img = mix(img, hexc('#2A2530'), smooth(0.055 * W - d, -1, 1))
    rs = np.random.default_rng(seed + 3)
    lines = []
    for i, y0 in enumerate((0.42, 0.60, 0.78)):
        x, pts = 0.16, []
        while x < (0.84 if i < 2 else 0.6):
            pts.append((x * W, (y0 + rs.uniform(-0.035, 0.035)) * H))
            x += rs.uniform(0.03, 0.07)
        lines.append(pts)
    img = mix(img, hexc(ink), 0.85 * linemask(H, W, lines, max(1.0, W / 60)))
    cut = smooth((np.minimum(xx, 1 - xx) * W + (yy * H)) - 0.22 * W, -1, 1)
    return mix(hexc(card) * 0.75, img, cut[..., None])


HOLLIS = {'oilskin': oilskin, 'knit': knit, 'carpet': carpet, 'watchface': watchface, 'label': label}
