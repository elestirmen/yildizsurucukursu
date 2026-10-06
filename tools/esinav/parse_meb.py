"""MEB MTSAS/MTSKS soru kitapçıklarından (PDF) soruları, şıkları, görselleri ve cevap anahtarını çıkarır.

Kullanım: python -I parse_meb.py <çıktı_dizini> <oturum_kodu>=<pdf> [...]
Çıktı: <çıktı_dizini>/raw.json ve <çıktı_dizini>/img/*.png
"""
import json, os, re, sys, hashlib
import pymupdf

OUT = sys.argv[1]
IMG = os.path.join(OUT, 'img')
os.makedirs(IMG, exist_ok=True)

SUBJ_HEAD = [
    ('İLK YARDIM', 'iy'),
    ('TRAFİK VE ÇEVRE', 'tc'),
    ('MOTOR VE ARAÇ', 'at'),
    ('MOTOR BİLGİSİ', 'at'),
    ('ARAÇ TEKNİĞİ', 'at'),
    ('TRAFİK ADABI', 'ta'),
]
QSTART = re.compile(r'^\s*(\d{1,2})\s*\.\s*(.*)$')
OPT = re.compile(r'([A-D])\)')
ZOOM = 3


def subj_of(text):
    t = text.upper()
    for k, v in SUBJ_HEAD:
        if k in t:
            return v
    return None


def lines_of(page):
    out = []
    d = page.get_text('dict')
    for b in d['blocks']:
        if b['type'] != 0:
            continue
        for l in b['lines']:
            spans = [s for s in l['spans'] if s['text'].strip()]
            if not spans:
                continue
            # aynı satırdaki büyük boşluklu parçaları (ör. "A) 15   B) 20") ayrı tut
            text = ''
            last = None
            for s in spans:
                if last is not None and s['bbox'][0] - last > 12:
                    text += '\t'
                text += s['text']
                last = s['bbox'][2]
            f = spans[0]
            out.append({
                'bbox': list(l['bbox']), 'text': text.replace('\u00a0', ' '),
                'size': max(s['size'] for s in spans),
                'bold': any('Bold' in s['font'] for s in spans),
                'spans': [{'bbox': list(s['bbox']), 'text': s['text']} for s in spans],
            })
    return out


def graphics_of(page):
    W, H = page.rect.width, page.rect.height
    g = []
    for x in page.get_images(full=True):
        for r in page.get_image_rects(x[0]):
            if r.width > 2 and r.height > 2:
                g.append(pymupdf.Rect(r))
    for dr in page.get_drawings():
        r = dr['rect']
        # sütun ayırıcı / başlık çizgileri gibi ince uzun çizgileri at
        if (r.width < 2.5 and r.height > 150) or (r.height < 2.5 and r.width > 150):
            continue
        if r.width < 0.5 and r.height < 0.5:
            continue
        # tamamen beyaz dolgu (arka plan) tek başına grafik sayılmaz
        if dr.get('fill') == (1.0, 1.0, 1.0) and not dr.get('color'):
            pass
        g.append(pymupdf.Rect(r))
    return g


def union(rects):
    u = None
    for r in rects:
        u = pymupdf.Rect(r) if u is None else u | r
    return u


def clusters(rects, gap=6):
    cl = [pymupdf.Rect(r) for r in rects]
    changed = True
    while changed:
        changed = False
        out = []
        for r in cl:
            for i, o in enumerate(out):
                if (o + (-gap, -gap, gap, gap)).intersects(r):
                    out[i] = o | r
                    changed = True
                    break
            else:
                out.append(r)
        cl = out
    return cl


def save_crop(page, rect, tag):
    rect = pymupdf.Rect(rect) + (-3, -3, 3, 3)
    rect &= page.rect
    pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), clip=rect, alpha=False)
    data = pix.tobytes('png')
    h = hashlib.sha1(data).hexdigest()[:12]
    name = f'{tag}-{h}.png'
    with open(os.path.join(IMG, name), 'wb') as f:
        f.write(data)
    return name


def parse_key(doc):
    """Son sayfalardaki cevap anahtarını {(ders_sırası, no): harf} olarak döndürür."""
    for pi in range(len(doc) - 1, max(-1, len(doc) - 4), -1):
        pg = doc[pi]
        txt = pg.get_text()
        if 'CEVAP ANAHTARI' not in txt:
            continue
        items = []
        heads = []
        for l in lines_of(pg):
            for sp in l['spans']:
                m = re.match(r'^\s*(\d{1,2})\s*\.\s*([A-E])\s*$', sp['text'])
                if m:
                    items.append((sp['bbox'][0], sp['bbox'][1], int(m.group(1)), m.group(2)))
            s = subj_of(l['text'])
            if s and 'CEVAP' not in l['text']:
                heads.append((l['bbox'][0], s))
        if not items:
            # bazı anahtarlarda numara ve harf ayrı span: satır metninden dene
            for l in lines_of(pg):
                for part in l['text'].split('\t'):
                    m = re.match(r'^\s*(\d{1,2})\s*\.\s*([A-E])\s*$', part)
                    if m:
                        items.append((l['bbox'][0], l['bbox'][1], int(m.group(1)), m.group(2)))
        # x'e göre sütunlara ayır
        xs = sorted(set(round(i[0] / 40) for i in items))
        cols = []
        for it in sorted(items, key=lambda t: t[0]):
            if cols and it[0] - cols[-1][-1][0] < 40:
                cols[-1].append(it)
            else:
                cols.append([it])
        key = {}
        # numaralar her sütunda 1'den başlıyorsa ders ders, tek sütunsa sıralı
        restart = sum(1 for c in cols if min(i[2] for i in c) == 1)
        if restart > 1:
            for ci, c in enumerate(cols):
                for it in c:
                    key[(ci, it[2])] = it[3]
            return key, 'bysubject', [h[1] for h in sorted(heads)]
        for c in cols:
            for it in c:
                key[(0, it[2])] = it[3]
        return key, 'single', []
    return {}, 'none', []


def split_options(qlines, colx0, colx1):
    """Şık satırlarını bulur. Dönen: [(harf, metin, etiket_bbox)] ve şık olmayan satırlar."""
    opts = {}
    other = []
    cur = None
    # aynı satır hizasındaki parçaları şık etiketine bağla (tablo şıklar, bölünmüş span'lar)
    isopt = lambda l: re.match(r'^\s*[A-D]\)', l['text'])
    merged = []
    absorbed = set()
    for i, l in enumerate(qlines):
        if i in absorbed:
            continue
        if isopt(l):
            l = dict(l); l['spans'] = list(l['spans'])
            for j, m in enumerate(qlines):
                if j == i or j in absorbed or isopt(m):
                    continue
                if abs(m['bbox'][1] - l['bbox'][1]) < 2.5 and m['bbox'][0] >= l['bbox'][0]:
                    # sağdaki ilk şık etiketinden önce olmalı
                    nxt = [o['bbox'][0] for o in qlines if isopt(o) and o is not qlines[i] and abs(o['bbox'][1] - l['bbox'][1]) < 2.5 and o['bbox'][0] > l['bbox'][0]]
                    if nxt and m['bbox'][0] > min(nxt):
                        continue
                    l['spans'] += m['spans']
                    l['text'] += '\t' + m['text']
                    l['bbox'] = [l['bbox'][0], l['bbox'][1], max(l['bbox'][2], m['bbox'][2]), max(l['bbox'][3], m['bbox'][3])]
                    absorbed.add(j)
        merged.append(l)
    qlines = merged
    for l in qlines:
        parts = []
        # span bazında A) B) ... ayrıştır
        found = False
        for sp in l['spans']:
            t = sp['text']
            ms = list(OPT.finditer(t))
            if ms and re.match(r'^\s*[A-D]\)', t):
                found = True
                for i, m in enumerate(ms):
                    end = ms[i + 1].start() if i + 1 < len(ms) else len(t)
                    seg = t[m.end():end].strip()
                    bx = sp['bbox']
                    # yaklaşık etiket konumu
                    frac = m.start() / max(1, len(t))
                    lx = bx[0] + (bx[2] - bx[0]) * frac
                    parts.append([m.group(1), seg, [lx, bx[1], lx + 12, bx[3]]])
            elif found and parts:
                parts[-1][1] = (parts[-1][1] + ' ' + t.strip()).strip()
        if found and parts and re.match(r'^\s*[A-D]\)', l['text']):
            for p in parts:
                opts[p[0]] = {'text': p[1], 'bbox': p[2], 'line': l}
            cur = parts[-1][0] if len(parts) == 1 else None
            continue
        if cur and opts and l['bbox'][0] > opts[cur]['bbox'][0] + 4 and not l['bold'] and abs(l['bbox'][1] - opts[cur]['line']['bbox'][3]) < 6:
            # önceki şıkkın devamı
            opts[cur]['text'] = (opts[cur]['text'] + ' ' + l['text'].replace('\t', ' ').strip()).strip()
            opts[cur]['line'] = l
            continue
        cur = None
        other.append(l)
    return opts, other


def join_stem(lines):
    out = ''
    prev = None
    for l in lines:
        t = l['text'].replace('\t', ' ').strip()
        if not t:
            continue
        if prev is None:
            out = t
        else:
            gap = l['bbox'][1] - prev['bbox'][3]
            newpara = gap > 1.5 or re.match(r'^(I{1,3}V?|IV|V|VI{0,3})\s*[-.)]', t) or t.startswith('•')
            if out.endswith('\u00ad') and not newpara:
                out = out[:-1] + t
            elif out.endswith('-') and not newpara and not re.search(r'\s-$', out):
                out = out[:-1] + t
            else:
                out += ('\n' if newpara else ' ') + t
        prev = l
    out = out.replace('\u00ad', '').replace('••', '•')
    out = re.sub(r'[ \t]+', ' ', out)
    return out.strip()


def parse_doc(code, path):
    doc = pymupdf.open(path)
    key, keymode, keyheads = parse_key(doc)
    W = doc[0].rect.width
    qs = []
    subj_order = []
    for pi, pg in enumerate(doc):
        txt = pg.get_text()
        if 'DİKKATİNE' in txt or 'SORU KİTAPÇIĞI İLE İLGİLİ' in txt or 'CEVAP ANAHTARI' in txt or 'SINAV SÜRESİNCE UYULACAK' in txt or 'KURALLAR' in txt and 'SALON' in txt:
            continue
        L = lines_of(pg)
        head = [l for l in L if l['bbox'][1] < 45]
        body = [l for l in L if 45 <= l['bbox'][1] < pg.rect.height - 50]
        subj = None
        for h in head:
            s = subj_of(h['text'])
            if s:
                subj = s
        if subj and (not subj_order or subj_order[-1] != subj):
            subj_order.append(subj)
        G = [g for g in graphics_of(pg) if g.y0 >= 48 and g.y1 <= pg.rect.height - 45]
        for col in (0, 1):
            cx0, cx1 = (0, W / 2) if col == 0 else (W / 2, W)
            cl = [l for l in body if cx0 <= (l['bbox'][0]) < cx1]
            if not cl:
                continue
            cands = []
            for l in cl:
                m = QSTART.match(l['text'].replace('\t', ' '))
                if m and (l['bold'] or l['size'] >= 11) and 1 <= int(m.group(1)) <= 60:
                    cands.append((l['bbox'][1], int(m.group(1)), l))
            if not cands:
                continue
            minx = min(c[2]['bbox'][0] for c in cands)
            starts = [c for c in cands if c[2]['bbox'][0] < minx + 12]
            starts.sort(key=lambda s: s[0])
            for si, (y0, no, sl) in enumerate(starts):
                y1 = starts[si + 1][0] - 1 if si + 1 < len(starts) else pg.rect.height - 50
                ql = [l for l in cl if y0 - 1 <= l['bbox'][1] < y1 and l is not sl]
                # numarayı ilk satırdan çıkar
                first = dict(sl)
                first['text'] = QSTART.match(first['text'].replace('\t', ' ')).group(2)
                first['spans'] = [dict(s) for s in first['spans']]
                if first['spans']:
                    first['spans'][0]['text'] = re.sub(r'^\s*\d{1,2}\s*\.\s*', '', first['spans'][0]['text'])
                ql = [first] + ql
                ql.sort(key=lambda l: (round(l['bbox'][1] / 3), l['bbox'][0]))
                gq = [g for g in G if g.y0 >= y0 - 4 and g.y1 <= y1 + 4 and g.x0 >= cx0 - 2 and g.x1 <= cx1 + 2 and not (g.x1 > cx1 - 2 and g.x0 < cx0 + 2)]
                opts, other = split_options(ql, cx0, cx1)
                rec = {'code': code, 'page': pi + 1, 'col': col, 'no': no, 'subj': subj,
                       'q': '', 'o': [], 'img': None, 'oimg': None, 'warn': []}
                letters = 'ABCD'
                if set(opts) != set(letters):
                    rec['warn'].append('options:' + ''.join(sorted(opts)))
                # görsel şıklar
                img_opts = [k for k in letters if k in opts and not opts[k]['text']]
                used = set()
                if img_opts:
                    labels = [(k, opts[k]['bbox']) for k in letters if k in opts]
                    oimg = {}
                    for k, bb in labels:
                        # hücre: etiketten sağdaki/aşağıdaki ilk etikete kadar
                        same_row_right = [b for kk, b in labels if abs(b[1] - bb[1]) < 6 and b[0] > bb[0] + 10]
                        xr = min([b[0] for b in same_row_right], default=cx1) - 2
                        below = [b for kk, b in labels if b[1] > bb[1] + 6]
                        yb = min([b[1] for b in below], default=y1) - 1
                        cell = pymupdf.Rect(bb[0] - 2, bb[1] - 4, xr, yb)
                        inside = [i for i, g in enumerate(gq) if cell.contains(pymupdf.Rect(g.x0 + 1, g.y0 + 1, g.x1 - 1, g.y1 - 1)) or (cell & g).get_area() > 0.6 * max(g.get_area(), 0.01)]
                        if not inside:
                            # etiket hücrenin altında olabilir: etiketin üstündeki alanı dene
                            above = [b for kk, b in labels if b[1] < bb[1] - 6]
                            ya = max([b[3] for b in above], default=y0) + 1
                            cell2 = pymupdf.Rect(bb[0] - 2, ya, xr, bb[3] + 2)
                            inside = [i for i, g in enumerate(gq) if (cell2 & g).get_area() > 0.6 * max(g.get_area(), 0.01)]
                        if inside:
                            u = union([gq[i] for i in inside])
                            # hücredeki küçük etiket metinlerini de kapsa
                            for l in other:
                                lb = pymupdf.Rect(l['bbox'])
                                if (u + (-6, -6, 6, 6)).contains(lb):
                                    u |= lb
                            used.update(inside)
                            oimg[k] = save_crop(pg, u, f'{code}-{no:02d}{k}')
                        else:
                            rec['warn'].append('noimg:' + k)
                    rec['oimg'] = [oimg.get(k) for k in letters]
                rest = [g for i, g in enumerate(gq) if i not in used]
                fig = None
                if rest:
                    big = [c for c in clusters(rest) if c.width >= 14 and c.height >= 14]
                    fig = union(big) if big else None
                stem_lines = []
                other = [l for l in other if not re.search(r'TEST(İ)? BİTTİ|CEVAPLARINIZI KONTROL|TESTİNE GEÇİNİZ|SAYFAYA GEÇİNİZ', l['text'])]
                for l in other:
                    lb = pymupdf.Rect(l['bbox'])
                    t = l['text'].strip()
                    if fig is not None and (fig + (-2, -2, 2, 2)).contains(lb) and (len(t) <= 15 or l['size'] < 9):
                        continue
                    if re.fullmatch(r'\d{1,2}', t) and lb.y0 > pg.rect.height - 90:
                        continue
                    stem_lines.append(l)
                if fig is not None:
                    # şekil içindeki küçük metinleri kapsa
                    rec['img'] = save_crop(pg, fig, f'{code}-{no:02d}')
                    rec['figbox'] = [round(v) for v in fig]
                rec['q'] = join_stem(stem_lines)
                rec['o'] = [re.sub(r'\u00ad\s*', '', re.sub(r'(\w)\u00ad\s+(\w)', r'\1\2', opts[k]['text'])).replace('\t', ' ').strip() if k in opts else '' for k in letters]
                rec['o'] = [re.sub(r'\s+', ' ', o) for o in rec['o']]
                qs.append(rec)
    # sıralama: sayfa, sütun, y
    # ders sırası ve cevap
    for r in qs:
        if keymode == 'bysubject':
            si = subj_order.index(r['subj']) if r['subj'] in subj_order else -1
            r['ans'] = key.get((si, r['no']))
        else:
            r['ans'] = key.get((0, r['no']))
        if not r['ans']:
            r['warn'].append('noans')
    return qs, keymode, subj_order


def main():
    allq = []
    report = []
    for arg in sys.argv[2:]:
        code, path = arg.split('=', 1)
        qs, km, so = parse_doc(code, path)
        nums = sorted((q['subj'] or '-', q['no']) for q in qs)
        report.append({'code': code, 'n': len(qs), 'keymode': km, 'subjects': so, 'warn': sum(1 for q in qs if q['warn'])})
        allq.extend(qs)
    with open(os.path.join(OUT, 'raw.json'), 'w') as f:
        json.dump(allq, f, ensure_ascii=False, indent=1)
    for r in report:
        print(r)
    print('TOTAL', len(allq))


main()
