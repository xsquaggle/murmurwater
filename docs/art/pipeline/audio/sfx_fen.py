"""sfx_fen.py : the sounds of Mossglass Fen (v0.4.0): the Fog Lamp, the sea-road lights, the crossing, the packet box, reeds
against the hull, and two ambience loops. Called from sfx_manifest.build(); the recordings it names are in PACKS there.

Everything in a loop is laid round a ring (B.ring), so a tail that runs past the end comes back in at the start: no seam."""
import numpy as np
from scipy import signal

SWAMP = 'oga/swamp-environment-audio/swamp_sounds.x/%s.ogg'
RUSTLE = 'oga/20-rustles-dry-leaves/qubodup-rustle.x/rustle/rustle%02d.flac'
WIND = 'oga/wind1/wind%d.wav'
CRICKETS = 'oga/crickets-ambient-noise-loopable/crickets_1.mp3'
BIRDS = 'oga/ambient-bird-sounds/birds-isaiah658_0.ogg'
SACK = 'oga/sack-of-gold/gold_sack.wav'
# the calls in SWAMP % 'cricket_1': one small frog, a chirp of 33 pulses a second around 2.7 kHz, about every 0.72 s
CHIRP = ((1.80, 2.25), (2.54, 3.02), (3.23, 3.77), (4.04, 4.49), (4.72, 5.23), (5.50, 5.91), (6.21, 6.75), (6.99, 7.49), (7.68, 8.18), (8.42, 8.87), (9.21, 9.62), (9.92, 10.42), (10.69, 11.12), (11.38, 11.87))
LOOP = 36.0     # seconds, both ambience loops


def build(B, add, label, M):
    """M is what the manifest shares: its source paths (M['DROPS'] ...), the single drops M['DRIP'] and the synthesised murmur."""
    SR = B.SR
    synth = lambda what: [{'kind': 'synth', 'what': what}]

    def peak(x, to=1.0): return x * to / max(np.abs(x).max(), 1e-12)

    def room(x, decay=0.3, wet=0.4, lp=3000, pre=0.02, seed=3):
        """x and a diffuse tail of it: the sound through a burst of noise that dies away, duller than the sound itself."""
        m = int(min(6 * decay, 2.5) * SR); r = np.random.default_rng(seed); ir = r.standard_normal(m) * np.exp(-np.arange(m) / SR / decay); ir[:int(pre * SR)] = 0
        ir = np.fft.irfft(np.fft.rfft(ir) / (1 + (np.fft.rfftfreq(m, 1 / SR) / lp) ** 2), m)
        dry = np.concatenate([x, np.zeros(m)]); w = signal.fftconvolve(dry, ir)[:len(dry)]
        return dry + wet * w * np.abs(x).max() / max(np.abs(w).max(), 1e-12)

    def far(x, lp):
        """Distance takes the top off: a gentle slope above lp."""
        return np.fft.irfft(np.fft.rfft(x) / (1 + (np.fft.rfftfreq(len(x), 1 / SR) / lp) ** 2), len(x))

    def note(f, seconds, attack=0.012, decay=0.8, beat=0.7, parts=((1, 1.0, 1.0), (2.0, 0.10, 0.5), (2.76, 0.20, 0.36), (5.4, 0.05, 0.14))):
        """One struck note of glass: each partial a pair a fraction of a hertz apart, so it shimmers as it rings down."""
        n = int(seconds * SR); t = np.arange(n) / SR; y = np.zeros(n)
        for k, (m, g, d) in enumerate(parts):
            e = np.exp(-t / (decay * d)); bt = beat * (1 + 0.6 * k)                                  # each partial beats at its own rate, and never to nothing
            y += g * e * (0.78 * np.sin(2 * np.pi * (f * m - bt / 2) * t) + 0.22 * np.sin(2 * np.pi * (f * m + bt / 2) * t + 4.2 + k))
        return y * (1 - np.exp(-t / attack))

    # ---- the Fog Lamp lights itself ----
    GLASS = ((1, 1.0, 1.0), (2.32, 0.22, 0.44), (4.25, 0.08, 0.22), (6.63, 0.03, 0.12))      # the partials of a struck glass, and how soon each dies beside the first

    def lamp():
        n = int(1.3 * SR); y = np.zeros(n); r = np.random.default_rng(21)
        flame = B.part(dict(src=M['FLAME'], speed=0.6, lp=1800, fi=0.12, fo=0.5)); y[:len(flame)] += peak(flame)                 # the whoomp: a recorded flame catching, slower and duller
        o = int(0.16 * SR); m = n - o; ring = note(1479.98, m / SR, attack=0.004, decay=0.55, beat=1.1, parts=GLASS)
        k = int(0.004 * SR); tick = B.filt(r.standard_normal(4 * k), hp=3500) [:k] * np.hanning(k); ring[:k] += 0.25 * tick          # the tick of the glass taking the heat
        y[o:] += 0.42 * peak(room(peak(ring), decay=0.28, wet=0.35, lp=3500, seed=22)[:m])
        return y
    add('fog-lamp-light_1', make=lamp, fo=0.3, sources=[dict(label(M['FLAME']), speed=0.6)] + synth('one ringing note of struck glass (F sharp 6: a tone with the upper partials of glass, each a pair a hertz or two apart, a tick at the start and a short tail of room), 0.16 s after the start'),
        how='the whoomp is a recorded flame catching, played at 0.6 of its speed with everything above 1800 Hz taken off; the ring is synthesised in sfx_fen.py')

    # ---- a sea-road light answers ----
    def chime(f, seed):
        y = note(f, 1.45, attack=0.018, decay=0.55, beat=0.8); y = far(y, 2600)
        y = room(y, decay=0.32, wet=0.55, lp=2400, pre=0.035, seed=seed)[:int(1.6 * SR)]
        return B.fade(y, 0.004, 0.5)
    for i, (f, nm) in enumerate(((880.0, 'A5'), (987.77, 'B5'), (1174.66, 'D6')), 1):
        add(f'sea-road-chime_{i}', make=(lambda f=f, i=i: chime(f, 30 + i)), trim=False, fo=0.4, level=-5,
            sources=synth(f'one far note of a glass bell ({nm}): a soft-struck tone with the faint upper partials of glass, each a pair a fraction of a hertz apart, its top taken off by distance, and a diffuse tail'),
            how='synthesised in sfx_fen.py; the three notes are A, B and D, which sit on the open fifth of the murmur')

    # ---- the middle of the crossing ----
    def crossing():
        T = 4.7; n = int(T * SR); t = np.arange(n) / SR
        w = B.filt(B.load(WIND % 3)[int(21.0 * SR):int(21.0 * SR) + n], hp=90, lp=1100)
        swell = np.sin(np.pi * np.clip(t / T, 0, 1) ** 0.8) ** 1.6                                                                                                # up over two seconds, down over two and a half
        gust = 1 + 0.25 * np.sin(2 * np.pi * 0.55 * t + 1.0)
        hum = M['murmur'](seconds=11.0, seed=7)[int(2.0 * SR):int(2.0 * SR) + n]; late = np.sin(np.pi * np.clip((t - 0.5) / (T - 0.5), 0, 1) ** 0.9) ** 2      # the murmur comes in half a second after the wind
        return peak(w) * swell * gust + 0.5 * peak(hum) * late
    add('fog-cross_1', make=crossing, trim=False, fo=0.5, level=-3,
        sources=[dict(label(WIND % 3), cut=[21.0, 25.7])] + synth('the murmur of murmur_1 (ten humming voices on an open fifth of D) under it'),
        how='recorded wind between 90 and 1100 Hz, swelling over two seconds and falling over two and a half; the murmur comes in half a second later and goes with it')

    # ---- the packet box takes a catch ----
    add('packet-box_1', [
        dict(src=M['KR'] % 'metalLatch', gain=-8), dict(src=M['WM'] % 'wood_misc_06', speed=0.75, at=0.05, gain=-11),
        dict(src=M['TREE'], a=2.92, b=3.62, at=0.27, gain=10, fi=0.03, fo=0.2),
        dict(src=SACK, a=0.86, b=1.72, at=0.84, gain=-5, fi=0.01, fo=0.3)],
        level=-2, how='a latch and the knock of the lid (played slower, so it is a heavier lid), a creak of rope from a creaking tree, and a sack of coins set down')

    # ---- a hull pushing through reeds ----
    def reeds(rustles, wash):
        ps = [dict(src=RUSTLE % k, at=at, gain=g, speed=sp, hp=220, lp=7500, fi=0.04, fo=0.25) for k, at, g, sp in rustles]
        y = B.mix(ps + [dict(wash, hp=150, lp=2200, fi=0.08, fo=0.4)])[:int(1.25 * SR)]; n = len(y); t = np.arange(n) / SR
        return B.fade(y * np.sin(np.clip(t / 0.22, 0, 1) * np.pi / 2) ** 2, 0.002, 0.4)                               # the bow goes in: a quarter of a second to full
    RB = (((11, 0.0, 0, 0.8), (16, 0.16, -2, 0.72), (9, 0.50, -4, 0.8)), ((14, 0.0, 0, 0.75), (19, 0.10, -1, 0.82), (12, 0.52, -3, 0.7)))
    WASH = (dict(src=M['SKIP'] + 'swim.wav', a=0.2, b=1.3, at=0.05, gain=-18), dict(src=M['EZWA'] % 3, at=0.2, gain=13, speed=0.8))
    for i in (0, 1):
        add(f'reed-brush_{i + 1}', make=(lambda i=i: reeds(RB[i], WASH[i])), trim=False, fo=0.3,
            sources=[dict(label(RUSTLE % k), speed=sp) for k, _, _, sp in RB[i]] + [label(WASH[i]['src'])],
            how='three rustles of dry leaves, played slower and with their top taken off so that they are stalks and not leaves, one after another, over a soft wash of water')

    # ---- the two ambience loops ----
    N = int(LOOP * SR)
    cyc = lambda m, ph=0.0: np.sin(2 * np.pi * (m * np.arange(N) / N + ph))                  # m whole cycles in the loop

    def tile(x, k, xf=None):
        """x laid k times round the loop, each copy cross-faded (equal power) into the next."""
        hop = N // k; f = len(x) - hop if xf is None else int(xf * SR); assert 0 < f <= hop, (len(x), hop)
        c = x[:hop + f].copy(); w = np.sin(np.linspace(0, np.pi / 2, f)); c[:f] *= w; c[-f:] *= w[::-1]
        return B.ring(N, [(i * hop, c) for i in range(k)]) if hop * k == N else None

    def frog(k, speed, gain, lp=None, wet=0.0, seed=0):
        a, b = CHIRP[k % len(CHIRP)]; c = B.part(dict(src=SWAMP % 'cricket_1', a=a - 0.03, b=b + 0.05, speed=speed, fi=0.01, fo=0.04)); c = peak(c)
        if lp: c = far(c, lp)
        if wet: c = room(c, decay=0.35, wet=wet, lp=2500, seed=seed)
        return c * 10 ** (gain / 20)

    def chorus(voices, seed):
        """Each frog calls in bouts: a few chirps in a row at its own pitch and pace, then nothing for a while."""
        r = np.random.default_rng(seed); ev = []
        for v in voices:
            for start, count in v['bouts']:
                t = start; k = int(r.integers(0, len(CHIRP)))
                for j in range(count):
                    sp = v['speed'] * float(r.uniform(0.985, 1.015)); g = v['gain'] + float(r.uniform(-1.5, 1.0)) - (2.5 if j == 0 else 0)
                    ev.append((int(t * SR) % N, frog(k + j, sp, g, v.get('lp'), v.get('wet', 0), seed + j))); t += v['gap'] * float(r.uniform(0.93, 1.07))
        return ev

    def drips(times, gain, seed):
        r = np.random.default_rng(seed); ev = []
        for j, t in enumerate(times):
            a, b = M['DRIP'][j % len(M['DRIP'])]; d = B.part(dict(src=M['DROPS'], a=a, b=b, speed=float(r.uniform(0.82, 1.12)), fo=0.08))
            ev.append((int(t * SR), room(peak(d), decay=0.25, wet=0.3, lp=3500, seed=seed + j) * 10 ** ((gain + float(r.uniform(-3, 2))) / 20)))
        return ev

    DAY_FROGS = (dict(speed=0.72, gain=-17, gap=1.02, lp=6000, wet=0.15, bouts=((2.0, 5), (16.5, 4), (27.0, 6))),                 # near, mid pitch
                 dict(speed=0.58, gain=-22, gap=1.31, lp=2600, wet=0.4, bouts=((5.2, 4), (20.0, 5), (31.5, 3))),        # further off, lower, slower
                 dict(speed=0.86, gain=-26, gap=0.84, lp=2200, wet=0.5, bouts=((10.5, 6), (24.0, 4))))                  # far, small, quick
    DAY_DRIPS = (3.4, 9.1, 13.6, 19.3, 22.4, 29.8, 34.2)
    DAY_BIRD = ((7.72, 9.70, 12.0, -18), (21.55, 22.12, 25.5, -21), (14.80, 15.27, 33.0, -22))                           # cut from, to; at; level
    DAY_CICADA = (('cicada_2', 0.3, 7.3, 1.0, 5.0, -18), ('cicada_1', 0.2, 4.6, 0.92, 13.0, -20), ('cicada_2', 0.3, 7.3, 0.88, 18.5, -19), ('cicada_1', 0.2, 4.6, 1.06, 27.5, -21), ('cicada_2', 0.3, 7.3, 0.94, 31.5, -20))

    def day():
        air = B.circular(B.loop_cut(WIND % 1, 8.0, LOOP, 3.0), hp=140, lp=4500); air = air / np.sqrt((air ** 2).mean()) * 10 ** (-33 / 20) * (1 + 0.25 * cyc(2, 0.1) + 0.15 * cyc(5, 0.6))
        ev = chorus(DAY_FROGS, 41) + drips(DAY_DRIPS, -19, 51)
        for a, b, at, g in DAY_BIRD:
            c = B.part(dict(src=BIRDS, a=a - 0.05, b=b + 0.1, hp=900, fi=0.04, fo=0.1)); ev.append((int(at * SR), room(far(peak(c), 3200), decay=0.5, wet=0.7, lp=2800, seed=int(at)) * 10 ** (g / 20)))
        for f, a, b, sp, at, g in DAY_CICADA:
            c = B.part(dict(src=SWAMP % f, a=a, b=b, speed=sp, hp=3000, fi=0.8, fo=1.2)); ev.append((int(at * SR), far(peak(c), 7000) * 10 ** (g / 20)))
        return air + B.ring(N, ev)
    add('fen-day_1', make=day, loop=True, lufs=-22,
        sources=[dict(label(WIND % 1), cut=[8.0, 44.0]), label(SWAMP % 'cricket_1'), label(SWAMP % 'cicada_1'), label(SWAMP % 'cicada_2'), label(M['DROPS']), label(BIRDS)],
        how='a quiet bed of recorded wind; three frogs, each the same recorded chirps played at 0.72, 0.58 and 0.86 of their speed, calling in bouts, the far ones duller and with a tail; five swells of cicadas; seven single drips; a far bird three times. Everything is laid round a 36 s ring, so tails that pass the end come back in at the start')

    NIGHT_FROGS = (dict(speed=0.42, gain=-15, gap=1.75, wet=0.2, bouts=((1.5, 4), (13.0, 5), (25.5, 4))),               # near and deep
                   dict(speed=0.34, gain=-19, gap=2.25, lp=2000, wet=0.4, bouts=((6.5, 3), (18.5, 4), (30.5, 3))),      # deeper, slower, further
                   dict(speed=0.50, gain=-24, gap=1.45, lp=1800, wet=0.5, bouts=((9.5, 5), (22.0, 4), (33.0, 3))))      # far

    def night():
        c = B.load(CRICKETS); bed = tile(c[int(0.2 * SR):], 4, 2.0); bed = bed / np.sqrt((bed ** 2).mean()) * 10 ** (-33 / 20) * (1 + 0.12 * cyc(1, 0.3) + 0.08 * cyc(3, 0.7))
        hum = B.circular(M['murmur'](seconds=LOOP, seed=19), lp=420); hum = hum / np.sqrt((hum ** 2).mean()) * 10 ** (-33 / 20) * (0.5 - 0.5 * cyc(1, 0.42)) ** 2      # there once in the loop, and gone
        return bed + hum + B.ring(N, chorus(NIGHT_FROGS, 43))
    add('fen-night_1', make=night, loop=True, lufs=-22,
        sources=[label(CRICKETS), label(SWAMP % 'cricket_1')] + synth('the murmur of murmur_1 with everything above 420 Hz taken off, swelling once in the loop'),
        how="a bed of recorded crickets, four times round the ring with 2 s crossfades; three frogs, the recorded chirps played at 0.42, 0.34 and 0.5 of their speed, so they are deep, calling in bouts; and, once in the loop, a far hum. 36 s, laid round a ring like the day loop")
