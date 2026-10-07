/* Ürgüp Yıldız Sürücü Kursu — Sınava Hazırlık: ortak soru çekirdeği
   Soru gösterimi, çözüm istatistikleri, okunan konular ve soru çözme ekranı (Practice).
   Hazırlık ana sayfası, konu sayfaları ve sınav sayfası bu dosyayı paylaşır.
   İlerleme yalnızca bu cihazda (localStorage) saklanır. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;
  const L = 'ABCD';
  const DERS = { iy: 'İlk Yardım', tc: 'Trafik ve Çevre', at: 'Araç Tekniği', ta: 'Trafik Adabı' };
  const DORDER = ['iy', 'tc', 'at', 'ta'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  /* ---------------- Depolama ---------------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* depolama kapalı */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } }
  };
  const K = { stat: 'yildiz-es-istat-v1', hist: 'yildiz-es-gecmis-v1', mark: 'yildiz-es-isaret-v1', run: 'yildiz-es-aktif-v1', read: 'yildiz-konu-okundu-v1', akaDone: 'yildiz-akademi-v1', akaStar: 'yildiz-akademi-yildiz-v1' };
  const S = {
    stat: store.get(K.stat, {}),                 // soru id -> [görülme, doğru, son (1/0), zaman]
    marks: new Set(store.get(K.mark, [])),
    hist: store.get(K.hist, []),
    read: new Set(store.get(K.read, []))
  };
  function record(id, ok) {
    const s = S.stat[id] || [0, 0, 0, 0];
    s[0]++; if (ok) s[1]++; s[2] = ok ? 1 : 0; s[3] = Date.now();
    S.stat[id] = s;
  }
  const saveStat = () => store.set(K.stat, S.stat);
  const toggleMark = (id) => { S.marks.has(id) ? S.marks.delete(id) : S.marks.add(id); store.set(K.mark, [...S.marks]); return S.marks.has(id); };
  const saveHist = () => store.set(K.hist, S.hist);
  function markRead(k) {
    if (S.read.has(k)) return false;
    S.read.add(k); store.set(K.read, [...S.read]);
    document.dispatchEvent(new CustomEvent('yildiz-okundu', { detail: { k } }));
    return true;
  }
  const akaStars = () => store.get(K.akaStar, {});
  function resetAll() {
    S.stat = {}; S.hist = []; S.marks = new Set(); S.read = new Set();
    [K.stat, K.hist, K.mark, K.run, K.read, K.akaDone, K.akaStar].forEach(store.del);
  }
  // Bir soru listesi için ilerleme: çözülen, son denemede doğru, yanlış, işaretli
  function progress(ids) {
    let seen = 0, ok = 0, mark = 0;
    ids.forEach((id) => { const s = S.stat[id]; if (s) { seen++; if (s[2]) ok++; } if (S.marks.has(id)) mark++; });
    return { n: ids.length, seen, ok, no: seen - ok, mark };
  }

  /* ---------------- Soru bankası (gerektiğinde yüklenir) ---------------- */
  let bankP = null;
  function loadBank() {
    if (window.YildizSorular) return Promise.resolve(window.YildizSorular);
    if (bankP) return bankP;
    const me = $('script[src*="soru.js"]');
    const v = me && me.src.includes('?') ? me.src.slice(me.src.indexOf('?')) : '';
    const src = (me && me.dataset.bank) || 'assets/data/sorular.js' + v;
    bankP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => (window.YildizSorular ? res(window.YildizSorular) : rej(new Error('bank')));
      s.onerror = () => { bankP = null; rej(new Error('bank')); };
      document.head.appendChild(s);
    });
    return bankP;
  }
  let SESS = null;
  const sessions = () => {
    if (!SESS && window.YildizSorular) SESS = new Map(window.YildizSorular.oturumlar.map((o) => [o.c, o]));
    return SESS;
  };

  /* ---------------- Soru gösterimi ---------------- */
  const ITEM = /^((I{1,3}|IV|V|VI{1,3})\s*[-.)]|[1-9]\s*[-.)]|•)/;
  function stemHTML(q) {
    const lines = q.q.split('\n').map((s) => s.trim()).filter(Boolean);
    const anyItem = lines.some((l) => ITEM.test(l));
    let html = lines.map((l, i) => {
      const item = ITEM.test(l);
      const ask = anyItem && !item && i === lines.length - 1;
      return `<p class="${item ? 'q-item' : ask ? 'q-ask' : ''}">${esc(l)}</p>`;
    }).join('');
    if (q.g) html += `<figure class="q-fig"><img src="assets/q/${q.g}" alt="Sorunun şekli" loading="lazy"></figure>`;
    return `<div class="q-stem">${html}</div>`;
  }
  function optsHTML(q, cls = '') {
    const img = !!(q.og && q.og.some(Boolean));
    return `<div class="opts${img ? ' img-opts' : ''}">` + q.o.map((o, i) => {
      const body = q.og && q.og[i] ? `<span class="o-img"><img src="assets/q/${q.og[i]}" alt="${L[i]} şıkkı" loading="lazy"></span>` : `<span>${esc(o)}</span>`;
      return `<button class="opt ${cls}" type="button" data-i="${i}"><span class="L">${L[i]}</span>${body}<span class="o-mark"></span></button>`;
    }).join('') + '</div>';
  }
  function srcText(q) {
    if (q.st) return q.st;
    if (q.es) return 'MEB e-Sınav örnek sorusu · cevap anahtarı yayımlanmadı, kursumuzca belirlendi';
    const m = sessions();
    const o = m && m.get(q.src[0]);
    const first = o ? `${o.tarih} · ${o.tur}` : q.src[0];
    return q.src.length > 1 ? `${first} · toplam ${q.src.length} sınavda çıktı` : first;
  }
  const noteHTML = (q) => (q.old ? `<p class="q-old"><b>Güncel değil:</b> ${esc(q.old)} Bu soru puanlamaya katılmaz.</p>` : '') +
    (q.es ? `<p class="q-es">${ICON('i-monitor')} MEB'in e-Sınav deneme sitesinde yayımlanan güncel bir sorudur; resmî cevap anahtarı yayımlanmadığından cevap, kursumuz eğitmenlerince belirlenmiştir.</p>` : '');
  const konuURL = (k, part) => `konu-${k}.html${part ? '#' + part : ''}`;

  /* ---------------- Onay penceresi ---------------- */
  function dialog(title, text, okLabel, onOk, danger, onCancel) {
    const d = $('#dlg');
    if (!d) { if (confirm(title + '\n\n' + text)) onOk(); return; }
    $('h3', d).textContent = title;
    $('p', d).textContent = text;
    const ok = $('[data-ok]', d);
    ok.textContent = okLabel;
    ok.className = 'btn ' + (danger ? 'btn-red' : 'btn-navy');
    d.hidden = false;
    ok.focus();
    const done = (run) => { d.hidden = true; ok.onclick = null; $('[data-cancel]', d).onclick = null; if (run) onOk(); else if (onCancel) onCancel(); };
    ok.onclick = () => done(true);
    $('[data-cancel]', d).onclick = () => done(false);
    d.onkeydown = (e) => { if (e.key === 'Escape') done(false); };
  }
  const modalOpen = () => { const d = $('#dlg'); return (d && !d.hidden) || document.documentElement.classList.contains('exam-open') || document.documentElement.classList.contains('drawer-open'); };

  /* =========================================================
     Soru çözme ekranı: her soruda anında doğru/yanlış ve açıklama
     opts: { qs: [soru], label, topicLinks, onBack, backLabel, endExtra(html) }
     ========================================================= */
  function Practice(root, opts) {
    let ST = { qs: opts.qs, i: 0, res: {}, label: opts.label };
    const single = !opts.topicLinks;
    const score = () => { const v = Object.values(ST.res); return { ok: v.filter((x) => x.ok).length, no: v.filter((x) => !x.ok).length }; };
    const chips = (sc) => `<span class="s-ok">${sc.ok} doğru</span><span class="s-no">${sc.no} yanlış</span>`;
    function render() {
      if (ST.i >= ST.qs.length) return renderEnd();
      const q = ST.qs[ST.i];
      const r = ST.res[q.i];
      root.innerHTML = `<div class="card qcard">
        <div class="q-top"><div class="q-progress"><button class="btn btn-line btn-sm" type="button" data-s="back">${ICON('i-left2')}${esc(opts.backLabel || 'Geri')}</button><span><b>${ST.i + 1}</b> / ${ST.qs.length}</span><span class="bar"><i style="width:${pct(ST.i, ST.qs.length)}%"></i></span>${single ? '' : `<span class="chip-d" data-d="${q.d}">${DERS[q.d]}</span>`}</div>
        <div class="score-chips">${chips(score())}</div></div>
        ${single ? '' : `<p class="q-from">${esc(ST.label)} · <a href="${konuURL(q.k, 'anlatim')}">${esc((window.YildizSorular && window.YildizSorular.konular[q.k]) || 'Konu anlatımı')}</a></p>`}
        ${noteHTML(q)}${stemHTML(q)}${optsHTML(q)}
        <div class="feedback" hidden></div>
        <div class="q-actions"><button class="btn btn-line btn-sm" type="button" data-s="prev" ${ST.i ? '' : 'disabled'}>${ICON('i-left')}Önceki</button>
        <button class="btn btn-line btn-sm bm" type="button" data-s="mark" aria-pressed="${S.marks.has(q.i)}">${ICON('i-star')}${S.marks.has(q.i) ? 'İşaretlendi' : 'İşaretle'}</button>
        <span class="spacer"></span><span class="kbd-hint"><kbd>A</kbd>–<kbd>D</kbd> cevapla · <kbd>Enter</kbd> sonraki</span>
        <button class="btn btn-red" type="button" data-s="next" ${r ? '' : 'disabled'}>${ST.i === ST.qs.length - 1 ? 'Bitir' : 'Sonraki soru'}${ICON('i-right')}</button></div></div>`;
      if (r) reveal(q, r.pick, false);
    }
    function reveal(q, pick, fresh) {
      $$('.opt', root).forEach((b) => {
        const i = Number(b.dataset.i);
        b.disabled = true;
        if (i === q.a) { b.classList.add('is-ok'); $('.o-mark', b).textContent = 'Doğru cevap'; }
        else if (i === pick) { b.classList.add('is-no'); $('.o-mark', b).textContent = 'Sizin cevabınız'; }
      });
      const ok = pick === q.a;
      const fb = $('.feedback', root);
      fb.hidden = false;
      fb.className = 'feedback ' + (ok ? 'ok' : 'no');
      const s = S.stat[q.i];
      fb.innerHTML = `<p class="fb-h">${ok ? ICON('i-check') + 'Doğru!' : ICON('i-x') + 'Yanlış — doğru cevap ' + L[q.a]}</p><p>${esc(q.e || '')}</p>
        <div class="fb-meta"><span>${ICON('i-cal')}${esc(srcText(q))}</span>${s && s[0] > 1 ? `<span>${ICON('i-refresh')}Bu soruyu ${s[0]} kez çözdünüz</span>` : ''}</div>`;
      $('[data-s="next"]', root).disabled = false;
      if (fresh) $('[data-s="next"]', root).focus({ preventScroll: true });
    }
    function answer(pick) {
      const q = ST.qs[ST.i];
      if (ST.res[q.i]) return;
      const ok = pick === q.a;
      ST.res[q.i] = { pick, ok };
      record(q.i, ok); saveStat();
      $('.score-chips', root).innerHTML = chips(score());
      reveal(q, pick, true);
      document.dispatchEvent(new CustomEvent('yildiz-cozum', { detail: { id: q.i, k: q.k, ok } }));
    }
    function renderEnd() {
      const sc = score();
      const wrong = ST.qs.filter((q) => ST.res[q.i] && !ST.res[q.i].ok);
      ST.wrong = wrong;
      root.innerHTML = `<div class="card card-pad pr-end"><h2 class="es-h2">Çalışma tamamlandı</h2>
        <p class="es-sub">${esc(ST.label)} · ${ST.qs.length} soru</p>
        <p class="pr-big">%${pct(sc.ok, sc.ok + sc.no)}</p>
        <p class="es-sub">${sc.ok} doğru, ${sc.no} yanlış</p>
        <div class="q-actions">${wrong.length ? `<button class="btn btn-red" type="button" data-s="redo">${ICON('i-refresh')}Yanlışları tekrar çöz (${wrong.length})</button>` : ''}
        ${opts.endExtra ? opts.endExtra(sc) : ''}
        <button class="btn btn-line" type="button" data-s="back">${esc(opts.backLabel || 'Geri')}</button></div></div>`;
      if (opts.onEnd) opts.onEnd(sc);
    }
    function top() {
      const r = root.getBoundingClientRect();
      if (r.top < 70 || r.top > innerHeight * 0.5) scrollTo({ top: r.top + scrollY - 140, behavior: reduced ? 'auto' : 'smooth' });
    }
    root.addEventListener('click', onClick);
    function onClick(e) {
      const o = e.target.closest('.opt');
      if (o && !o.disabled) { answer(Number(o.dataset.i)); return; }
      const s = e.target.closest('[data-s]');
      if (!s) return;
      const act = s.dataset.s;
      if (act === 'next') { ST.i++; render(); top(); }
      else if (act === 'prev') { ST.i = Math.max(0, ST.i - 1); render(); }
      else if (act === 'mark') { const on = toggleMark(ST.qs[ST.i].i); s.setAttribute('aria-pressed', String(on)); s.innerHTML = `${ICON('i-star')}${on ? 'İşaretlendi' : 'İşaretle'}`; }
      else if (act === 'back') { destroy(); if (opts.onBack) opts.onBack(); }
      else if (act === 'redo') { ST = { qs: shuffle(ST.wrong.slice()), i: 0, res: {}, label: ST.label + ' · tekrar' }; render(); top(); }
    }
    function onKey(e) {
      if (!root.isConnected || root.hidden || ST.i >= ST.qs.length || modalOpen()) return;
      if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      const r = root.getBoundingClientRect();
      if (r.bottom < innerHeight * 0.25 || r.top > innerHeight * 0.75) return;
      const k = e.key.toLocaleLowerCase('tr');
      const map = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
      if (k in map) { e.preventDefault(); answer(map[k]); }
      else if ((e.key === 'Enter' || e.key === 'ArrowRight') && ST.res[ST.qs[ST.i].i]) { e.preventDefault(); ST.i++; render(); top(); }
      else if (e.key === 'ArrowLeft' && ST.i > 0) { e.preventDefault(); ST.i--; render(); }
    }
    addEventListener('keydown', onKey);
    function destroy() { root.removeEventListener('click', onClick); removeEventListener('keydown', onKey); }
    render();
    top();
    return { destroy };
  }

  // Bir soru havuzunu filtrele/sırala
  function pick(qs, filter, order) {
    let out = qs.filter((q) => !q.old);
    if (filter === 'new') out = out.filter((q) => !S.stat[q.i]);
    else if (filter === 'wrong') out = out.filter((q) => S.stat[q.i] && !S.stat[q.i][2]);
    else if (filter === 'mark') out = out.filter((q) => S.marks.has(q.i));
    shuffle(out);
    if (order === 'freq') out.sort((a, b) => (b.src ? b.src.length : 0) - (a.src ? a.src.length : 0));
    else if (order === 'newfirst') out.sort((a, b) => (S.stat[a.i] ? 1 : 0) - (S.stat[b.i] ? 1 : 0));
    return out;
  }

  window.YildizSoru = { $, $$, esc, ICON, L, DERS, DORDER, K, S, store, record, saveStat, saveHist, toggleMark, markRead, akaStars, resetAll, progress,
    loadBank, stemHTML, optsHTML, srcText, noteHTML, konuURL, dialog, Practice, pick, shuffle, pct, reduced };
  // e-Sınav sayfasının eski adı (konu.js ve dış kullanımlar için)
  window.YildizSoruHTML = { stem: stemHTML, opts: optsHTML, src: srcText };
})();
