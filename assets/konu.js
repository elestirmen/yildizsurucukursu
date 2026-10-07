/* Ürgüp Yıldız Sürücü Kursu — Konu anlatımı: kit çizimleri (levha, ikaz lambası, ilk yardım) ve sınav sayfasındaki konu çekmecesi */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const DERS = { iy: 'İlk Yardım', tc: 'Trafik ve Çevre', at: 'Araç Tekniği', ta: 'Trafik Adabı' };
  const FA = { cpr: 'Kalp masajında ellerin yeri', koma: 'Koma (yarı yüzükoyun yan) pozisyonu', sok: 'Şok pozisyonu', basgeri: 'Baş geri – çene yukarı', heimlich: 'Heimlich manevrası', burun: 'Burun kanamasında ilk yardım', yanik: 'Yanığı su ile soğutma', tel112: '112 Acil Çağrı' };
  // İlk yardım uygulamaları fotoğrafla gösterilir (çizimler anlaşılmıyordu); 112 simgesi çizim olarak kalır.
  // 0: gösterilmez (yanık soğutma, konu sayfasının başlık fotoğrafında zaten var).
  const FA_PHOTO = {
    basgeri: 'Bir el alında, diğer elin parmak uçları çenenin altında; baş geriye eğilerek hava yolu açılıyor',
    burun: 'Burnu kanayan genç, başını hafifçe öne eğmiş, burnunun yumuşak kısmını sıkıyor',
    cpr: 'Eğitim mankeninde göğüs ortasına yerleştirilmiş, parmakları kenetli eller ve dik inen kollar',
    heimlich: 'Arkasından sarılan kişi yumruğunu boğulan kişinin göbeğinin hemen üstüne yerleştirmiş',
    koma: 'Yan yatırılmış bilinçsiz kişi: üstteki el yanağın altında, üstteki diz bükülü, ağız yere doğru',
    sok: 'Sırtüstü yatan kişinin bacakları çantanın üstünde yükseltilmiş, üzeri battaniyeyle örtülü',
    yanik: 0
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

  /* ---------- kit.js çizimleri (levha, ikaz lambası, ilk yardım) ---------- */
  function renderKit(root) {
    const KIT = window.YildizKit;
    if (!KIT) return;
    $$('.kn-vis[data-kit]', root).forEach((el) => {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      el.innerHTML = el.dataset.kit.trim().split(/\s+/).map((key) => {
        const [t, id] = key.split(':');
        if (t === 'fa' && FA_PHOTO[id] === 0) return '';
        if (t === 'fa' && FA_PHOTO[id]) return `<figure class="kn-photo"><img src="assets/img/ilkyardim/${id}.webp" width="800" height="600" alt="${esc(FA_PHOTO[id])}" loading="lazy"><figcaption>${esc(FA[id])}</figcaption></figure>`;
        let svg = '', name = '', cls = '';
        if (t === 'sign' && KIT.SIGNS[id]) { svg = KIT.sign(id); name = KIT.SIGNS[id].name; }
        else if (t === 'lamp' && KIT.LAMPS && KIT.LAMPS[id]) { svg = KIT.lamp(id); name = KIT.LAMPS[id].name; cls = 'kn-lamp'; }
        else if (t === 'fa' && FA[id]) { svg = KIT.fa(id); name = FA[id]; }
        if (!svg) return '';
        return `<figure class="${cls}"><div role="img" aria-label="${esc(name)}">${svg}</div><figcaption>${esc(name)}</figcaption></figure>`;
      }).join('');
      el.hidden = !el.innerHTML;
    });
  }

  /* ---------- konu verisini yükle ---------- */
  let loading = null;
  function load() {
    if (window.YildizKonular) return Promise.resolve(window.YildizKonular);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      const v = (document.querySelector('script[src*="konu.js"]') || {}).src || '';
      s.src = 'assets/data/konular.js' + (v.includes('?') ? v.slice(v.indexOf('?')) : '');
      s.onload = () => res(window.YildizKonular);
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return loading;
  }

  function articleHTML(k, id) {
    return `${k.ozet ? `<p class="kn-lead">${esc(k.ozet)}</p>` : ''}` +
      (k.sik && k.sik.length ? `<div class="kn-sum"><h3>${ICON('i-check')}Akılda kalsın</h3><ul>${k.sik.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '') +
      `<div class="kn-article">${k.html || ''}</div>`;
  }

  /* ---------- çekmece ---------- */
  let lastFocus = null;
  function drawerEl() {
    let d = $('#konu-drawer');
    if (d) return d;
    d = document.createElement('div');
    d.className = 'drawer'; d.id = 'konu-drawer'; d.hidden = true;
    d.innerHTML = `<div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="dr-title">
      <div class="drawer-head"><div><span class="chip-d" data-dr-chip></span><h2 id="dr-title">Konu anlatımı</h2></div>
        <button class="drawer-close" type="button" aria-label="Kapat">${ICON('i-x')}</button></div>
      <div class="drawer-body" tabindex="0"></div>
      <div class="drawer-foot"></div></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.drawer-close')) closeDrawer(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !d.hidden) { e.stopPropagation(); closeDrawer(); } }, true);
    return d;
  }
  function closeDrawer() {
    const d = $('#konu-drawer');
    if (!d || d.hidden) return;
    d.hidden = true;
    document.documentElement.classList.remove('drawer-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  async function openDrawer(id, opts = {}) {
    const d = drawerEl();
    lastFocus = document.activeElement;
    const body = $('.drawer-body', d);
    body.innerHTML = '<p class="es-sub">Konu anlatımı yükleniyor…</p>';
    d.hidden = false;
    document.documentElement.classList.add('drawer-open');
    let data;
    try { data = await load(); } catch (e) { body.innerHTML = '<p>Konu anlatımı yüklenemedi. Lütfen bağlantınızı kontrol edin.</p>'; return; }
    const k = data[id];
    if (!k) { body.innerHTML = '<p>Bu konu için anlatım bulunamadı.</p>'; return; }
    const chip = $('[data-dr-chip]', d);
    chip.textContent = DERS[k.d] || ''; chip.dataset.d = k.d;
    $('#dr-title', d).textContent = k.t;
    body.innerHTML = articleHTML(k, id);
    body.scrollTop = 0;
    renderKit(body);
    const foot = $('.drawer-foot', d);
    foot.innerHTML = `<a class="btn btn-line" href="konu-${id}.html">${ICON('i-book')}Konu sayfasına git</a>` +
      `<a class="btn btn-red" href="konu-${id}.html#sorular">${ICON('i-check')}Bu konunun sorularını çöz</a>`;
    $('.drawer-close', d).focus();
  }

  window.YildizKonu = { renderKit, load, openDrawer, closeDrawer, DERS };

  /* Konu sayfaları: levha, ikaz lambası ve ilk yardım çizimleri */
  if (document.getElementById('kp-page')) renderKit(document);
})();
