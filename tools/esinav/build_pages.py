"""Sınava Hazırlık sayfalarını ve konular.js verisini üretir:
  hazirlik.html            hazırlık ana sayfası (1 Öğren · 2 Çalış · 3 Sınav ol, konu listesi ve ilerleme)
  konu-<id>.html           her konu için tek sayfa: anlatım → (varsa) etkileşimli uygulama → sorular
  e-sinav.html             Sınav ol: deneme sınavı ve çıkmış sınavlar
  konu-anlatimi.html, trafik-akademisi.html   eski adresler (yeni yerlerine yönlendirir)
Kullanım: python3 build_pages.py <scratchpad> <site_dizini>
<scratchpad>/konu_out/<id>.json konu anlatımlarını içerir (tools/esinav/data/konular bağlantısı).
Varlık sürümleri (?v=) <scratchpad>/versions.json'dan, yoksa bu dizindeki versions.json'dan okunur.
"""
import html, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from partials import nav, footer, quickbar, FONTS

HERE = os.path.dirname(os.path.abspath(__file__))
SP, SITE = sys.argv[1], sys.argv[2]
_vp = next((x for x in (os.path.join(SP, 'versions.json'), os.path.join(HERE, 'versions.json')) if os.path.exists(x)), None)
V = json.load(open(_vp)) if _vp else {}
ver = lambda k: V.get(k, 1)
index = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
sprite = re.search(r'  <svg class="sprite" aria-hidden="true" focusable="false">.*?\n  </svg>\n', index, re.S).group(0)

src = open(os.path.join(SITE, 'assets', 'data', 'sorular.js'), encoding='utf-8').read()
DATA = json.loads(src[src.index('=') + 1:].rstrip().rstrip(';'))
titles = DATA['konular']
stats = DATA['stats']
live = [q for q in DATA['sorular'] if 'old' not in q]
SESS = {o['c']: o for o in DATA['oturumlar']}
DERS = {'iy': 'İlk Yardım', 'tc': 'Trafik ve Çevre', 'at': 'Araç Tekniği', 'ta': 'Trafik Adabı'}
DERS_TXT = {
    'iy': 'Olay yerinde ilk müdahale: temel yaşam desteği, kanamalar, kırıklar, yanıklar, bilinç bozuklukları ve kazazedenin taşınması.',
    'tc': 'Trafik işaretleri, geçiş hakkı, hız ve takip mesafesi, duraklama-park, sürücü belgeleri, trafik kazaları ve çevre bilinci.',
    'at': 'Motorun çalışması, yakıt, soğutma, yağlama ve elektrik sistemleri, güç aktarma, fren ve lastikler, gösterge paneli ve bakım.',
    'ta': 'Trafikte saygı, sabır, empati ve sorumluluk; sürücü davranışları, risk algısı ve yol kullanıcılarıyla iletişim.',
}
DORDER = ['iy', 'tc', 'at', 'ta']
fmt = lambda n: f'{n:,}'.replace(',', '.')
e = html.escape
jdump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

# Konu → etkileşimli uygulama (eski Trafik Akademisi dersleri)
APP = {'tc-isikli': 'isik', 'tc-gecis': 'gecis', 'tc-uyari': 'levha', 'tc-yatay': 'serit', 'tc-park': 'park',
       'tc-hiz': 'durus', 'tc-sollama': 'ayna', 'iy-tyd': 'tyd', 'at-gosterge': 'gosterge', 'ta-adab': 'adab'}
# Levha ve ikaz lambası konularında yapay zekâ görseli yerine doğru çizimler
KIT_HEAD = {
    'tc-uyari': 'sign:virajsag sign:kaygan sign:yayauyari sign:okul sign:yolcalisma sign:daralan',
    'tc-tanzim': 'sign:dur sign:yolver sign:girisyok sign:hiz50 sign:sollamayasak sign:ileri',
    'tc-bilgi': 'sign:park sign:hastane sign:yayagecidi sign:cikmaz sign:parkyasak sign:durakparkyasak',
    'at-gosterge': 'lamp:yag lamp:aku lamp:hararet lamp:fren lamp:motor lamp:abs',
}
ALT = {
    'iy-temel': 'Yol kenarında dörtlüleri yanan araç, arkasına konmuş reflektör; yaralının yanında 112\'yi arayan kadın',
    'iy-vucut': 'İlk yardım dersinde göğüs kafesi açık anatomi modeli üzerinde kalbi gösteren eğitmen',
    'iy-degerlendirme': 'Yerde yatan bilinçsiz kişinin omuzlarına dokunup nefes alıp almadığını kontrol eden ilk yardımcı',
    'iy-tyd': 'Eğitim mankeni üzerinde kollar düz, eller göğüs ortasında kalp masajı yapan kişi',
    'iy-kanama': 'Yukarı kaldırılmış koldaki yaraya eldivenli elle steril gazlı bezle bastıran ilk yardımcı',
    'iy-yara': 'Dizdeki yaraya steril örtü koyup sargı bezi saran eldivenli eller',
    'iy-kirik': 'Kırık önkolu atelle sabitleyip üçgen sargıyla askıya alan ilk yardımcı',
    'iy-bilinc': 'Bayılan kişinin bacaklarını yükselterek sırtüstü yatıran ilk yardımcı',
    'iy-yanik': 'Yanan eli akan serin su altında soğutan kişi',
    'iy-tasima': 'Koma pozisyonunda yan yatırılmış kişinin solunumunu kontrol eden ilk yardımcı',
    'tc-kavramlar': 'Ürgüp\'te taşıt yolu, kaldırımlar, park etmiş araç ve kavşak görünen sokak, yukarıdan',
    'tc-isikli': 'Trafik ışıklı kavşakta kolunu kaldırarak trafiği yöneten yelekli trafik görevlisi',
    'tc-yatay': 'Asfalt üzerinde yaya geçidi, durma çizgisi, şerit okları ve düz-kesik orta çizgi, yukarıdan',
    'tc-hiz': 'Kapadokya yolunda öndeki araçla arasında uzun takip mesafesi bırakan otomobil',
    'tc-gecis': 'Ürgüp\'te küçük bir dönel kavşak ve girişte yol veren araç, yukarıdan',
    'tc-sollama': 'Kesik orta çizgili köy yolunda yavaş traktörü sollayan beyaz otomobil',
    'tc-park': 'Taş döşeli sokakta iki araç arasına geri geri park eden otomobil',
    'tc-isik': 'Alacakaranlıkta kısa farları yanık olarak ilerleyen otomobil',
    'tc-ozel': 'Işıklarını yakarak gelen ambulansa sağa çekilerek yol veren araçlar',
    'tc-yukleme': 'Kasasındaki yükü branda ve spanzetlerle sağlamca bağlanmış kamyonet',
    'tc-belge': 'Masada sürücü belgesi kartı, ruhsat, sigorta poliçesi ve araç anahtarı',
    'tc-ceza': 'Gece yol kontrolünde sürücüye alkolmetre uygulayan trafik polisi',
    'tc-kaza': 'Hafif çarpışmadan sonra dörtlüleri yanan iki araç ve kaldırımda tutanak dolduran sürücüler',
    'tc-cevre': 'Eski bir aracın egzozundan çıkan koyu duman',
    'at-motor': 'Pistonları, krank milini ve supapları görünen kesitli motor modeli',
    'at-yakit': 'Açık motorun üzerinde yeni bir buji tutan el, ateşleme bobinleri görünüyor',
    'at-sogutma': 'Motor soğukken genleşme kabındaki antifriz seviyesini kontrol eden kişi',
    'at-yaglama': 'Motor yağ çubuğunu çekip yağ seviyesine bakan kişi',
    'at-elektrik': 'Akünün artı ve eksi kutuplarına takılmış kırmızı ve siyah takviye kabloları',
    'at-aktarma': 'Liftte kaldırılmış aracın altında şanzıman, kardan mili ve diferansiyel',
    'at-fren': 'Jant arasından görünen fren diski ve kaliper',
    'at-lastik': 'Lastik diş derinliğini ölçüm aletiyle ölçen el',
    'at-bakim': 'Periyodik bakımda kaputu açık aracın motoruna bakan usta ve araç sahibi',
    'ta-adab': 'Yaya geçidinin önünde durup bastonlu yaşlı kadının geçmesini bekleyen sürücü',
    'ta-surucu': 'Araç kullanırken elindeki telefona bakan dikkati dağılmış sürücü',
    'ta-iletisim': 'Kavşakta kendisine yol veren sürücüye el sallayarak teşekkür eden sürücü',
}

konular = {}
for k in titles:
    p = os.path.join(SP, 'konu_out', f'{k}.json')
    if os.path.exists(p):
        konular[k] = json.load(open(p))
    else:
        konular[k] = {'id': k, 'ozet': '', 'sik': [], 'anahtar': [], 'html': '<p>Bu konunun anlatımı hazırlanıyor.</p>'}
        print('UYARI: konu yok', k)

# --- konular.js (sınav sayfasındaki konu çekmecesi için) ---
kj = {k: {'t': titles[k], 'd': k.split('-')[0], 'ozet': v.get('ozet', ''), 'sik': v.get('sik', []), 'html': v.get('html', '')} for k, v in konular.items()}
open(os.path.join(SITE, 'assets', 'data', 'konular.js'), 'w', encoding='utf-8').write(
    '/* Ürgüp Yıldız Sürücü Kursu — konu anlatımları (otomatik üretildi: tools/esinav/build_pages.py) */\nwindow.YildizKonular = ' +
    json.dumps(kj, ensure_ascii=False, separators=(',', ':')) + ';\n')

order = [k for d in DORDER for k in titles if k.startswith(d + '-')]
count = {k: sum(1 for q in live if q['k'] == k) for k in titles}
dcount = {d: sum(1 for q in live if q['d'] == d) for d in DORDER}
n_live = fmt(stats['guncel'])
konu_url = lambda k: f'konu-{k}.html'
img_path = lambda k: f'assets/img/konu/{k}.webp'
has_img = lambda k: os.path.exists(os.path.join(SITE, img_path(k)))


def head(title, desc, canonical, css=('sinav', 'hazirlik'), robots='index, follow', image=None):
    links = ''.join(f'''  <link rel="stylesheet" href="assets/{c}.css?v={ver(c + '.css')}">\n''' for c in css)
    og = image or f"assets/og.jpg?v={ver('og')}"
    return f'''<!doctype html>
<html lang="tr" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#ffffff">
  <meta name="color-scheme" content="light dark">
  <script>
    (function () {{
      var t; try {{ t = localStorage.getItem('yildiz-tema'); }} catch (e) {{}}
      if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var d = document.documentElement; d.dataset.theme = t; d.classList.add('js', 'no-anim');
    }})();
  </script>
  <meta name="robots" content="{robots}">
  <link rel="canonical" href="https://www.urgupyildizsurucu.com/{canonical}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="tr_TR">
  <meta property="og:site_name" content="Ürgüp Yıldız Sürücü Kursu">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="https://www.urgupyildizsurucu.com/{canonical}">
  <meta property="og:image" content="https://www.urgupyildizsurucu.com/{og}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="assets/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  {FONTS}
  <link rel="stylesheet" href="assets/site.css?v={ver('site.css')}">
  <link rel="stylesheet" href="assets/kurumsal.css?v={ver('kurumsal.css')}">
{links}</head>
<body>
  <a class="skip" href="#icerik">İçeriğe geç</a>
{sprite}
'''


DIALOG = '''  <div class="dlg" id="dlg" hidden><div class="dlg-box" role="alertdialog" aria-modal="true"><h3></h3><p></p><div class="dlg-actions"><button class="btn btn-line" type="button" data-cancel>Vazgeç</button><button class="btn btn-navy" type="button" data-ok>Tamam</button></div></div></div>
'''


def tail(scripts, extra=''):
    s = '\n'.join(f'  <script src="{x}" defer></script>' if isinstance(x, str) else f'  <script src="{x[0]}" {x[1]} defer></script>' for x in scripts)
    return f'''
  <!-- Mobil hızlı erişim -->
{quickbar(False)}
{extra}{s}
</body>
</html>
'''


def write(name, text):
    open(os.path.join(SITE, name), 'w', encoding='utf-8').write(text)


soru_js = (f"assets/soru.js?v={ver('soru.js')}", f'data-bank="assets/data/sorular.js?v={ver("sorular.js")}"')
ICON = lambda i: f'<svg class="ic"><use href="#{i}"/></svg>'


def src_text(q):
    if q.get('es'):
        return 'MEB e-Sınav örnek sorusu · cevap anahtarı yayımlanmadı, kursumuzca belirlendi'
    o = SESS.get(q['src'][0])
    first = f"{o['tarih']} · {o['tur']}" if o else q['src'][0]
    return f"{first} · toplam {len(q['src'])} sınavda çıktı" if len(q['src']) > 1 else first


# =========================================================
# Konu sayfaları
# =========================================================
lessons_src = open(os.path.join(HERE, 'data', 'akademi-dersler.html'), encoding='utf-8').read()
LESSON = {m.group(1): m.group(0) for m in re.finditer(r'          <article class="lesson[^>]*data-lesson="(\w+)".*?\n          </article>\n', lessons_src, re.S)}


def lesson_html(lid):
    a = LESSON[lid]
    a = re.sub(r'<article class="lesson[^"]*" id="ders-(\w+)" role="tabpanel" aria-labelledby="tab-\w+" data-lesson="(\w+)" data-s="(\w+)"( hidden)?>',
               lambda m: f'<article class="lesson is-active" id="ders-{m.group(1)}" data-lesson="{m.group(2)}" data-s="{m.group(3)}">', a, count=1)
    a = re.sub(r'<span class="lesson-no">Ders \d+ · ([^<]+)</span><span class="xa-subj"[^>]*>[^<]*</span>', r'<span class="lesson-no">Etkileşimli uygulama · \1</span>', a)
    a = a.replace('<h3>', '<h3 class="lesson-h">', 1)
    return a


app_names = {lid: re.search(r'<h3>([^<]+)</h3>', LESSON[lid]).group(1) for lid in LESSON}

for i, k in enumerate(order):
    d = k.split('-')[0]
    v = konular[k]
    ks_d = [x for x in order if x.startswith(d + '-')]
    num = ks_d.index(k) + 1
    prev_k = order[i - 1] if i else None
    next_k = order[i + 1] if i + 1 < len(order) else None
    app = APP.get(k)
    qs = []
    for q in live:
        if q['k'] != k:
            continue
        x = {f: q[f] for f in ('i', 'd', 'k', 'q', 'o', 'a', 'e', 'g', 'og', 'es', 'src') if f in q}
        x['st'] = src_text(q)
        qs.append(x)
    n = len(qs)
    freq = sum(1 for q in qs if len(q.get('src', [])) >= 3)

    if k in KIT_HEAD:
        media = f'<div class="kp-media kp-kit"><div class="kn-vis" data-kit="{KIT_HEAD[k]}"></div></div>'
    else:
        src_img = img_path(k) if has_img(k) else f'assets/img/subj-{d}.webp'
        alt = ALT.get(k, '') if has_img(k) else ''
        media = f'<figure class="kp-media"><img src="{src_img}" width="800" height="600" alt="{e(alt)}" fetchpriority="high"></figure>'

    steps = [('anlatim', 'Anlatım', 'Okunmadı')] + ([('uygulama', 'Uygulama', 'Yapılmadı')] if app else []) + [('sorular', 'Sorular', f'0/{n}')]
    steps_html = ''.join(f'<a href="#{sid}"><span class="kp-no">{j + 1}</span><span class="kp-st-t"><b>{lab}</b><small data-st="{sid}">{st}</small></span></a>' for j, (sid, lab, st) in enumerate(steps))
    sik = ''.join(f'<li>{e(x)}</li>' for x in v.get('sik', []))
    sec_no = {sid: j + 1 for j, (sid, _, _) in enumerate(steps)}

    app_html = ''
    if app:
        app_html = f'''
          <section class="kp-sec" id="uygulama" aria-labelledby="h-uygulama">
            <div class="kp-sec-head"><h2 class="kp-h" id="h-uygulama"><span class="kp-no">{sec_no['uygulama']}</span>Etkileşimli uygulama</h2>
              <button class="ap-sound" id="academy-sound" type="button" aria-pressed="true">{ICON('i-sound')}<span>Ses açık</span></button></div>
            <p class="kp-sec-sub">Okuduğunuz kuralı ekranda uygulayın. Hedefi tamamlayınca uygulama biter; hatasız bitirirseniz 3 yıldız alırsınız.</p>
            <div class="academy-shell kp-app" data-after="sorular" data-after-label="Sorulara geç">
{lesson_html(app)}            </div>
          </section>'''

    pager = (f'<a class="prev" href="{konu_url(prev_k)}"><small>← Önceki konu</small>{e(titles[prev_k])}</a>' if prev_k else '<span></span>') + \
            (f'<a class="next" href="{konu_url(next_k)}"><small>Sonraki konu →</small>{e(titles[next_k])}</a>' if next_k else
             f'<a class="next" href="e-sinav.html#deneme"><small>Tüm konular bitti →</small>Deneme sınavına gir</a>')

    page = head(f'{titles[k]} | {DERS[d]} Konu Anlatımı ve Çıkmış Sorular | Ürgüp Yıldız Sürücü Kursu',
                e((v.get('ozet') or titles[k])[:150] + f' Bu konudan {n} çıkmış soru.'), konu_url(k))
    page += nav(False, 'hazirlik')
    page += f'''
  <main id="icerik">
    <div id="kp-page" data-d="{d}">
      <section class="kp-head">
        <div class="wrap kp-head-in">
          <div class="kp-head-txt">
            <ol class="crumbs"><li><a href="index.html">Ana sayfa</a></li><li><a href="hazirlik.html">Sınava Hazırlık</a></li><li><a href="hazirlik.html#ders-{d}">{DERS[d]}</a></li></ol>
            <p class="kp-kick"><span class="chip-d" data-d="{d}">{DERS[d]}</span><span>Konu {num} / {len(ks_d)}</span><span>{n} çıkmış soru</span>{f'<span class="kp-has-app">{ICON("i-play")}Uygulamalı</span>' if app else ''}</p>
            <h1>{e(titles[k])}</h1>
            {f'<p class="kp-lead">{e(v["ozet"])}</p>' if v.get('ozet') else ''}
          </div>
          {media}
        </div>
      </section>
      <nav class="kp-steps" aria-label="Konunun bölümleri"><div class="wrap">{steps_html}</div></nav>
      <div class="page-body kp-body">
        <div class="wrap kp-wrap">
          <section class="kp-sec" id="anlatim" aria-labelledby="h-anlatim">
            <h2 class="kp-h" id="h-anlatim"><span class="kp-no">1</span>Konu anlatımı</h2>
            {f'<div class="kn-sum"><h3>{ICON("i-check")}Akılda kalsın</h3><ul>{sik}</ul></div>' if sik else ''}
            <div class="kn-article">{v.get('html', '')}</div>
            <div class="kp-read" id="anlatim-son"><button class="btn btn-line" type="button" data-read>{ICON('i-check')}<span>Okudum, devam et</span></button></div>
          </section>{app_html}
          <section class="kp-sec" id="sorular" aria-labelledby="h-sorular">
            <h2 class="kp-h" id="h-sorular"><span class="kp-no">{sec_no['sorular']}</span>Bu konunun soruları</h2>
            <p class="kp-sec-sub">MEB sınavlarında bu konudan çıkmış {n} soru{f' ({freq} tanesi en az üç sınavda soruldu)' if freq else ''}. Her soruda doğru cevabı ve açıklamasını hemen görürsünüz.</p>
            <div class="card card-pad kp-q-start" id="kp-q-start">
              <div class="opt-group"><p>Hangi sorular?</p><div class="seg" role="group" aria-label="Soru filtresi">
                <button type="button" data-f="all" aria-pressed="true">Tümü <small>{n}</small></button><button type="button" data-f="new" aria-pressed="false">Çözmediklerim <small>{n}</small></button><button type="button" data-f="wrong" aria-pressed="false">Yanlışlarım <small>0</small></button><button type="button" data-f="mark" aria-pressed="false">İşaretlediklerim <small>0</small></button></div></div>
              <div class="opt-group"><p>Sıralama</p><div class="seg" role="group" aria-label="Sıralama">
                <button type="button" data-o="mix" aria-pressed="true">Karışık</button><button type="button" data-o="freq" aria-pressed="false">Sık çıkanlar önce</button></div></div>
              <button class="btn btn-red btn-lg" type="button" id="kp-q-go">{ICON('i-play')}Çözmeye başla · <span id="kp-q-n">{n}</span> soru</button>
            </div>
            <div id="kp-q-run" hidden></div>
          </section>
          <nav class="kn-pager" aria-label="Konular arası geçiş">{pager}</nav>
        </div>
      </div>
    </div>
  </main>
'''
    page += footer(False)
    page += DIALOG
    kp_data = {'k': k, 'd': d, 't': titles[k], 'app': app, 'next': {'k': next_k, 't': titles[next_k]} if next_k else None}
    extra = f'  <script type="application/json" id="kp-data">{jdump(kp_data)}</script>\n  <script type="application/json" id="kp-sorular">{jdump(qs)}</script>\n'
    scripts = [f"assets/site.js?v={ver('site.js')}", f"assets/kit.js?v={ver('kit.js')}", soru_js, f"assets/konu.js?v={ver('konu.js')}"]
    if app:
        scripts += [f"assets/{x}.js?v={ver('academy')}" for x in ('academy-gfx', 'academy-3d', 'academy-top', 'academy')]
    scripts.append(f"assets/hazirlik.js?v={ver('hazirlik.js')}")
    page += tail(scripts, extra)
    write(konu_url(k), page)


# =========================================================
# hazirlik.html
# =========================================================
APP_TAG = ' · <span class="hr-app">' + ICON('i-play') + 'Uygulama</span><span class="hr-stars"></span>'


def row(k):
    app = APP.get(k)
    app_tag = APP_TAG
    ks_d = [x for x in order if x[:2] == k[:2]]
    return (f'<li class="hr" data-k="{k}"><a class="hr-a" href="{konu_url(k)}">'
            f'<span class="hr-n">{ks_d.index(k) + 1}</span>'
            f'<span class="hr-t"><b>{e(titles[k])}</b><small>{count[k]} soru{app_tag if app else ""}</small></span>'
            f'<span class="hr-st"><span class="hr-read" hidden>{ICON("i-check")}Okundu</span><span class="hr-q">0/{count[k]}</span><span class="hr-bar" aria-hidden="true"><i></i></span><span class="hr-acc"></span></span>'
            f'{ICON("i-right")}</a></li>')


ders_html = ''.join(f'''
          <section class="hz-ders" data-d="{d}" id="ders-{d}" aria-labelledby="hd-{d}">
            <header class="hd"><img src="assets/img/subj-{d}.webp" width="800" height="600" alt="" loading="lazy">
              <div><h3 id="hd-{d}">{DERS[d]}</h3><p>{DERS_TXT[d]}</p><div class="hd-prog"><span>{len([k for k in order if k.startswith(d + '-')])} konu</span><span>{fmt(dcount[d])} soru</span></div></div></header>
            <ol class="hr-list">{''.join(row(k) for k in order if k.startswith(d + '-'))}</ol>
          </section>''' for d in DORDER)
n_app = len(APP)
hz = head(f'Sınava Hazırlık: {stats["konu"]} Konu Anlatımı ve {n_live} Çıkmış Ehliyet Sorusu | Ürgüp Yıldız Sürücü Kursu',
          f'Ehliyet e-Sınavına adım adım hazırlanın: {stats["konu"]} konuda anlatım, {n_app} etkileşimli uygulama, MEB sınavlarında çıkmış {n_live} soru ve e-Sınav düzeninde deneme sınavı.',
          'hazirlik.html')
hz += nav(False, 'hazirlik')
hz += f'''
  <main id="icerik">
    <section class="page-head">
      <img class="ph-img" src="assets/img/konu.webp" alt="" width="1200" height="675">
      <div class="wrap">
        <ol class="crumbs"><li><a href="index.html">Ana sayfa</a></li><li>Sınava Hazırlık</li></ol>
        <h1>Sınava Hazırlık</h1>
        <p>e-Sınav'ın dört dersi {stats["konu"]} konuda. Her konuyu okuyun, varsa uygulamasını yapın, sorularını çözün; hazır olduğunuzda deneme sınavına girin.</p>
        <ul class="ph-stats" id="hz-stats"><li><b>0/{stats["konu"]}</b><span>konu okundu</span></li><li><b>0</b><span>soru çözüldü</span></li><li><b>–</b><span>doğru oranı</span></li><li><b>–</b><span>en iyi deneme puanı</span></li></ul>
      </div>
    </section>
    <div class="page-body" id="hz-page">
      <div class="wrap" id="hz-main">
        <ol class="hz-steps">
          <li class="hz-step" id="ogren"><span class="hz-no">1</span>
            <h2>Öğren</h2>
            <p>{stats["konu"]} konu anlatımı; {n_app} konuda etkileşimli uygulama. Konuyu okuyun, sonra sorularına geçin.</p>
            <p class="hz-meta" id="hz-next-t">İlk konu: <b>{e(titles[order[0]])}</b></p>
            <a class="btn btn-red" id="hz-next" href="{konu_url(order[0])}">İlk konuyla başla{ICON('i-arrow')}</a>
          </li>
          <li class="hz-step" id="calis"><span class="hz-no">2</span>
            <h2>Çalış</h2>
            <p>{n_live} çıkmış soru. Her konunun soruları kendi sayfasında; burada dersleri karışık çalışabilirsiniz.</p>
            <div class="seg hz-dz" role="group" aria-label="Ders"><button type="button" data-dz="all" aria-pressed="true">Tümü</button>{''.join(f'<button type="button" data-dz="{d}" aria-pressed="false">{DERS[d]}</button>' for d in DORDER)}</div>
            <div class="hz-acts"><button class="btn btn-navy" type="button" data-coz="karisik">{ICON('i-play')}20 karışık soru</button><button class="btn btn-line" type="button" data-coz="yanlis" hidden>{ICON('i-refresh')}Yanlışlarım <small></small></button><button class="btn btn-line" type="button" data-coz="isaret" hidden>{ICON('i-star')}İşaretlediklerim <small></small></button></div>
          </li>
          <li class="hz-step" id="sinav"><span class="hz-no">3</span>
            <h2>Sınav ol</h2>
            <p>Gerçek e-Sınav düzeninde 50 soru, 45 dakika; ya da MEB'in {stats["oturum"]} çıkmış sınavından birini çözün.</p>
            <p class="hz-meta" id="hz-last">Henüz sınava girmediniz.</p>
            <div class="hz-acts"><a class="btn btn-red" href="e-sinav.html#deneme">{ICON('i-monitor')}Deneme sınavına gir</a><a class="btn btn-line" href="e-sinav.html#cikmis">Çıkmış sınavlar</a></div>
          </li>
        </ol>

        <section class="hz-konular" id="konular" aria-labelledby="hz-konular-t">
          <div class="hz-konular-head"><h2 class="es-h2" id="hz-konular-t">Konular</h2><p class="es-sub">Sırayla ilerleyin; her konunun yanında okuyup okumadığınızı, çözdüğünüz soru sayısını ve doğru oranınızı görürsünüz.</p></div>{ders_html}
        </section>
        <p class="footnote hz-foot">İlerlemeniz yalnızca bu cihazdaki tarayıcıda saklanır; hiçbir sunucuya gönderilmez. <button class="text-btn" type="button" id="hz-reset">İlerlemeyi sıfırla</button></p>
      </div>
      <div class="wrap" id="hz-run" hidden><div id="hz-run-box"></div></div>
    </div>
  </main>
'''
hz += footer(False) + DIALOG
hz_data = {'order': order, 'k': {k: {'t': titles[k], 'd': k[:2], 'ids': [q['i'] for q in live if q['k'] == k], 'app': APP.get(k)} for k in order}}
hz += tail([f"assets/site.js?v={ver('site.js')}", soru_js, f"assets/hazirlik.js?v={ver('hazirlik.js')}"],
           f'  <script type="application/json" id="hz-data">{jdump(hz_data)}</script>\n')
write('hazirlik.html', hz)


# =========================================================
# e-sinav.html — Sınav ol
# =========================================================
es = head(f'Sınav Ol: e-Sınav Deneme Sınavı ve {stats["oturum"]} Çıkmış Ehliyet Sınavı | Ürgüp Yıldız Sürücü Kursu',
          f"MEB ehliyet sınavlarında çıkmış {n_live} gerçek soruyla e-Sınav düzeninde deneme sınavı (50 soru, 45 dakika) ve {stats['oturum']} çıkmış sınav. Ürgüp Yıldız Sürücü Kursu.",
          'e-sinav.html', css=('sinav',))
es += nav(False, 'hazirlik')
es += f'''
  <main id="icerik">
    <section class="page-head">
      <img class="ph-img" src="assets/img/esinav.webp" alt="" width="1200" height="675">
      <div class="wrap">
        <ol class="crumbs"><li><a href="index.html">Ana sayfa</a></li><li><a href="hazirlik.html">Sınava Hazırlık</a></li><li>Sınav ol</li></ol>
        <h1>Sınav ol</h1>
        <p>Gerçek e-Sınav düzeninde deneme sınavı ya da MEB'in yayımladığı çıkmış sınavlar. Sınavdan sonra yanlışlarınızı ve tekrar etmeniz gereken konuları görürsünüz.</p>
        <ul class="ph-stats">
          <li><b>50 / 45 dk</b><span>e-Sınav düzeni</span></li>
          <li><b>{n_live}</b><span>güncel soru</span></li>
          <li><b>{stats['oturum']}</b><span>çıkmış sınav</span></li>
        </ul>
      </div>
    </section>

    <nav class="es-tabs" aria-label="Sınav türü">
      <div class="wrap" role="tablist">
        <a class="es-tab" role="tab" href="#deneme" data-tab="deneme" aria-selected="true">{ICON('i-monitor')}Deneme sınavı</a>
        <a class="es-tab" role="tab" href="#cikmis" data-tab="cikmis" aria-selected="false">{ICON('i-cal')}Çıkmış sınavlar</a>
      </div>
    </nav>

    <div class="page-body">
      <div class="wrap">
        <!-- DENEME -->
        <section class="es-panel" id="p-deneme" aria-labelledby="h-deneme">
          <div class="grid-2">
            <div class="card card-pad">
              <h2 class="es-h2" id="h-deneme">Deneme sınavı</h2>
              <p class="es-sub">Sorular, MEB e-Sınavı'ndaki ders dağılımıyla gerçek çıkmış sorular arasından her seferinde yeniden seçilir.</p>
              <div class="mode-pick" role="radiogroup" aria-label="Sınav türü">
                <button class="mode-opt" type="button" role="radio" data-mode="tam" aria-checked="true">{ICON('i-monitor')}<span><b>Tam deneme</b><small>50 soru · 45 dakika · gerçek sınav düzeni</small></span></button>
                <button class="mode-opt" type="button" role="radio" data-mode="mini" aria-checked="false">{ICON('i-bolt')}<span><b>Kısa deneme</b><small>20 soru · 18 dakika · hızlı tekrar</small></span></button>
              </div>
              <div class="dist" id="d-dist"></div>
              <ul class="rules">
                <li>{ICON('i-check')}<span><b id="d-rule-n">50</b> soru, <b id="d-rule-dk">45</b> dakika. Süre bitince sınav otomatik olarak sona erer.</span></li>
                <li>{ICON('i-check')}<span>Her sorunun dört şıkkı vardır; yalnızca biri doğrudur. Yanlışlar doğruları götürmez.</span></li>
                <li>{ICON('i-check')}<span>Başarı için en az 70 puan (<b id="d-rule-pass">35</b> doğru) gerekir.</span></li>
                <li>{ICON('i-check')}<span>Sorular arasında serbestçe gezinebilir, cevabınızı değiştirebilirsiniz. Sınav iki aşamalı onayla bitirilir.</span></li>
              </ul>
              <label class="check-row"><input type="checkbox" id="d-new" checked> Önce daha önce çözmediğim soruları getir</label>
              <button class="btn btn-red btn-lg" type="button" id="d-start">{ICON('i-play')}Sınavı başlat</button>
            </div>
            <div class="side-note">
              <div class="card card-pad">
                <h3>Son sınavlarınız</h3>
                <div id="d-hist"></div>
              </div>
              <div class="card card-pad" style="margin-top:16px">
                <h3>Önce konuları çalışın</h3>
                <p style="margin:0 0 12px">Sınavda zorlandığınız konuların anlatımını okuyup sorularını tek tek çözmek için Sınava Hazırlık bölümüne dönün.</p>
                <a class="btn btn-line btn-sm" href="hazirlik.html#konular">{ICON('i-book')}Konulara git</a>
              </div>
              <div class="card card-pad" style="margin-top:16px">
                <h3>Sorular nereden geliyor?</h3>
                <ul class="src-list">
                  <li>MEB'in 2012–2016 yılları arasında yaptığı Motorlu Taşıt Sürücü Adayları ve Kursiyerleri Sınavı'nın yayımlanmış soru kitapçıkları ve <b>resmî cevap anahtarları</b>.</li>
                  <li>MEB'in e-Sınav deneme sitesinde yayımladığı güncel e-Sınav soruları (bu soruların cevap anahtarı yayımlanmadığı için cevaplar eğitmenlerimizce belirlenmiştir).</li>
                  <li>Mevzuatı değişen sorular deneme sınavına ve konu sorularına alınmaz.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <!-- ÇIKMIŞ SINAVLAR -->
        <section class="es-panel" id="p-cikmis" aria-labelledby="h-cikmis" hidden>
          <div class="card card-pad" style="margin-bottom:24px">
            <h2 class="es-h2" id="h-cikmis">Çıkmış sınavlar</h2>
            <p class="es-sub">MEB'in yayımladığı sınav kitapçıklarını, sorular kitapçıktaki sırasıyla ve sınavın kendi süresiyle çözün. 2016 öncesi “B sertifikası” sınavlarında başarı için her dersten ayrı ayrı 70 puan gerekiyordu; değerlendirme de buna göre yapılır.</p>
          </div>
          <div id="sess-list"></div>
        </section>
      </div>
    </div>
  </main>

  <!-- SINAV EKRANI -->
  <div class="xm" id="xm" hidden role="dialog" aria-modal="true" aria-label="Sınav ekranı">
    <div class="xm-top">
      <svg class="brand-mark" aria-hidden="true" style="width:36px;height:36px"><use href="#brandmark"/></svg>
      <div class="xm-title"><b>Deneme sınavı</b><small></small></div>
      <div class="xm-timer" role="timer" aria-live="off">45:00</div>
      <button class="btn btn-ghost-light" type="button" data-x="ov">{ICON('i-menu')}Sınavım</button>
      <button class="btn btn-red" type="button" data-x="finish">Sınavı bitir</button>
      <button class="btn btn-ghost-light" type="button" data-x="close" hidden>{ICON('i-x')}Kapat</button>
    </div>
    <div class="xm-body"></div>
    <div class="xm-bottom">
      <button class="xm-nav" type="button" data-x="prev" aria-label="Önceki soru">{ICON('i-left')}</button>
      <div class="xm-strip" aria-label="Sorular"></div>
      <button class="xm-nav" type="button" data-x="next" aria-label="Sonraki soru">{ICON('i-right')}</button>
    </div>
    <div class="xm-overview" hidden><div class="xo-in"></div></div>
  </div>
'''
es += DIALOG + footer(False)
es += tail([f"assets/site.js?v={ver('site.js')}", f"assets/kit.js?v={ver('kit.js')}", soru_js, f"assets/data/sorular.js?v={ver('sorular.js')}",
            f"assets/konu.js?v={ver('konu.js')}", f"assets/sinav.js?v={ver('sinav.js')}"])
write('e-sinav.html', es)


# =========================================================
# Eski adresler: konu-anlatimi.html ve trafik-akademisi.html
# =========================================================
def stub(name, title, js_map, fallback, links):
    return f'''<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} | Ürgüp Yıldız Sürücü Kursu</title>
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="https://www.urgupyildizsurucu.com/hazirlik.html">
  <script>
    (function () {{
      var m = {jdump(js_map)}, h = decodeURIComponent(location.hash.slice(1));
      location.replace(m[h] || '{fallback}');
    }})();
  </script>
  <noscript><meta http-equiv="refresh" content="0; url={fallback}"></noscript>
</head>
<body>
  <p>{title} artık <a href="hazirlik.html">Sınava Hazırlık</a> bölümünde.</p>
  <ul>{links}</ul>
</body>
</html>
'''


write('konu-anlatimi.html', stub('konu-anlatimi.html', 'Konu anlatımı', {k: konu_url(k) for k in order}, 'hazirlik.html#konular',
                                 ''.join(f'<li><a href="{konu_url(k)}">{e(titles[k])}</a></li>' for k in order)))
inv = {lid: k for k, lid in APP.items()}
aka_map = {}
for lid, k in inv.items():
    aka_map[lid] = aka_map['ders-' + lid] = aka_map['tab-' + lid] = konu_url(k) + '#uygulama'
write('trafik-akademisi.html', stub('trafik-akademisi.html', 'Trafik Akademisi', aka_map, 'hazirlik.html#ogren',
                                    ''.join(f'<li><a href="{konu_url(k)}#uygulama">{e(app_names[lid])} ({e(titles[k])})</a></li>' for lid, k in inv.items())))

# --- site haritası ---
sm = os.path.join(SITE, 'sitemap.xml')
today = os.environ.get('SITEMAP_DATE')
if today:
    urls = [('', 'weekly', '1.0'), ('hazirlik.html', 'weekly', '0.9'), ('e-sinav.html', 'monthly', '0.8')] + [(konu_url(k), 'monthly', '0.7') for k in order]
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
        f'  <url>\n    <loc>https://www.urgupyildizsurucu.com/{u}</loc>\n    <lastmod>{today}</lastmod>\n    <changefreq>{c}</changefreq>\n    <priority>{p}</priority>\n  </url>\n' for u, c, p in urls) + '</urlset>\n'
    open(sm, 'w', encoding='utf-8').write(xml)
print('ok', len(order), 'konu sayfası', len(hz), len(es))
