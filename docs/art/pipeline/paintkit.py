"""paintkit.py : helpers for painting a texture atlas in code (paint-pot-float.py, paint-belfry.py).

A painter works on float RGB images (height, width, 3) in sRGB 0..1 and pastes them into rectangles of the atlas that the
model's builder laid out (layout JSON: name -> [x0, y0, x1, y1] in pixels). Everything is seeded, so a texture can be
painted again bit for bit. Needs numpy, scipy and Pillow.
"""
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi


def hexc(s):
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], float) / 255


def mix(a, b, t):
    """a to b by t; t may be a number or an (h, w) mask."""
    t = np.asarray(t, float)
    if t.ndim == 2:
        t = t[..., None]
    return np.asarray(a, float) * (1 - t) + np.asarray(b, float) * t


def smooth(x, a, b):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def vnoise(h, w, cy, cx, rs, tile_y=False, tile_x=False):
    """Smooth value noise 0..1 with cy by cx lattice cells; it can repeat exactly along either axis."""
    cy, cx = max(1, int(round(cy))), max(1, int(round(cx)))
    g = rs.random((cy if tile_y else cy + 1, cx if tile_x else cx + 1))
    g = np.concatenate([g[-2:], g, g[:3]], 0) if tile_y else np.pad(g, ((2, 3), (0, 0)), mode='edge')
    g = np.concatenate([g[:, -2:], g, g[:, :3]], 1) if tile_x else np.pad(g, ((0, 0), (2, 3)), mode='edge')
    yy = np.arange(h) / h * cy + 2
    xx = np.arange(w) / w * cx + 2
    Y, X = np.meshgrid(yy, xx, indexing='ij')
    return np.clip(ndi.map_coordinates(g, [Y, X], order=3, mode='nearest'), 0, 1)


def fbm(h, w, cy, cx, seed, octaves=4, gain=0.5, tile_y=False, tile_x=False):
    """Layered noise, 0..1 (mean about 0.5)."""
    rs = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, tot = 1.0, 0.0
    for _ in range(octaves):
        out += amp * vnoise(h, w, cy, cx, rs, tile_y, tile_x)
        tot += amp
        amp *= gain
        cy, cx = cy * 2, cx * 2
    return out / tot


def stretch(n, lo=0.0, hi=1.0):
    """Spread a noise field over lo..hi by its own 2nd and 98th percentile."""
    a, b = np.percentile(n, [2, 98])
    return lo + (hi - lo) * np.clip((n - a) / (b - a + 1e-9), 0, 1)


def blur(m, r, wrap_x=False):
    if m.ndim == 3:
        return np.stack([blur(m[..., i], r, wrap_x) for i in range(3)], -1)
    return ndi.gaussian_filter(m, r, mode=['nearest', 'wrap' if wrap_x else 'nearest'])


def shift(m, dy, dx, wrap_x=False):
    """The mask moved down by dy and right by dx pixels."""
    out = np.roll(m, (dy, dx), (0, 1))
    if dy > 0: out[:dy] = out[dy:dy + 1]
    if dy < 0: out[dy:] = out[dy - 1:dy]
    if not wrap_x:
        if dx > 0: out[:, :dx] = out[:, dx:dx + 1]
        if dx < 0: out[:, dx:] = out[:, dx - 1:dx]
    return out


def emboss(mask, depth=2, wrap_x=False):
    """Light from the top left on the edges of a 0..1 mask of raised paint: returns (lit, shaded), both 0..1.
    shaded is where paint lies up and to the left of bare ground (the paint's edge throws a shadow into the chip);
    lit is where bare ground lies up and to the left of paint (that edge of the paint faces the light)."""
    d = shift(mask, depth, depth, wrap_x) - shift(mask, -depth, -depth, wrap_x)
    return np.clip(-d, 0, 1), np.clip(d, 0, 1)


def chips(h, w, cells, seed, amount=0.12, tile_x=False, crisp=0.02, bias=None):
    """A 0..1 mask of chipped-off places: blobs of mid-size noise cut at a level so that about `amount` of the area is
    chipped. bias (h, w) adds to the noise where chips should gather (edges, the waterline)."""
    n = stretch(fbm(h, w, cells[0], cells[1], seed, octaves=3, gain=0.55, tile_x=tile_x))
    n = n * 0.8 + 0.2 * stretch(fbm(h, w, cells[0] * 5, cells[1] * 5, seed + 1, octaves=2, tile_x=tile_x))
    if bias is not None:
        n = n + bias
    lvl = np.quantile(n, 1 - amount)
    return smooth(n, lvl - crisp, lvl + crisp)


def strokes(h, w, seed, along='x', length=14, fine=90, tile_x=False):
    """Brush-stroke streaks, 0..1: noise that is long one way and fine the other."""
    cy, cx = (fine, length) if along == 'x' else (length, fine)
    return stretch(fbm(h, w, cy * h / 512, cx * w / 512, seed, octaves=3, gain=0.6, tile_x=tile_x))


def shade(img, k):
    """Multiply by a number or an (h, w) field."""
    k = np.asarray(k, float)
    return img * (k[..., None] if k.ndim == 2 else k)


def tint(img, colour, t):
    return mix(img, np.asarray(colour, float) * np.ones_like(img), t)


def paintify(img, size=3, wrap_x=False):
    """Flatten small noise into dabs, the way a painted texture reads: a median filter on each channel."""
    k = size // 2
    pad = np.pad(img, ((k, k), (k, k), (0, 0)), mode='edge')
    if wrap_x:
        pad[:, :k] = pad[:, -2 * k:-k]
        pad[:, -k:] = pad[:, k:2 * k]
    out = np.stack([ndi.median_filter(pad[..., i], size=size, mode='nearest') for i in range(3)], -1)
    return out[k:-k, k:-k]


def speckle(h, w, seed, density=0.02, size=(1.0, 2.2), tile_x=False):
    """Soft dots 0..1 (cork grains, barnacle flecks, rivet-free rust)."""
    rs = np.random.default_rng(seed)
    pts = (rs.random((h, w)) < density).astype(float)
    r = rs.uniform(size[0], size[1])
    m = ndi.gaussian_filter(pts, r, mode=['nearest', 'wrap' if tile_x else 'nearest'])
    return np.clip(m / (m.max() + 1e-9) * 2.2, 0, 1)


def polymask(h, w, polys, scale=4):
    """A 0..1 antialiased mask of polygons given in pixels [(x, y), ...]."""
    im = Image.new('L', (w * scale, h * scale), 0)
    d = ImageDraw.Draw(im)
    for p in polys:
        d.polygon([(x * scale, y * scale) for x, y in p], fill=255)
    return np.asarray(im.resize((w, h), Image.LANCZOS), float) / 255


def linemask(h, w, lines, width=1.5, scale=4):
    """A 0..1 mask of poly-lines [[(x, y), ...], ...] in pixels."""
    im = Image.new('L', (w * scale, h * scale), 0)
    d = ImageDraw.Draw(im)
    for ln in lines:
        d.line([(x * scale, y * scale) for x, y in ln], fill=255, width=max(1, int(round(width * scale))), joint='curve')
    return np.asarray(im.resize((w, h), Image.LANCZOS), float) / 255


class Atlas:
    def __init__(self, layout, size=None, base='#6B5A4A'):
        self.layout = json.load(open(layout)) if isinstance(layout, str) else layout
        self.w, self.h = size or self.layout['atlas']
        self.img = np.ones((self.h, self.w, 3)) * hexc(base)
        self.used = np.zeros((self.h, self.w), bool)

    def rect(self, name):
        x0, y0, x1, y1 = [int(round(v)) for v in self.layout['rects'][name]]
        return x0, y0, x1, y1

    def size(self, name):
        x0, y0, x1, y1 = self.rect(name)
        return y1 - y0, x1 - x0

    def paste(self, name, img, bleed=4):
        """Put a painted patch into its rectangle and let its border colours run `bleed` pixels beyond it (unless
        another patch is already there), so that no seam shows when the texture is filtered."""
        x0, y0, x1, y1 = self.rect(name)
        h, w = y1 - y0, x1 - x0
        assert img.shape[:2] == (h, w), (name, img.shape, (h, w))
        pad = np.pad(np.clip(img, 0, 1), ((bleed, bleed), (bleed, bleed), (0, 0)), mode='edge')
        Y0, X0 = y0 - bleed, x0 - bleed
        for yy in range(pad.shape[0]):
            ay = Y0 + yy
            if ay < 0 or ay >= self.h: continue
            xs = np.arange(pad.shape[1]) + X0
            ok = (xs >= 0) & (xs < self.w)
            inside = (ay >= y0) & (ay < y1) & (xs >= x0) & (xs < x1)
            ok &= inside | ~self.used[ay, np.clip(xs, 0, self.w - 1)]
            self.img[ay, xs[ok]] = pad[yy, ok]
        self.used[y0:y1, x0:x1] = True

    def save(self, path):
        Image.fromarray((np.clip(self.img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path)
        return path
