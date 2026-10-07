/* Ürgüp Yıldız Sürücü Kursu — Sınav ol: deneme sınavı (e-Sınav düzeni) ve çıkmış sınavlar.
   Ortak soru çekirdeği: assets/soru.js (YildizSoru). Soru bankası: assets/data/sorular.js. */
(() => {
  'use strict';
  const DATA = window.YildizSorular, Y = window.YildizSoru;
  if (!DATA || !Y) return;
  const { $, $$, esc, ICON, L, DERS, DORDER, store, K, record, saveStat, saveHist, stemHTML, optsHTML, srcText, noteHTML, shuffle, pct, dialog, reduced } = Y;
  const MODES = {
    tam: { ad: 'Tam deneme', n: 50, dk: 45, dist: { iy: 12, tc: 23, at: 9, ta: 6 } },
    mini: { ad: 'Kısa deneme', n: 20, dk: 18, dist: { iy: 5, tc: 9, at: 4, ta: 2 } }
  };
  const Q = DATA.sorular;
  const byId = new Map(Q.map((q) => [q.i, q]));
  const live = Q.filter((q) => !q.old);
  const SESS = new Map(DATA.oturumlar.map((o) => [o.c, o]));
  const K_RUN = K.run;
  const fmtDate = (ts) => new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const topicBtn = (q, label = 'Konu anlatımı') => q.k ? `<button class="btn btn-line btn-sm btn-topic" type="button" data-topic="${q.k}">${ICON('i-book')}${label}</button>` : '';

  /* ---------------- Konu çekmecesi ---------------- */
  const openTopic = (id) => window.YildizKonu && window.YildizKonu.openDrawer(id);
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-topic]');
    if (t) { e.preventDefault(); openTopic(t.dataset.topic); }
  });

  /* ---------------- Sekmeler ---------------- */
  const tabs = $$('.es-tab');
  const panels = $$('.es-panel');
  function showTab(name) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    panels.forEach((p) => { p.hidden = p.id !== 'p-' + name; });
    if (name === 'cikmis') renderSessions();
    if (name === 'deneme') renderHistory();
  }
  // Eski e-Sınav Merkezi adresleri yeni yerlerine
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [name, arg] = h.split('=');
    if (name === 'calis') { location.replace(arg && DATA.konular[arg] ? Y.konuURL(arg, 'sorular') : arg === 'yanlis' ? 'hazirlik.html#coz=yanlis' : 'hazirlik.html#calis'); return; }
    if (name === 'gelisim') { location.replace('hazirlik.html'); return; }
    if (name === 'konu' && arg && DATA.konular[arg]) { location.replace(Y.konuURL(arg)); return; }
    showTab(name === 'cikmis' ? 'cikmis' : 'deneme');
  }
  tabs.forEach((t) => t.addEventListener('click', (e) => {
    e.preventDefault();
    const target = '#' + t.dataset.tab;
    if (location.hash === target) route(); else location.hash = target;
  }));
  addEventListener('hashchange', route);
  /* =========================================================
     DENEME SINAVI: başlangıç kartı
     ========================================================= */
  let mode = 'tam';
  function paintMode() {
    $$('.mode-opt').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
    const m = MODES[mode];
    $('#d-dist').innerHTML = `<div class="dist-bar">${DORDER.map((d) => `<i data-d="${d}" style="flex:${m.dist[d]}"></i>`).join('')}</div>` +
      `<ul class="dist-legend">${DORDER.map((d) => `<li data-d="${d}">${DERS[d]} <b>${m.dist[d]}</b></li>`).join('')}</ul>`;
    $('#d-rule-n').textContent = m.n;
    $('#d-rule-dk').textContent = m.dk;
    $('#d-rule-pass').textContent = Math.ceil(m.n * 0.7);
  }
  $$('.mode-opt').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; paintMode(); }));
  paintMode();

  function pickExam(m, preferNew) {
    const ids = [];
    DORDER.forEach((d) => {
      let pool = live.filter((q) => q.d === d);
      shuffle(pool);
      if (preferNew) pool.sort((a, b) => (Y.S.stat[a.i] ? 1 : 0) - (Y.S.stat[b.i] ? 1 : 0));
      // aynı konudan art arda çok soru gelmesin: konulara dengeli dağıt
      const byTopic = new Map();
      pool.forEach((q) => { if (!byTopic.has(q.k)) byTopic.set(q.k, []); byTopic.get(q.k).push(q); });
      const lists = shuffle([...byTopic.values()]);
      const picked = [];
      while (picked.length < m.dist[d] && lists.some((l) => l.length)) {
        for (const l of lists) { if (l.length && picked.length < m.dist[d]) picked.push(l.shift()); }
      }
      ids.push(...shuffle(picked).map((q) => q.i));
    });
    return ids;
  }
  $('#d-start').addEventListener('click', () => {
    const m = MODES[mode];
    Exam.start({ kind: 'deneme', title: `${m.ad} · ${m.n} soru`, sub: 'e-Sınav düzeninde', ids: pickExam(m, $('#d-new').checked), dk: m.dk, kural: 'toplam' });
  });

  function renderHistory() {
    const box = $('#d-hist');
    const rows = Y.S.hist.slice(0, 8);
    box.innerHTML = rows.length ? `<table class="hist"><thead><tr><th>Tarih</th><th>Sınav</th><th>Puan</th><th>Sonuç</th></tr></thead><tbody>${rows.map((h) =>
      `<tr><td>${fmtDate(h.ts)}</td><td>${esc(h.title)}</td><td><b>${h.puan}</b> <small>(${h.dogru}/${h.n})</small></td><td><span class="pill-res ${h.gecti ? 'ok' : 'no'}">${h.gecti ? 'Geçti' : 'Kaldı'}</span></td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">Henüz sınav çözmediniz. İlk denemenizi başlatın; sonuçlarınız burada listelenecek.</p>';
  }

  /* =========================================================
     SINAV MOTORU (tam ekran)
     ========================================================= */
  const Exam = (() => {
    const root = $('#xm');
    const body = $('.xm-body', root), strip = $('.xm-strip', root), timerEl = $('.xm-timer', root);
    const ov = $('.xm-overview', root);
    let S = null, tick = 0;

    const save = () => { if (S && !S.done) store.set(K_RUN, S); };
    function start(cfg) {
      S = { ...cfg, ans: cfg.ids.map(() => null), flag: [], cur: 0, end: Date.now() + cfg.dk * 60000, started: Date.now(), done: false };
      open();
    }
    function resume(saved) { S = saved; open(); }
    function open() {
      root.hidden = false;
      document.documentElement.classList.add('exam-open');
      $('.xm-title b', root).textContent = S.title;
      $('.xm-title small', root).textContent = S.sub || '';
      $('.xm-top [data-x="ov"]', root).hidden = false;
      $('.xm-top [data-x="finish"]', root).hidden = false;
      $('.xm-top [data-x="close"]', root).hidden = true;
      timerEl.hidden = false;
      $('.xm-bottom', root).hidden = false;
      ov.hidden = true;
      buildStrip();
      render();
      clearInterval(tick);
      tick = setInterval(updateTimer, 1000);
      updateTimer();
      save();
    }
    function close() {
      clearInterval(tick);
      root.hidden = true;
      document.documentElement.classList.remove('exam-open');
      S = null;
      renderHistory();
    }
    function updateTimer() {
      if (!S || S.done) return;
      const left = Math.max(0, S.end - Date.now());
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      timerEl.classList.toggle('warn', left < 5 * 60000);
      timerEl.setAttribute('aria-label', `Kalan süre ${m} dakika ${s} saniye`);
      if (left <= 0) finish(true);
    }
    function buildStrip() {
      strip.innerHTML = S.ids.map((_, i) => `<button type="button" data-n="${i}" aria-label="Soru ${i + 1}">${i + 1}</button>`).join('');
    }
    function paintStrip() {
      $$('button', strip).forEach((b, i) => {
        b.classList.toggle('done', S.ans[i] != null);
        b.classList.toggle('cur', i === S.cur);
        b.classList.toggle('flagged', S.flag.includes(i));
        if (S.done) {
          const q = byId.get(S.ids[i]);
          b.classList.remove('done');
          b.classList.toggle('r-ok', S.ans[i] === q.a);
          b.classList.toggle('r-no', S.ans[i] != null && S.ans[i] !== q.a);
          b.classList.toggle('r-empty', S.ans[i] == null);
        }
      });
      const cur = $(`button[data-n="${S.cur}"]`, strip);
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    function render() {
      const q = byId.get(S.ids[S.cur]);
      const flagged = S.flag.includes(S.cur);
      body.innerHTML = `<div class="xm-q"><div><p class="xm-num"><b>${S.cur + 1}</b>/ ${S.ids.length} <span class="chip-d" data-d="${q.d}">${DERS[q.d]}</span></p>${S.kind === 'oturum' ? noteHTML(q) : ''}${stemHTML(q)}</div>` +
        `<div>${optsHTML(q)}<div class="q-actions"><button class="btn btn-line btn-sm bm" type="button" data-x="flag" aria-pressed="${flagged}">${ICON('i-flag')}${flagged ? 'İşaretlendi' : 'Sonra bakacağım'}</button>` +
        `${S.ans[S.cur] != null ? `<button class="btn btn-line btn-sm" type="button" data-x="clear">${ICON('i-x')}Cevabı sil</button>` : ''}<span class="spacer"></span><span class="kbd-hint"><kbd>A</kbd>–<kbd>D</kbd> seç · <kbd>←</kbd> <kbd>→</kbd> gezin</span></div></div></div>`;
      $$('.opt', body).forEach((b) => b.classList.toggle('sel', Number(b.dataset.i) === S.ans[S.cur]));
      $('[data-x="prev"]', root).disabled = S.cur === 0;
      $('[data-x="next"]', root).disabled = S.cur === S.ids.length - 1;
      body.scrollTop = 0;
      paintStrip();
    }
    function go(i) { if (!S || i < 0 || i >= S.ids.length) return; S.cur = i; ov.hidden = true; render(); save(); }
    function choose(i) {
      if (!S || S.done) return;
      S.ans[S.cur] = S.ans[S.cur] === i ? null : i;
      render(); save();
    }
    function overview() {
      const n = S.ids.length, done = S.ans.filter((a) => a != null).length;
      $('.xo-in', ov).innerHTML = `<h2 class="es-h2">Sınavım</h2><p class="es-sub">${done} soru cevaplandı, ${n - done} soru boş${S.flag.length ? `, ${S.flag.length} soru işaretli` : ''}. Gitmek istediğiniz soruya dokunun.</p>` +
        `<div class="xo-grid">${S.ids.map((id, i) => { const q = byId.get(id); return `<button type="button" data-n="${i}" class="${S.ans[i] != null ? 'done' : ''}">${i + 1}<small>${S.ans[i] != null ? L[S.ans[i]] : (S.flag.includes(i) ? '★' : '–')}</small></button>`; }).join('')}</div>` +
        `<div class="xo-legend"><span>■ Cevaplanan</span><span>□ Boş</span><span>★ İşaretli</span></div>`;
      ov.hidden = !ov.hidden;
    }

    /* ---- bitirme: iki aşamalı onay ---- */
    function confirmFinish() {
      const empty = S.ans.filter((a) => a == null).length;
      dialog('Sınavı bitirmek istiyor musunuz?', empty ? `${empty} soruyu boş bıraktınız. Süreniz bitmeden sınavı bitirirseniz bu sorulara dönemezsiniz.` : 'Tüm soruları cevapladınız. Cevaplarınızı “Sınavım” panelinden kontrol edebilirsiniz.', 'Sınavı bitir', () => {
        dialog('Son onay', 'Sınavınız sonlandırılacak ve cevaplarınız değerlendirilecek. Bu işlem geri alınamaz.', 'Evet, sınavı bitir', () => finish(false), true);
      });
    }
    function finish(timeout) {
      if (!S || S.done) return;
      S.done = true;
      clearInterval(tick);
      store.del(K_RUN);
      const per = {};
      let ok = 0, scored = 0;
      S.ids.forEach((id, i) => {
        const q = byId.get(id);
        const a = S.ans[i];
        if (a != null) record(id, a === q.a);
        if (q.old) return;
        scored++;
        per[q.d] = per[q.d] || [0, 0];
        per[q.d][1]++;
        if (a === q.a) { per[q.d][0]++; ok++; }
      });
      saveStat();
      const puan = pct(ok, scored);
      const gecti = S.kural === 'ders' ? Object.values(per).every(([a, b]) => pct(a, b) >= 70) : puan >= 70;
      Y.S.hist.unshift({ ts: Date.now(), title: S.title, kind: S.kind, code: S.code || null, n: scored, dogru: ok, puan, gecti, per });
      Y.S.hist = Y.S.hist.slice(0, 40);
      saveHist();
      S.result = { per, ok, scored, puan, gecti, timeout };
      showResult();
      if (gecti && window.YildizFX && !reduced) setTimeout(() => window.YildizFX.confetti(innerWidth / 2, innerHeight / 3, 140), 400);
    }
    function showResult() {
      const r = S.result;
      $('.xm-top [data-x="ov"]', root).hidden = true;
      $('.xm-top [data-x="finish"]', root).hidden = true;
      $('.xm-top [data-x="close"]', root).hidden = false;
      timerEl.hidden = true;
      $('.xm-bottom', root).hidden = true;
      ov.hidden = true;
      const C = 2 * Math.PI * 64;
      const rule = S.kural === 'ders' ? 'Bu sınavda başarı için her dersten ayrı ayrı en az 70 puan gerekir.' : 'Başarı için en az 70 puan gerekir; yanlışlar doğruları götürmez.';
      const weak = topicWeakness(S);
      body.innerHTML = `<div class="res-wrap">
        <div class="res-head"><div class="res-ring ${r.gecti ? '' : 'fail'}"><svg viewBox="0 0 150 150"><circle class="bg" cx="75" cy="75" r="64"/><circle class="fg" cx="75" cy="75" r="64" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg><div><b>${r.puan}</b><small>puan</small></div></div>
        <div><span class="pill-res ${r.gecti ? 'ok' : 'no'}">${r.gecti ? 'Başarılı' : 'Başarısız'}</span><h2>${r.gecti ? 'Tebrikler, sınavı geçtiniz.' : 'Bu sefer olmadı; eksik konularınızı çalışalım.'}</h2>
        <p>${r.timeout ? 'Süreniz dolduğu için sınav otomatik olarak bitirildi. ' : ''}${r.scored} sorudan ${r.ok} doğru. ${rule}</p></div></div>
        <table class="res-table"><thead><tr><th>Ders</th><th>Soru</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Puan</th></tr></thead><tbody>${DORDER.filter((d) => r.per[d]).map((d) => {
          const ids = S.ids.map((id, i) => [byId.get(id), S.ans[i]]).filter(([q]) => q.d === d && !q.old);
          const bos = ids.filter(([, a]) => a == null).length;
          const [ok, n] = r.per[d];
          return `<tr><td><span class="chip-d" data-d="${d}">${DERS[d]}</span></td><td class="num">${n}</td><td class="num">${ok}</td><td class="num">${n - ok - bos}</td><td class="num">${bos}</td><td class="num"><b>${pct(ok, n)}</b></td></tr>`;
        }).join('')}</tbody></table>
        ${weak.length ? `<div class="card card-pad"><h3 class="es-h2" style="font-size:19px">Tekrar etmeniz önerilen konular</h3><ul class="weak-list">${weak.map((w) => `<li><span class="chip-d" data-d="${w.d}">${DERS[w.d]}</span><span class="w-name">${esc(DATA.konular[w.k])}</span><span class="w-pct">${w.no} yanlış</span><a class="btn btn-line btn-sm" href="${Y.konuURL(w.k)}">${ICON('i-book')}Konuya git</a></li>`).join('')}</ul></div>` : ''}
        <div class="res-filter"><b>Cevaplarınız:</b> <div class="seg" role="group" aria-label="Filtre"><button type="button" data-f="all" aria-pressed="true">Tümü</button><button type="button" data-f="no" aria-pressed="false">Yanlışlar</button><button type="button" data-f="empty" aria-pressed="false">Boşlar</button><button type="button" data-f="ok" aria-pressed="false">Doğrular</button></div></div>
        <div class="rev-list" id="rev-list"></div>
        <div class="q-actions" style="margin-top:28px"><button class="btn btn-red" type="button" data-x="again">${ICON('i-refresh')}Yeni deneme sınavı</button><button class="btn btn-line" type="button" data-x="close2">Sınav ekranını kapat</button></div></div>`;
      requestAnimationFrame(() => requestAnimationFrame(() => { const fg = $('.res-ring .fg', body); if (fg) fg.style.strokeDashoffset = (C * (1 - r.puan / 100)).toFixed(1); }));
      renderReview('all');
      paintStrip();
      body.scrollTop = 0;
    }
    function renderReview(f) {
      const list = $('#rev-list', body);
      const items = S.ids.map((id, i) => ({ q: byId.get(id), a: S.ans[i], n: i + 1 })).filter(({ q, a }) =>
        f === 'all' || (f === 'ok' && a === q.a) || (f === 'no' && a != null && a !== q.a) || (f === 'empty' && a == null));
      list.innerHTML = items.length ? items.map(({ q, a, n }) => {
        const res = a == null ? 'Boş bırakıldı' : a === q.a ? 'Doğru' : 'Yanlış';
        return `<div class="card qcard" id="rv-${n}"><div class="q-top"><span><span class="rev-n">${n}</span> <span class="chip-d" data-d="${q.d}">${DERS[q.d]}</span></span><span class="pill-res ${a === q.a ? 'ok' : 'no'}">${res}</span></div>${noteHTML(q)}${stemHTML(q)}${reviewOpts(q, a)}
          <div class="feedback ${a === q.a ? 'ok' : 'no'}"><p class="fb-h">Doğru cevap: ${L[q.a]}</p><p>${esc(q.e || '')}</p><div class="fb-meta"><span>${ICON('i-cal')}${esc(srcText(q))}</span></div></div>
          <div class="q-actions">${topicBtn(q, 'Konu anlatımını aç')}</div></div>`;
      }).join('') : '<p class="empty">Bu filtreye uyan soru yok.</p>';
    }
    function reviewOpts(q, a) {
      const tmp = document.createElement('div');
      tmp.innerHTML = optsHTML(q);
      $$('.opt', tmp).forEach((b) => {
        const i = Number(b.dataset.i);
        b.disabled = true;
        if (i === q.a) { b.classList.add('is-ok'); $('.o-mark', b).textContent = 'Doğru cevap'; }
        else if (i === a) { b.classList.add('is-no'); $('.o-mark', b).textContent = 'Sizin cevabınız'; }
      });
      return tmp.innerHTML;
    }

    root.addEventListener('click', (e) => {
      const o = e.target.closest('.xm-q .opt');
      if (o && S && !S.done) { choose(Number(o.dataset.i)); return; }
      const n = e.target.closest('[data-n]');
      if (n && S) { if (S.done) { const el = $('#rv-' + (Number(n.dataset.n) + 1), body); if (el) el.scrollIntoView({ behavior: 'smooth' }); } else go(Number(n.dataset.n)); return; }
      const x = e.target.closest('[data-x]');
      if (x) {
        const act = x.dataset.x;
        if (act === 'prev') go(S.cur - 1);
        else if (act === 'next') go(S.cur + 1);
        else if (act === 'ov') overview();
        else if (act === 'finish') confirmFinish();
        else if (act === 'flag') { const i = S.flag.indexOf(S.cur); i >= 0 ? S.flag.splice(i, 1) : S.flag.push(S.cur); render(); save(); }
        else if (act === 'clear') { S.ans[S.cur] = null; render(); save(); }
        else if (act === 'close' || act === 'close2') { if (S && !S.done) dialog('Sınavdan çıkılsın mı?', 'Sınavınız kaydedildi; daha sonra kaldığınız yerden devam edebilirsiniz. Süre işlemeye devam eder.', 'Çık', close); else close(); }
        else if (act === 'again') { const k = S.kind; close(); if (k === 'deneme') $('#d-start').click(); else location.hash = '#cikmis'; }
      }
      const f = e.target.closest('.res-filter [data-f]');
      if (f) { $$('.res-filter [data-f]', body).forEach((b) => b.setAttribute('aria-pressed', String(b === f))); renderReview(f.dataset.f); }
    });
    addEventListener('keydown', (e) => {
      if (!S || S.done || root.hidden || e.altKey || e.ctrlKey || e.metaKey || !$('#dlg').hidden || document.documentElement.classList.contains('drawer-open')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      const k = e.key.toLocaleLowerCase('tr');
      const map = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
      if (k in map) { e.preventDefault(); choose(map[k]); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(S.cur + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(S.cur - 1); }
    });
    return { start, resume, close, get active() { return S; } };
  })();

  function topicWeakness(S) {
    const m = new Map();
    S.ids.forEach((id, i) => {
      const q = byId.get(id);
      if (q.old || S.ans[i] === q.a) return;
      const w = m.get(q.k) || { k: q.k, d: q.d, no: 0 };
      w.no++; m.set(q.k, w);
    });
    return [...m.values()].sort((a, b) => b.no - a.no).slice(0, 6);
  }

  /* =========================================================
     ÇIKMIŞ SINAVLAR
     ========================================================= */
  function renderSessions() {
    const best = {};
    Y.S.hist.forEach((h) => { if (h.code) best[h.code] = Math.max(best[h.code] || 0, h.puan); });
    const years = {};
    const ES = 'Güncel e-Sınav örnekleri (MEB)';
    DATA.oturumlar.forEach((o) => { const y = o.c.startsWith('es') ? ES : o.c.slice(0, 4); (years[y] = years[y] || []).push(o); });
    $('#sess-list').innerHTML = Object.keys(years).sort((a, b) => (a === ES ? -1 : b === ES ? 1 : b.localeCompare(a))).map((y) => `<h3 class="sess-year">${y}</h3><div class="sess-grid">${years[y].map((o) => {
      const old = o.l.filter((id) => byId.get(id).old).length;
      return `<button class="sess" type="button" data-sess="${o.c}"><b>${esc(o.tarih)}</b><small>${esc(o.tur)}</small><small>${o.l.length} soru · ${o.dk} dakika${old ? ` · ${old} soru güncel değil` : ''}</small>${best[o.c] != null ? `<span class="sess-best" style="color:${best[o.c] >= 70 ? 'var(--ok)' : 'var(--bad)'}">En iyi puanınız: ${best[o.c]}</span>` : ''}</button>`;
    }).join('')}</div>`).join('');
  }
  $('#sess-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sess]');
    if (!b) return;
    const o = SESS.get(b.dataset.sess);
    const old = o.l.filter((id) => byId.get(id).old).length;
    dialog(`${o.tarih} · ${o.tur}`, `${o.l.length} soru, ${o.dk} dakika. Sorular kitapçıktaki sırasıyla gelir.${old ? ` Mevzuatı değişen ${old} soru işaretli gösterilir ve puanlamaya katılmaz.` : ''} ${o.kural === 'ders' ? 'Bu sınavda başarı için her dersten ayrı ayrı 70 puan gerekiyordu.' : 'Başarı için 70 puan gerekir.'}`, 'Sınavı başlat', () => {
      Exam.start({ kind: 'oturum', code: o.c, title: `${o.tarih} · ${o.tur}`, sub: 'MEB çıkmış sınav', ids: o.l.slice(), dk: o.dk, kural: o.kural });
    });
  });

  /* ---------------- Başlangıç ---------------- */
  route();
  const saved = store.get(K_RUN, null);
  if (saved && saved.ids && !saved.done) {
    if (saved.end > Date.now()) {
      dialog('Yarım kalan sınavınız var', `“${saved.title}” sınavınız devam ediyor. Kaldığınız yerden devam etmek ister misiniz?`, 'Devam et', () => Exam.resume(saved));
      $('#dlg [data-cancel]').addEventListener('click', () => store.del(K_RUN), { once: true });
    } else store.del(K_RUN);
  }
})();
