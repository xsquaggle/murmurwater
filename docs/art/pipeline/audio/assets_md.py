#!/usr/bin/env python3
"""assets_md.py : the "Sound effects" tables for docs/ASSETS.md, written from sfx/out/index.json and sfx_manifest.py."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.dirname(HERE); sys.path.insert(0, HERE)
import sfx_manifest as M
idx = json.load(open(os.path.join(A, 'sfx', 'out', 'index.json'))); gen = json.load(open(os.path.join(HERE, 'generated.json')))
short = {v[0]: v for v in M.PACKS.values()}; used = {}; genused = {}


def src(s):
    cut = f" {s['cut'][0]:g} to {s['cut'][1]:g} s" if 'cut' in s else ''
    sp = f", played at {s['speed']:g}x" if 'speed' in s else ''
    if s['kind'] == 'cc0':
        used.setdefault(s['pack'], set()).add(s['file']); return f"`{s['pack']}` `{s['file']}`{cut}{sp}"
    if s['kind'] == 'generated':
        genused.setdefault(s['name'], s['job']); return f"generated `{s['name']}`{cut}{sp}"
    return 'synthesised: ' + s['what']


rows = []
for it in idx:
    made = ' + '.join(src(s) for s in it['sources'])
    if it.get('how'): made += f" ({it['how']})"
    rows.append(f"| `{it['file']}` | {it['seconds']:.2f} s{' loop' if it['loop'] else ''} | {made} |")
print('| File | Length | Made from |\n|---|---|---|'); print('\n'.join(rows))
print('\nCC0 packs, all from OpenGameArt:\n\n| Short name | Pack | Author | Page | Files used |\n|---|---|---|---|---|')
for k in sorted(used):
    _, title, author, page = short[k]; print(f"| `{k}` | {title} | {author} | {page} | {', '.join('`' + f + '`' for f in sorted(used[k]))} |")
print('\nGenerated clips (Higgsfield `generate_audio`, model `mirelo_text_to_audio`, 2026-11-12, generated for this project):\n\n| Clip | Prompt | Seconds | Job id |\n|---|---|---|---|')
for k in sorted(genused):
    g = gen[k]; print(f"| `{k}` | {g['prompt']} | {g['duration']} | `{g['job']}` |")
