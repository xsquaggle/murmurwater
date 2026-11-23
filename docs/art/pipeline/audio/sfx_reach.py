"""sfx_reach.py : the sounds of Saltbone Reach (v0.7.0): the Reach by day and by night, rain on the sea and a gale in the rigging,
thunder near and far, a bolt into the sea, struck water, the storm cone run up its halyard, and the swell booming in the Kettles.
Called from sfx_manifest.build(); the recordings it names are in PACKS there.

The four loops are laid round a ring (B.ring) or cut with a crossfade (B.loop_cut), and anything that moves in them (a gust, the
pitch of a wire) moves in whole cycles of the loop, so there is no seam. One-shots are lists of parts as in sfx_finds.py."""
import numpy as np
from scipy import signal
from sfx_crew import SR, ease, peak, room, far
from sfx_finds import ring, glide, die, MORE

RT = 'oga/rain-long-thunder/rain-thunder.ogg'                                      # rain on water for 21 s, then one close thunderclap and its roll
ST = 'oga/storm-siren/storm_3_siren.ogg'                                           # a storm with distant rolls under steady rain
RL = 'oga/rain-loopable/Rain OGG.x/%d.ogg'
STEAM = 'oga/steam-release-sounds/steam_hisses.x/steam hisses - Marker #%d.wav'
WIND = 'oga/wind1/wind%d.wav'
WI = 'oga/35-wooden-crackshitsdestructions/independent_nu_ljudbank-wood_crack_hit_destruction.x/wood_impact/%s.mp3.flac'
RD = 'oga/40-cc0-water-splash-slime-sfx/water-splash-slime-sfx.x/%s.ogg'
BM = 'oga/bubble-sound-effects/bubbles-%s.wav'
FABRIC = 'oga/fabric-rustling/rustling.ogg'
LOOP = 36.0     # seconds, the day and night beds
GALE = 24.0     # the storm's wind
RAIN = 20.0     # the storm's rain
STRUCK = 6.0    # struck water


def rms(x): return np.sqrt((x ** 2).mean())


def at_rms(x, dbfs): return x * 10 ** (dbfs / 20) / max(rms(x), 1e-12)


def resonate(x, tracks, width=0.035, nper=16384):
    """The loop x through narrow resonances that move: each track is (f(t), gain), f an array of Hz over the loop (one value a
    sample), and the resonance a bell of `width` (a fraction of f) on a log scale, with weaker ones at 2f and 3f. Done on three
    copies of the loop and the middle one kept, so the result loops too. What comes out is x's own noise, sung at those pitches."""
    n = len(x); y3 = np.tile(x, 3); hop = nper // 4
    fr, tt, Z = signal.stft(y3, SR, nperseg=nper, noverlap=nper - hop, boundary=None, padded=False)
    idx = np.clip((tt * SR).astype(int) % n, 0, n - 1); lf = np.log(np.maximum(fr, 1.0))[:, None]; mask = np.zeros(Z.shape)
    for f, g in tracks:
        fc = f[idx][None, :]
        for h, hg in ((1, 1.0), (2, 0.45), (3, 0.18)):
            mask += g * hg * np.exp(-0.5 * ((lf - np.log(h * fc)) / width) ** 2)
    _, z = signal.istft(Z * mask, SR, nperseg=nper, noverlap=nper - hop, boundary=False)
    z = np.concatenate([z, np.zeros(max(0, 3 * n - len(z)))]); return z[n:2 * n]


def build(B, add, label, M):
    """M is what the manifest shares: its source paths (M['ALK'], M['GULL'], M['KR'], M['WM'], M['TK'], M['TREE'], M['DROPS'])."""
    assert B.SR == SR
    ALK, GULL, KR, WM, TK = (M[k] for k in ('ALK', 'GULL', 'KR', 'WM', 'TK'))
    synth = lambda what: [{'kind': 'synth', 'what': what}]
    level = lambda x, lv: x * 10 ** ((lv - 20 - B.loud100(x)) / 20)

    def lay(parts, seconds=None):
        """As in sfx_finds.py: the parts summed at their offsets, each brought to its own level first (lv 0 is 20 dB under full scale
        over its loudest 100 ms). A part may also be `rev` (played backwards)."""
        xs = []
        for p in parts:
            x = B.part({k: v for k, v in p.items() if k not in MORE + ('rev',)}); lv = p.get('lv', 0); o = int(p.get('at', 0) * SR)
            if p.get('rev'): x = B.fade(x[::-1], p.get('fo', 0.03), p.get('fi', 0.002))
            if 'glide' in p: x = glide(x, *p['glide'])
            if 'die' in p: x = die(x, *p['die'])
            xs.append((o, x * 10 ** ((lv - 20 - B.loud100(x)) / 20)))
            if 'ring' in p: r = ring(x, p['ring'][0], decay=p['ring'][3] if len(p['ring']) > 3 else (0.09, 0.05), gain=(p['ring'] + ((1.0, 0.5),))[2]); xs.append((o, r * 10 ** ((lv + p['ring'][1] - 20 - B.loud100(r)) / 20)))
        y = np.zeros(int(seconds * SR) if seconds else max(o + len(x) for o, x in xs))
        for o, x in xs: m = min(len(x), len(y) - o); y[o:o + m] += x[:m]
        return y

    def log(parts):
        out = []
        for p in parts:
            sp = p.get('speed', 1.0) * (sum(p['glide']) / 2 if 'glide' in p else 1.0)
            d = dict(label(p['src']), **({'cut': [p.get('a', 0), p['b']]} if 'b' in p else {}), **({'speed': round(sp, 3)} if sp != 1.0 else {}), **({'reversed': True} if p.get('rev') else {}))
            if d not in out: out.append(d)
        return out

    # ---- storm-rain: hard rain on the sea. Two recordings of rain laid together, the rumble under 200 Hz taken out ----
    def rain():
        a = B.loop_cut(RL % 2, 5.5, RAIN, 1.5); b = B.loop_cut(RL % 3, 12.0, RAIN, 2.0)
        return B.circular(at_rms(a, -20) + at_rms(b, -23), hp=200)
    add('storm-rain_1', make=rain, loop=True, lufs=-21, sources=[dict(label(RL % 2), cut=[5.5, 25.5]), dict(label(RL % 3), cut=[12.0, 32.0])],
        how='two recordings of rain, a dense one and one of rain on water 3 dB under it, each cut to 20 s with a crossfade into the audio before the cut, laid together with everything under 200 Hz taken out (one of them had a rumble in it)')

    # ---- storm-wind: a gale in rigging. Recorded wind, rising and falling, and the same wind sung through moving resonances: the moan ----
    NG = int(GALE * SR); tg = np.arange(NG) / SR; cg = lambda m, ph: np.sin(2 * np.pi * (m * tg / GALE + ph))

    def gale():
        w = B.circular(B.loop_cut(WIND % 3, 20.0, GALE, 3.0), hp=60); w = at_rms(w, -24)
        gust = np.clip(0.5 + 0.32 * cg(2, 0.10) + 0.14 * cg(3, 0.55) + 0.06 * cg(7, 0.30), 0, 1)        # two big gusts and a lesser one in the loop
        wires = [(f0 * (1 + 0.16 * gust + 0.015 * cg(m, ph)), g) for f0, g, m, ph in ((168.0, 1.0, 5, 0.2), (251.0, 0.7, 4, 0.7), (377.0, 0.4, 6, 0.4))]
        moan = at_rms(resonate(w, wires), -24)
        return w * (0.45 + 0.55 * gust) + moan * gust ** 1.6
    add('storm-wind_1', make=gale, loop=True, lufs=-21, sources=[dict(label(WIND % 3), cut=[20.0, 44.0])],
        how='recorded wind, 24 s cut with a 3 s crossfade, rising and falling in two big gusts and a lesser one; laid with the same wind through three narrow resonances (near 168, 251 and 377 Hz, with weaker ones at twice and three times each) whose pitch climbs a sixth of itself with each gust: the rigging moaning. No synthesised noise: the moan is the recorded wind, filtered')

    # ---- reach-day and reach-night: a long slow swell on shingle, wind over bare rock; gulls far off by day, a wire humming by night ----
    N = int(LOOP * SR); t36 = np.arange(N) / SR; cyc = lambda m, ph=0.0: np.sin(2 * np.pi * (m * t36 / LOOP + ph))

    def swells(times, seed, lp=None, gain=0.0, surge_db=-30):
        """Each swell: a low surge coming up for a second and a half (the wave an octave down and dulled), then the wave breaking
        and dragging back over the pebbles."""
        r = np.random.default_rng(seed); ev = []
        for j, tm in enumerate(times):
            k = 1 + (j * 3 + seed) % 4; sp = float(r.uniform(0.82, 0.94)); g = gain + float(r.uniform(-2.5, 1.0))
            wv = B.part(dict(src=ALK % k, speed=sp, fi=0.25, fo=0.8)); wv = far(wv, lp) if lp else wv
            surge = B.part(dict(src=ALK % k, speed=sp * 0.5, lp=260, fi=1.4, fo=1.5))
            ev.append((int((tm - 1.2) * SR) % N, at_rms(surge, surge_db + g)))
            ev.append((int(tm * SR) % N, at_rms(wv, -26 + g)))
        return ev

    def air(file, a, lo, hi, dbfs, seed):
        w = B.circular(B.loop_cut(WIND % file, a, LOOP, 3.0), hp=lo, lp=hi); return at_rms(w, dbfs) * (1 + 0.3 * cyc(2, 0.1 * seed) + 0.15 * cyc(5, 0.37 * seed))

    DAY_SWELL = (1.8, 8.9, 15.4, 22.6, 29.1)                       # one every 6.5 to 7 s: a long, slow swell
    DAY_GULLS = (('Ambient 1', 0.0, 3.89, 5.5, -31), ('Ambient 5', 0.0, 1.45, 19.0, -34), ('Ambient 7', 0.0, 0.88, 20.7, -36), ('Big Ambient 2', 0.3, 3.2, 31.5, -35))

    def day():
        ev = swells(DAY_SWELL, 3)
        for nm, a, b, tm, g in DAY_GULLS:
            c = B.part(dict(src=GULL % nm, a=a, b=b, hp=700, fi=0.03, fo=0.15)); c = room(far(peak(c), 2600), decay=0.25, wet=0.25, lp=2400, seed=int(tm))
            ev.append((int(tm * SR), at_rms(c, g)))
        return air(4, 10.0, 160, 2600, -33, 1) + B.ring(N, ev)
    add('reach-day_1', make=day, loop=True, lufs=-22,
        sources=[label(ALK % k) for k in (1, 2, 3, 4)] + [dict(label(WIND % 4), cut=[10.0, 46.0])] + [dict(label(GULL % nm), cut=[a, b]) for nm, a, b, _, _ in DAY_GULLS],
        how='five swells, one every 6.5 to 7 s: each is a recorded wave breaking on a pebble beach, played a little slower, after a second and a half of the same wave an octave down and dulled coming up under it (the swell arriving); a quiet bed of recorded wind between 160 and 2600 Hz, rising and falling; four gull calls far off, dulled and with a long tail. Laid round a 36 s ring')

    NIGHT_SWELL = (3.0, 10.4, 17.5, 24.9, 31.8)
    E3 = 5933 / 36.0                                               # E3, nudged so the hum has a whole number of cycles in the loop

    def hum():
        """A stay wire humming in the wind: the wind itself through two very narrow resonances on E3 and B3, and under it the faint
        pure note, swelling and fading twice in the loop."""
        w = at_rms(B.circular(B.loop_cut(WIND % 5, 12.0, LOOP, 3.0), hp=80), -24)
        f1 = E3 * (1 + 0.004 * cyc(3, 0.2)); f2 = 1.5 * E3 * (1 + 0.004 * cyc(4, 0.6))
        sung = at_rms(resonate(w, [(f1, 1.0), (f2, 0.55)], width=0.012, nper=32768), -30)
        ph = 2 * np.pi * np.cumsum(f1) / SR; core = at_rms(np.sin(ph) + 0.25 * np.sin(2 * ph + 1.0), -36)
        return (sung + core) * (0.55 + 0.45 * cyc(2, 0.62)) ** 1.5

    def night():
        return air(2, 14.0, 120, 1800, -41, 2) + at_rms(hum(), -37) + B.ring(N, swells(NIGHT_SWELL, 5, lp=2400, gain=2, surge_db=-40))
    add('reach-night_1', make=night, loop=True, lufs=-22,
        sources=[label(ALK % k) for k in (1, 2, 3, 4)] + [dict(label(WIND % 2), cut=[14.0, 50.0]), dict(label(WIND % 5), cut=[12.0, 48.0])] + synth('a faint pure note on E3 with a little of its octave, under the wire'),
        how='the swell of the day loop at other times and duller (everything over 2400 Hz falling away); a quieter bed of recorded wind; and a stay wire humming: recorded wind through two very narrow resonances on E3 and B3 with a faint pure E3 under them, swelling and fading twice in the loop. Laid round a 36 s ring')

    # ---- thunder-near: a crack and a long roll, close. One recorded thunderclap, cut two ways ----
    TN = ([dict(src=RT, a=20.95, b=26.6, hp=25, fo=1.5)],
          [dict(src=RT, a=20.95, b=22.75, speed=0.9, hp=25, fo=0.35), dict(src=RT, a=26.9, b=30.4, speed=0.9, hp=25, fi=0.4, fo=1.4, at=1.65, lv=-1)])
    for i, parts in enumerate(TN, 1):
        add(f'thunder-near_{i}', make=(lambda parts=parts: lay(parts)), sources=log(parts), trim=False, fo=0.4,
            how=('a recorded thunderclap and the first five seconds of its roll' if i == 1 else 'the same thunderclap played at 0.9 of its speed, so it is lower and longer, joined to a later stretch of its roll'))

    # ---- thunder-far: a roll a long way off. Rolls from two recordings, dulled (distance takes the top off) and given a tail ----
    def farroll(p, lp, decay=0.9):
        def make():
            x = B.part(p); x = far(far(x, lp), lp)
            return room(peak(x), decay=decay, wet=0.45, lp=lp, seed=int(p['a']))[:len(x) + int(0.8 * SR)]
        return make
    TF = (dict(src=ST, a=73.6, b=79.2, speed=0.92, fi=0.8, fo=2.0), dict(src=ST, a=52.6, b=58.2, speed=0.9, fi=0.6, fo=2.0), dict(src=RT, a=27.8, b=32.6, speed=0.8, fi=0.9, fo=2.0))
    for i, p in enumerate(TF, 1):
        lp = (420, 380, 260)[i - 1]
        add(f'thunder-far_{i}', make=farroll(p, lp), sources=log([p]), trim=False, fo=0.6,
            how=f'a stretch of a recorded roll of thunder played at {p["speed"]} of its speed, everything over {lp} Hz falling away twice over, and a long dull tail')

    # ---- lightning-strike: a bolt into the sea a cast away. A split (two wooden cracks, the top of a thunderclap), a slap of water, a hiss of steam ----
    def bolt(crack, cb, sp, h1, h2, sp1):
        return [dict(src=WI % crack, a=0.1, b=cb, hp=400, fo=0.15, lv=-6), dict(src=RT, a=21.2, b=21.9, hp=60, speed=sp, fo=0.25, lv=0), dict(src=RD % 'splash_02', speed=1.05 * sp, at=0.02, lv=-13),
                dict(src=STEAM % h1, speed=sp1, at=0.06, fi=0.02, lv=0), dict(src=STEAM % h2, speed=sp1 + 0.15, at=0.5, fi=0.1, lv=-5),
                dict(src=RT, a=3.0, b=4.6, hp=3000, at=0.1, fi=0.05, die=(0.4, 0.4), lv=-9)]
    LS = (bolt('crack01', 0.7, 1.0, 2, 4, 0.55), bolt('crack04', 0.6, 0.94, 5, 3, 0.6))
    for i, parts in enumerate(LS, 1):
        add(f'lightning-strike_{i}', make=(lambda parts=parts: lay(parts, 1.62)), sources=log(parts), trim=False, fo=0.3,
            how='the first moment of a recorded thunderclap with a sharp wooden crack under it for the split, a slap of water, and from 0.06 s two recorded hisses of steam played slower, one after the other, with the fizz of rain on water dying under them; no roll (the game plays the thunder after it); cut at 1.62 s')

    # ---- struck-water: a faint fizz and a singing note, quiet ----
    NS = int(STRUCK * SR); ts = np.arange(NS) / SR; cs = lambda m, ph=0.0: np.sin(2 * np.pi * (m * ts / STRUCK + ph))

    def struck():
        raw = B.loop_cut(RT, 6.0, STRUCK, 1.0); fz = at_rms(B.circular(raw, hp=3800), -27) * (1 + 0.25 * cs(3, 0.1) + 0.15 * cs(7, 0.5))
        hs = [B.part(dict(src=STEAM % k, fi=0.2, fo=0.6, hp=2500)) for k in (1, 3)]; sz = B.ring(NS, [(0, at_rms(hs[0], -38)), (int(3.1 * SR), at_rms(hs[1], -39))])
        f = 3956 / STRUCK; vib = 0.003 * f * cs(12, 0.3); ph = 2 * np.pi * np.cumsum(f + vib) / SR      # a slow sway of pitch, twice a second, in whole cycles of the loop
        tone = 0.8 * np.sin(ph) + 0.2 * np.sin(ph * (f + 0.5) / f + 2.0) + 0.05 * np.sin(2 * ph + 0.7)
        swell = (0.5 + 0.5 * cs(3, 0.25)) ** 2; tone *= 0.15 + 0.85 * swell            # it swells and all but dies three times in the loop
        sung = at_rms(resonate(raw, [(f + vib, 1.0)], width=0.006, nper=16384), -31) * (0.3 + 0.7 * swell)      # the same rain on water, singing at the note
        return fz + sz + sung + at_rms(tone, -38)
    add('struck-water_1', make=struck, loop=True, lufs=-29,
        sources=[dict(label(RT), cut=[6.0, 12.0]), label(STEAM % 1), label(STEAM % 3)] + synth('a singing note near E5 (659 Hz): two tones half a hertz apart, so it beats once every two seconds, with a faint octave, its pitch swaying a third of a percent twice a second, swelling and all but dying three times in the loop'),
        how='rain on water with everything under 3800 Hz taken away, so only the fizz of it is left, and two soft hisses of steam; the same rain on water through a very narrow resonance near E5, so the water itself sings, with a faint pure note under it; quiet on purpose (7 dB under the other loops)')

    # ---- storm-cone: a canvas cone run up a halyard. A block squeaks as the line runs, the canvas cone thumps against the masthead ----
    CONE = [dict(src=KR % 'creak3', speed=1.15, glide=(1.0, 1.2), fo=0.06, lv=-2), dict(src=KR % 'creak1', a=0.14, b=0.5, speed=1.2, at=0.24, fo=0.05, lv=-5),
            dict(src=FABRIC, a=18.55, b=18.95, lp=3000, at=0.5, fo=0.15, lv=-8), dict(src=WM % 'wood_hit_09', speed=0.75, lp=800, at=0.5, lv=0)]
    add('storm-cone_1', make=(lambda: lay(CONE, 1.0)), sources=log(CONE), trim=False, fo=0.2,
        how='two short squeaks of a block as the line runs (wooden creaks played a little faster, the first rising), then at 0.5 s a flap of cloth and a dull wooden knock: the cone arriving at the masthead; cut at 1 s')

    # ---- swell-boom: the swell going into one of the Kettles. A deep hollow boom, ringing in the cave, and the water sucked back out ----
    def boom(k, a, b, sp, f, suck, bub):
        return [dict(src=ALK % k, a=a, b=b, speed=sp, lp=320, fi=0.03, fo=0.5, ring=(f, -2, (1.0, 0.6), (0.45, 0.3))),
                dict(src=ALK % suck, speed=0.75, hp=250, lp=2600, fi=0.25, fo=0.9, at=1.0, lv=-7), dict(src=BM % bub, speed=0.35, lp=900, at=2.1, lv=-13)]
    SB = (boom(1, 1.05, 2.0, 0.45, (46, 97), 3, 'single1'), boom(3, 0.15, 1.0, 0.4, (41, 88), 2, 'single3'))
    for i, parts in enumerate(SB, 1):
        add(f'swell-boom_{i}', make=(lambda parts=parts: lay(parts, 3.1)), sources=log(parts), trim=False, fo=0.3,
            how='the break of a recorded wave played at about two fifths of its speed with the top taken off, so it is a boom 0.3 s in, ringing on in two low resonances of a cave (near 45 and 95 Hz) for the boom; from 1.0 s another wave, played slower with its low end taken out (only the hiss of the water left), dying away, for the water sucked back out over the stones, and one slow low gulp at the end; cut at 3.1 s')
