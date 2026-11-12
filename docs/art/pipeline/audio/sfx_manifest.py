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
KR = 'cc0/kenney-rpg/OGG/%s.ogg'
KU = 'cc0/kenney-interface/Audio/%s.ogg'
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

    # ---- loops ----
    add('waves-lap_1', make=lambda: B.loop_cut(VIST, 234.0, 20.0, 2.0), loop=True, lufs=-22, sources=[dict(label(VIST), cut=[234.0, 254.0])], how='20 s cut with a 2 s crossfade into the audio before the loop start')
    add('waves-lap_2', make=lambda: B.loop_cut(VIST, 150.0, 20.0, 2.0), loop=True, lufs=-22, sources=[dict(label(VIST), cut=[150.0, 170.0])], how='20 s cut with a 2 s crossfade into the audio before the loop start')
    add('cat-purr_1', make=lambda: B.circular(B.load(CAT + 'cat_purrsleepy_loop.wav'), hp=35), loop=True, lufs=-22, sources=[label(CAT + 'cat_purrsleepy_loop.wav')], how="the author's loop with rumble below 35 Hz removed")
    add('cat-purr_2', make=lambda: B.circular(B.load(CAT + 'cat_purractive_loop.wav'), hp=35), loop=True, lufs=-22, sources=[label(CAT + 'cat_purractive_loop.wav')], how="the author's loop with rumble below 35 Hz removed")
    return items
