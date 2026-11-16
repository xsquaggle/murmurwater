"""sfx_manifest.py : what every sound effect is made from. Read by sfx_build.py.

PACKS lists the source recordings (all CC0) and GEN the generated clips; build() returns one item per output file."""
import json, os
import numpy as np

A = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OGA = 'https://opengameart.org/content/'
PACKS = {   # path prefix -> (short name, title, author, page)
    'oga/swish-bamboo-stick-weapon-swhoshes/': ('qubodup-swosh', 'Swish - bamboo stick weapon swhoshes', 'qubodup', OGA + 'swish-bamboo-stick-weapon-swhoshes'),
    'oga/fisheefects/': ('fisheefects', 'Fisheefects', "You're Perfect Studio (sounds by Memoraphile)", OGA + 'fisheefects'),
    'oga/skippy-fish-water-sound-collection/': ('skippy', 'Skippy Fish Water Sound Collection', 'jcpmcdonald', OGA + 'skippy-fish-water-sound-collection'),
    'oga/object-dropping-into-water-0/': ('angeloyazar-drops', 'Object Dropping into Water', 'angeloyazar', OGA + 'object-dropping-into-water-0'),
    'oga/water-splash-and-sand-footsteps/': ('peludo', 'Water Splash and sand footsteps', 'Peludo', OGA + 'water-splash-and-sand-footsteps'),
    'oga/6-short-water-splashes/': ('ezwa', '6 Short water splashes', 'ezwa', OGA + '6-short-water-splashes'),
    'oga/different-steps-on-wood-stone-leaves-gravel-and-mud/': ('tinyworlds', 'Different steps on wood, stone, leaves, gravel and mud', 'TinyWorlds', OGA + 'different-steps-on-wood-stone-leaves-gravel-and-mud'),
    'oga/cat-purr-meow/': ('kerzoven', 'Cat Purr & Meow', 'Kerzoven', OGA + 'cat-purr-meow'),
    'oga/flare-ignition/': ('qubodup-flare', 'Flare ignition', 'qubodup', OGA + 'flare-ignition'),
    'oga/catching-fire/': ('themightyglider', 'Catching fire', 'themightyglider', OGA + 'catching-fire'),
    'oga/tree-creaking/': ('antumdeluge', 'Tree Creaking', 'AntumDeluge', OGA + 'tree-creaking'),
    'oga/solo-seagull-sound-effects/': ('rangomango', 'Solo Seagull Sound Effects', 'Rango Mango', OGA + 'solo-seagull-sound-effects'),
    'oga/sea-and-river-wave-sounds/': ('randommind', 'Sea and river wave sounds', 'RandomMind', OGA + 'sea-and-river-wave-sounds'),
    'oga/water-waves/': ('transitking', 'Water Waves', 'transitking', OGA + 'water-waves'),
    'cc0/kenney-rpg/': ('kenney-rpg', '50 RPG sound effects', 'Kenney', OGA + '50-rpg-sound-effects'),
    'cc0/kenney-interface/': ('kenney-ui', 'Interface Sounds', 'Kenney', OGA + 'interface-sounds'),
    'oga/100-cc0-metal-and-wood-sfx/': ('rubberduck-wood', '100 CC0 metal and wood SFX', 'rubberduck', OGA + '100-cc0-metal-and-wood-sfx'),
    'oga/opening-and-closing-a-map-sounds/': ('springspring-map', 'Opening and Closing a Map Sounds', 'Spring Spring', OGA + 'opening-and-closing-a-map-sounds'),
    'oga/various-paper-sound-effects/': ('luckius-paper', 'Various Paper Sound Effects', 'Luckius', OGA + 'various-paper-sound-effects'),
    'oga/beach-ocean-waves/': ('jasinski-waves', 'Beach Ocean Waves', 'jasinski', OGA + 'beach-ocean-waves'),
    'oga/swamp-environment-audio/': ('lokif-swamp', 'Swamp Environment Audio', 'LokiF', OGA + 'swamp-environment-audio'),
    'oga/20-rustles-dry-leaves/': ('qubodup-rustle', '20 Rustles of dry leaves', 'qubodup', OGA + '20-rustles-dry-leaves'),
    'oga/wind1/': ('rustltd-wind', 'wind1', 'Luke.RUSTLTD', OGA + 'wind1'),
    'oga/crickets-ambient-noise-loopable/': ('wolfgang-crickets', 'Crickets Ambient Noise - loopable', 'Wolfgang_', OGA + 'crickets-ambient-noise-loopable'),
    'oga/ambient-bird-sounds/': ('isaiah658-birds', 'Ambient Bird Sounds', 'isaiah658', OGA + 'ambient-bird-sounds'),
    'oga/sack-of-gold/': ('amarikah-gold', 'Sack of Gold', 'Amarikah', OGA + 'sack-of-gold'),
}
BAM = 'oga/swish-bamboo-stick-weapon-swhoshes/swoshes.x/swosh-%02d.flac'
FISH = 'oga/fisheefects/FisheefectsComplete.x/'
SKIP = 'oga/skippy-fish-water-sound-collection/'
DROPS = 'oga/object-dropping-into-water-0/water_drops_1.ogg'
PEL = 'oga/water-splash-and-sand-footsteps/'
EZWA = 'oga/6-short-water-splashes/ezwa-water_splash.x/ezwa-water_splash/water_splash-%02d.flac'
TW = 'oga/different-steps-on-wood-stone-leaves-gravel-and-mud/[kdd]DifferentSteps_0.x/%s.ogg'
CAT = 'oga/cat-purr-meow/'
IGN = 'oga/flare-ignition/ignition.flac'
FLAME = 'oga/catching-fire/flame_0.ogg'
TREE = 'oga/tree-creaking/tree_creak.flac'
GULL = 'oga/solo-seagull-sound-effects/Seagull %s.wav'
VIST = 'oga/sea-and-river-wave-sounds/VistulaShort_0.mp3'
TK = 'oga/water-waves/wave_%02d_cc0-11505__transitking__wavesound.flac'
ALK = 'oga/beach-ocean-waves/wave_%02d_cc0-18363__jasinski__alkaibeach.flac'
KR = 'cc0/kenney-rpg/OGG/%s.ogg'
KU = 'cc0/kenney-interface/Audio/%s.ogg'
WM = 'oga/100-cc0-metal-and-wood-sfx/100-CC0-wood-metal-SFX.x/%s.ogg'
MAP = 'oga/opening-and-closing-a-map-sounds/%s.wav'
PAPER = 'oga/various-paper-sound-effects/%s.mp3'
MIR = 'sfx/raw/%s.mp3'
JOBS = {k: v['job'] for k, v in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'generated.json'))).items()}   # generated clips: name -> job id (prompts are in the same file)


def label(src):
    if src.startswith('sfx/raw/'):
        n = os.path.basename(src)[:-4]; return {'kind': 'generated', 'name': n, 'job': JOBS[n]}
    for pre, (short, title, author, page) in PACKS.items():
        if src.startswith(pre): return {'kind': 'cc0', 'pack': short, 'file': os.path.basename(src)}
    raise KeyError(src)


def build(B):
    SR = B.SR; items = []

    def add(name, parts=None, make=None, sources=None, **kw):
        if parts is not None:
            make = (lambda ps=parts: B.mix(ps)); sources = [dict(label(p['src']), **({'cut': [p.get('a', 0), p['b']]} if 'b' in p else {}), **({'speed': p['speed']} if 'speed' in p else {})) for p in parts]
        items.append(dict(name=name, make=make, sources=sources, **kw))

    def one(base, srcs, **kw):
        for i, s in enumerate(srcs, 1):
            add(f'{base}_{i}', [s] if isinstance(s, dict) else s, **kw)

    # ---- fishing ----
    one('cast-swish', [dict(src=BAM % n) for n in (40, 42, 29, 43)])
    one('reel-spin', [dict(src=FISH + 'reel.wav', a=a, b=b, speed=sp, fi=0.01, fo=fo) for a, b, sp, fo in ((1.0, 2.9, 1.7, 0.5), (3.6, 5.1, 1.5, 0.45), (6.0, 7.9, 1.35, 0.65))], trim=False, how='played 1.35 to 1.7 times faster, so the reel whirrs, and faded out')
    one('bobber-plop', [dict(src=FISH + 'bloop.wav'), dict(src=SKIP + 'water.wav'), dict(src=SKIP + 'waterReentry.wav')])
    one('nibble', [dict(src=DROPS, a=a, b=b) for a, b in ((0.28, 0.62), (1.99, 2.30), (3.66, 3.97), (6.53, 6.86))], level=-6)
    one('bite-dunk', [
        [dict(src=FISH + 'bloop.wav', speed=0.7), dict(src=PEL + 'splash2_0.wav', a=0.64, b=1.15, gain=-8, at=0.03, fo=0.2)],
        [dict(src=SKIP + 'waterReentry.wav', speed=0.6), dict(src=EZWA % 3, gain=6, at=0.04, fo=0.2)],
        [dict(src=SKIP + 'water.wav', speed=0.65), dict(src=PEL + 'splash1_0.wav', a=0.52, b=1.06, gain=-10, at=0.03, fo=0.2)],
    ], how='a plop slowed down for depth, with a small splash on top')
    one('hook-set', [[dict(src=BAM % n, speed=1.25)] + [dict(src=KU % 'tick_002', at=0.07 + 0.028 * k, gain=-8 - 2 * k) for k in range(4)] for n in (17, 3, 15)], how='a rod swish played a little faster, with four quick clicks of the reel behind it')
    one('line-creak', [dict(src=KR % 'creak1'), dict(src=KR % 'creak2'), dict(src=KR % 'creak3')])
    one('fish-splash', [dict(src=EZWA % 1), dict(src=TK % 4, fo=0.2), dict(src=PEL + 'splash2_0.wav', a=0.6), dict(src=EZWA % 3)])
    one('land-splash', [dict(src=MIR % 'fish-splash.b', b=1.5, fo=0.5), dict(src=MIR % 'fish-splash.a', a=0.45, b=2.4, fi=0.08, fo=0.5), dict(src=TK % 1, fo=0.2)], trim=False)
    one('coins', [dict(src=KR % 'handleCoins'), dict(src=KR % 'handleCoins2'), dict(src=MIR % 'coins.p', b=0.9, fo=0.1), dict(src=MIR % 'coins.a', a=0.15, b=0.95, fo=0.1)])

    # ---- line snap (layered recordings), reel ratchet loop (recorded clicks on a grid), quest chime (synthesised) ----
    one('line-snap', [
        [dict(src=KR % 'beltHandle1'), dict(src=BAM % 17, speed=1.8, at=0.01, gain=-3)],
        [dict(src=KR % 'bookClose'), dict(src=BAM % 3, speed=1.8, at=0.01, gain=-3)],
        [dict(src=KR % 'clothBelt2', b=0.3, fo=0.1), dict(src=BAM % 1, speed=1.8, at=0.01, gain=-3)],
    ], how='a sharp snap with a fast whip of air right behind it')

    def ratchet(seed, per_s, clicks, bed_a):
        r = np.random.default_rng(seed); n = SR; ev = []
        for k in range(per_s):
            c = B.part(dict(src=KU % clicks[k % len(clicks)], speed=float(r.uniform(0.96, 1.04)), fi=0.0005, fo=0.004)); ev.append((round(k * n / per_s), c * 10 ** (r.uniform(-1.5, 1.5) / 20)))
        y = B.ring(n, ev); bed = B.loop_cut(FISH + 'reel.wav', bed_a, 1.0, 0.15); bed *= 10 ** (-14 / 20) * np.abs(y).max() / np.abs(bed).max()
        return y + bed
    add('reel-click_1', make=lambda: ratchet(11, 12, ['click_004', 'tick_002'], 2.0), loop=True, lufs=-20, sources=[dict(label(KU % 'click_004')), dict(label(KU % 'tick_002')), dict(label(FISH + 'reel.wav'), cut=[2.0, 3.0])], how='12 evenly spaced clicks a second over a quiet bed of the recorded reel; exactly 1 s')
    add('reel-click_2', make=lambda: ratchet(12, 16, ['tick_002', 'click_004', 'tick_001'], 5.0), loop=True, lufs=-20, sources=[dict(label(KU % 'tick_002')), dict(label(KU % 'click_004')), dict(label(KU % 'tick_001')), dict(label(FISH + 'reel.wav'), cut=[5.0, 6.0])], how='16 evenly spaced clicks a second over a quiet bed of the recorded reel; exactly 1 s')

    def chime(notes, gap=0.085):
        n = int(1.25 * SR); y = np.zeros(n); t = np.arange(n) / SR
        for k, f in enumerate(notes):
            o = int(k * gap * SR); tt = t[:n - o]; a = 1 - np.exp(-tt / 0.003)
            v = sum(g * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt / d) for m, g, d in ((1, 1.0, 0.42), (2.0, 0.30, 0.22), (3.01, 0.10, 0.12), (5.4, 0.06, 0.05)))
            y[o:] += a * v * (0.8 + 0.2 * k / max(1, len(notes) - 1))
        return y
    D5, FS5, A5, A4, D6, E5, B4 = 587.33, 739.99, 880.0, 440.0, 1174.66, 659.25, 493.88
    for i, notes in enumerate(((D5, FS5, A5), (A4, D5, FS5), (FS5, A5, D6)), 1):
        add(f'quest-accept_{i}', make=(lambda ns=notes: chime(ns)), sources=[{'kind': 'synth', 'what': 'three rising notes of a D major chord on a soft mallet tone'}], how='synthesised in sfx_manifest.py, in the key of the Hearthbay theme', fo=0.25, level=-3)

    # ---- world ----
    one('step-wood', [dict(src=KR % 'footstep02'), dict(src=KR % 'footstep03'), dict(src=TW % 'wood03'), dict(src=TW % 'wood02')], level=-4)
    one('step-cobble', [dict(src=KR % f) for f in ('footstep04', 'footstep06', 'footstep07', 'footstep05')], level=-4)
    one('step-grass', [dict(src=MIR % 'step-grass.a', a=a, b=b, fo=0.1) for a, b in ((1.33, 1.69), (1.70, 2.22), (2.84, 3.21), (3.19, 3.60))], level=-4)
    one('step-sand', [dict(src=PEL + 'sand_footsteps_0.mp3', a=a, b=b, fo=0.1) for a, b in ((2.00, 2.54), (2.62, 3.14), (3.22, 3.74), (3.84, 4.36))], level=-4)
    one('ui-open', [dict(src=KU % f'open_00{n}') for n in (1, 2, 3, 4)], level=-4)
    one('ui-close', [dict(src=KU % f'close_00{n}') for n in (1, 2, 3, 4)], level=-4)
    one('ui-click', [dict(src=KU % f'click_00{n}') for n in (1, 2, 3, 4)], level=-4)
    one('page-turn', [dict(src=KR % f'bookFlip{n}') for n in (1, 2, 3)], level=-3)
    one('lamp-ignite', [
        [dict(src=FLAME, speed=0.85)],
        [dict(src=IGN)],
        [dict(src=FLAME, speed=0.7), dict(src=IGN, gain=-6, at=0.06)],
    ])
    one('oars', [dict(src=MIR % 'oars.b', a=0.05, b=1.2, fi=0.03, fo=0.25), dict(src=MIR % 'oars.b', a=1.8, b=3.1, fi=0.05, fo=0.3), dict(src=MIR % 'oars.c', a=1.0, b=2.3, fi=0.05, fo=0.3), dict(src=MIR % 'oars.c', a=3.2, b=4.8, fi=0.05, fo=0.4)], trim=False)
    one('gulls', [dict(src=GULL % 'Big Ambient 2'), dict(src=GULL % 'Ambient 5'), dict(src=GULL % 'Ambient 1'), dict(src=GULL % 'Ambient 7')])
    one('dock-creak', [dict(src=TREE, a=0.05, b=1.95, speed=0.7, fo=0.2), dict(src=MIR % 'dock-creak.a', a=0.85, b=2.4, fo=0.2), dict(src=MIR % 'dock-creak.b', a=1.75, b=3.55, fi=0.02, fo=0.2), dict(src=MIR % 'dock-creak.c', a=1.95, b=3.4, fi=0.02, fo=0.3)])
    one('cat-meow', [dict(src=MIR % 'cat-meow.b', a=0.2, b=1.12), dict(src=MIR % 'cat-meow.p', a=0.36, b=1.96, fo=0.08), dict(src=MIR % 'cat-meow.a', a=0.84, fo=0.22)])

    # ---- sailing ----
    one('sail-flap', [dict(src=MIR % 'sail-flap.a', a=a, b=b, hp=80, fi=0.03, fo=fo) for a, b, fo in ((0.25, 1.2, 0.2), (1.2, 2.0, 0.2), (2.0, 3.55, 0.25))], trim=False, how='one gust of a generated take, with the wind rumble below 80 Hz removed')
    add('boat-bump_1', [dict(src=WM % 'wood_misc_07', speed=0.6), dict(src=PEL + 'sand_footsteps_0.mp3', a=0.83, b=1.5, gain=-10, at=0.02, fi=0.01, fo=0.12, lp=5000)], how='a wooden knock played slower, so it is heavy and hollow, with a scrape of sand under it')
    add('boat-bump_2', [dict(src=MIR % 'boat-bump.a', a=1.10, b=1.79, fi=0.01, fo=0.2)], how='one thud of a generated take')
    add('boat-bump_3', [dict(src=WM % 'wood_hit_05', speed=0.5), dict(src=WM % 'wood_hit_09', speed=0.6, at=0.16, gain=-7)], how='two wooden knocks played slower, the second softer: the hull touches and settles')
    add('rope-creak_1', [dict(src=TREE, a=3.78, b=4.86, fi=0.01, fo=0.15)], level=-3, how='a cut of a creaking tree')
    add('rope-creak_2', [dict(src=TREE, a=2.0, b=3.6, fi=0.01, fo=0.15)], level=-3, how='a cut of a creaking tree')
    add('rope-creak_3', [dict(src=TREE, a=0.08, b=1.9, speed=1.5, fi=0.01, fo=0.15)], level=-3, how='the stretch that the dock creak slows down, played faster here, so it is tighter and higher')
    add('boat-board_1', [dict(src=KR % 'footstep02', speed=0.6), dict(src=MIR % 'oars.d', a=0.2, b=1.3, at=0.10, gain=-8, fi=0.05, fo=0.4)], level=-2, how='a step on wood played slower for weight, with the slosh of an oar stroke behind it')
    add('boat-board_2', [dict(src=WM % 'wood_close_01', speed=0.65), dict(src=TREE, a=3.83, b=4.3, at=0.12, gain=-12, fo=0.15), dict(src=MIR % 'oars.d', a=1.3, b=2.5, at=0.14, gain=-7, fi=0.05, fo=0.4)], level=-2, how='a wooden thump played slower for weight, a short creak and the slosh of an oar stroke behind it')
    one('chart-open', [dict(src=MAP % 'snd_use_map'), dict(src=PAPER % 'paper_sound_-_4', a=1.2, b=2.6, fi=0.05, fo=0.2)], level=-3)
    add('chest-open_1', [dict(src=KR % 'creak1', a=0.14, b=0.66, speed=0.7, fi=0.005), dict(src=KR % 'handleCoins', b=0.45, at=0.45, gain=-7, fo=0.1)], level=-2, how='a wooden creak played slower, so it is a heavy lid, with a small clink of coins as the lid comes to rest')
    add('chest-open_2', [dict(src=KR % 'creak3', a=0.015, b=0.34, speed=0.6, fi=0.004), dict(src=KR % 'handleCoins2', at=0.34, gain=8)], level=-2, how='a shorter creak played slower, with a small clink of coins after it')

    # ---- Lantern Pots and the Drowned Bell ----
    def rope_run(at, gain, n=9, step=0.09):
        """A rope paying out: cloth rustles in a row, each a little later, faster and quieter than the last."""
        return [dict(src=KR % f'cloth{1 + k % 4}', at=round(at + step * k, 3), speed=0.75 + 0.03 * k, gain=gain - 1.2 * k) for k in range(n)]
    add('pot-set_1', make=lambda: B.mix([dict(src=EZWA % 5, speed=0.8)] + rope_run(0.2, -4) + [dict(src=SKIP + 'bubbles.wav', at=1.2, gain=-10)]),
        sources=[dict(label(EZWA % 5), speed=0.8)] + [label(KR % f'cloth{k}') for k in (1, 2, 3, 4)] + [label(SKIP + 'bubbles.wav')],
        how='a splash played slower for weight; nine cloth rustles in a row, each a little faster and quieter than the last, for the rope running out; bubbles after it')
    DRIP = ((5.0, 5.45), (0.28, 0.62), (3.66, 3.97), (1.99, 2.30), (6.53, 6.86))        # the single drops in the recording
    def drips(at, gaps, gain, first=0):
        """Drips falling off the basket: single recorded drops in a row, each a little quieter than the last."""
        out = []; t = at
        for k, g in enumerate(gaps):
            a, b = DRIP[(first + k) % len(DRIP)]; out.append(dict(src=DROPS, a=a, b=b, at=round(t, 3), gain=gain - 1.3 * k, speed=(1.0, 1.12, 0.92, 1.06, 0.97)[k % 5], fo=0.08)); t += g
        return out
    add('pot-haul_1', make=lambda: B.mix([dict(src=PEL + 'drowning_0.wav', a=0.2, b=2.4, fi=0.02, fo=0.8), dict(src=TREE, a=3.6, b=4.5, at=0.1, gain=4, fo=0.2)] + drips(1.6, (0.19, 0.24, 0.2, 0.33, 0.3), 15)),
        sources=[dict(label(PEL + 'drowning_0.wav'), cut=[0.2, 2.4]), dict(label(TREE), cut=[3.6, 4.5]), label(DROPS)],
        how='water churning as the basket breaks the surface, a creak of the rope, and five single drips falling off it, each quieter than the last')
    add('pot-haul_2', make=lambda: B.mix([dict(src=PEL + 'splash1_0.wav', a=0.5, b=2.4, fo=0.6), dict(src=SKIP + 'swim.wav', at=0.3, gain=-4, fo=0.5), dict(src=KR % 'creak2', at=0.05, gain=-6)] + drips(1.45, (0.18, 0.25, 0.2, 0.3, 0.26, 0.3), 12, first=2)),
        sources=[dict(label(PEL + 'splash1_0.wav'), cut=[0.5, 2.4]), label(SKIP + 'swim.wav'), label(KR % 'creak2'), label(DROPS)],
        how='the tail of a big splash with a stroke through water over it, a creak of the rope, and six single drips falling off the basket')

    def tide():
        """One wave that swells in and pulls back: two recorded waves, the second 1.2 s after the first. The swell opens up from its
        own rumble (below 700 Hz), and the last 1.7 s thin into the hiss above 1500 Hz, the water draining back down the shore."""
        a = B.part(dict(src=ALK % 1, fi=1.0, fo=1.0)); b = B.part(dict(src=ALK % 4, fi=0.4, fo=1.0)) * 10 ** (-3 / 20)
        o = int(1.2 * SR); n = max(len(a), o + len(b)); y = np.zeros(n); y[:len(a)] += a; y[o:o + len(b)] += b
        t = np.arange(n) / SR; dark = B.filt(y, lp=700); thin = B.filt(y, hp=1500)
        op = np.clip((t - 0.1) / 1.5, 0, 1) ** 1.5; back = np.clip((t - (n / SR - 1.7)) / 1.5, 0, 1)
        y = dark * (1 - op) * 1.6 + y * op; y = y * (1 - 0.75 * back) + thin * 1.3 * back
        return B.fade(y, 0.6, 1.1)
    add('tide-turn_1', make=tide, sources=[label(ALK % 1), label(ALK % 4)], fo=0.3,
        how='two waves, the second 1.2 s after the first and 3 dB quieter; the swell opens up from its own low rumble and the last 1.7 s thin into hiss, the water draining back')

    def toll(f0=146.83, seconds=9.5, seed=5, clang=5.0, room=0.15):
        """One strike of a big church bell whose strike note is f0 (D3). The partials of a tuned bell (the hum an octave below, prime,
        minor-third tierce, quint, nominal and those above), every one a pair a fraction of a hertz apart, which is the slow beat of
        a real bell, and every one wavering a little as it rings down, the low ones longest. The strike itself is the clang: sixty
        short-lived partials scattered between 14 and 70 times the strike note, with the knock of the clapper. A dark tail of room after it."""
        n = int(seconds * SR); t = np.arange(n) / SR; r = np.random.default_rng(seed); y = np.zeros(n); fr = np.fft.rfftfreq(n, 1 / SR)
        #          ratio   gain  decay (s)  beat (Hz)
        P = [(0.5, 0.50, 6.5, 0.31), (1.0, 0.62, 4.0, 0.47), (1.195, 0.85, 3.2, 0.62), (1.5, 0.22, 1.9, 0.80), (2.0, 1.00, 2.3, 0.93),
             (2.51, 0.34, 1.3, 1.3), (2.66, 0.20, 1.1, 1.4), (3.01, 0.50, 1.15, 1.7), (3.33, 0.16, 0.8, 1.9), (4.16, 0.42, 0.75, 2.3), (4.5, 0.12, 0.6, 2.4),
             (5.43, 0.30, 0.52, 3.1), (6.8, 0.24, 0.40, 4.0), (8.21, 0.18, 0.31, 5.0), (9.7, 0.14, 0.25, 5.5), (11.3, 0.11, 0.20, 6.0), (13.0, 0.08, 0.16, 6.5)]
        for ratio, g, d, beat in P:
            f = f0 * ratio; attack = 1 - np.exp(-t / (0.003 + 0.02 / ratio))
            for sg, share in ((-0.5, 0.6), (0.5, 0.4)):
                wv = np.fft.irfft(np.fft.rfft(r.standard_normal(n)) * np.exp(-fr / 2.5), n); w = 1 + 0.11 * wv / np.abs(wv).max()        # a slow random waver of about a decibel
                y += g * share * attack * w * np.exp(-t / (d * (1 + 0.1 * sg))) * np.sin(2 * np.pi * (f + sg * beat) * t + r.uniform(0, 2 * np.pi))
        k = int(0.6 * SR); tk = t[:k]; c = np.zeros(k)
        for _ in range(60):
            q = 14 * (70 / 14) ** r.uniform(); c += r.uniform(0.3, 1.0) / q ** 0.5 * np.exp(-tk / (r.uniform(0.6, 1.4) * 3.0 / q)) * np.sin(2 * np.pi * f0 * q * tk + r.uniform(0, 2 * np.pi))
        sp = np.fft.rfft(r.standard_normal(k)); fk = np.fft.rfftfreq(k, 1 / SR); kn = np.fft.irfft(sp * np.exp(-0.5 * (np.log2(np.maximum(fk, 1) / 2600) / 1.1) ** 2), k) * np.exp(-tk / 0.007)
        y /= np.abs(y).max(); y[:k] += clang * (0.55 * c / np.abs(c).max() + 0.5 * kn / np.abs(kn).max()) + 0.4 * np.sin(2 * np.pi * 88 * tk) * np.exp(-tk / 0.045)
        m = int(2.2 * SR); ir = r.standard_normal(m) * np.exp(-np.arange(m) / SR / 0.55); ir[:int(0.018 * SR)] = 0
        ir = np.fft.irfft(np.fft.rfft(ir) / (1 + (np.fft.rfftfreq(m, 1 / SR) / 3000) ** 2), m); wet = np.convolve(y, ir)[:n]; y = y + room * wet / np.abs(wet).max()
        fo = int(3.0 * SR); y[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
        return y / np.abs(y).max()
    add('bell-toll_1', make=toll, sources=[{'kind': 'synth', 'what': 'one strike of a church bell with a strike note of D3: seventeen partials of a tuned bell from the hum (D2) up, each a beating pair that wavers as it rings down, a clang of sixty short-lived high partials and the knock of the clapper at the strike, and a dark tail of room'}],
        how='synthesised in sfx_manifest.py', fo=0.5)

    def glass(notes=(1174.66, 1760.0), seconds=0.95):
        """A soft glassy chime with two fading echoes: each note a pure tone with the faint upper partials of struck glass and a soft start,
        and the whole figure heard twice more, quieter and duller."""
        n = int(seconds * SR); t = np.arange(n) / SR; one = np.zeros(n)
        for k, f in enumerate(notes):
            o = int(k * 0.035 * SR); tt = t[:n - o]; a = 1 - np.exp(-tt / 0.006)
            v = sum(g * np.sin(2 * np.pi * f * m * tt + ph) * np.exp(-tt / d) for m, g, d, ph in ((1, 1.0, 0.28, 0), (2.32, 0.22, 0.123, 1.0), (4.25, 0.08, 0.062, 2.0), (1.003, 0.5, 0.35, 0.5)))
            one[o:] += a * v * (1.0 if k == 0 else 0.7)
        y = one.copy()
        for delay, g, lp in ((0.17, 0.36, 5000), (0.34, 0.15, 3200)):
            e = np.fft.irfft(np.fft.rfft(one) / (1 + (np.fft.rfftfreq(n, 1 / SR) / lp) ** 4), n); o = int(delay * SR); y[o:] += g * e[:n - o]
        return y / np.abs(y).max()
    add('echo-buy_1', make=glass, sources=[{'kind': 'synth', 'what': 'two notes of struck glass (D6, then A6 35 ms later), each a pure tone with faint upper partials, heard twice more as quieter, duller echoes'}],
        how='synthesised in sfx_manifest.py, in the key of the Hearthbay theme', trim=False, fo=0.25, level=-3)

    # ---- loops ----
    add('waves-lap_1', make=lambda: B.loop_cut(VIST, 234.0, 20.0, 2.0), loop=True, lufs=-22, sources=[dict(label(VIST), cut=[234.0, 254.0])], how='20 s cut with a 2 s crossfade into the audio before the loop start')
    add('waves-lap_2', make=lambda: B.loop_cut(VIST, 150.0, 20.0, 2.0), loop=True, lufs=-22, sources=[dict(label(VIST), cut=[150.0, 170.0])], how='20 s cut with a 2 s crossfade into the audio before the loop start')
    add('cat-purr_1', make=lambda: B.circular(B.load(CAT + 'cat_purrsleepy_loop.wav'), hp=35), loop=True, lufs=-22, sources=[label(CAT + 'cat_purrsleepy_loop.wav')], how="the author's loop with rumble below 35 Hz removed")
    add('cat-purr_2', make=lambda: B.circular(B.load(CAT + 'cat_purractive_loop.wav'), hp=35), loop=True, lufs=-22, sources=[label(CAT + 'cat_purractive_loop.wav')], how="the author's loop with rumble below 35 Hz removed")
    add('hull-wash_1', make=lambda: B.circular(B.loop_cut(MIR % 'hull-wash.b', 1.1, 8.8, 1.0), hp=110), loop=True, lufs=-22, sources=[dict(label(MIR % 'hull-wash.b'), cut=[1.1, 9.9])], how='8.8 s cut with a 1 s crossfade into the audio before the loop start, rumble below 110 Hz removed')

    def murmur(seconds=11.0, seed=7):
        """A wordless hum: a few voices on each note of an open fifth of D, every voice a stack of harmonics under slowly changing vowel
        formants with its own vibrato and breath, one note sliding a semitone, over a breath of low noise.
        Every part runs a whole number of cycles in the loop, so there is no seam."""
        n = int(round(seconds * SR)); t = np.arange(n) / SR; T = n / SR; r = np.random.default_rng(seed)
        cyc = lambda m, ph=0.0: np.sin(2 * np.pi * (m * t / T + ph))                    # m whole cycles in the loop
        vowel = lambda f, F: sum(a * np.exp(-0.5 * ((f - c) / w) ** 2) for c, w, a in F) + 0.003
        OO = ((300, 110, 1.0), (870, 150, 0.30), (2240, 260, 0.03)); MM = ((250, 90, 1.0), (1000, 200, 0.05)); AH = ((640, 140, 0.9), (1080, 170, 0.45), (2500, 300, 0.05))
        y = np.zeros(n); air = np.zeros(n); fr = np.fft.rfftfreq(n, 1 / SR)
        #        pitch  gain singers slide (cycles, Hz)  vowels
        notes = ((73.42, 1.00, 2, 0, 0.0, (MM, OO)), (110.00, 0.85, 3, 0, 0.0, (OO, MM)), (146.83, 0.60, 3, 0, 0.0, (OO, AH)), (226.4, 0.20, 2, 1, 6.5, (OO, AH)))   # the last note bends between A and B flat
        for f, g, singers, sm, sh, (V0, V1) in notes:
            for k in range(singers):
                f0 = round(f * 2 ** (r.uniform(-9, 9) / 1200) * T) / T; ph = r.uniform(0, 1, 8); vr = round(r.uniform(4.7, 5.8) * T)      # each singer a few cents off, with a vibrato of their own
                depth = 0.011 * f0 / (vr / T) * (0.55 + 0.45 * cyc(int(r.integers(1, 4)), ph[1]))                                         # about 1 % of pitch
                bend = depth * cyc(vr, ph[2]) + 0.5 * cyc(int(r.integers(1, 4)), ph[0]) + (sh * T / sm * cyc(sm, 0.25) if sm else 0)
                w = 0.5 + 0.5 * cyc(int(r.integers(1, 3)), ph[3]); breath = 0.68 + 0.32 * cyc(int(r.integers(1, 4)), ph[4])
                for h in range(1, int(2600 / f0) + 1):
                    amp = (1 - w) * vowel(h * f0, V0) + w * vowel(h * f0, V1)
                    y += g / singers ** 0.5 * breath * amp / h ** 1.3 * (1 + 0.05 * cyc(vr, ph[5])) * np.sin(2 * np.pi * (h * f0 * t + r.uniform()) + h * bend)
                a = np.fft.irfft(np.fft.rfft(r.standard_normal(n)) * (vowel(fr, V0) + vowel(fr, V1)) * (fr > 150), n)                    # the air in the voice, through the same vowels
                air += g / singers ** 0.5 * breath * a / np.abs(a).max()
        spec = np.fft.rfft(r.standard_normal(n)) * np.exp(-0.5 * ((np.log2(np.maximum(fr, 1) / 190)) / 0.9) ** 2)        # a band of noise around 190 Hz; made in the frequency domain, so it loops
        sea = np.fft.irfft(spec, n); sea *= (0.55 + 0.45 * cyc(2, 0.13)) * (0.8 + 0.2 * cyc(5, 0.4))
        return y / np.abs(y).max() + 0.05 * air / np.abs(air).max() + 0.16 * sea / np.abs(sea).max()
    add('murmur_1', make=murmur, loop=True, lufs=-22, sources=[{'kind': 'synth', 'what': 'ten humming voices on an open fifth of D (D2, A2 and D3, each a few cents apart with a vibrato of its own, and one note that slides between A3 and B flat), with slowly changing vowels, over a breath of low noise'}], how='synthesised in sfx_manifest.py; every part runs a whole number of cycles in 11 s, so there is no seam')

    # ---- Mossglass Fen: eight sounds and two ambience loops, in sfx_fen.py ----
    import sfx_fen
    sfx_fen.build(B, add, label, dict(DROPS=DROPS, DRIP=DRIP, FLAME=FLAME, KR=KR, WM=WM, TREE=TREE, SKIP=SKIP, EZWA=EZWA, murmur=murmur))
    return items
