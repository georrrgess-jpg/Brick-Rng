#!/usr/bin/env python3
"""Bundle the game into one self-contained HTML file (for hosts that take a single page).
Usage: python3 tools/bundle.py out.html"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
css = (root / 'css/styles.css').read_text() + '\n' + (root / 'css/skins.css').read_text()
# dark single-look game: declare it, keep the board comfortably inside the side gutters
css = css.replace(':root {\n  --bg0', ':root {\n  color-scheme: dark;\n  --bg0', 1)
css = css.replace('min(94vw,', 'min(92vw,')
body = re.search(r'<body>(.*?)<script src=', html, re.S).group(1)
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
js = '\n'.join((root / s).read_text() for s in scripts)
out = f'''<title>Shardfall</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap">
<style>
{css}
.screen{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}
</style>
{body}
<script>
{js}
</script>
'''
pathlib.Path(sys.argv[1]).write_text(out)
print(len(out), 'bytes')
