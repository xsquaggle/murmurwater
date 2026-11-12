#!/usr/bin/env python3
"""add.py key=url ...  : record a take for a line and download it (raw/<key>.t<n>.mp3)."""
import json, os, re, subprocess, sys
R = os.path.dirname(os.path.abspath(__file__))
jp = os.path.join(R, 'jobs.json')
jobs = json.load(open(jp)) if os.path.exists(jp) else {}
for a in sys.argv[1:]:
    key, url = a.split('=', 1)
    job = re.search(r'_([0-9a-f]{8}-[0-9a-f-]{27})\.mp3$', url).group(1)
    takes = jobs.setdefault(key, [])
    if any(t['job'] == job for t in takes): continue
    n = len(takes) + 1
    f = os.path.join(R, 'raw', key.replace('/', '__') + f'.t{n}.mp3')
    subprocess.run(['curl', '-sS', '--fail', '--retry', '3', '-o', f, url], check=True)
    takes.append({'job': job, 'url': url, 'file': f, 'take': n})
    print(key, 'take', n, os.path.getsize(f))
json.dump(jobs, open(jp, 'w'), indent=1)
