#!/usr/bin/env python3
"""Bundle Pop Rush into one self-contained HTML page (for hosts that take a single file, like Artifacts).
Fonts become data URIs; the manifest, icons and service worker are dropped (a hosted page does not need them).
Usage: python3 tools/bundle.py out.html          (a fragment: the Artifact host adds the document skeleton)
       python3 tools/bundle.py out.html --full   (a complete document with a doctype, for opening the file directly)"""
import base64, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()

def font_uri(path):
    return 'data:font/woff2;base64,' + base64.b64encode((root / path).read_bytes()).decode()

css_files = re.findall(r'<link rel="stylesheet" href="([^"]+)">', html)
css = ''
for f in css_files:
    text = (root / f).read_text()
    text = re.sub(r"url\('\.\./(fonts/[^']+)'\)", lambda m: f"url('{font_uri(m.group(1))}')", text)
    css += text + '\n'

body = re.search(r'<body>(.*?)<script src=', html, re.S).group(1)
body = re.sub(r'<noscript>.*?</noscript>', '', body, flags=re.S)
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
js = '\n'.join((root / s).read_text() for s in scripts)
# a hosted single page has no service worker or install prompt
js = js.replace("navigator.serviceWorker.register('sw.js')", "Promise.reject(new Error('no sw'))")

if '--full' in sys.argv:
    out = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0b0716">
<title>Pop Rush</title>
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{js}
</script>
</body>
</html>
'''
else:
    out = f'''<title>Pop Rush</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
{css}
</style>
{body}
<script>
{js}
</script>
'''
pathlib.Path(sys.argv[1]).write_text(out)
print(len(out), 'bytes')
