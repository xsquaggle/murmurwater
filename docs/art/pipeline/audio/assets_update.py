#!/usr/bin/env python3
"""assets_update.py <docs/ASSETS.md> : replace the three sound-effect tables in ASSETS.md (files, CC0 packs, generated clips)
with the ones assets_md.py writes from the current build, and print the totals for the section's opening sentence."""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.dirname(HERE)
out = subprocess.run([sys.executable, os.path.join(HERE, 'assets_md.py')], capture_output=True, text=True, check=True).stdout
tables = {}; cur = None
for line in out.splitlines():
    if line.startswith(('| File |', '| Short name |', '| Clip |')): cur = line; tables[cur] = [line]
    elif cur and line.startswith('|'): tables[cur].append(line)
    else: cur = None
md = open(sys.argv[1]).read().split('\n')
for head, rows in tables.items():
    i = md.index(head); j = i
    while j < len(md) and md[j].startswith('|'): j += 1
    print(f'{head[:40]}: {j - i - 2} rows -> {len(rows) - 2}'); md[i:j] = rows
open(sys.argv[1], 'w').write('\n'.join(md))
idx = json.load(open(os.path.join(A, 'sfx', 'out', 'index.json')))
print(len({i['name'].rsplit('_', 1)[0] for i in idx}), 'sounds,', len(idx), 'files,', round(sum(i['seconds'] for i in idx)), 's,', round(sum(i['bytes'] for i in idx) / 1e6, 2), 'MB;',
      sum(1 for i in idx if i['loop']), 'loops; generated clips used:', len({s['name'] for i in idx for s in i['sources'] if s['kind'] == 'generated'}))
