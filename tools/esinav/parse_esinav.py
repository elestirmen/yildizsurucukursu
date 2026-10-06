"""esinavdeneme.meb.gov.tr'den kaydedilen soru HTML'lerini yapılandırır.
Kullanım: python -I parse_esinav.py <scratchpad>"""
import base64, html, json, os, re, sys
from html.parser import HTMLParser
SP = sys.argv[1]
OUT = os.path.join(SP, 'bank_es'); IMG = os.path.join(OUT, 'img')
os.makedirs(IMG, exist_ok=True)

class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.lines = [[]]; s.imgs = []
    def handle_starttag(s, tag, attrs):
        a = dict(attrs)
        if tag in ('tr', 'br', 'p', 'div'):
            s.lines.append([])
        if tag == 'img' and a.get('src', '').startswith('data:'):
            s.imgs.append(a['src']); s.lines[-1].append('\x00IMG\x00')
    def handle_endtag(s, tag):
        if tag in ('tr', 'p', 'div'):
            s.lines.append([])
    def handle_data(s, d):
        s.lines[-1].append(d)

def text_of(h):
    p = P(); p.feed(h)
    lines = []
    for l in p.lines:
        t = html.unescape(' '.join(x for x in l if x != '\x00IMG\x00'))
        t = re.sub(r'\s+', ' ', t.replace('\xa0', ' ')).strip()
        if t: lines.append(t)
    return lines, p.imgs

def save(uri, name):
    head, b64 = uri.split(',', 1)
    ext = 'png' if 'png' in head else ('jpg' if 'jp' in head else 'gif')
    fn = f'{name}.{ext}'
    open(os.path.join(IMG, fn), 'wb').write(base64.b64decode(b64))
    return fn

SUBJ = lambda n: 'iy' if n <= 12 else 'tc' if n <= 35 else 'at' if n <= 44 else 'ta'
items = []
for t, f in ((1, 'questions_A.json'), (2, 'questions_-.json'), (3, 'questions_-.json')):
    for q in json.load(open(os.path.join(SP, 'meb', 'esinav', f'test{t}', f))):
        no = int(q['no']); qid = f'e{t}{no:02d}'
        lines, imgs = text_of(q['soru'])
        # roma rakamı / madde satırlarını birleştirme: "I." tek başına satırsa sonrakine ekle
        merged = []
        for l in lines:
            if merged and re.fullmatch(r'(I{1,3}|IV|V|VI{0,3})\.?|•', merged[-1]):
                merged[-1] = merged[-1] + ' ' + l
            else:
                merged.append(l)
        stem_imgs = [save(u, f'{qid}' + (f'_{i}' if i else '')) for i, u in enumerate(imgs)]
        # şıklar
        cells = re.findall(r'<td[^>]*class="secenekler"[^>]*>(.*?)</td>\s*(?=<td[^>]*class="secenekler"|</tr>)', q['cevap'], re.S)
        opts, oimgs = [], []
        for i, c in enumerate(cells[:4]):
            ol, oi = text_of(c)
            txt = re.sub(r'^[A-D]\)\s*', '', ' '.join(ol)).strip()
            opts.append(txt)
            oimgs.append(save(oi[0], f'{qid}-{"abcd"[i]}') if oi else None)
        items.append({'id': qid, 'test': t, 'no': no, 'subj': SUBJ(no), 'q': '\n'.join(merged), 'o': opts,
                      'img': stem_imgs, 'oimg': oimgs if any(oimgs) else None})
json.dump(items, open(os.path.join(OUT, 'items.json'), 'w'), ensure_ascii=False, indent=1)
bad = [x['id'] for x in items if len(x['o']) != 4]
print(len(items), 'bad', bad, 'stem imgs', sum(1 for x in items if x['img']), 'multi', [x['id'] for x in items if len(x['img']) > 1], 'oimg', sum(1 for x in items if x['oimg']))
