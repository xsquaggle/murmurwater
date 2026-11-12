#!/usr/bin/env python3
"""get.py <music|sfx> name=url ... : download a generated clip to <kind>/raw/<name>.mp3 and note its job id in <kind>/jobs.json"""
import json, os, re, subprocess, sys
A = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
kind = sys.argv[1]; jp = os.path.join(A, kind, 'jobs.json'); jobs = json.load(open(jp)) if os.path.exists(jp) else {}
for a in sys.argv[2:]:
    name, url = a.split('=', 1); job = re.search(r'_([0-9a-f]{8}-[0-9a-f-]{27})\.\w+$', url).group(1)
    f = os.path.join(A, kind, 'raw', name + os.path.splitext(url)[1])
    subprocess.run(['curl', '-sS', '--fail', '--retry', '3', '-o', f, url], check=True)
    jobs[name] = job
    d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels,bit_rate:format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.split()
    print(name, os.path.getsize(f), ' '.join(d))
json.dump(jobs, open(jp, 'w'), indent=1)
