#!/usr/bin/env python3
"""Contact sheet: python3 contact.py OUT.png COLS HEIGHT file1.png file2.png ...
Each image is scaled to HEIGHT px tall and labelled with its file name; COLS images per row."""
import sys, os
from PIL import Image, ImageDraw

out, cols, h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = [f for f in sys.argv[4:] if os.path.exists(f)]
ims = []
for f in files:
    im = Image.open(f).convert('RGB')
    w = round(im.width * h / im.height)
    ims.append((os.path.basename(f)[:-4], im.resize((w, h), Image.LANCZOS)))
if not ims:
    sys.exit('no images')
cw = max(i.width for _, i in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (cw + 8) + 8, rows * (h + 26) + 8), (40, 40, 48))
d = ImageDraw.Draw(sheet)
for k, (name, im) in enumerate(ims):
    x, y = 8 + (k % cols) * (cw + 8), 8 + (k // cols) * (h + 26)
    sheet.paste(im, (x, y + 18))
    d.text((x, y + 2), name, fill=(255, 255, 120))
sheet.save(out)
print(out, sheet.size)
