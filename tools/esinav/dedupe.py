"""raw.json'daki soruları oturumlar arasında tekilleştirir.
Aynı metin + aynı şık kümesi + benzer görsel(ler) => tek soru; kaynak oturumlar listelenir.
Kullanım: python -I dedupe.py <bank_dizini>
"""
import json, os, re, sys, unicodedata
from PIL import Image, ImageOps

BANK = sys.argv[1]
qs = json.load(open(os.path.join(BANK, 'raw.json')))


def norm(t):
    t = unicodedata.normalize('NFC', t or '').lower()
    t = t.replace('â', 'a').replace('î', 'i').replace('û', 'u')
    t = re.sub(r'[^0-9a-zçğıöşü]+', '', t)
    return t


_hash = {}


def ahash(name):
    if not name:
        return None
    if name in _hash:
        return _hash[name]
    im = Image.open(os.path.join(BANK, 'img', name)).convert('L')
    # kenar boşluklarını kırp
    inv = ImageOps.invert(im)
    bb = inv.point(lambda v: 255 if v > 25 else 0).getbbox()
    if bb:
        im = im.crop(bb)
    w, h = im.size
    sm = im.resize((16, 16), Image.BILINEAR)
    px = list(sm.get_flattened_data()) if hasattr(sm, "get_flattened_data") else list(sm.getdata())
    avg = sum(px) / len(px)
    bits = tuple(1 if p < avg else 0 for p in px)
    _hash[name] = (bits, w / max(h, 1))
    return _hash[name]


def img_close(a, b):
    if a is None and b is None:
        return True
    if (a is None) != (b is None):
        return False
    ha, hb = ahash(a), ahash(b)
    d = sum(x != y for x, y in zip(ha[0], hb[0]))
    ratio = abs(ha[1] - hb[1]) / max(ha[1], hb[1])
    return d <= 22 and ratio < 0.2


def opt_imgs_close(qa, qb):
    """Görsel şıklar sıra farklı olabilir: harfleri eşleştirerek karşılaştır."""
    A, B = qa['oimg'], qb['oimg']
    if not A and not B:
        return True, None
    if not A or not B:
        return False, None
    perm = []
    used = set()
    for x in A:
        for j, y in enumerate(B):
            if j not in used and img_close(x, y):
                perm.append(j); used.add(j); break
        else:
            return False, None
    return True, perm


letters = 'ABCD'
groups = []  # her biri: {'rep': q, 'members': [q,...]}
index = {}
for q in qs:
    ok = [o for o in q['o']]
    tkey = norm(q['q']) + '|' + '|'.join(sorted(norm(o) for o in ok))
    placed = False
    for g in index.get(tkey, []):
        r = g['rep']
        if not img_close(q['img'], r['img']):
            continue
        same, perm = opt_imgs_close(r, q)
        if not same:
            continue
        g['members'].append(q)
        placed = True
        break
    if not placed:
        g = {'rep': q, 'members': [q]}
        groups.append(g)
        index.setdefault(tkey, []).append(g)

out = []
conflicts = 0
for g in groups:
    ms = sorted(g['members'], key=lambda m: m['code'], reverse=True)
    rep = ms[0]  # en yeni oturumdaki biçim
    # doğru cevabın metnine/görseline göre tutarlılık
    def correct_key(m):
        if not m.get('ans') or m['ans'] not in letters:
            return None
        i = letters.index(m['ans'])
        if m['oimg'] and m['oimg'][i]:
            return ('img', m['oimg'][i])
        return ('txt', norm(m['o'][i]))
    rk = correct_key(rep)
    agree = []
    for m in ms:
        k = correct_key(m)
        if k is None or rk is None:
            continue
        if k[0] == 'txt':
            agree.append(k == rk)
        else:
            agree.append(rk[0] == 'img' and img_close(k[1], rk[1]))
    conflict = not all(agree)
    conflicts += conflict
    subj = next((m['subj'] for m in ms if m['subj']), None)
    out.append({
        'src': sorted({m['code'] for m in ms}),
        'ref': f"{rep['code']}#{rep['subj'] or ''}{rep['no']}",
        'subj': subj,
        'q': rep['q'],
        'o': rep['o'],
        'ans': rep.get('ans'),
        'img': rep['img'],
        'oimg': rep['oimg'],
        'conflict': conflict,
        'members': [f"{m['code']}#{m['subj'] or ''}{m['no']}:{m.get('ans')}" for m in ms],
    })

json.dump(out, open(os.path.join(BANK, 'dedup.json'), 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print('unique', len(out), 'from', len(qs), 'conflicts', conflicts)
print('by subj', Counter(o['subj'] for o in out))
print('repeat dist', Counter(len(o['src']) for o in out))
print('with img', sum(1 for o in out if o['img']), 'with oimg', sum(1 for o in out if o['oimg']))
