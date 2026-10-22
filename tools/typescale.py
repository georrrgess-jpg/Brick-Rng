#!/usr/bin/env python3
"""Larger text is one type scale: every font size in the menu stylesheets is `calc(Npx * var(--ts))`, and html.large-text raises --ts.
Run this after editing css/base.css, css/screens.css or css/coach.css (it is idempotent); tests/u5-menus.js fails when a menu text size
is written as a bare px value, because that text would not grow with Larger text.

    python3 tools/typescale.py          # rewrite the files
    python3 tools/typescale.py --check  # list the bare sizes and exit 1 if there are any
"""
import re, sys, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FILES = ['css/base.css', 'css/screens.css', 'css/coach.css']
# font: <weight> <size>[/<line-height>] <family>   and   font-size: <size>
SHORT = re.compile(r'(font:\s*(?:italic\s+)?\d{3}\s+)(\d+(?:\.\d+)?)px(?=[\s/;!])')
LONG = re.compile(r'(font-size:\s*)(\d+(?:\.\d+)?)px')
CLAMP = re.compile(r'(font:\s*\d{3}\s+)(clamp\((?:[^()]|\([^()]*\))*\))')


def convert(css):
    css = SHORT.sub(lambda m: f'{m.group(1)}calc({m.group(2)}px * var(--ts))', css)
    css = LONG.sub(lambda m: f'{m.group(1)}calc({m.group(2)}px * var(--ts))', css)
    css = CLAMP.sub(lambda m: f'{m.group(1)}calc({m.group(2)} * var(--ts))', css)
    return css


def bare(css):
    out = []
    for n, line in enumerate(css.split('\n'), 1):
        for rx in (SHORT, LONG, CLAMP):
            if rx.search(line):
                out.append((n, line.strip()[:110]))
                break
    return out


if __name__ == '__main__':
    check = '--check' in sys.argv
    bad = 0
    for f in FILES:
        path = os.path.join(ROOT, f)
        css = open(path).read()
        if check:
            for n, l in bare(css):
                bad += 1
                print(f'{f}:{n}: {l}')
        else:
            new = convert(css)
            if new != css:
                open(path, 'w').write(new)
                print('rewrote', f)
    if check:
        print(f'{bad} bare font sizes' if bad else 'type scale ok')
        sys.exit(1 if bad else 0)
