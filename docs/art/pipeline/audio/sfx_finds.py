"""sfx_finds.py : the sounds of "things fished up" (v0.6.0): the float drawn under by a dead weight, the thing on the line knocking on
the sea bed, catching fast and coming free, and a heavy box swung up out of the sea.
Called from sfx_manifest.build(); the recordings it names are in PACKS there.

Every sound is a list of parts, as in sfx_crew.py: the dicts sfx_build.part() takes, with `at` (where the part starts, s) and `lv`
(how loud its loudest tenth of a second is beside the others, dB), and three more keys that this module adds:
`glide` (r0, r1): the part played at a speed that slides evenly from r0 to r1, so a creak rises or falls;
`die` (t0, d): the part at full level until t0 seconds, then falling by 1/e every d seconds, so a stream runs out;
`ring` ((f1, f2), dB[, (g1, g2)]): the part again through two resonances of its own, that many dB beside it (and how much of each
resonance, if not 1 and 0.5): what a struck plank goes on doing."""
import numpy as np
from scipy import signal, ndimage
from sfx_crew import SR, WS

RD = 'oga/40-cc0-water-splash-slime-sfx/water-splash-slime-sfx.x/%s.ogg'
BM = 'oga/bubble-sound-effects/bubbles-%s.wav'
MORE = ('at', 'lv', 'glide', 'die', 'ring')


def ring(x, f, decay=(0.09, 0.05), gain=(1.0, 0.5)):
    """x through two decaying resonances: a low one and a shorter one above it."""
    n = int(0.4 * SR); t = np.arange(n) / SR; ir = sum(g * np.exp(-t / d) * np.sin(2 * np.pi * ff * t) for ff, d, g in zip(f, decay, gain))
    y = signal.fftconvolve(x, ir)[:len(x) + n]; return y / max(np.abs(y).max(), 1e-12)


def glide(x, r0, r1):
    """x played at a speed that goes evenly from r0 to r1."""
    n = int(len(x) / ((r0 + r1) / 2)); pos = np.cumsum(np.linspace(r0, r1, n)); pos = pos[pos < len(x) - 1]; return np.interp(pos, np.arange(len(x)), x)


def die(x, t0, d):
    t = np.arange(len(x)) / SR; return x * np.exp(-np.clip(t - t0, 0, None) / d)


def build(B, add, label, M):
    """M is what the manifest shares: its source paths (M['DROPS'] ...) and the single drops M['DRIP']."""
    assert B.SR == SR
    KR, WM, DROPS, DRIP, TREE = (M[k] for k in ('KR', 'WM', 'DROPS', 'DRIP', 'TREE'))

    def tame(x, crest):
        """A limiter: nothing in x stands more than `crest` dB over its loudest tenth of a second (the gain dips for a few ms round a spike)."""
        w = int(0.003 * SR); env = ndimage.uniform_filter1d(ndimage.maximum_filter1d(np.abs(x), 2 * w + 1), w)
        return x * np.minimum(1.0, 10 ** ((B.loud100(x) + crest) / 20) / np.maximum(env, 1e-12))

    def lay(parts, seconds=None, crest=None):
        """The parts summed at their offsets, each brought to its own level first (lv 0 is 20 dB under full scale over its loudest 100 ms).
        With `crest`, the sum goes through tame(), so that a few spikes do not hold the whole sound down when it is levelled."""
        xs = []
        for p in parts:
            x = B.part({k: v for k, v in p.items() if k not in MORE}); lv = p.get('lv', 0); o = int(p.get('at', 0) * SR)
            if 'glide' in p: x = glide(x, *p['glide'])
            if 'die' in p: x = die(x, *p['die'])
            xs.append((o, x * 10 ** ((lv - 20 - B.loud100(x)) / 20)))
            if 'ring' in p: r = ring(x, p['ring'][0], gain=(p['ring'] + ((1.0, 0.5),))[2]); xs.append((o, r * 10 ** ((lv + p['ring'][1] - 20 - B.loud100(r)) / 20)))
        y = np.zeros(int(seconds * SR) if seconds else max(o + len(x) for o, x in xs))
        for o, x in xs: m = min(len(x), len(y) - o); y[o:o + m] += x[:m]
        return tame(y, crest) if crest else y

    def log(parts):
        """The source log of a list of parts: each recording once per cut and speed (a gliding part is logged at its middle speed)."""
        out = []
        for p in parts:
            sp = p.get('speed', 1.0) * (sum(p['glide']) / 2 if 'glide' in p else 1.0)
            d = dict(label(p['src']), **({'cut': [p.get('a', 0), p['b']]} if 'b' in p else {}), **({'speed': round(sp, 3)} if sp != 1.0 else {}))
            if d not in out: out.append(d)
        return out

    def drip(k, at, speed, lv): return dict(src=DROPS, a=DRIP[k][0], b=DRIP[k][1], speed=speed, at=at, lv=lv)

    # ---- find-drag: the float drawn slowly under by a dead weight. One bubble played two or three times slower is one long, low gulp ----
    for i, p in enumerate((dict(src=RD % 'bubble_03', speed=0.5, fi=0.02), dict(src=BM % 'single1', speed=0.3, fi=0.02)), 1):
        add(f'find-drag_{i}', [p], fo=0.2, how='one bubble played two to three times slower, so it is a long, low gulp with no splash in it')

    # ---- haul-knock: the thing on the line knocks on the sea bed. A wooden knock, slowed and with the top off, through two low
    #      resonances of its own (the short ring), and one small bubble, which is what says "under water" ----
    def knock(p, f, bub=0.8, g=(1.0, 0.9)):
        return [dict(p, lp=2200, ring=(f, -6, g)), dict(src=RD % 'bubble_02', speed=bub, lp=2000, at=0.1, lv=-10)]

    N = (knock(dict(src=KR % 'footstep02', speed=0.6, hp=120), (118, 326), 0.8, (0.4, 1.0)),      # this one is all bottom unless the lower resonance is held back
         knock(dict(src=WS % 'wood on wood thuds', a=0.36, b=0.68, speed=0.7), (110, 300), 0.75),
         knock(dict(src=WS % 'wood on wood thuds', a=3.09, b=3.36, speed=0.7), (126, 345), 0.85))
    for i, parts in enumerate(N, 1):
        add(f'haul-knock_{i}', make=(lambda parts=parts: lay(parts, 0.48, 14)), sources=log(parts), trim=False, fo=0.1,
            how='a wooden knock played slower with the top taken off, ringing on through two low resonances (near 120 and 330 Hz, gone in a fifth of a second), with one small bubble behind it; cut at 0.48 s')

    # ---- haul-snag: it has caught fast. A heavier thud, and the line and rod taking the strain: a creak whose pitch climbs ----
    def snag(thud, creaks, f, blv=-12):
        return [dict(thud, ring=(f, -5)), dict(src=RD % 'bubble_02', speed=0.8, lp=1500, at=0.1, lv=blv)] + [
                dict(c, fi=0.02, fo=0.06, glide=g, at=at, lv=lv) for c, g, at, lv in creaks]

    G = (snag(dict(src=WM % 'wood_hit_09', speed=0.45, lp=700), ((dict(src=KR % 'creak2'), (0.85, 1.3), 0.12, 0), (dict(src=TREE, a=2.0, b=2.8), (0.9, 1.4), 0.12, 0)), (84, 228)),
         snag(dict(src=KR % 'footstep02', speed=0.42, lp=900), ((dict(src=KR % 'creak1'), (0.85, 1.3), 0.16, 0), (dict(src=TREE, a=2.0, b=2.8), (1.0, 1.5), 0.2, 0)), (78, 214)))
    for i, parts in enumerate(G, 1):
        add(f'haul-snag_{i}', make=(lambda parts=parts: lay(parts, 0.9, 15)), sources=log(parts), trim=False, fo=0.1,
            how='a wooden knock at less than half speed with the top taken off, so it is a heavy thud, ringing on near 80 and 220 Hz, with one small bubble; then two creaks together, a wooden one and a creaking tree, each played at a speed that climbs by half as it goes, so the creak tightens; cut at 0.9 s')

    # ---- haul-free: it comes free. A soft scrape over sand and a few bubbles going up, each quieter than the last ----
    SAND = M['PEL'] + 'sand_footsteps_0.mp3'
    F = ([dict(src=SAND, a=0.83, b=1.5, speed=0.7, lp=1400, fi=0.05, fo=0.2),
          dict(src=RD % 'bubble_02', speed=1.2, at=0.24, lv=-10), dict(src=BM % 'single2', at=0.4, lv=-12), dict(src=BM % 'single3', speed=1.2, at=0.52, lv=-14)],
         [dict(src=SAND, a=2.55, b=3.2, speed=0.75, lp=1500, fi=0.05, fo=0.2),
          dict(src=RD % 'bubble_01', speed=1.3, at=0.2, lv=-10), dict(src=BM % 'single1', speed=1.3, at=0.46, lv=-13)])
    for i, parts in enumerate(F, 1):
        add(f'haul-free_{i}', make=(lambda parts=parts: lay(parts, 0.78)), sources=log(parts), trim=False, fo=0.2,
            how='a footstep in sand played slower with the top taken off, so it is a soft scrape, and two or three single bubbles after it, each quieter than the last; cut at 0.78 s')

    # ---- find-surface: a heavy box swung up out of the sea. It breaks the surface, the water runs off it in a stream, then drips ----
    def surface(speed, stream, drips, lb=None):
        low = dict(src=RD % 'splash_02', speed=speed * 0.6, lp=500, lv=-4, **({'b': lb, 'fo': 0.15} if lb else {}))
        return [dict(src=RD % 'splash_02', speed=speed), low, dict(stream, fi=0.06, die=(0.3, 0.28), at=0.2, lv=-4)] + [drip(k, at, s_, -8 - 2 * j) for j, (k, at, s_) in enumerate(drips)]

    d1 = ((2, 0.95, 0.95), (4, 1.12, 1.05), (0, 1.3, 1.15)); d2 = ((3, 1.0, 0.9), (1, 1.16, 1.1), (2, 1.34, 1.0))
    U = (surface(0.8, dict(src=M['SKIP'] + 'swim.wav', b=1.0), d1),
         surface(0.72, dict(src=RD % 'loop_water_01', b=1.0), d2, 0.3))
    for i, parts in enumerate(U, 1):
        add(f'find-surface_{i}', make=(lambda parts=parts: lay(parts, 1.58, 15)), sources=log(parts), trim=False, fo=0.12,
            how='a splash played a little slower, with itself again an octave down and dulled under it for the weight; a second of running water that starts 0.2 s in and dies away; then three single drops, each quieter than the last; cut at 1.58 s')
