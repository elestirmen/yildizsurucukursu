# Ortak üst/alt bölüm parçaları (ana sayfa ve alt sayfalar)
WA_URL = "https://wa.me/905324527722?text=Merhaba%2C%20ehliyet%20kursu%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum."

def nav(home, active=''):
    h = '' if home else 'index.html'
    def a(href, label, key):
        cur = ' aria-current="page"' if key == active else ''
        return f'        <a href="{href}"{cur}>{label}</a>\n'
    links = (a(f'{h}#hakkimizda', 'Hakkımızda', 'hak') + a(f'{h}#kurslar', 'Kurslar', 'kurs') +
             a('e-sinav.html', 'e-Sınav', 'sinav') + a('konu-anlatimi.html', 'Konu Anlatımı', 'konu') +
             a('trafik-akademisi.html', 'Trafik Akademisi', 'aka') + a(f'{h}#sss', 'SSS', 'sss') + a(f'{h}#iletisim', 'İletişim', 'ilet'))
    return f'''  <header class="nav" id="nav">
    <div class="nav-inner">
      <a class="brand" href="{h or '#top'}" aria-label="Ürgüp Yıldız Sürücü Kursu, ana sayfa">
        <svg class="brand-mark" aria-hidden="true"><use href="#brandmark"/></svg>
        <span class="brand-text"><b>YILDIZ</b><small>ÜRGÜP SÜRÜCÜ KURSU</small></span>
      </a>
      <nav class="nav-links" id="menu" aria-label="Ana menü">
{links}        <div class="menu-extra">
          <a class="btn btn-red" href="tel:+903843413673"><svg class="ic"><use href="#i-phone"/></svg>0384 341 36 73</a>
          <a class="btn btn-line" href="{WA_URL}" target="_blank" rel="noopener"><svg class="ic"><use href="#i-wa"/></svg>WhatsApp</a>
        </div>
      </nav>
      <div class="nav-cta">
        <button class="theme-toggle" type="button" aria-label="Karanlık temaya geç" aria-pressed="false" title="Tema değiştir">
          <svg class="ic t-sun"><use href="#i-sun"/></svg><svg class="ic t-moon"><use href="#i-moon"/></svg>
        </button>
        <a class="btn btn-red btn-sm" href="{h}#iletisim" data-kayit>Ön Kayıt</a>
        <button class="burger" type="button" aria-label="Menüyü aç" aria-expanded="false" aria-controls="menu">
          <svg class="ic ic-open"><use href="#i-menu"/></svg><svg class="ic ic-close"><use href="#i-x"/></svg>
        </button>
      </div>
    </div>
  </header>
'''

def footer(home):
    h = '' if home else 'index.html'
    return f'''  <footer class="footer">
    <div class="wrap">
      <div class="foot-grid">
        <div class="foot-brand">
          <a class="brand" href="{h or '#top'}"><svg class="brand-mark"><use href="#brandmark"/></svg><span class="brand-text"><b>YILDIZ</b><small>ÜRGÜP SÜRÜCÜ KURSU</small></span></a>
          <p>Özel Ürgüp Yıldız Motorlu Taşıtlar Sürücü Kursu — T.C. Millî Eğitim Bakanlığı'na bağlı özel kurum. 35 yıldır Ürgüp'te.</p>
          <p class="foot-meta">Kurs Müdürü: Mustafa AYAZ</p>
          <div class="socials">
            <a href="https://www.instagram.com/urgup_yildiz_surucu_kursu/" target="_blank" rel="noopener" aria-label="Instagram"><svg class="ic"><use href="#i-insta"/></svg></a>
            <a href="https://wa.me/905324527722" target="_blank" rel="noopener" aria-label="WhatsApp"><svg class="ic"><use href="#i-wa"/></svg></a>
            <a href="mailto:yildizmtsk50@hotmail.com" aria-label="E-posta"><svg class="ic"><use href="#i-mail"/></svg></a>
          </div>
        </div>
        <div>
          <h4>Kurumsal</h4>
          <ul>
            <li><a href="{h}#hakkimizda">Hakkımızda</a></li>
            <li><a href="{h}#kurslar">Kurslar</a></li>
            <li><a href="{h}#surec">Ehliyet süreci</a></li>
            <li><a href="{h}#belgeler">Gerekli belgeler</a></li>
            <li><a href="{h}#sss">Sıkça sorulanlar</a></li>
          </ul>
        </div>
        <div>
          <h4>e-Sınav Merkezi</h4>
          <ul>
            <li><a href="e-sinav.html#deneme">Deneme sınavı</a></li>
            <li><a href="e-sinav.html#calis">Çalışma modu</a></li>
            <li><a href="e-sinav.html#cikmis">Çıkmış sınavlar</a></li>
            <li><a href="konu-anlatimi.html">Konu anlatımı</a></li>
            <li><a href="trafik-akademisi.html">Trafik Akademisi</a></li>
            <li><a href="{h}#yas">Yaş hesaplayıcı</a></li>
          </ul>
        </div>
        <div>
          <h4>İletişim</h4>
          <ul class="foot-contact">
            <li><a href="tel:+903843413673">0384 341 36 73</a></li>
            <li><a href="https://wa.me/905324527722" target="_blank" rel="noopener">0532 452 77 22</a></li>
            <li><a href="mailto:yildizmtsk50@hotmail.com">yildizmtsk50@hotmail.com</a></li>
            <li>Güllüce 1 Sk. No:8/1, Ürgüp</li>
            <li>Pzt – Cmt · 08:30 – 17:30</li>
          </ul>
        </div>
      </div>
      <div class="foot-bottom">
        <p>© <span id="year">2026</span> Ürgüp Yıldız Sürücü Kursu. Tüm hakları saklıdır.</p>
        <p class="legal">Mevzuat bilgileri MEB Özel Motorlu Taşıt Sürücüleri Kursu Yönetmeliği ve 2026 MTSK e-Sınav Kılavuzu esas alınarak hazırlanmıştır. e-Sınav Merkezi'ndeki sorular MEB'in 2012–2016 yıllarında yayımladığı sınav kitapçıklarından ve resmî cevap anahtarlarından alınmıştır; açıklamalar ve konu anlatımları kursumuza aittir. Sitemiz çerez kullanmaz; çalışma ilerlemeniz yalnızca bu cihazda saklanır.</p>
        <a class="to-top" href="#top">Yukarı <svg class="ic"><use href="#i-arrow"/></svg></a>
      </div>
    </div>
  </footer>
'''

def quickbar(home):
    h = '' if home else 'index.html'
    return f'''  <div class="quickbar" aria-label="Hızlı iletişim">
    <a href="tel:+903843413673"><svg class="ic"><use href="#i-phone"/></svg>Ara</a>
    <a class="qb-wa" href="{WA_URL}" target="_blank" rel="noopener"><svg class="ic"><use href="#i-wa"/></svg>WhatsApp</a>
    <a class="qb-red" href="{h}#iletisim" data-kayit><svg class="ic"><use href="#i-send"/></svg>Ön Kayıt</a>
  </div>
'''

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap">'
