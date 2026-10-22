# Mirrors the economy block of tests/sim.js (bot Coins/run and run seconds from `node tests/sim.js`, full mode).
bots = {'casual': (26, 149), 'average': (54, 143), 'sharp': (65, 145)}
price = {'skin': 350, 'pop': 300, 'board': 450, 'fuse': 300}
today = {'skin': 19, 'pop': 16, 'board': 11, 'fuse': 10}
s4 = {'skin': 8, 'pop': 8, 'board': 6, 'fuse': 6}
TROPHIES, PASS_COINS = 2500, 1570
MIS, RUNS_DAY, MENU = 38 * 3, 10, 0.8
def need(cat, pr=price): return sum(cat[t] * pr[t] for t in cat)
def hours(total_need, n_items, one_time_extra=0, pr=price, pass_chests=True):
    avg = total_need / n_items
    pass_val = (pr['skin'] + pr['pop'] + pr['board'] + pr['fuse'] + avg) if pass_chests else 0
    one = TROPHIES + PASS_COINS + pass_val + one_time_extra
    out = {}
    for k, (coins, sec) in bots.items():
        per = coins + MIS / RUNS_DAY + (250 + avg) / (7 * RUNS_DAY)
        runs = (total_need - one) / per
        out[k] = (round(runs), round(runs * (sec / 60 + MENU) / 60, 1), round(avg / per * (sec / 60 + MENU)))
    return one, out
after = {t: today[t] + s4[t] for t in today}
print('today need', need(today), 'items', sum(today.values()))
print(' ', hours(need(today), sum(today.values())))
print('after need', need(after), 'items', sum(after.values()), 'added', need(s4))
print(' ', hours(need(after), sum(after.values())))
print('after + 1200 new trophies', hours(need(after), sum(after.values()), 1200))
# veteran: owns the 56, needs only the 28; one-time: new trophies 1200 + a Season 4 Pass track (coins 1570 + 4 chests + golden)
avg = need(after) / sum(after.values())
for label, extra in [('veteran, chests only', 0), ('veteran + 1200 trophies', 1200), ('veteran + trophies + Season 4 pass', 1200 + 1570 + 1400 + avg)]:
    out = {}
    for k, (coins, sec) in bots.items():
        per = coins + MIS / RUNS_DAY + (250 + avg) / (7 * RUNS_DAY)
        runs = max(0, need(s4) - extra) / per
        out[k] = (round(runs), round(runs * (sec / 60 + MENU) / 60, 1))
    print(label, round(extra), out)
per_chest = {t: (after[t], after[t] * price[t]) for t in after}
print('per chest after', per_chest)
# what price cut / income rise would hold the old hours
one_old, _ = hours(need(today), 56)
one_new, _ = hours(need(after), 84)
print('ratio of Coins still to earn (new/old):', round((need(after) - one_new) / (need(today) - one_old), 3))
# board chest at 400
pr2 = dict(price); pr2['board'] = 400
print('board 400', need(after, pr2), hours(need(after, pr2), 84, 0, pr2))
# lever: +20% run Coins (not missions)
for mult in (1.2, 1.71):
    out = {}
    for k, (coins, sec) in bots.items():
        avg = need(after) / 84
        per = coins * mult + MIS / RUNS_DAY + (250 + avg) / (7 * RUNS_DAY)
        runs = (need(after) - one_new - 1200) / per
        out[k] = round(runs * (sec / 60 + MENU) / 60, 1)
    print('run coins x', mult, '+ trophies', out)
