#!/usr/bin/env python3
"""Summarise sweep-*.json / run-*.json geometry findings: python3 summarize.py file.json [kinds...]"""
import json, sys
d = json.load(open(sys.argv[1]))
kinds = sys.argv[2:] or ['small-target', 'clip', 'offscreen-x', 'hscroll', 'sheet-top', 'ctl-offscreen', 'ellipsis', 'sheet-scrolls', 'in-inset', 'covered', 'overlap-target']
print(d['tag'], d['W'], d['H'], 'errors:', d['errors'][:3])
for k, v in d['found'].items():
    if not isinstance(v, list):
        print(' ', k, v); continue
    for x in v:
        if x[0] in kinds and not (x[0] == 'clip' and 'sr-only' in x[1]):
            print(' ', k, x)
