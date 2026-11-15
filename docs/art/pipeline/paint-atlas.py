"""paint-atlas.py <layout.json> <out.png> [base colour] : paints an atlas whose layout names a material for every
rectangle (mats.py). For a prop that needs nothing painted by hand; one that does has its own painter, which calls
mats.paint_spec() and then paints the rest."""
import sys
from paintkit import Atlas
from mats import paint_spec

layout, out = sys.argv[1:3]
A = Atlas(layout, base=sys.argv[3] if len(sys.argv) > 3 else '#4A4640')
print(len(paint_spec(A)), 'patches', A.save(out))
