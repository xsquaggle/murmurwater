"""unpack.py <archive> ... : unpack a .zip or .7z into <archive minus extension>.x/ (its own directory); refuses paths that leave it."""
import sys, os, zipfile
for a in sys.argv[1:]:
    d = os.path.splitext(a)[0] + '.x'
    os.makedirs(d, exist_ok=True)
    root = os.path.realpath(d)
    if a.endswith('.zip'):
        z = zipfile.ZipFile(a)
        names = z.namelist()
    else:
        import py7zr
        z = py7zr.SevenZipFile(a)
        names = z.getnames()
    bad = [n for n in names if not os.path.realpath(os.path.join(d, n)).startswith(root)]
    if bad:
        print('refused', a, bad[:3]); continue
    z.extractall(d)
    print(a, len(names), 'entries')
