"""e-sinav.html, konu-anlatimi.html ve trafik-akademisi.html sayfalarını ve konular.js verisini üretir.
Kullanım: python3 build_pages.py <scratchpad> <site_dizini>
Varlık sürümleri (?v=) <scratchpad>/versions.json'dan, yoksa bu dizindeki versions.json'dan okunur.
"""
import html, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from partials import nav, footer, quickbar, FONTS

SP, SITE = sys.argv[1], sys.argv[2]
_vp = next((x for x in (os.path.join(SP, 'versions.json'), os.path.join(os.path.dirname(__file__), 'versions.json')) if os.path.exists(x)), None)
V = json.load(open(_vp)) if _vp else {}
ver = lambda k: V.get(k, 1)
index = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
sprite = re.search(r'  <svg class="sprite" aria-hidden="true" focusable="false">.*?\n  </svg>\n', index, re.S).group(0)

src = open(os.path.join(SITE, 'assets', 'data', 'sorular.js'), encoding='utf-8').read()
DATA = json.loads(src[src.index('=') + 1:].rstrip().rstrip(';'))
titles = DATA['konular']
stats = DATA['stats']
live = [q for q in DATA['sorular'] if 'old' not in q]
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

konular = {}
for k in titles:
    p = os.path.join(SP, 'konu_out', f'{k}.json')
    if os.path.exists(p):
        konular[k] = json.load(open(p))
    else:
        konular[k] = {'id': k, 'ozet': '', 'sik': [], 'anahtar': [], 'html': '<p>Bu konunun anlatımı hazırlanıyor.</p>'}
        print('UYARI: konu yok', k)

# --- konular.js (çekmece için) ---
kj = {k: {'t': titles[k], 'd': k.split('-')[0], 'ozet': v.get('ozet', ''), 'sik': v.get('sik', []), 'html': v.get('html', '')} for k, v in konular.items()}
open(os.path.join(SITE, 'assets', 'data', 'konular.js'), 'w', encoding='utf-8').write(
    '/* Ürgüp Yıldız Sürücü Kursu — konu anlatımları (otomatik üretildi: tools/build_pages.py) */\nwindow.YildizKonular = ' +
    json.dumps(kj, ensure_ascii=False, separators=(',', ':')) + ';\n')

count = {k: sum(1 for q in live if q['k'] == k) for k in titles}
dcount = {d: sum(1 for q in live if q['d'] == d) for d in DORDER}


def head(title, desc, canonical, sinav=True):
    css_sinav = f'''  <link rel="stylesheet" href="assets/sinav.css?v={ver('sinav.css')}">\n''' if sinav else ''
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
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://www.urgupyildizsurucu.com/{canonical}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="tr_TR">
  <meta property="og:site_name" content="Ürgüp Yıldız Sürücü Kursu">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="https://www.urgupyildizsurucu.com/{canonical}">
  <meta property="og:image" content="https://www.urgupyildizsurucu.com/assets/og.jpg?v={ver('og')}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="assets/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  {FONTS}
  <link rel="stylesheet" href="assets/site.css?v={ver('site.css')}">
  <link rel="stylesheet" href="assets/kurumsal.css?v={ver('kurumsal.css')}">
{css_sinav}</head>
<body>
  <a class="skip" href="#icerik">İçeriğe geç</a>
{sprite}
'''


def tail(scripts):
    s = '\n'.join(f'  <script src="{x}" defer></script>' for x in scripts)
    return f'''
  <!-- Mobil hızlı erişim -->
{quickbar(False)}
{s}
</body>
</html>
'''


# =========================================================
# e-sinav.html
# =========================================================
n_live = fmt(stats['guncel'])
esinav = head(f'e-Sınav Merkezi: {n_live} Çıkmış Ehliyet Sorusu, Deneme Sınavı | Ürgüp Yıldız Sürücü Kursu',
              f"MEB ehliyet sınavlarında çıkmış {n_live} gerçek soru: e-Sınav düzeninde deneme sınavı, konu konu çalışma modu, çıkmış sınavlar ve konu anlatımı. Ürgüp Yıldız Sürücü Kursu.",
              'e-sinav.html')
esinav += nav(False, 'sinav')
esinav += f'''
  <main id="icerik">
    <section class="page-head">
      <img class="ph-img" src="assets/img/esinav.webp" alt="" width="1200" height="675">
      <div class="wrap">
        <ol class="crumbs"><li><a href="index.html">Ana sayfa</a></li><li>e-Sınav Merkezi</li></ol>
        <h1>e-Sınav Merkezi</h1>
        <p>MEB'in 2012–2016 yıllarında yaptığı {stats['oturum']} sınavın kitapçıklarından derlenen gerçek sorular ve güncel e-Sınav örnekleri; resmî cevap anahtarı, açıklamalar ve konu anlatımıyla.</p>
        <ul class="ph-stats">
          <li><b>{n_live}</b><span>güncel soru</span></li>
          <li><b>{stats['oturum']}</b><span>çıkmış sınav</span></li>
          <li><b>{stats['konu']}</b><span>konu anlatımı</span></li>
          <li><b>50 / 45 dk</b><span>e-Sınav düzeni</span></li>
        </ul>
      </div>
    </section>

    <nav class="es-tabs" aria-label="e-Sınav Merkezi bölümleri">
      <div class="wrap" role="tablist">
        <a class="es-tab" role="tab" href="#deneme" data-tab="deneme" aria-selected="true"><svg class="ic"><use href="#i-monitor"/></svg>Deneme sınavı</a>
        <a class="es-tab" role="tab" href="#calis" data-tab="calis" aria-selected="false"><svg class="ic"><use href="#i-book"/></svg>Çalışma modu</a>
        <a class="es-tab" role="tab" href="#cikmis" data-tab="cikmis" aria-selected="false"><svg class="ic"><use href="#i-cal"/></svg>Çıkmış sınavlar</a>
        <a class="es-tab" role="tab" href="#gelisim" data-tab="gelisim" aria-selected="false"><svg class="ic"><use href="#i-gauge"/></svg>Gelişimim</a>
        <a class="es-tab" href="konu-anlatimi.html"><svg class="ic"><use href="#i-out"/></svg>Konu anlatımı</a>
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
                <button class="mode-opt" type="button" role="radio" data-mode="tam" aria-checked="true"><svg class="ic"><use href="#i-monitor"/></svg><span><b>Tam deneme</b><small>50 soru · 45 dakika · gerçek sınav düzeni</small></span></button>
                <button class="mode-opt" type="button" role="radio" data-mode="mini" aria-checked="false"><svg class="ic"><use href="#i-bolt"/></svg><span><b>Kısa deneme</b><small>20 soru · 18 dakika · hızlı tekrar</small></span></button>
              </div>
              <div class="dist" id="d-dist"></div>
              <ul class="rules">
                <li><svg class="ic"><use href="#i-check"/></svg><span><b id="d-rule-n">50</b> soru, <b id="d-rule-dk">45</b> dakika. Süre bitince sınav otomatik olarak sona erer.</span></li>
                <li><svg class="ic"><use href="#i-check"/></svg><span>Her sorunun dört şıkkı vardır; yalnızca biri doğrudur. Yanlışlar doğruları götürmez.</span></li>
                <li><svg class="ic"><use href="#i-check"/></svg><span>Başarı için en az 70 puan (<b id="d-rule-pass">35</b> doğru) gerekir.</span></li>
                <li><svg class="ic"><use href="#i-check"/></svg><span>Sorular arasında serbestçe gezinebilir, cevabınızı değiştirebilirsiniz. Sınav iki aşamalı onayla bitirilir.</span></li>
              </ul>
              <label class="check-row"><input type="checkbox" id="d-new" checked> Önce daha önce çözmediğim soruları getir</label>
              <button class="btn btn-red btn-lg" type="button" id="d-start"><svg class="ic"><use href="#i-play"/></svg>Sınavı başlat</button>
            </div>
            <div class="side-note">
              <div class="card card-pad">
                <h3>Son sınavlarınız</h3>
                <div id="d-hist"></div>
              </div>
              <div class="card card-pad" style="margin-top:16px">
                <h3>Sorular nereden geliyor?</h3>
                <ul class="src-list">
                  <li>MEB'in 2012–2016 yılları arasında yaptığı Motorlu Taşıt Sürücü Adayları ve Kursiyerleri Sınavı'nın yayımlanmış soru kitapçıkları ve <b>resmî cevap anahtarları</b>.</li>
                  <li>MEB'in e-Sınav deneme sitesinde yayımladığı güncel e-Sınav soruları (bu soruların cevap anahtarı yayımlanmadığı için cevaplar eğitmenlerimizce belirlenmiştir).</li>
                  <li>Mevzuatı değişen sorular deneme sınavına ve çalışma moduna alınmaz.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <!-- ÇALIŞMA MODU -->
        <section class="es-panel" id="p-calis" aria-labelledby="h-calis" hidden>
          <div id="study-setup" class="study-setup">
            <div class="card">
              <div class="card-pad" style="padding-bottom:8px">
                <h2 class="es-h2" id="h-calis">Çalışma modu</h2>
                <p class="es-sub">Ders veya konu seçin; her soruda cevabınızın doğru olup olmadığını, açıklamasını ve sorunun çıktığı sınavı hemen görün. Konu anlatımını açmak için <svg class="ic" style="vertical-align:-.15em"><use href="#i-book"/></svg> simgesine dokunun.</p>
              </div>
              <div id="subj-list"></div>
            </div>
            <aside class="card card-pad study-opts" aria-label="Çalışma seçenekleri">
              <div class="opt-group"><p>Sorular</p><div class="seg" id="s-filter" role="group" aria-label="Soru filtresi">
                <button type="button" data-v="all" aria-pressed="true">Tümü</button><button type="button" data-v="new" aria-pressed="false">Çözmediklerim</button><button type="button" data-v="wrong" aria-pressed="false">Yanlışlarım</button><button type="button" data-v="mark" aria-pressed="false">İşaretlediklerim</button></div></div>
              <div class="opt-group"><p>Sıralama</p><div class="seg" id="s-order" role="group" aria-label="Sıralama">
                <button type="button" data-v="mix" aria-pressed="true">Karışık</button><button type="button" data-v="freq" aria-pressed="false">Sık çıkanlar önce</button></div></div>
              <p class="sel-count" id="sel-count"></p>
              <button class="btn btn-red btn-block" type="button" id="s-start"><svg class="ic"><use href="#i-play"/></svg>Çalışmaya başla</button>
              <div class="q-actions" style="margin-top:12px"><button class="btn btn-line btn-sm" type="button" id="s-clear">Seçimi temizle</button><button class="btn btn-line btn-sm" type="button" id="s-wrong"><svg class="ic"><use href="#i-refresh"/></svg>Yanlışlarımı çöz</button></div>
            </aside>
          </div>
          <div id="study-run" hidden></div>
        </section>

        <!-- ÇIKMIŞ SINAVLAR -->
        <section class="es-panel" id="p-cikmis" aria-labelledby="h-cikmis" hidden>
          <div class="card card-pad" style="margin-bottom:24px">
            <h2 class="es-h2" id="h-cikmis">Çıkmış sınavlar</h2>
            <p class="es-sub">MEB'in yayımladığı sınav kitapçıklarını, sorular kitapçıktaki sırasıyla ve sınavın kendi süresiyle çözün. 2016 öncesi “B sertifikası” sınavlarında başarı için her dersten ayrı ayrı 70 puan gerekiyordu; değerlendirme de buna göre yapılır.</p>
          </div>
          <div id="sess-list"></div>
        </section>

        <!-- GELİŞİM -->
        <section class="es-panel" id="p-gelisim" aria-labelledby="h-gelisim" hidden>
          <h2 class="es-h2" id="h-gelisim" style="margin-bottom:16px">Gelişimim</h2>
          <div class="kpis" id="g-kpis"></div>
          <div class="grid-2">
            <div class="card card-pad"><h3 class="es-h2" style="font-size:19px">Derslere göre son durum</h3><p class="es-sub" style="font-size:14px;margin-bottom:16px">Çözdüğünüz soruların son denemesinde doğru cevapladıklarınızın oranı.</p><div class="subj-bars" id="g-subj"></div><div style="margin-top:18px" id="g-wrong"></div></div>
            <div class="card card-pad"><h3 class="es-h2" style="font-size:19px">Güçlendirmeniz gereken konular</h3><div id="g-weak"></div></div>
          </div>
          <div class="card card-pad" style="margin-top:24px"><h3 class="es-h2" style="font-size:19px">Sınav geçmişi</h3><div id="g-hist"></div>
            <div class="q-actions"><span class="spacer"></span><button class="btn btn-line btn-sm" type="button" id="g-reset"><svg class="ic"><use href="#i-x"/></svg>İlerlemeyi sıfırla</button></div></div>
          <p class="footnote">İlerlemeniz yalnızca bu cihazdaki tarayıcıda saklanır; hiçbir sunucuya gönderilmez.</p>
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
      <button class="btn btn-ghost-light" type="button" data-x="ov"><svg class="ic"><use href="#i-menu"/></svg>Sınavım</button>
      <button class="btn btn-red" type="button" data-x="finish">Sınavı bitir</button>
      <button class="btn btn-ghost-light" type="button" data-x="close" hidden><svg class="ic"><use href="#i-x"/></svg>Kapat</button>
    </div>
    <div class="xm-body"></div>
    <div class="xm-bottom">
      <button class="xm-nav" type="button" data-x="prev" aria-label="Önceki soru"><svg class="ic"><use href="#i-left"/></svg></button>
      <div class="xm-strip" aria-label="Sorular"></div>
      <button class="xm-nav" type="button" data-x="next" aria-label="Sonraki soru"><svg class="ic"><use href="#i-right"/></svg></button>
    </div>
    <div class="xm-overview" hidden><div class="xo-in"></div></div>
  </div>
  <div class="dlg" id="dlg" hidden><div class="dlg-box" role="alertdialog" aria-modal="true"><h3></h3><p></p><div class="dlg-actions"><button class="btn btn-line" type="button" data-cancel>Vazgeç</button><button class="btn btn-navy" type="button" data-ok>Tamam</button></div></div></div>
'''
esinav += footer(False)
esinav += tail([f"assets/site.js?v={ver('site.js')}", f"assets/kit.js?v={ver('kit.js')}", f"assets/data/sorular.js?v={ver('sorular.js')}",
                f"assets/konu.js?v={ver('konu.js')}", f"assets/sinav.js?v={ver('sinav.js')}"])
open(os.path.join(SITE, 'e-sinav.html'), 'w', encoding='utf-8').write(esinav)


# =========================================================
# konu-anlatimi.html
# =========================================================
L = 'ABCD'
ITEM = re.compile(r'^((I{1,3}|IV|V|VI{1,3})\s*[-.)]|[1-9]\s*[-.)]|•)')


def stem_html(q):
    lines = [l.strip() for l in q['q'].split('\n') if l.strip()]
    any_item = any(ITEM.match(l) for l in lines)
    out = []
    for i, l in enumerate(lines):
        item = bool(ITEM.match(l))
        ask = any_item and not item and i == len(lines) - 1
        out.append(f'<p class="{"q-item" if item else "q-ask" if ask else ""}">{e(l)}</p>')
    if q.get('g'):
        out.append(f'<figure class="q-fig"><img src="assets/q/{q["g"]}" alt="Sorunun şekli" loading="lazy"></figure>')
    return '<div class="q-stem">' + ''.join(out) + '</div>'


SESS = {o['c']: o for o in DATA['oturumlar']}


def src_text(q):
    if q.get('es'):
        return 'MEB e-Sınav örnek sorusu'
    o = SESS.get(q['src'][0])
    first = f"{o['tarih']} · {o['tur']}" if o else q['src'][0]
    return f"{first} · toplam {len(q['src'])} sınavda çıktı" if len(q['src']) > 1 else first


def examples(k):
    qs = sorted([q for q in live if q['k'] == k and not q.get('og') and not q.get('es')], key=lambda q: -len(q['src']))[:4]
    if not qs:
        return ''
    cards = []
    for q in qs:
        opts = ''.join(f'<button class="opt" type="button" data-i="{i}"><span class="L">{L[i]}</span><span>{e(o)}</span></button>' for i, o in enumerate(q['o']))
        cards.append(f'<div class="card qcard" data-a="{q["a"]}">{stem_html(q)}<div class="opts">{opts}</div>'
                     f'<div class="feedback" hidden><p class="fb-h"></p><p>{e(q.get("e", ""))}</p><div class="fb-meta"><span><svg class="ic"><use href="#i-cal"/></svg>{e(src_text(q))}</span></div></div></div>')
    return ('<section class="kn-examples"><h3>Bu konudan çıkmış sorular</h3><p>MEB sınavlarında sorulmuş örnekler. Bir şık seçerek kendinizi deneyin.</p>'
            '<div class="rev-list">' + ''.join(cards) + '</div></section>')


order = [k for d in DORDER for k in titles if k.startswith(d + '-')]
side = []
for d in DORDER:
    ks = [k for k in order if k.startswith(d + '-')]
    side.append(f'<h3 data-d="{d}">{DERS[d]}</h3><ul>' + ''.join(
        f'<li data-search="{e(titles[k] + " " + " ".join(konular[k].get("anahtar", [])))}"><a href="#{k}" data-konu="{k}">{e(titles[k])}<small>{count[k]}</small></a></li>' for k in ks) + '</ul>')

ov = []
for d in DORDER:
    ks = [k for k in order if k.startswith(d + '-')]
    ov.append(f'''<section class="subj-sec" data-d="{d}">
          <div class="subj-card"><img src="assets/img/subj-{d}.webp" width="800" height="600" alt="" loading="lazy"><div><span class="chip-d" data-d="{d}">{len(ks)} konu · {dcount[d]} soru</span><h2>{DERS[d]}</h2><p>{DERS_TXT[d]}</p></div></div>
          <div class="topic-cards">''' + ''.join(
        f'<a class="topic-card" href="#{k}" data-d="{d}"><b>{e(titles[k])}</b><span>{e(konular[k].get("ozet", ""))}</span><small>{count[k]} çıkmış soru →</small></a>' for k in ks) + '</div></section>')

arts = []
for i, k in enumerate(order):
    d = k.split('-')[0]
    v = konular[k]
    prev_k = order[i - 1] if i else None
    next_k = order[i + 1] if i + 1 < len(order) else None
    sik = ''.join(f'<li>{e(x)}</li>' for x in v.get('sik', []))
    pager = (f'<a class="prev" href="#{prev_k}"><small>← Önceki konu</small>{e(titles[prev_k])}</a>' if prev_k else '<span></span>') + \
            (f'<a class="next" href="#{next_k}"><small>Sonraki konu →</small>{e(titles[next_k])}</a>' if next_k else '')
    arts.append(f'''<article data-konu="{k}" id="konu-{k}" hidden>
          <div class="kn-hero"><div><span class="chip-d" data-d="{d}">{DERS[d]}</span><h2>{e(titles[k])}</h2><div class="kn-meta"><span>Bu konudan {count[k]} çıkmış soru</span></div></div><img src="assets/img/subj-{d}.webp" width="800" height="600" alt="" loading="lazy"></div>
          {f'<p class="kn-lead">{e(v["ozet"])}</p>' if v.get('ozet') else ''}
          {f'<div class="kn-sum"><h3><svg class="ic"><use href="#i-check"/></svg>Akılda kalsın</h3><ul>{sik}</ul></div>' if sik else ''}
          <div class="kn-article">{v.get('html', '')}</div>
          <div class="kn-cta"><p><b>Bu konudan {count[k]} gerçek soru</b><br>Çalışma modunda her sorunun açıklamasıyla birlikte çözün.</p><a class="btn btn-light" href="e-sinav.html#calis={k}"><svg class="ic"><use href="#i-play"/></svg>Soruları çöz</a></div>
          {examples(k)}
          <nav class="kn-pager" aria-label="Konular arası geçiş">{pager}</nav>
        </article>''')

konu = head('Konu Anlatımı: Ehliyet Sınavı Dersleri | Ürgüp Yıldız Sürücü Kursu',
            f"Ehliyet e-Sınavı için {stats['konu']} başlıkta konu anlatımı: İlk Yardım, Trafik ve Çevre, Araç Tekniği ve Trafik Adabı. Her konuda çıkmış sorular ve açıklamalar.",
            'konu-anlatimi.html')
konu += nav(False, 'konu')
konu += f'''
  <main id="icerik">
    <section class="page-head">
      <img class="ph-img" src="assets/img/konu.webp" alt="" width="1200" height="675">
      <div class="wrap">
        <ol class="crumbs"><li><a href="index.html">Ana sayfa</a></li><li><a href="e-sinav.html">e-Sınav Merkezi</a></li><li>Konu anlatımı</li></ol>
        <h1>Konu anlatımı</h1>
        <p>e-Sınav'ın dört dersi {stats['konu']} başlıkta. Her konu, MEB sınavlarında gerçekten sorulan bilgilere göre hazırlandı; konunun çıkmış sorularını hemen çözebilirsiniz.</p>
      </div>
    </section>
    <div class="page-body" id="kn-page">
      <div class="wrap kn-layout">
        <aside class="kn-side card" aria-label="Konular">
          <input class="kn-search" id="kn-search" type="search" placeholder="Konu ara (ör. kanama, sollama, akü)" aria-label="Konu ara">
          <button class="btn btn-line btn-sm btn-block only-mobile" type="button" id="kn-nav-toggle" aria-expanded="false"><svg class="ic"><use href="#i-menu"/></svg>Tüm konular</button>
          <nav class="kn-nav"><h3><a href="#" style="padding:0;color:inherit">Genel bakış</a></h3>{''.join(side)}</nav>
        </aside>
        <div class="kn-main">
          <div class="kn-overview" id="kn-overview">
            {''.join(ov)}
          </div>
          {''.join(arts)}
        </div>
      </div>
    </div>
  </main>
'''
konu += footer(False)
konu += tail([f"assets/site.js?v={ver('site.js')}", f"assets/kit.js?v={ver('kit.js')}", f"assets/konu.js?v={ver('konu.js')}"])
open(os.path.join(SITE, 'konu-anlatimi.html'), 'w', encoding='utf-8').write(konu)


# =========================================================
# trafik-akademisi.html: gövde sayfanın kendisinden alınır; baş, menü, alt bilgi ve betikler yenilenir
# =========================================================
ap = os.path.join(SITE, 'trafik-akademisi.html')
body = re.search(r'\n  <main id="icerik">.*?\n  </main>\n', open(ap, encoding='utf-8').read(), re.S).group(0)
aka = head("Trafik Akademisi: 10 Etkileşimli Trafik Dersi | Ürgüp Yıldız Sürücü Kursu",
           "Trafik kurallarını uygulayarak öğrenin: 3B sürüş, kavşak ve park senaryoları, levhalar, ayna görüntüsü, gösterge ışıkları ve ilk yardım ritmiyle 10 etkileşimli ders. Ürgüp Yıldız Sürücü Kursu.",
           'trafik-akademisi.html', sinav=False)
aka += nav(False, 'aka') + body + footer(False)
aka += tail([f"assets/site.js?v={ver('site.js')}", f"assets/kit.js?v={ver('kit.js')}"] +
            [f"assets/{x}.js?v={ver('academy')}" for x in ('academy-gfx', 'academy-3d', 'academy-top', 'academy')])
open(ap, 'w', encoding='utf-8').write(aka)
print('ok', len(esinav), len(konu), len(aka))
