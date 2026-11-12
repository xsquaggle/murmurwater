#!/usr/bin/env python3
"""oga_page.py slug ... : print author, licences and file links of OpenGameArt pages; with --get, download the files to oga/<slug>/."""
import sys, re, urllib.request, urllib.parse, html, os, json
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) asset-search'}
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'oga')
def get(u, binary=False):
    d = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read()
    return d if binary else d.decode('utf-8', 'replace')
dl = '--get' in sys.argv
for slug in [a for a in sys.argv[1:] if not a.startswith('--')]:
    try: h = get('https://opengameart.org/content/' + slug)
    except Exception as e: print(slug, 'ERR', e); continue
    title = html.unescape(re.search(r'<title>([^<|]+)', h).group(1).strip())
    am = re.search(r"field-name-author-submitter.*?<span class='username'>(?:<a [^>]*>)?([^<]+)<", h, re.S); author = html.unescape(am.group(1)) if am else '?'
    lic = sorted(set(re.findall(r"<div class='license-name'>([^<]+)</div>", h)))
    files = re.findall(r'<span class="file"><[^>]*> <a href="([^"]+)"[^>]*>([^<]+)</a>(?:</span>)?\s*([\d.]+ ?[KMG]?b)?', h)
    notes = re.search(r'field-name-field-art-attribution.*?<div class="field-item[^>]*>(.*?)</div>', h, re.S)
    print(f'== {slug} | {title} | by {author} | {lic}')
    if notes: print('   attribution note:', re.sub(r'<[^>]+>', '', notes.group(1))[:300])
    for u, n, sz in files: print('   ', n, sz)
    meta = {'slug': slug, 'title': title, 'author': author, 'licenses': lic, 'page': 'https://opengameart.org/content/' + slug, 'files': [u for u, _, _ in files]}
    if dl:
        d = os.path.join(ROOT, slug); os.makedirs(d, exist_ok=True)
        json.dump(meta, open(os.path.join(d, 'SOURCE.json'), 'w'), indent=1)
        for u, n, _ in files:
            p = os.path.join(d, os.path.basename(urllib.parse.unquote(u)))
            if not os.path.exists(p): open(p, 'wb').write(get(u, True))
            print('    saved', p, os.path.getsize(p))
