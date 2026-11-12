#!/usr/bin/env python3
"""oga_search.py term ... : list CC0 sound effects on OpenGameArt matching each term (title, page)."""
import sys, re, urllib.request, urllib.parse, html, os
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) asset-search'}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read().decode('utf-8', 'replace')
for term in sys.argv[1:]:
    q = urllib.parse.urlencode([('keys', term), ('field_art_type_tid[]', '13'), ('field_art_licenses_tid[]', '4'), ('sort_by', 'count'), ('sort_order', 'DESC'), ('items_per_page', '48')])
    try: h = get('https://opengameart.org/art-search-advanced?' + q)
    except Exception as e: print(term, 'ERR', e); continue
    items = re.findall(r'<span class="art-preview-title"><a href="(/content/[^"]+)">([^<]+)</a>', h)
    seen = []
    for u, t in items:
        if u not in seen: seen.append(u); 
    print(f'== {term}: {len(seen)}')
    for u, t in dict(items).items(): print('   ', html.unescape(t), '|', u)
