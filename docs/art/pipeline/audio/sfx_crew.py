"""sfx_crew.py : the sounds of "hands aboard" (v0.5.0): Biscuit hooking a fish out and eating it, Mister Hollis landing one, thinning
at dawn and gathering at dusk, the crew basket full, Pell's boatyard, and the Puffin's sail filling.
Called from sfx_manifest.build(); the recordings it names are in PACKS there.

Mister Hollis has no recorded voice. His note is synthesised in voice(): three voices a few cents apart on "ah", more breath than tone.
Every layered sound is written as a list of parts (the dicts sfx_build.part() takes, with two more keys: `at`, where the part starts,
and `lv`, how loud its loudest tenth of a second is beside the others, in dB), so the list is both the sound and its source log."""
import numpy as np
from scipy import signal

WS = 'oga/68-workshop-sounds/workshop.x/workshop/workshop - %s.wav'
SAW = 'oga/saw-or-wood-impact/saw_-_starninjas_0.ogg'
CRUNCH = 'oga/7-eating-crunches/crunch_-_tito.x/crunch.%d.ogg'
FABRIC = 'oga/fabric-rustling/rustling.ogg'
THWACK = 'oga/thwack-sounds/thwack-1.0.x/PCM/thwack-%02d.wav'
BREATH = 'oga/ghost-breath/ghostbreath.flac'
D3, A2 = 146.83, 110.0      # the fog's two notes: the top and the middle of the murmur's open fifth


SR = 44100
ease = lambda v: (lambda c: c * c * (3 - 2 * c))(np.clip(v, 0, 1))


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


# ---- the fog's voice ----
FORMANTS = ((700, 110), (1150, 130), (2600, 220))      # "ah": centre and width of each resonance of the mouth, Hz
SHUT = ((480, 110), (1050, 130), (2500, 220))          # "uh", the mouth barely open: where the note starts from


def mouth(f, formants=FORMANTS):
    """How much the mouth passes at f: one at the bottom, a peak at each formant, falling away above the last."""
    g = 1.0
    for c, w in formants: g = g * c * c / np.sqrt((c * c - f * f) ** 2 + (w * f) ** 2)
    return g


def voice(pitch, loud, seed, air=1.0, lead=0.09, tilt=1.9, voices=(-8, 0, 7), waver=8.0, rough=0.004, opens=0.16, shut=SHUT, formants=FORMANTS):
    """The fog says "ah". pitch (Hz) and loud (0 to 1) are arrays over time. Three voices a few cents apart, each a stack of harmonics
    that falls away fast (a soft voice: `tilt` is how fast) through the mouth above. As a held note does, each has a slow vibrato that
    comes in after the start, a pitch and loudness that wander (`waver`, cents) and a little roughness from one cycle to the next
    (`rough`); the mouth opens from "uh" to "ah" over the first `opens` seconds of sound. With them their breath, noise through the
    same mouth, which starts a moment before the tone, as an "h" does."""
    n = len(pitch); t = np.arange(n) / SR; r = np.random.default_rng(seed); tone = np.zeros(n); grid = np.arange(0, n / SR + 0.2, 0.12)
    slow = lambda: np.interp(t, grid, r.standard_normal(len(grid)))                               # a wander with a new aim every 0.12 s
    fr = np.fft.rfftfreq(n, 1 / SR); fast = lambda: peak(np.fft.irfft(np.fft.rfft(r.standard_normal(n)) * (fr < 70), n))      # and one below 70 Hz
    on = np.argmax(loud > 0.02) / SR; w = ease((t - on) / opens) if opens else np.ones(n)          # how far the mouth has opened
    for cents in voices:
        f = pitch * 2 ** ((cents + waver * slow()) / 1200) * (1 + 0.007 * np.clip((t - on) / 0.5, 0, 1) * np.sin(2 * np.pi * r.uniform(4.4, 5.4) * t + r.uniform(0, 2 * np.pi)) + rough * fast())
        ph = 2 * np.pi * np.cumsum(f) / SR; one = np.zeros(n)
        for h in range(1, int(3200 / f.max()) + 1): one += ((1 - w) * mouth(h * f, shut) + w * mouth(h * f, formants)) / h ** tilt * np.sin(h * ph + r.uniform(0, 2 * np.pi))
        tone += one * (1 + 0.012 * waver * slow())
    sp = np.fft.rfft(r.standard_normal(n)) * (fr > 180) / (1 + (fr / 3500) ** 2)
    breath = (1 - w) * np.fft.irfft(sp * mouth(fr, shut), n) + w * np.fft.irfft(sp * mouth(fr, formants), n)
    k = int(lead * SR); early = np.concatenate([loud[k:], np.full(k, loud[-1])])               # the breath's loudness runs ahead of the tone's
    return peak(tone) * loud + air * peak(breath) * np.maximum(early, loud) ** 0.7


def build(B, add, label, M):
    """M is what the manifest shares: its source paths (M['DROPS'] ...) and the single drops M['DRIP']."""
    assert B.SR == SR
    KR, WM, CAT, EZWA, SKIP, DROPS, DRIP, TK, MIR, TREE = (M[k] for k in ('KR', 'WM', 'CAT', 'EZWA', 'SKIP', 'DROPS', 'DRIP', 'TK', 'MIR', 'TREE'))
    synth = lambda what: [{'kind': 'synth', 'what': what}]

    def lay(parts, seconds=None):
        """The parts summed at their offsets, each brought to its own level first (lv 0 is 20 dB under full scale over its loudest 100 ms)."""
        xs = []
        for p in parts:
            x = B.part({k: v for k, v in p.items() if k not in ('at', 'lv')}); xs.append((int(p.get('at', 0) * SR), x * 10 ** ((p.get('lv', 0) - 20 - B.loud100(x)) / 20)))
        y = np.zeros(int(seconds * SR) if seconds else max(o + len(x) for o, x in xs))
        for o, x in xs: m = min(len(x), len(y) - o); y[o:o + m] += x[:m]
        return y

    def log(parts, *more):
        """The source log of a list of parts: each recording once per cut and speed."""
        out = []
        for p in parts:
            d = dict(label(p['src']), **({'cut': [p.get('a', 0), p['b']]} if 'b' in p else {}), **({'speed': p['speed']} if 'speed' in p else {}))
            if d not in out: out.append(d)
        return out + [m for group in more for m in group]

    AH = 'three voices a few cents apart, each a stack of harmonics that falls away fast under the three formants of a mouth opening from "uh" to "ah", with a slow vibrato and a pitch that wanders a few cents, and noise through the same formants for their breath, which starts 90 ms before the tone; the top taken off by distance, and a diffuse tail'

    # ---- Mister Hollis lands a fish: the line through a mitten, a drip, and the fog says "ah" ----
    def landed(parts, f, seed):
        n = SR; t = np.arange(n) / SR
        loud = ease(t / 0.14) * (1 - ease((t - 0.42) / 0.5)) ** 1.4                                # up in 0.14 s, held, gone by 0.92 s
        pitch = f * 2 ** (-1.0 / 12 * ease((t - 0.4) / 0.55))                                      # and it sags a semitone as it goes, as a spoken "ah" does
        ah = room(far(voice(pitch, loud, seed), 2800), decay=0.22, wet=0.4, lp=2200, seed=seed + 1)
        o = int(0.52 * SR); y = np.zeros(o + len(ah)); x = lay(parts); y[:len(x)] += x[:len(y)]
        y[o:] += ah * 10 ** ((2 - 20 - B.loud100(ah)) / 20)
        return y[:int(1.65 * SR)]
    L1 = [dict(src=FABRIC, a=18.55, b=19.42, lp=5000, fi=0.03, fo=0.15, lv=-5), dict(src=KR % 'drawKnife2', speed=0.6, lp=3500, at=0.06, lv=-9),
          dict(src=DROPS, a=DRIP[0][0], b=DRIP[0][1], at=0.50, lv=-7, fo=0.1)]
    L2 = [dict(src=FABRIC, a=17.46, b=18.01, lp=5000, fi=0.03, fo=0.15, lv=-5), dict(src=KR % 'drawKnife1', speed=0.55, lp=3500, at=0.02, lv=-9),
          dict(src=DROPS, a=DRIP[3][0], b=DRIP[3][1], speed=0.92, at=0.47, lv=-7, fo=0.1)]
    for i, (parts, f, nm) in enumerate(((L1, D3, 'D3'), (L2, A2, 'A2')), 1):
        add(f'hollis-catch_{i}', make=(lambda parts=parts, f=f, i=i: landed(parts, f, 40 + i)), trim=False, fo=0.25,
            sources=log(parts, synth(f'one low breathy note ({nm}) on "ah", 0.9 s long from 0.52 s, sagging a semitone as it goes: ' + AH)),
            how='cloth rubbed, with a knife drawn from its sheath played at a little over half speed under it, for the line through a mitten; one recorded drop; the note is synthesised in sfx_crew.py, on the notes of the murmur')

    # ---- dawn: he thins. dusk or fog: he is there again ----
    TB = 2.5

    def thins():
        n = int(TB * SR); t = np.arange(n) / SR
        out = peak(B.fade(far(B.load(BREATH)[int(0.2 * SR):int(0.2 * SR) + n], 4000), 0.05, 1.0))                 # the recorded breath, out
        loud = ease(t / 0.22) * (1 - ease((t - 0.45) / 1.85)) ** 1.6                                              # the note is there at once and falls away for two seconds
        ah = far(voice(D3 * 2 ** (-5 / 12 * ease((t - 0.55) / 1.6)), loud, 51, air=1.3), 2800)                    # and sinks a fourth, D3 to A2, as it goes
        return room(0.7 * out + peak(ah), decay=0.3, wet=0.45, lp=2200, seed=52)[:int((TB + 0.25) * SR)]

    def gathers():
        n = int(TB * SR); t = np.arange(n) / SR
        b = B.load(BREATH); k = int(1.9 * SR); o = int(0.12 * SR); breath = np.zeros(n)
        breath[:k] = B.fade(B.filt(b[o:o + k][::-1].copy(), hp=500), 0.5, 0.14)                                    # the same breath backwards and thinner: it swells and stops, a breath in
        loud = ease((t - 1.3) / 0.5) ** 1.3 * (1 - ease((t - 2.05) / 0.45))                                       # the note comes as the breath ends, full at 1.8 s, let go at 2.05 s
        ah = far(voice(D3 * 2 ** (-2 / 12 * (1 - ease((t - 1.3) / 0.4))), loud, 53, air=1.5, opens=0.5), 2800)    # coming up a tone into D3, the mouth opening slowly
        return room(peak(breath) + peak(ah), decay=0.3, wet=0.45, lp=2200, seed=54)[:int((TB + 0.25) * SR)]
    add('hollis-thin_1', make=thins, trim=False, fo=0.4, sources=[dict(label(BREATH), cut=[0.2, 2.7])] + synth('one breathy note on "ah" that sinks a fourth, D3 to A2, as it fades: ' + AH),
        how='a recorded breath out; under it the note, there at once, falling away for two seconds and sinking a fourth as it goes; synthesised in sfx_crew.py')
    add('hollis-thick_1', make=gathers, trim=False, fo=0.4, sources=[dict(label(BREATH), cut=[0.12, 2.02])] + synth('one breathy note on "ah" (D3) that comes up a tone into its pitch as it arrives: ' + AH),
        how='the same recorded breath played backwards with everything below 500 Hz taken off, so it swells and stops like a breath in; the note comes as the breath ends, in half a second, and is let go; synthesised in sfx_crew.py')

    # ---- Biscuit hooks a fish out: a small quick splash, a wet flap on wood (and a smaller one), a chirrup ----
    # The chirrup is a meow cut short (1) or played half as fast again (2). The recorded trills in the cat pack read as a hen to the tagger at every speed tried.
    def flap(at, sp, water, wsp, lv=-5):
        """One flap of a wet fish on a plank: a slap, a knock on wood under it and a little water on it."""
        return [dict(src=THWACK % 1, **({'speed': sp} if sp != 1 else {}), at=at, lv=lv), dict(src=WM % 'wood_hit_05', lp=1800, fo=0.1, at=at, lv=lv - 7), dict(src=SKIP + water, speed=wsp, hp=700, at=at - 0.005, lv=lv - 2)]
    C1 = [dict(src=TK % 4, b=0.5, speed=1.4, fo=0.12, lv=-2)] + flap(0.30, 1, 'waterReentry.wav', 1.4) + flap(0.43, 1.15, 'water.wav', 1.6, -10) + \
         [dict(src=MIR % 'cat-meow.p', a=0.41, b=0.9, speed=1.25, fo=0.12, at=0.56, lv=0)]
    C2 = [dict(src=EZWA % 2, speed=1.35, fo=0.1, lv=-2)] + flap(0.28, 0.9, 'water.wav', 1.4) + flap(0.42, 1.1, 'waterReentry.wav', 1.6, -10) + \
         [dict(src=MIR % 'cat-meow.b', a=0.42, b=1.04, speed=1.5, fi=0.01, fo=0.08, at=0.52, lv=0)]
    for i, parts in enumerate((C1, C2), 1):
        add(f'cat-catch_{i}', make=(lambda parts=parts: lay(parts)), sources=log(parts), fo=0.06,
            how='a short splash played faster, so it is small; two soft slaps, each over a knock on wood with water on it, the second smaller; then a meow cut short or played faster, so it is a quick mew')

    # ---- she eats it: small crunching over a purr ----
    E = [dict(src=CAT + 'cat_purractive_loop.wav', a=1.0, b=3.1, hp=35, fi=0.3, fo=0.5, lv=-9)] + \
        [dict(src=CRUNCH % k, speed=sp, hp=500, at=at, lv=lv) for k, sp, at, lv in ((3, 1.25, 0.16, 0), (5, 1.45, 0.50, -2), (3, 1.4, 0.86, -1), (6, 1.5, 1.17, -3), (5, 1.6, 1.50, -3))]
    add('cat-eat_1', make=lambda: lay(E), sources=log(E), trim=False, fo=0.3,
        how='five recorded bites played a quarter to a half faster with everything below 500 Hz taken off, so they are small, a third of a second apart, over two seconds of purr')

    # ---- the crew basket is full: a wicker creak and two knocks on wood ----
    K = [dict(src=KR % 'creak2', a=0.28, speed=1.3, fo=0.08, lv=0), dict(src=CRUNCH % 7, hp=900, b=0.45, fo=0.15, lv=-6),
         dict(src=WS % 'wood on wood thuds', a=0.36, b=0.68, at=0.46, lv=-2), dict(src=WS % 'wood on wood thuds', a=0.91, b=1.18, at=0.65, lv=-4)]
    add('crew-basket-full_1', make=lambda: lay(K), sources=log(K),
        how='two squeaks of a creak played faster, so it is light, with a crackle on it for the wicker; then two knocks of wood on wood, the second a little softer')

    # ---- Pell's refit, under a black screen: mallet, saw, plane, and the hull slides into the water ----
    Y = [dict(src=WS % 'wood hammering', a=0.95, b=2.25, speed=0.8, fo=0.12, lv=0),                                                                        # three knocks of the mallet, 0.54 s apart
         dict(src=SAW, a=0.24, b=1.48, fi=0.03, fo=0.05, at=1.45, lv=-2),                                                                                  # three strokes of the saw
         dict(src=WS % 'scrapes', a=0.5, b=1.4, speed=1.4, fi=0.1, fo=0.05, at=2.68, lv=-3), dict(src=WS % 'scrape5', a=0.9, b=1.85, speed=1.5, fi=0.05, fo=0.06, at=3.28, lv=-4),      # two strokes of the plane: scrapes that swell and stop
         dict(src=WS % 'scrapes', a=8.5, b=9.4, speed=0.8, lp=2500, fi=0.15, fo=0.4, at=3.75, lv=-4), dict(src=TREE, a=0.08, b=1.0, speed=0.7, fo=0.3, at=3.75, lv=-8),   # the hull starts down the slip, and the timber groans
         dict(src=TK % 1, b=1.4, speed=0.9, fo=0.6, at=4.38, lv=0)]                                                                                         # and she takes the water
    add('boatyard_1', make=lambda: lay(Y), sources=log(Y), trim=False, fo=0.5,
        how='three knocks of a hammer on wood played at 0.8 of their speed, so it is a mallet; three strokes of a hand saw; two scrapes of wood played faster, each swelling and stopping, for the plane; a heavier scrape and a creak, both played slower, for the hull starting down the slip, and a wave played a little slower as she takes the water')

    # ---- the Puffin's bigger sail fills: a deeper thump of canvas and a creak of gaff jaws ----
    P = [dict(src=MIR % 'sail-flap.a', a=2.75, b=3.55, speed=0.72, lp=4500, fi=0.03, fo=0.3, lv=-4), dict(src=KR % 'cloth1', speed=0.5, fo=0.35, at=0.2, lv=0),
         dict(src=MIR % 'dock-creak.c', a=1.95, b=2.6, speed=1.15, fi=0.02, fo=0.15, at=0.62, lv=-5)]
    add('sloop-sail_1', make=lambda: lay(P, 1.3), sources=log(P), trim=False, fo=0.25,
        how='a flap of cloth played at half speed, so it is a big sail filling with a thump, over the gust of the sail-flap take played at 0.72 of its speed; then a short wooden creak for the gaff jaws on the mast')
