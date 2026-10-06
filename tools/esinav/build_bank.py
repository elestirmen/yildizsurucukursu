"""Tekilleştirilmiş MEB sorularını, ajan sınıflandırmasını ve görselleri sitenin soru bankasına derler.

Kullanım: python -I build_bank.py <scratchpad> <site_dizini>
Çıktı: <site>/assets/data/sorular.js, <site>/assets/q/*.webp
"""
import glob, json, os, re, sys
from PIL import Image

SP, SITE = sys.argv[1], sys.argv[2]
BANK = os.path.join(SP, 'bank')
QDIR = os.path.join(SITE, 'assets', 'q')
DDIR = os.path.join(SITE, 'assets', 'data')
os.makedirs(QDIR, exist_ok=True)
os.makedirs(DDIR, exist_ok=True)

ded = json.load(open(os.path.join(BANK, 'dedup_ids.json')))
raw = json.load(open(os.path.join(BANK, 'raw.json')))
topics = json.load(open(os.path.join(SP, 'topics.json')))
titles = json.load(open(os.path.join(SP, 'topic_titles.json')))
cls = {}
for f in sorted(glob.glob(os.path.join(SP, 'agent_out', 'batch_[0-9].json'))):
    for r in json.load(open(f)):
        cls[r['id']] = r
review = {}
rp = os.path.join(SP, 'review.json')
if os.path.exists(rp):
    review = json.load(open(rp))  # id -> {"old": null|"...", "oldc": ..., "fixq":..., "fixo":..., "exp":..., "a":...}

missing = [d['id'] for d in ded if d['id'] not in cls]
if missing:
    print('UYARI: sınıflandırılmamış', len(missing), missing[:10])

AY = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']


def session_label(code):
    date, typ = code.split('_')
    y, m, d = date.split('-')
    tarih = f'{int(d)} {AY[int(m)]} {y}'
    if typ == 'B':
        return tarih, 'MTSAS · B sertifikası', 'ders'
    if typ == 'YM':
        return tarih, 'MTSAS · Yeni müfredat', 'toplam'
    if typ == 'G1':
        return tarih, 'MTSKS · 1. grup', 'toplam'
    if typ == 'G2':
        return tarih, 'MTSKS · 2. grup (güncel müfredat)', 'toplam'
    return tarih, typ, 'toplam'


def recolor(im):
    """İki renk baskıdaki magentayı levha kırmızısına çevirir."""
    im = im.convert('RGB')
    hsv = im.convert('HSV')
    h, s, v = hsv.split()
    hp, sp_, vp = h.load(), s.load(), v.load()
    W, H = im.size
    changed = 0
    for y in range(H):
        for x in range(W):
            hh = hp[x, y]
            if 200 <= hh <= 248 and sp_[x, y] > 40:
                hp[x, y] = 254
                changed += 1
    if not changed:
        return im
    return Image.merge('HSV', (h, s, v)).convert('RGB')


def save_img(src_name, out_name, maxw=760):
    out = os.path.join(QDIR, out_name)
    if os.path.exists(out) and os.path.getmtime(out) > os.path.getmtime(os.path.join(BANK, 'img', src_name)):
        return out_name
    im = Image.open(os.path.join(BANK, 'img', src_name))
    im = recolor(im)
    # 3x render: ekranda ~1.5x yoğunluk yeterli
    w, h = im.size
    tw = min(maxw, round(w * 0.62))
    if tw < w:
        im = im.resize((tw, round(h * tw / w)), Image.LANCZOS)
    im.save(out, 'WEBP', quality=82, method=6)
    return out_name


# raw üye -> benzersiz id eşlemesi (oturum soru sırası için)
member_to_id = {}
for d in ded:
    for m in d['members']:
        key = m.rsplit(':', 1)[0]
        member_to_id[key] = d['id']

L = 'ABCD'
out_q = []
by_id = {}
for d in ded:
    c = cls.get(d['id'], {})
    rv = review.get(d['id'], {})
    q = rv.get('fixq') or c.get('fixq') or d['q']
    o = rv.get('fixo') or c.get('fixo') or d['o']
    o = [x if x is not None else '' for x in o]
    a = L.index(d['ans']) if d['ans'] in L else None
    if 'a' in rv:
        a = rv['a']
    subj = c.get('subj') or d['subj']
    topic = c.get('topic')
    if not topic or topic not in topics or not topic.startswith(subj + '-'):
        print('UYARI konu', d['id'], subj, topic)
    old = rv['old'] if 'old' in rv else c.get('old')
    oldc = rv['oldc'] if 'oldc' in rv else c.get('oldc')
    rec = {'i': d['id'], 'd': subj, 'k': topic, 'q': q.strip(), 'o': [x.strip() for x in o], 'a': a,
           'e': (rv.get('exp') or c.get('exp') or '').strip(), 'src': d['src']}
    if d['img']:
        rec['g'] = save_img(d['img'], f"{d['id']}.webp")
    if d['oimg']:
        rec['og'] = [save_img(p, f"{d['id']}-{L[i].lower()}.webp", 380) if p else None for i, p in enumerate(d['oimg'])]
    if old and oldc == 'kesin':
        rec['old'] = old
    elif old and oldc == 'olasi':
        rec['old'] = old  # inceleme sonrası kalanlar da güncel sayılmaz
    if c.get('keyq') and 'a' not in rv and not rv.get('keyok'):
        rec['old'] = rec.get('old') or ('Cevap anahtarı tartışmalı: ' + c['keyq'])
    if a is None:
        rec['old'] = rec.get('old') or 'Cevap anahtarı okunamadı'
    out_q.append(rec)
    by_id[d['id']] = rec

# oturumlar
sess = {}
for r in raw:
    sess.setdefault(r['code'], []).append(r)
SUBJ_ORDER = {'iy': 0, 'tc': 1, 'at': 2, None: 0}
oturumlar = []
for code in sorted(sess, reverse=True):
    rs = sess[code]
    rs.sort(key=lambda r: (SUBJ_ORDER[r['subj']], r['no']))
    ids = [member_to_id[f"{r['code']}#{r['subj'] or ''}{r['no']}"] for r in rs]
    tarih, tur, kural = session_label(code)
    n = len(ids)
    dk = {50: 60, 60: 75, 120: 150}.get(n, round(n * 1.2))
    oturumlar.append({'c': code, 'tarih': tarih, 'tur': tur, 'kural': kural, 'dk': dk, 'l': ids})


# ---------- MEB e-Sınav deneme sitesi soruları (cevaplar iki bağımsız çözümle) ----------
ESB = os.path.join(SP, 'bank_es')
es_items = {x['id']: x for x in json.load(open(os.path.join(ESB, 'items.json')))} if os.path.exists(os.path.join(ESB, 'items.json')) else {}
es_dec = json.load(open(os.path.join(SP, 'es_final.json'))) if os.path.exists(os.path.join(SP, 'es_final.json')) else {}


def save_es(name, out_name, maxw=760):
    out = os.path.join(QDIR, out_name)
    im = Image.open(os.path.join(ESB, 'img', name)).convert('RGB')
    w, h = im.size
    if w > maxw:
        im = im.resize((maxw, round(h * maxw / w)), Image.LANCZOS)
    im.save(out, 'WEBP', quality=82, method=6)
    return out_name


es_sessions = {1: [], 2: [], 3: []}
for qid, dec in sorted(es_dec.items()):
    it = es_items[qid]
    rec = {'i': qid, 'd': dec['topic'].split('-')[0], 'k': dec['topic'], 'q': (dec.get('fixq') or it['q']).strip(),
           'o': [x.strip() for x in (dec.get('fixo') or it['o'])], 'a': L.index(dec['a']), 'e': dec['exp'].strip(), 'src': [f"es{it['test']}"], 'es': 1}
    if it['img']:
        rec['g'] = save_es(it['img'][0], f'{qid}.webp')
    if it['oimg']:
        rec['og'] = [save_es(p_, f"{qid}-{L[i].lower()}.webp", 380) if p_ else None for i, p_ in enumerate(it['oimg'])]
    out_q.append(rec)
    by_id[qid] = rec
    es_sessions[it['test']].append((it['no'], qid))
for t in (3, 2, 1):
    ids = [q for _, q in sorted(es_sessions[t])]
    if ids:
        oturumlar.insert(0, {'c': f'es{t}', 'tarih': f'e-Sınav örnek kitapçığı {t}', 'tur': 'MEB e-Sınav deneme sitesi (güncel)', 'kural': 'toplam', 'dk': round(len(ids) * 0.9), 'l': ids})

# konu başlıkları
konular = {}
for k in topics:
    konular[k] = titles[k]

stats = {
    'toplam': len(out_q),
    'guncel': sum(1 for q in out_q if 'old' not in q),
    'oturum': sum(1 for o in oturumlar if not o['c'].startswith('es')),
    'es': sum(1 for q in out_q if q.get('es')),
    'konu': len(konular),
}
data = {'v': 1, 'stats': stats, 'konular': konular, 'oturumlar': oturumlar, 'sorular': out_q}
js = '/* Ürgüp Yıldız Sürücü Kursu — e-Sınav soru bankası (otomatik üretildi: tools/build_bank.py)\n' \
     '   Kaynak: MEB Motorlu Taşıt Sürücü Adayları/Kursiyerleri Sınavı soru kitapçıkları ve resmî cevap anahtarları (2012–2016).\n' \
     '   Alanlar: i kimlik · d ders · k konu · q soru · o şıklar · a doğru şık (0 tabanlı) · g soru görseli · og şık görselleri\n' \
     '            e açıklama (kursumuzca yazıldı) · src çıktığı sınavlar · old güncel değil gerekçesi */\n' \
     'window.YildizSorular = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(os.path.join(DDIR, 'sorular.js'), 'w', encoding='utf-8').write(js)
print(json.dumps(stats, ensure_ascii=False))
from collections import Counter
g = [q for q in out_q if 'old' not in q]
print('güncel ders dağılımı', Counter(q['d'] for q in g))
print('boyut', os.path.getsize(os.path.join(DDIR, 'sorular.js')) // 1024, 'KB; görsel', len(os.listdir(QDIR)),
      sum(os.path.getsize(os.path.join(QDIR, f)) for f in os.listdir(QDIR)) // 1024, 'KB')
