/* Ürgüp Yıldız Sürücü Kursu — e-Sınav Merkezi
   Deneme sınavı (e-Sınav düzeni), çalışma modu, çıkmış sınavlar ve gelişim takibi.
   Soru bankası: assets/data/sorular.js (MEB çıkmış soruları). İlerleme yalnızca bu cihazda (localStorage) saklanır. */
(() => {
  'use strict';
  const DATA = window.YildizSorular;
  if (!DATA) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;
  const L = 'ABCD';
  const DERS = { iy: 'İlk Yardım', tc: 'Trafik ve Çevre', at: 'Araç Tekniği', ta: 'Trafik Adabı' };
  const DORDER = ['iy', 'tc', 'at', 'ta'];
  const MODES = {
    tam: { ad: 'Tam deneme', n: 50, dk: 45, dist: { iy: 12, tc: 23, at: 9, ta: 6 } },
    mini: { ad: 'Kısa deneme', n: 20, dk: 18, dist: { iy: 5, tc: 9, at: 4, ta: 2 } }
  };
  const Q = DATA.sorular;
  const byId = new Map(Q.map((q) => [q.i, q]));
  const live = Q.filter((q) => !q.old);
  const SESS = new Map(DATA.oturumlar.map((o) => [o.c, o]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Depolama ---------------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* depolama kapalı */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } }
  };
  const K_STAT = 'yildiz-es-istat-v1', K_HIST = 'yildiz-es-gecmis-v1', K_MARK = 'yildiz-es-isaret-v1', K_RUN = 'yildiz-es-aktif-v1';
  let stat = store.get(K_STAT, {});            // id -> [görülme, doğru, son (1/0), zaman]
  let marks = new Set(store.get(K_MARK, []));
  let hist = store.get(K_HIST, []);
  const record = (id, ok) => {
    const s = stat[id] || [0, 0, 0, 0];
    s[0]++; if (ok) s[1]++; s[2] = ok ? 1 : 0; s[3] = Date.now();
    stat[id] = s;
  };
  const saveStat = () => store.set(K_STAT, stat);
  const toggleMark = (id) => { marks.has(id) ? marks.delete(id) : marks.add(id); store.set(K_MARK, [...marks]); return marks.has(id); };

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
    if (q.es) return 'MEB e-Sınav örnek sorusu · cevap anahtarı yayımlanmadı, kursumuzca belirlendi';
    const o = SESS.get(q.src[0]);
    const first = o ? `${o.tarih} · ${o.tur}` : q.src[0];
    return q.src.length > 1 ? `${first} · toplam ${q.src.length} sınavda çıktı` : first;
  }
  window.YildizSoruHTML = { stem: stemHTML, opts: optsHTML, src: srcText };
  const topicBtn = (q, label = 'Konu anlatımı') => q.k ? `<button class="btn btn-line btn-sm btn-topic" type="button" data-topic="${q.k}">${ICON('i-book')}${label}</button>` : '';
  const noteHTML = (q) => (q.old ? `<p class="q-old"><b>Güncel değil:</b> ${esc(q.old)} Bu soru puanlamaya katılmaz.</p>` : '') +
    (q.es ? `<p class="q-es">${ICON('i-monitor')} MEB'in e-Sınav deneme sitesinde yayımlanan güncel bir sorudur; resmî cevap anahtarı yayımlanmadığından cevap, kursumuz eğitmenlerince belirlenmiştir.</p>` : '');

  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const fmtDate = (ts) => new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  /* ---------------- Konu çekmecesi ---------------- */
  const openTopic = (id) => window.YildizKonu && window.YildizKonu.openDrawer(id, { onStudy: (k) => { location.hash = 'calis=' + k; } });
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
    if (name === 'gelisim') renderProgress();
    if (name === 'cikmis') renderSessions();
    if (name === 'deneme') renderHistory();
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [name, arg] = h.split('=');
    if (name === 'calis') {
      showTab('calis');
      if (arg && DATA.konular[arg]) startStudy({ topics: [arg], filter: 'all', order: 'freq' });
      else if (arg === 'yanlis') startStudy({ topics: [], filter: 'wrong', order: 'mix' });
      else showStudySetup();
    } else if (name === 'konu' && arg) {
      openTopic(arg);
    } else if (['deneme', 'cikmis', 'gelisim'].includes(name)) {
      showTab(name);
    } else showTab('deneme');
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
      if (preferNew) pool.sort((a, b) => (stat[a.i] ? 1 : 0) - (stat[b.i] ? 1 : 0));
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
    const rows = hist.slice(0, 8);
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
      hist.unshift({ ts: Date.now(), title: S.title, kind: S.kind, code: S.code || null, n: scored, dogru: ok, puan, gecti, per });
      hist = hist.slice(0, 40);
      store.set(K_HIST, hist);
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
        ${weak.length ? `<div class="card card-pad"><h3 class="es-h2" style="font-size:19px">Tekrar etmeniz önerilen konular</h3><ul class="weak-list">${weak.map((w) => `<li><span class="chip-d" data-d="${w.d}">${DERS[w.d]}</span><span class="w-name">${esc(DATA.konular[w.k])}</span><span class="w-pct">${w.no} yanlış</span><button class="btn btn-line btn-sm" type="button" data-topic="${w.k}">${ICON('i-book')}Konu</button></li>`).join('')}</ul></div>` : ''}
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

  /* ---------------- Onay penceresi ---------------- */
  function dialog(title, text, okLabel, onOk, danger) {
    const d = $('#dlg');
    $('h3', d).textContent = title;
    $('p', d).textContent = text;
    const ok = $('[data-ok]', d);
    ok.textContent = okLabel;
    ok.className = 'btn ' + (danger ? 'btn-red' : 'btn-navy');
    d.hidden = false;
    ok.focus();
    const done = (run) => { d.hidden = true; ok.onclick = null; $('[data-cancel]', d).onclick = null; if (run) onOk(); };
    ok.onclick = () => done(true);
    $('[data-cancel]', d).onclick = () => done(false);
    d.onkeydown = (e) => { if (e.key === 'Escape') done(false); };
  }

  /* =========================================================
     ÇALIŞMA MODU
     ========================================================= */
  const setupEl = $('#study-setup'), runEl = $('#study-run');
  let sFilter = 'all', sOrder = 'mix';
  const topicsBySubj = {};
  Object.keys(DATA.konular).forEach((k) => { const d = k.split('-')[0]; (topicsBySubj[d] = topicsBySubj[d] || []).push(k); });
  const countIn = (k) => live.filter((q) => q.k === k).length;
  function topicProgress(k) {
    const qs = live.filter((q) => q.k === k);
    let seen = 0, ok = 0;
    qs.forEach((q) => { const s = stat[q.i]; if (s) { seen++; if (s[2]) ok++; } });
    return { n: qs.length, seen, ok };
  }
  function buildSetup() {
    $('#subj-list').innerHTML = DORDER.map((d) => {
      const n = live.filter((q) => q.d === d).length;
      return `<div class="subj-block${d === 'iy' ? ' open' : ''}" data-d="${d}">
        <button class="subj-head" type="button" aria-expanded="${d === 'iy'}"><img src="assets/img/subj-${d}.webp" alt="" width="54" height="40" loading="lazy"><span class="sh-txt"><b>${DERS[d]}</b><small>${topicsBySubj[d].length} konu · ${n} soru</small></span>${ICON('i-down').replace('class="ic"', 'class="ic ic-down"')}</button>
        <ul class="topic-list"><li><label class="topic-row"><input type="checkbox" data-all="${d}"><span class="tr-name"><b>Tüm ${DERS[d]} konuları</b></span><span class="tr-meta">${n} soru</span></label></li>
        ${topicsBySubj[d].map((k) => {
          const p = topicProgress(k);
          const w = pct(p.seen, p.n);
          return `<li><div class="topic-row"><input type="checkbox" value="${k}" id="t-${k}" aria-label="${esc(DATA.konular[k])}"><label class="tr-name" for="t-${k}">${esc(DATA.konular[k])}</label><span class="tr-meta"><span title="Çözülen: ${p.seen}/${p.n}, son denemede doğru: ${p.ok}">${p.seen}/${p.n}</span><span class="mini-bar" aria-hidden="true"><i style="width:${w}%"></i></span><button class="tr-link" type="button" data-topic="${k}" title="Konu anlatımı" aria-label="${esc(DATA.konular[k])} konu anlatımı">${ICON('i-book')}</button></span></div></li>`;
        }).join('')}</ul></div>`;
    }).join('');
    paintSel();
  }
  function selectedTopics() { return $$('#subj-list input[value]:checked').map((i) => i.value); }
  function poolFor(topics, filter) {
    let qs = topics.length ? live.filter((q) => topics.includes(q.k)) : live.slice();
    if (filter === 'new') qs = qs.filter((q) => !stat[q.i]);
    else if (filter === 'wrong') qs = (topics.length ? Q.filter((q) => topics.includes(q.k)) : Q).filter((q) => !q.old && stat[q.i] && !stat[q.i][2]);
    else if (filter === 'mark') qs = qs.filter((q) => marks.has(q.i));
    return qs;
  }
  function paintSel() {
    const t = selectedTopics();
    const n = poolFor(t, sFilter).length;
    $('#sel-count').innerHTML = `<b>${n}</b> soru ${t.length ? `· ${t.length} konu seçili` : '· tüm konular'}`;
    $('#s-start').disabled = !n;
  }
  $('#subj-list').addEventListener('click', (e) => {
    const h = e.target.closest('.subj-head');
    if (h) { const b = h.parentElement; b.classList.toggle('open'); h.setAttribute('aria-expanded', String(b.classList.contains('open'))); }
  });
  $('#subj-list').addEventListener('change', (e) => {
    const all = e.target.closest('[data-all]');
    if (all) $$(`.subj-block[data-d="${all.dataset.all}"] input[value]`).forEach((i) => { i.checked = all.checked; });
    paintSel();
  });
  $$('#s-filter button').forEach((b) => b.addEventListener('click', () => { sFilter = b.dataset.v; $$('#s-filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); paintSel(); }));
  $$('#s-order button').forEach((b) => b.addEventListener('click', () => { sOrder = b.dataset.v; $$('#s-order button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  $('#s-clear').addEventListener('click', () => { $$('#subj-list input').forEach((i) => { i.checked = false; }); paintSel(); });
  $('#s-start').addEventListener('click', () => startStudy({ topics: selectedTopics(), filter: sFilter, order: sOrder }));
  $('#s-wrong').addEventListener('click', () => startStudy({ topics: [], filter: 'wrong', order: 'mix' }));

  let ST = null;
  function showStudySetup() {
    ST = null;
    buildSetup();
    setupEl.hidden = false;
    runEl.hidden = true;
  }
  function startStudy({ topics, filter, order }) {
    let qs = poolFor(topics, filter);
    if (!qs.length) {
      showStudySetup();
      $('#sel-count').innerHTML = filter === 'wrong' ? '<b>0</b> soru · henüz yanlış cevapladığınız soru yok' : '<b>0</b> soru';
      return;
    }
    qs = order === 'freq' ? shuffle(qs).sort((a, b) => b.src.length - a.src.length) : shuffle(qs);
    const label = topics.length === 1 ? DATA.konular[topics[0]] : topics.length ? `${topics.length} konu` : 'Tüm konular';
    ST = { ids: qs.map((q) => q.i), i: 0, res: {}, label: label + (filter === 'wrong' ? ' · yanlışlarım' : filter === 'new' ? ' · çözmediklerim' : filter === 'mark' ? ' · işaretlediklerim' : ''), topics };
    setupEl.hidden = true;
    runEl.hidden = false;
    renderStudy();
    const p = $('#p-calis');
    if (p.getBoundingClientRect().top < 0) scrollTo({ top: p.getBoundingClientRect().top + scrollY - 130, behavior: reduced ? 'auto' : 'smooth' });
  }
  function studyScore() {
    const v = Object.values(ST.res);
    return { ok: v.filter((x) => x.ok).length, no: v.filter((x) => !x.ok).length };
  }
  function renderStudy() {
    if (ST.i >= ST.ids.length) return renderStudyEnd();
    const q = byId.get(ST.ids[ST.i]);
    const r = ST.res[q.i];
    const sc = studyScore();
    runEl.innerHTML = `<div class="card qcard">
      <div class="q-top"><div class="q-progress"><button class="btn btn-line btn-sm" type="button" data-s="back">${ICON('i-left2')}Konular</button><span><b>${ST.i + 1}</b> / ${ST.ids.length}</span><span class="bar"><i style="width:${pct(ST.i, ST.ids.length)}%"></i></span><span class="chip-d" data-d="${q.d}">${DERS[q.d]}</span></div>
      <div class="score-chips"><span class="s-ok">${sc.ok} doğru</span><span class="s-no">${sc.no} yanlış</span></div></div>
      <p class="es-sub" style="font-size:13.5px;margin:-4px 0 14px">${ST.label.startsWith(DATA.konular[q.k]) ? '' : esc(ST.label) + ' · '}<a href="#konu=${q.k}" data-topic="${q.k}">${esc(DATA.konular[q.k])}</a>${ST.label.startsWith(DATA.konular[q.k]) ? esc(ST.label.slice(DATA.konular[q.k].length)) : ''}</p>
      ${noteHTML(q)}${stemHTML(q)}${optsHTML(q)}
      <div class="feedback" hidden></div>
      <div class="q-actions"><button class="btn btn-line btn-sm" type="button" data-s="prev" ${ST.i ? '' : 'disabled'}>${ICON('i-left')}Önceki</button>
      ${topicBtn(q)}<button class="btn btn-line btn-sm bm" type="button" data-s="mark" aria-pressed="${marks.has(q.i)}">${ICON('i-star')}${marks.has(q.i) ? 'İşaretlendi' : 'İşaretle'}</button>
      <span class="spacer"></span><span class="kbd-hint"><kbd>A</kbd>–<kbd>D</kbd> cevapla · <kbd>Enter</kbd> sonraki</span>
      <button class="btn btn-red" type="button" data-s="next" ${r ? '' : 'disabled'}>${ST.i === ST.ids.length - 1 ? 'Bitir' : 'Sonraki soru'}${ICON('i-right')}</button></div></div>`;
    if (r) reveal(q, r.pick, false);
  }
  function reveal(q, pick, fresh) {
    $$('.opt', runEl).forEach((b) => {
      const i = Number(b.dataset.i);
      b.disabled = true;
      if (i === q.a) { b.classList.add('is-ok'); $('.o-mark', b).textContent = 'Doğru cevap'; }
      else if (i === pick) { b.classList.add('is-no'); $('.o-mark', b).textContent = 'Sizin cevabınız'; }
    });
    const ok = pick === q.a;
    const fb = $('.feedback', runEl);
    fb.hidden = false;
    fb.className = 'feedback ' + (ok ? 'ok' : 'no');
    fb.innerHTML = `<p class="fb-h">${ok ? ICON('i-check') + 'Doğru!' : ICON('i-x') + 'Yanlış — doğru cevap ' + L[q.a]}</p><p>${esc(q.e || '')}</p>
      <div class="fb-meta"><span>${ICON('i-cal')}${esc(srcText(q))}</span>${stat[q.i] && stat[q.i][0] > 1 ? `<span>${ICON('i-refresh')}Bu soruyu ${stat[q.i][0]} kez çözdünüz</span>` : ''}</div>`;
    $('[data-s="next"]', runEl).disabled = false;
    if (fresh) $('[data-s="next"]', runEl).focus({ preventScroll: true });
  }
  function answerStudy(pick) {
    const q = byId.get(ST.ids[ST.i]);
    if (ST.res[q.i]) return;
    const ok = pick === q.a;
    ST.res[q.i] = { pick, ok };
    record(q.i, ok); saveStat();
    const sc = studyScore();
    $('.score-chips', runEl).innerHTML = `<span class="s-ok">${sc.ok} doğru</span><span class="s-no">${sc.no} yanlış</span>`;
    reveal(q, pick, true);
  }
  function renderStudyEnd() {
    const sc = studyScore();
    const wrong = Object.entries(ST.res).filter(([, r]) => !r.ok).map(([id]) => id);
    runEl.innerHTML = `<div class="card card-pad" style="text-align:center"><h2 class="es-h2">Çalışma tamamlandı</h2>
      <p class="es-sub">${esc(ST.label)} · ${ST.ids.length} soru</p>
      <p style="font-family:var(--f-display);font-size:44px;font-weight:800;margin:14px 0 4px">%${pct(sc.ok, sc.ok + sc.no)}</p>
      <p class="es-sub">${sc.ok} doğru, ${sc.no} yanlış</p>
      <div class="q-actions" style="justify-content:center">${wrong.length ? `<button class="btn btn-red" type="button" data-s="redo">${ICON('i-refresh')}Yanlışları tekrar çöz (${wrong.length})</button>` : ''}
      ${ST.topics.length === 1 ? `<button class="btn btn-line" type="button" data-topic="${ST.topics[0]}">${ICON('i-book')}Konu anlatımı</button>` : ''}
      <button class="btn btn-line" type="button" data-s="back">Konu seçimine dön</button></div></div>`;
    ST.wrong = wrong;
  }
  runEl.addEventListener('click', (e) => {
    const o = e.target.closest('.opt');
    if (o && ST && !o.disabled) { answerStudy(Number(o.dataset.i)); return; }
    const s = e.target.closest('[data-s]');
    if (!s || !ST) return;
    const act = s.dataset.s;
    if (act === 'next') { ST.i++; renderStudy(); }
    else if (act === 'prev') { ST.i = Math.max(0, ST.i - 1); renderStudy(); }
    else if (act === 'mark') { const on = toggleMark(ST.ids[ST.i]); s.setAttribute('aria-pressed', String(on)); s.innerHTML = `${ICON('i-star')}${on ? 'İşaretlendi' : 'İşaretle'}`; }
    else if (act === 'back') { if (location.hash !== '#calis') location.hash = '#calis'; else showStudySetup(); }
    else if (act === 'redo') { ST = { ids: shuffle(ST.wrong.slice()), i: 0, res: {}, label: ST.label + ' · tekrar', topics: ST.topics }; renderStudy(); }
  });
  addEventListener('keydown', (e) => {
    if (!ST || runEl.hidden || $('#p-calis').hidden || !$('#xm').hidden || !$('#dlg').hidden || document.documentElement.classList.contains('drawer-open')) return;
    if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    const k = e.key.toLocaleLowerCase('tr');
    const map = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
    if (k in map && ST.i < ST.ids.length) { e.preventDefault(); answerStudy(map[k]); }
    else if ((e.key === 'Enter' || e.key === 'ArrowRight') && ST.i < ST.ids.length && ST.res[ST.ids[ST.i]]) { e.preventDefault(); ST.i++; renderStudy(); }
    else if (e.key === 'ArrowLeft' && ST.i > 0) { e.preventDefault(); ST.i--; renderStudy(); }
  });

  /* =========================================================
     ÇIKMIŞ SINAVLAR
     ========================================================= */
  function renderSessions() {
    const best = {};
    hist.forEach((h) => { if (h.code) best[h.code] = Math.max(best[h.code] || 0, h.puan); });
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

  /* =========================================================
     GELİŞİM
     ========================================================= */
  function renderProgress() {
    const ids = Object.keys(stat).filter((id) => byId.has(id));
    const solved = ids.length;
    const lastOk = ids.filter((id) => stat[id][2]).length;
    const tries = ids.reduce((a, id) => a + stat[id][0], 0);
    const okAll = ids.reduce((a, id) => a + stat[id][1], 0);
    const exams = hist.length;
    const bestP = hist.reduce((m, h) => Math.max(m, h.puan), 0);
    $('#g-kpis').innerHTML = [
      [solved, `farklı soru çözüldü <br><small>havuz: ${live.length}</small>`],
      [`%${pct(okAll, tries)}`, 'genel doğruluk'],
      [exams, 'sınav tamamlandı'],
      [exams ? bestP : '–', 'en yüksek puan']
    ].map(([b, s]) => `<div class="card kpi"><b>${b}</b><span>${s}</span></div>`).join('');
    $('#g-subj').innerHTML = DORDER.map((d) => {
      const di = ids.filter((id) => byId.get(id).d === d);
      const n = live.filter((q) => q.d === d).length;
      const ok = di.filter((id) => stat[id][2]).length;
      return `<div class="sb-row" data-d="${d}"><span>${DERS[d]} <small style="color:var(--faint)">${di.length}/${n}</small></span><span class="track"><i style="width:${pct(ok, di.length || 1)}%"></i></span><em>${di.length ? '%' + pct(ok, di.length) : '–'}</em></div>`;
    }).join('');
    const tw = Object.keys(DATA.konular).map((k) => {
      const qs = ids.filter((id) => byId.get(id).k === k);
      const ok = qs.filter((id) => stat[id][2]).length;
      return { k, d: k.split('-')[0], n: qs.length, p: pct(ok, qs.length) };
    }).filter((t) => t.n >= 3).sort((a, b) => a.p - b.p).slice(0, 8);
    $('#g-weak').innerHTML = tw.length ? `<ul class="weak-list">${tw.map((t) => `<li><span class="chip-d" data-d="${t.d}">${DERS[t.d]}</span><span class="w-name">${esc(DATA.konular[t.k])} <small style="color:var(--faint)">(${t.n} soru)</small></span><span class="w-pct" style="color:${t.p >= 70 ? 'var(--ok)' : 'var(--bad)'}">%${t.p}</span><button class="btn btn-line btn-sm" type="button" data-topic="${t.k}">${ICON('i-book')}</button><a class="btn btn-line btn-sm" href="#calis=${t.k}">Çalış</a></li>`).join('')}</ul>`
      : '<p class="empty">Konu bazında değerlendirme için her konudan en az 3 soru çözün.</p>';
    const wrongN = ids.filter((id) => !stat[id][2] && !byId.get(id).old).length;
    $('#g-wrong').innerHTML = wrongN ? `<a class="btn btn-red" href="#calis=yanlis">${ICON('i-refresh')}Yanlışlarımı çöz (${wrongN})</a>` : '';
    $('#g-hist').innerHTML = hist.length ? `<table class="hist"><thead><tr><th>Tarih</th><th>Sınav</th><th>Puan</th><th>Sonuç</th></tr></thead><tbody>${hist.slice(0, 20).map((h) => `<tr><td>${fmtDate(h.ts)}</td><td>${esc(h.title)}</td><td><b>${h.puan}</b> <small>(${h.dogru}/${h.n})</small></td><td><span class="pill-res ${h.gecti ? 'ok' : 'no'}">${h.gecti ? 'Geçti' : 'Kaldı'}</span></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Henüz tamamlanmış sınavınız yok.</p>';
  }
  $('#g-reset').addEventListener('click', () => dialog('İlerleme sıfırlansın mı?', 'Bu cihazdaki tüm çözüm geçmişiniz, sınav sonuçlarınız ve işaretli sorularınız silinecek.', 'Sıfırla', () => {
    stat = {}; hist = []; marks = new Set();
    [K_STAT, K_HIST, K_MARK, K_RUN].forEach(store.del);
    renderProgress();
  }, true));

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
