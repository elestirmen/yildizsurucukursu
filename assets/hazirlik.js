/* Ürgüp Yıldız Sürücü Kursu — Sınava Hazırlık
   Hazırlık ana sayfası (konu listesi ve ilerleme, karışık çalışma) ve konu sayfaları
   (anlatım → uygulama → sorular). Ortak çekirdek: assets/soru.js. */
(() => {
  'use strict';
  const Y = window.YildizSoru;
  if (!Y) return;
  const { $, $$, esc, ICON, DERS, DORDER, S, progress, pct, reduced } = Y;
  const json = (id) => { const el = document.getElementById(id); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } };
  const starSVG = (n) => [1, 2, 3].map((i) => `<svg class="${i <= n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"/></svg>`).join('');
  const smooth = reduced ? 'auto' : 'smooth';

  if ($('#kp-page')) konuPage();
  if ($('#hz-page')) hubPage();

  /* =========================================================
     KONU SAYFASI
     ========================================================= */
  function konuPage() {
    const D = json('kp-data'), QS = json('kp-sorular') || [];
    if (!D) return;
    const ids = QS.map((q) => q.i);

    // --- adım çubuğu: okundu / uygulama yıldızı / çözülen soru ---
    function paintSteps() {
      const read = S.read.has(D.k);
      const a = $('[data-st="anlatim"]');
      if (a) { a.innerHTML = read ? `${ICON('i-check')}Okundu` : 'Okunmadı'; a.classList.toggle('done', read); }
      const u = $('[data-st="uygulama"]');
      if (u && D.app) { const n = Y.akaStars()[D.app] || 0; u.innerHTML = n ? `<span class="kp-stars" role="img" aria-label="${n} yıldız">${starSVG(n)}</span>` : 'Yapılmadı'; u.classList.toggle('done', n > 0); }
      const p = progress(ids);
      const s = $('[data-st="sorular"]');
      if (s) { s.textContent = p.seen ? `${p.seen}/${p.n} · %${pct(p.ok, p.seen)}` : `0/${p.n}`; s.classList.toggle('done', p.seen === p.n && p.n > 0); }
      const rb = $('[data-read]');
      if (rb) { rb.classList.toggle('is-read', read); $('span', rb).textContent = read ? 'Okundu olarak işaretlendi' : 'Okudum, devam et'; }
      paintFilters();
    }

    // --- bölüm takibi (adım çubuğunda o anki bölüm) ---
    const links = $$('.kp-steps a[href^="#"]');
    const secs = links.map((l) => document.getElementById(l.getAttribute('href').slice(1))).filter(Boolean);
    const spy = () => {
      const y = innerHeight * 0.35;
      let cur = secs[0];
      secs.forEach((s) => { if (s.getBoundingClientRect().top < y) cur = s; });
      links.forEach((l) => l.setAttribute('aria-current', String(l.getAttribute('href') === '#' + cur.id)));
    };
    addEventListener('scroll', spy, { passive: true });
    spy();

    // --- okundu: anlatımın sonuna gelince ya da düğmeyle ---
    const end = $('#anlatim-son');
    const t0 = Date.now();
    if (end && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && Date.now() - t0 > 15000) { Y.markRead(D.k); io.disconnect(); }
      });
      io.observe(end);
    }
    const rb = $('[data-read]');
    if (rb) rb.addEventListener('click', () => {
      Y.markRead(D.k);
      const nx = document.getElementById(D.app ? 'uygulama' : 'sorular');
      if (nx) nx.scrollIntoView({ block: 'start', behavior: smooth });
    });
    document.addEventListener('yildiz-okundu', paintSteps);
    document.addEventListener('yildiz-akademi', paintSteps);
    document.addEventListener('yildiz-cozum', paintSteps);

    // --- sorular ---
    const startEl = $('#kp-q-start'), runEl = $('#kp-q-run');
    let filter = 'all', order = 'mix';
    function paintFilters() {
      if (!startEl) return;
      const c = { all: QS.length, new: Y.pick(QS, 'new').length, wrong: Y.pick(QS, 'wrong').length, mark: Y.pick(QS, 'mark').length };
      $$('[data-f]', startEl).forEach((b) => {
        const n = c[b.dataset.f];
        $('small', b).textContent = n;
        b.disabled = !n && b.dataset.f !== 'all';
        if (b.disabled && filter === b.dataset.f) { filter = 'all'; }
        b.setAttribute('aria-pressed', String(b.dataset.f === filter));
      });
      const n = c[filter];
      $('#kp-q-go').disabled = !n;
      $('#kp-q-n').textContent = n;
    }
    if (startEl) {
      startEl.addEventListener('click', (e) => {
        const f = e.target.closest('[data-f]');
        if (f && !f.disabled) { filter = f.dataset.f; paintFilters(); }
        const o = e.target.closest('[data-o]');
        if (o) { order = o.dataset.o; $$('[data-o]', startEl).forEach((b) => b.setAttribute('aria-pressed', String(b === o))); }
      });
      $('#kp-q-go').addEventListener('click', start);
    }
    function start() {
      const qs = Y.pick(QS, filter, order);
      if (!qs.length) return;
      startEl.hidden = true;
      runEl.hidden = false;
      const label = D.t + (filter === 'wrong' ? ' · yanlışlarım' : filter === 'new' ? ' · çözmediklerim' : filter === 'mark' ? ' · işaretlediklerim' : '');
      Y.Practice(runEl, {
        qs, label, backLabel: 'Seçeneklere dön',
        onBack: () => { runEl.hidden = true; runEl.innerHTML = ''; startEl.hidden = false; paintSteps(); },
        endExtra: () => (D.next ? `<a class="btn btn-navy" href="${Y.konuURL(D.next.k)}">Sonraki konu: ${esc(D.next.t)}${ICON('i-arrow')}</a>` : `<a class="btn btn-navy" href="e-sinav.html#deneme">Deneme sınavına gir${ICON('i-arrow')}</a>`)
      });
    }
    paintSteps();
  }

  /* =========================================================
     HAZIRLIK ANA SAYFASI
     ========================================================= */
  function hubPage() {
    const H = json('hz-data');
    if (!H) return;
    const allIds = H.order.flatMap((k) => H.k[k].ids);
    const main = $('#hz-main'), run = $('#hz-run'), runBox = $('#hz-run-box');

    function paint() {
      // konu satırları
      let readN = 0;
      H.order.forEach((k) => {
        const row = $(`.hr[data-k="${k}"]`);
        if (!row) return;
        const p = progress(H.k[k].ids);
        const read = S.read.has(k);
        if (read) readN++;
        row.classList.toggle('is-read', read);
        $('.hr-read', row).hidden = !read;
        $('.hr-q', row).textContent = `${p.seen}/${p.n}`;
        const bar = $('.hr-bar i', row);
        bar.style.width = `${pct(p.seen, p.n)}%`;
        const acc = $('.hr-acc', row);
        acc.textContent = p.seen ? `%${pct(p.ok, p.seen)}` : '';
        acc.className = 'hr-acc' + (p.seen >= 3 ? (pct(p.ok, p.seen) >= 70 ? ' good' : ' weak') : '');
        const st = $('.hr-stars', row);
        if (st && H.k[k].app) { const n = Y.akaStars()[H.k[k].app] || 0; st.innerHTML = n ? starSVG(n) : ''; }
      });
      // ders başlıkları
      DORDER.forEach((d) => {
        const el = $(`.hz-ders[data-d="${d}"] .hd-prog`);
        if (!el) return;
        const ks = H.order.filter((k) => H.k[k].d === d);
        const r = ks.filter((k) => S.read.has(k)).length;
        const p = progress(ks.flatMap((k) => H.k[k].ids));
        el.innerHTML = `<span>${r}/${ks.length} konu okundu</span><span>${p.seen}/${p.n} soru</span>`;
      });
      // üst özet
      const p = progress(allIds);
      const best = S.hist.reduce((m, h) => Math.max(m, h.puan), -1);
      $('#hz-stats').innerHTML = [
        [`${readN}/${H.order.length}`, 'konu okundu'],
        [`${p.seen}`, `soru çözüldü <small>/ ${p.n}</small>`],
        [p.seen ? `%${pct(p.ok, p.seen)}` : '–', 'doğru oranı'],
        [best >= 0 ? best : '–', 'en iyi deneme puanı']
      ].map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('');
      // 1. adım: sıradaki konu
      const nextK = H.order.find((k) => !S.read.has(k));
      const nx = $('#hz-next');
      if (nextK) {
        nx.href = Y.konuURL(nextK);
        nx.innerHTML = `${readN ? 'Kaldığın yerden devam et' : 'İlk konuyla başla'}${ICON('i-arrow')}`;
        $('#hz-next-t').innerHTML = `${readN ? 'Sıradaki konu' : 'İlk konu'}: <b>${esc(H.k[nextK].t)}</b>`;
      } else {
        nx.href = '#konular';
        nx.innerHTML = `Konulara göz at${ICON('i-arrow')}`;
        $('#hz-next-t').innerHTML = '<b>Tüm konuları okudunuz.</b> Zayıf olduğunuz konuların sorularını tekrar çözün.';
      }
      // 2. adım: yanlış / işaretli sayıları
      const wrong = allIds.filter((id) => S.stat[id] && !S.stat[id][2]).length;
      const mark = allIds.filter((id) => S.marks.has(id)).length;
      const bw = $('[data-coz="yanlis"]'), bm = $('[data-coz="isaret"]');
      bw.hidden = !wrong; $('small', bw).textContent = wrong;
      bm.hidden = !mark; $('small', bm).textContent = mark;
      // 3. adım: son deneme
      const last = S.hist[0];
      $('#hz-last').innerHTML = last ? `Son sınav: <b>${last.puan} puan</b> · <span class="pill-res ${last.gecti ? 'ok' : 'no'}">${last.gecti ? 'Geçti' : 'Kaldı'}</span>` : 'Henüz sınava girmediniz.';
    }

    // ders seçimi (karışık çalışma için)
    let dz = 'all';
    $$('[data-dz]').forEach((b) => b.addEventListener('click', () => { dz = b.dataset.dz; $$('[data-dz]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
    $$('[data-coz]').forEach((b) => b.addEventListener('click', () => { location.hash = 'coz=' + b.dataset.coz + (b.dataset.coz === 'karisik' && dz !== 'all' ? '-' + dz : ''); }));

    let P = null;
    function route() {
      const h = decodeURIComponent(location.hash.slice(1));
      const m = /^coz=(karisik|yanlis|isaret)(?:-(iy|tc|at|ta))?$/.exec(h);
      if (P) { P.destroy(); P = null; }
      if (!m) {
        run.hidden = true; main.hidden = false; runBox.innerHTML = '';
        paint();
        if (h && document.getElementById(h)) document.getElementById(h).scrollIntoView({ block: 'start' });
        return;
      }
      main.hidden = true; run.hidden = false;
      runBox.innerHTML = '<div class="card card-pad"><p class="es-sub">Sorular yükleniyor…</p></div>';
      scrollTo({ top: 0 });
      Y.loadBank().then((DATA) => {
        const [, kind, d] = m;
        let qs = DATA.sorular.filter((q) => !q.old && (!d || q.d === d));
        let label;
        if (kind === 'karisik') { qs = Y.pick(qs, 'all', 'newfirst').slice(0, 20); Y.shuffle(qs); label = 'Karışık 20 soru' + (d ? ' · ' + DERS[d] : ''); }
        else if (kind === 'yanlis') { qs = Y.pick(qs, 'wrong'); label = 'Yanlışlarım'; }
        else { qs = Y.pick(qs, 'mark'); label = 'İşaretlediklerim'; }
        if (!qs.length) { runBox.innerHTML = `<div class="card card-pad"><p class="es-sub">Bu seçimde soru yok.</p><div class="q-actions"><a class="btn btn-line" href="#calis">Hazırlığa dön</a></div></div>`; return; }
        P = Y.Practice(runBox, { qs, label, topicLinks: true, backLabel: 'Hazırlığa dön', onBack: () => { location.hash = 'calis'; } });
      }).catch(() => { runBox.innerHTML = '<div class="card card-pad"><p>Sorular yüklenemedi. Lütfen bağlantınızı kontrol edip sayfayı yenileyin.</p></div>'; });
    }
    addEventListener('hashchange', route);
    const rs = $('#hz-reset');
    if (rs) rs.addEventListener('click', () => Y.dialog('İlerleme sıfırlansın mı?', 'Bu cihazdaki okunan konular, çözüm geçmişiniz, sınav sonuçlarınız, işaretli sorularınız ve uygulama yıldızlarınız silinecek.', 'Sıfırla', () => { Y.resetAll(); paint(); }, true));
    addEventListener('pageshow', (e) => { if (e.persisted) { S.read = new Set(Y.store.get(Y.K.read, [])); S.stat = Y.store.get(Y.K.stat, {}); S.marks = new Set(Y.store.get(Y.K.mark, [])); S.hist = Y.store.get(Y.K.hist, []); paint(); } });
    route();
  }
})();
