/* Ürgüp Yıldız Sürücü Kursu — Konu anlatımı: ortak çizim/çekmece yardımcıları ve konu sayfası */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const DERS = { iy: 'İlk Yardım', tc: 'Trafik ve Çevre', at: 'Araç Tekniği', ta: 'Trafik Adabı' };
  const FA = { cpr: 'Kalp masajı', koma: 'Koma (yarı yüzükoyun yan) pozisyonu', sok: 'Şok pozisyonu', basgeri: 'Baş geri – çene yukarı', heimlich: 'Heimlich manevrası', burun: 'Burun kanamasında ilk yardım', yanik: 'Yanığı su ile soğutma', tel112: '112 Acil Çağrı' };
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
        let svg = '', name = '', cls = '';
        if (t === 'sign' && KIT.SIGNS[id]) { svg = KIT.sign(id); name = KIT.SIGNS[id].name; }
        else if (t === 'lamp' && KIT.LAMPS && KIT.LAMPS[id]) { svg = KIT.lamp(id); name = KIT.LAMPS[id].name; cls = 'kn-lamp'; }
        else if (t === 'fa' && FA[id]) { svg = KIT.fa(id); name = FA[id]; }
        if (!svg) return '';
        return `<figure class="${cls}"><div role="img" aria-label="${esc(name)}">${svg}</div><figcaption>${esc(name)}</figcaption></figure>`;
      }).join('');
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
    foot.innerHTML = `<a class="btn btn-line" href="konu-anlatimi.html#${id}">${ICON('i-book')}Konu sayfasında aç</a>` +
      (opts.onStudy ? `<button class="btn btn-red" type="button" data-dr-study>${ICON('i-check')}Bu konudan soru çöz</button>` : `<a class="btn btn-red" href="e-sinav.html#calis=${id}">${ICON('i-check')}Bu konudan soru çöz</a>`);
    const sb = $('[data-dr-study]', foot);
    if (sb) sb.addEventListener('click', () => { closeDrawer(); opts.onStudy(id); });
    $('.drawer-close', d).focus();
  }

  window.YildizKonu = { renderKit, load, openDrawer, closeDrawer, DERS };

  /* =========================================================
     Konu anlatımı sayfası
     ========================================================= */
  const page = $('#kn-page');
  if (!page) return;
  const arts = $$('.kn-main > article[data-konu]');
  const overview = $('#kn-overview');
  const links = $$('.kn-nav a[data-konu]');
  page.addEventListener('click', (e) => {
    const b = e.target.closest('.kn-examples .opt');
    if (!b) return;
    const card = b.closest('[data-a]');
    if (!card || card.dataset.answered) return;
    card.dataset.answered = '1';
    const ans = Number(card.dataset.a), pick = Number(b.dataset.i);
    $$('.opt', card).forEach((o, i) => {
      o.disabled = true;
      if (i === ans) o.classList.add('is-ok');
      else if (i === pick) o.classList.add('is-no');
    });
    const fb = $('.feedback', card);
    fb.hidden = false;
    fb.classList.add(pick === ans ? 'ok' : 'no');
    $('.fb-h', fb).innerHTML = pick === ans ? `${ICON('i-check')}Doğru` : `${ICON('i-x')}Yanlış — doğru cevap ${'ABCD'[ans]}`;
  });

  function show(id) {
    const art = id && arts.find((a) => a.dataset.konu === id);
    arts.forEach((a) => { a.hidden = a !== art; });
    overview.hidden = !!art;
    links.forEach((l) => l.setAttribute('aria-current', String(l.dataset.konu === id)));
    if (art) {
      renderKit(art);
      document.title = `${$('h2', art).textContent} | Konu Anlatımı | Ürgüp Yıldız Sürücü Kursu`;
      const cur = links.find((l) => l.dataset.konu === id);
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    } else {
      document.title = 'Konu Anlatımı | e-Sınav Dersleri | Ürgüp Yıldız Sürücü Kursu';
    }
  }
  const route = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    show(arts.some((a) => a.dataset.konu === id) ? id : null);
  };
  addEventListener('hashchange', () => { route(); const top = $('.kn-layout'); if (top) scrollTo({ top: top.getBoundingClientRect().top + scrollY - 100 }); });
  route();

  // arama
  const search = $('#kn-search');
  if (search) {
    const norm = (s) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '');
    search.addEventListener('input', () => {
      const t = norm(search.value.trim());
      $$('.kn-nav li').forEach((li) => { li.hidden = t && !norm(li.dataset.search || li.textContent).includes(t); });
      $$('.kn-nav h3').forEach((h) => {
        const ul = h.nextElementSibling;
        h.hidden = ul && !$$('li', ul).some((li) => !li.hidden);
      });
      $('.kn-side').classList.toggle('show-nav', !!t);
    });
  }
  const navToggle = $('#kn-nav-toggle');
  if (navToggle) navToggle.addEventListener('click', () => {
    const s = $('.kn-side');
    s.classList.toggle('show-nav');
    navToggle.setAttribute('aria-expanded', String(s.classList.contains('show-nav')));
  });
  $$('.kn-nav a').forEach((a) => a.addEventListener('click', () => { if (innerWidth <= 1000) $('.kn-side').classList.remove('show-nav'); }));
})();
