/* Ürgüp Yıldız Sürücü Kursu — e-Sınav simülasyonu
   MTSK e-Sınav düzeni: 50 soru (12 İlk Yardım, 23 Trafik ve Çevre, 9 Araç Tekniği, 6 Trafik Adabı), 45 dakika,
   4 şık, yanlışlar doğruları götürmez, puan = doğru / soru × 100, 70 ve üzeri başarılı. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const lobby = $('#exam');
  const BANK = window.YildizExamBank || [];
  const KIT = window.YildizKit;
  if (!lobby || !BANK.length || !KIT) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* depolama kapalı olabilir */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* yok say */ } }
  };
  const FX = () => window.YildizFX || { burstFrom() {} };
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const SUBJ = { iy: 'İlk Yardım', tc: 'Trafik ve Çevre', at: 'Araç Tekniği', ta: 'Trafik Adabı' };
  const ORDER = ['iy', 'tc', 'at', 'ta']; // kılavuzdaki ders sırası
  const MODES = {
    full: { label: 'Gerçek sınav', n: 50, min: 45, dist: { iy: 12, tc: 23, at: 9, ta: 6 }, warn: 5 },
    mini: { label: 'Kısa deneme', n: 10, min: 9, dist: { iy: 2, tc: 5, at: 2, ta: 1 }, warn: 1 }
  };
  const PASS = 70, EARLY_MIN = 15;
  const K_ACTIVE = 'yildiz-esinav-aktif', K_LAST = 'yildiz-esinav-son', K_HIST = 'yildiz-esinav-gecmis';
  const byId = new Map(BANK.map((q) => [q.id, q]));
  const LESSON_NAME = { isik: 'Trafik ışıkları', gecis: 'Kim önce geçer?', durus: 'Duruş mesafesi', ayna: 'Ayna ve kör nokta', levha: 'Levhaların dili', serit: 'Yol çizgileri', park: 'Park ve duraklama', gosterge: 'Gösterge ışıkları', tyd: 'Temel yaşam desteği', adab: 'Trafik adabı' };
  function lessonFor(q) {
    if (q.s === 'iy') return 'tyd';
    if (q.s === 'at') return 'gosterge';
    if (q.s === 'ta') return 'adab';
    const v = q.v || '';
    if (/^scene:cizgi/.test(v)) return 'serit';
    if (/^scene:/.test(v)) return 'gecis';
    if (/^sign:/.test(v)) return 'levha';
    return { tc44: 'durus', tc45: 'serit', tc46: 'serit', tc47: 'isik', tc48: 'isik', tc49: 'isik', tc51: 'ayna', tc52: 'park', tc53: 'park', tc54: 'park', tc55: 'park', tc56: 'park' }[q.id] || 'gecis';
  }

  /* ================= Lobi (sayfadaki kart) ================= */
  let mode = 'full';
  const modeBtns = $$('.xl-mode', lobby);
  const agree = $('#xl-agree', lobby);
  const startBtn = $('[data-exam-start]', lobby);
  function paintLobby() {
    const M = MODES[mode];
    modeBtns.forEach((b) => { const on = b.dataset.mode === mode; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); });
    ORDER.forEach((s) => {
      const n = M.dist[s];
      const seg = $(`.xl-bar [data-s="${s}"]`, lobby); if (seg) seg.style.flexGrow = n;
      const c = $(`.xl-legend [data-s="${s}"] b`, lobby); if (c) c.textContent = n;
    });
    $('[data-k="n"]', lobby).textContent = M.n;
    $('[data-k="min"]', lobby).textContent = M.min;
    $('[data-k="need"]', lobby).textContent = Math.ceil((PASS / 100) * M.n);
    startBtn.disabled = !agree.checked;
    // yarım kalan sınav
    const act = store.get(K_ACTIVE, null);
    const res = $('.xl-resume', lobby);
    if (act && !act.done && act.deadline > Date.now()) {
      res.hidden = false;
      $('[data-k="resume"]', res).textContent = `${MODES[act.mode].label} · ${act.ans.filter((a) => a != null).length}/${act.ids.length} cevap · kalan ${mmss(act.deadline - Date.now())}`;
    } else res.hidden = true;
    // geçmiş
    const hist = store.get(K_HIST, []);
    const hb = $('.xl-history', lobby);
    hb.hidden = !hist.length;
    if (hist.length) {
      $('.xl-hist-list', hb).innerHTML = hist.slice(0, 5).map((h) => `<li class="${h.ok ? 'pass' : 'fail'}" title="${esc(new Date(h.t).toLocaleString('tr-TR'))}"><b>${h.sc}</b><span>${h.m === 'full' ? '50 soru' : '10 soru'}</span></li>`).join('');
    }
    $('[data-exam-last]', lobby).hidden = !store.get(K_LAST, null);
  }
  modeBtns.forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; paintLobby(); }));
  agree.addEventListener('change', paintLobby);
  startBtn.addEventListener('click', () => { if (agree.checked) newExam(mode); });
  $('[data-exam-resume]', lobby).addEventListener('click', () => { const act = store.get(K_ACTIVE, null); if (act) openExam(act, false); });
  $('[data-exam-discard]', lobby).addEventListener('click', () => { store.del(K_ACTIVE); paintLobby(); });
  $('[data-exam-last]', lobby).addEventListener('click', () => { const last = store.get(K_LAST, null); if (last) { openApp(); showResult(last, false); } });
  setInterval(() => { if (!$('.xl-resume', lobby).hidden) paintLobby(); }, 1000);

  /* ================= Sınav uygulaması (tam ekran) ================= */
  const app = document.createElement('div');
  app.className = 'xa';
  app.id = 'exam-app';
  app.hidden = true;
  app.setAttribute('role', 'dialog');
  app.setAttribute('aria-modal', 'true');
  app.setAttribute('aria-labelledby', 'xa-title');
  app.tabIndex = -1;
  app.innerHTML = `
    <header class="xa-top">
      <div class="xa-brand"><span class="xa-logo" aria-hidden="true"><svg class="ic"><use href="#i-monitor"/></svg></span><div><b id="xa-title">e-Sınav Simülasyonu</b><span data-k="mode"></span></div></div>
      <div class="xa-timer" data-k="timerbox"><small>Kalan süre</small><b data-k="timer">45:00</b></div>
      <div class="xa-actions">
        <button class="xa-btn" type="button" data-x="panel"><svg class="ic"><use href="#i-menu"/></svg><span>Sınavım</span></button>
        <button class="xa-btn xa-btn-red" type="button" data-x="finish"><svg class="ic"><use href="#i-flag"/></svg><span>Sınavı bitir</span></button>
        <button class="xa-close" type="button" data-x="close" aria-label="Sınav ekranından çık"><svg class="ic"><use href="#i-x"/></svg></button>
      </div>
    </header>
    <div class="xa-body">
      <section class="xa-screen xa-count" data-screen="count">
        <div class="tl tl-big" aria-hidden="true"><i></i><i></i><i></i></div>
        <p class="xa-count-t" aria-live="assertive">Sınav başlıyor…</p>
      </section>
      <section class="xa-screen xa-q" data-screen="q">
        <div class="xa-meta"><span class="xa-no" data-k="no"></span><span class="xa-subj" data-k="subj"></span></div>
        <div class="xa-qbody"><div class="xa-vis" data-k="vis" aria-hidden="true"></div><p class="xa-text" data-k="text" id="xa-qtext"></p></div>
        <div class="xa-opts" data-k="opts" role="radiogroup" aria-labelledby="xa-qtext"></div>
      </section>
      <section class="xa-screen xa-result" data-screen="result" tabindex="-1"></section>
      <section class="xa-screen xa-review" data-screen="review" tabindex="-1"></section>
    </div>
    <footer class="xa-foot">
      <div class="xa-nav">
        <button class="xa-navbtn" type="button" data-x="prev"><svg class="ic"><use href="#i-left"/></svg><span>Önceki soru</span></button>
        <span class="xa-answered" data-k="answered"></span>
        <button class="xa-navbtn xa-navbtn-next" type="button" data-x="next"><span>Sonraki soru</span><svg class="ic"><use href="#i-right"/></svg></button>
      </div>
      <div class="xa-strip" data-k="strip" aria-label="Soru numaraları"></div>
    </footer>
    <div class="xa-sheet" data-k="sheet" hidden>
      <div class="xa-sheet-card" role="document">
        <div class="xa-sheet-head"><b>Sınavım</b><span class="xa-legend"><i class="a"></i>Cevaplandı<i class="e"></i>Boş<i class="c"></i>Şu anki soru</span><button class="xa-close" type="button" data-x="sheet-close" aria-label="Sınavım panelini kapat"><svg class="ic"><use href="#i-x"/></svg></button></div>
        <div class="xa-sheet-body" data-k="sheetbody"></div>
      </div>
    </div>
    <div class="xa-modal" data-k="modal" hidden><div class="xa-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="xa-mt" aria-describedby="xa-mb"><h3 id="xa-mt"></h3><div id="xa-mb"></div><div class="xa-modal-act"></div></div></div>
    <div class="xa-toast" data-k="toast" role="status" aria-live="polite"></div>`;
  document.body.appendChild(app);
  const A = (k) => $(`[data-k="${k}"]`, app);
  const screens = $$('.xa-screen', app);
  const showScreen = (name) => {
    screens.forEach((s) => s.classList.toggle('is-active', s.dataset.screen === name));
    app.dataset.view = name;
  };

  let ex = null, tick = 0, lastFocus = null, warned = false, countTimers = [];
  const save = () => { if (ex && !ex.done) store.set(K_ACTIVE, ex); };

  function pickIds(m) {
    const prev = new Set((store.get(K_LAST, null) || {}).ids || []);
    return ORDER.flatMap((s) => shuffle(BANK.filter((q) => q.s === s))
      .sort((a, b) => (prev.has(a.id) ? 1 : 0) - (prev.has(b.id) ? 1 : 0)) // son sınavdaki sorular sona
      .slice(0, MODES[m].dist[s]).map((q) => q.id));
  }
  function newExam(m) {
    const ids = pickIds(m);
    const perm = ids.map((id) => { const q = byId.get(id); return q.fix ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3]); });
    const state = { v: 1, mode: m, ids, perm, ans: ids.map(() => null), cur: 0, start: 0, deadline: 0, done: false };
    openExam(state, true);
  }
  function openApp() {
    if (!app.contains(document.activeElement)) lastFocus = document.activeElement;
    app.hidden = false;
    document.documentElement.classList.add('exam-open');
    requestAnimationFrame(() => app.classList.add('is-open'));
    app.focus({ preventScroll: true });
  }
  function closeApp(opt = {}) {
    clearInterval(tick); countTimers.forEach(clearTimeout); countTimers = [];
    app.classList.remove('is-open');
    app.hidden = true;
    document.documentElement.classList.remove('exam-open');
    closeModal(); closeSheet();
    paintLobby();
    if (opt.scroll === false) return;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    lobby.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }
  function openExam(state, fresh) {
    ex = state;
    warned = false;
    openApp();
    A('mode').textContent = `${MODES[ex.mode].label} · ${ex.ids.length} soru · ${MODES[ex.mode].min} dakika`;
    $('.xa-timer small', app).textContent = 'Kalan süre';
    buildStrip();
    app.dataset.phase = 'exam';
    if (fresh) {
      showScreen('count');
      A('timer').textContent = mmss(MODES[ex.mode].min * 60000);
      const tl = $('.xa-count .tl', app), t = $('.xa-count-t', app);
      const seq = [['r', 'Kırmızı… sınav başlıyor'], ['y', 'Sarı… hazır ol'], ['g', 'Yeşil — başarılar!']];
      const d = reduced ? 120 : 650;
      tl.className = 'tl tl-big';
      seq.forEach(([c, label], i) => countTimers.push(setTimeout(() => { tl.className = 'tl tl-big ' + c; t.textContent = label; }, i * d)));
      countTimers.push(setTimeout(() => {
        ex.start = Date.now();
        ex.deadline = ex.start + MODES[ex.mode].min * 60000;
        save();
        beginRun();
      }, seq.length * d + 200));
    } else beginRun();
  }
  function beginRun() {
    showScreen('q');
    renderQ(true);
    clearInterval(tick);
    tick = setInterval(paintTimer, 250);
    paintTimer();
  }
  function paintTimer() {
    if (!ex || ex.done) return;
    const left = ex.deadline - Date.now();
    A('timer').textContent = mmss(left);
    const warn = left <= MODES[ex.mode].warn * 60000;
    A('timerbox').classList.toggle('warn', warn);
    if (warn && !warned) { warned = true; toast(`Son ${MODES[ex.mode].warn} dakika! Süre takibinden aday sorumludur.`); }
    if (left <= 0) timeUp();
  }
  function toast(text) {
    const t = A('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- Soru ekranı ---------- */
  function buildStrip() {
    A('strip').innerHTML = ORDER.map((s) => {
      const idx = ex.ids.map((id, i) => [id, i]).filter(([id]) => byId.get(id).s === s);
      if (!idx.length) return '';
      return `<div class="xa-seg" data-s="${s}"><span class="xa-seg-t">${SUBJ[s]}</span><div class="xa-seg-n">${idx.map(([, i]) => `<button type="button" class="xa-dot" data-go="${i}" aria-label="Soru ${i + 1}"><span>${i + 1}</span><i></i></button>`).join('')}</div></div>`;
    }).join('');
  }
  function paintStrip() {
    $$('.xa-dot', app).forEach((b) => {
      const i = Number(b.dataset.go);
      b.classList.toggle('ans', ex.ans[i] != null);
      b.classList.toggle('cur', i === ex.cur);
      b.setAttribute('aria-current', i === ex.cur ? 'step' : 'false');
      b.setAttribute('aria-label', `Soru ${i + 1}${ex.ans[i] != null ? ', cevaplandı' : ', boş'}`);
    });
    const done = ex.ans.filter((a) => a != null).length;
    A('answered').textContent = `${done}/${ex.ids.length} cevaplandı`;
    const cur = $('.xa-dot.cur', app);
    if (cur) {
      const strip = A('strip');
      if (strip.scrollWidth > strip.clientWidth + 4) strip.scrollTo({ left: cur.offsetLeft - strip.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
    }
  }
  function renderQ(focus) {
    const i = ex.cur, q = byId.get(ex.ids[i]), perm = ex.perm[i];
    A('no').textContent = `Soru ${i + 1} / ${ex.ids.length}`;
    const subj = A('subj'); subj.textContent = SUBJ[q.s]; subj.dataset.s = q.s;
    const vis = A('vis');
    vis.innerHTML = KIT.visual(q.v);
    vis.dataset.kind = q.v ? q.v.split(':')[0] : '';
    A('text').textContent = q.q;
    A('opts').innerHTML = perm.map((oi, k) => `<button type="button" class="xa-opt" role="radio" aria-checked="${ex.ans[i] === k}" data-o="${k}"><span class="xa-key">${'ABCD'[k]}</span><span class="xa-otext">${esc(q.o[oi])}</span></button>`).join('');
    $$('.xa-opt', app).forEach((b) => b.classList.toggle('sel', ex.ans[i] === Number(b.dataset.o)));
    $('[data-x="prev"]', app).disabled = i === 0;
    const nx = $('[data-x="next"] span', app);
    nx.textContent = i === ex.ids.length - 1 ? 'Sınavı bitir' : 'Sonraki soru';
    paintStrip();
    const qs = $('.xa-q', app);
    qs.classList.remove('swap'); void qs.offsetWidth; qs.classList.add('swap');
    if (focus) {
      const target = $('.xa-opt.sel', app) || $('.xa-opt', app);
      if (target && finePointer) target.focus({ preventScroll: true });
    }
    $('.xa-body', app).scrollTop = 0;
  }
  function choose(k) {
    if (!ex || ex.done || app.dataset.view !== 'q') return;
    ex.ans[ex.cur] = ex.ans[ex.cur] === k ? null : k; // aynı şıkka tekrar dokunmak seçimi kaldırır
    $$('.xa-opt', app).forEach((b) => { const on = ex.ans[ex.cur] === Number(b.dataset.o); b.classList.toggle('sel', on); b.setAttribute('aria-checked', String(on)); });
    save();
    paintStrip();
  }
  function go(i) {
    if (!ex || ex.done) return;
    ex.cur = Math.max(0, Math.min(ex.ids.length - 1, i));
    save();
    renderQ(true);
  }
  function next() {
    if (ex.cur === ex.ids.length - 1) askFinish();
    else go(ex.cur + 1);
  }

  /* ---------- Sınavım paneli ---------- */
  function openSheet() {
    if (!ex || ex.done) return;
    A('sheetbody').innerHTML = ORDER.map((s) => {
      const idx = ex.ids.map((id, i) => [id, i]).filter(([id]) => byId.get(id).s === s);
      if (!idx.length) return '';
      const done = idx.filter(([, i]) => ex.ans[i] != null).length;
      return `<div class="xa-grp" data-s="${s}"><div class="xa-grp-h"><b>${SUBJ[s]}</b><span>${done}/${idx.length}</span></div><div class="xa-grp-n">${idx.map(([, i]) => `<button type="button" class="xa-cell${ex.ans[i] != null ? ' ans' : ''}${i === ex.cur ? ' cur' : ''}" data-go="${i}"><b>${i + 1}</b><span>${ex.ans[i] != null ? 'ABCD'[ex.ans[i]] : '–'}</span></button>`).join('')}</div></div>`;
    }).join('');
    A('sheet').hidden = false;
    requestAnimationFrame(() => A('sheet').classList.add('show'));
    const c = $('.xa-cell.cur', app); if (c) c.focus({ preventScroll: true });
  }
  function closeSheet() { const s = A('sheet'); s.classList.remove('show'); s.hidden = true; }

  /* ---------- Onay pencereleri ---------- */
  let modalKeep = null;
  function modal(title, bodyHTML, actions) {
    const m = A('modal');
    $('#xa-mt', app).textContent = title;
    $('#xa-mb', app).innerHTML = bodyHTML;
    const act = $('.xa-modal-act', m);
    act.innerHTML = actions.map((a, i) => `<button type="button" class="btn ${a.primary ? 'btn-red' : 'btn-ghost'}" data-i="${i}">${a.label}</button>`).join('');
    $$('button', act).forEach((b) => b.addEventListener('click', () => actions[Number(b.dataset.i)].run()));
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('show'));
    modalKeep = actions.find((a) => a.cancel) || null;
    const first = $$('button', act).find((b) => !actions[Number(b.dataset.i)].primary) || $('button', act);
    first.focus({ preventScroll: true });
  }
  function closeModal() { const m = A('modal'); m.classList.remove('show'); m.hidden = true; modalKeep = null; }
  function askFinish() {
    if (!ex || ex.done) return;
    closeSheet();
    const empty = ex.ans.filter((a) => a == null).length;
    const elapsed = Date.now() - ex.start;
    const early = ex.mode === 'full' && elapsed < EARLY_MIN * 60000;
    modal('Sınavı bitirmek istediğinizden emin misiniz?',
      `<p class="xa-m-big"><b>${empty}</b> soru cevaplanmamış</p>${empty ? '<p>Cevaplanmamış sorular yanlış sayılmaz ama puan da getirmez. İstersen sorulara dönüp tamamlayabilirsin.</p>' : '<p>Bütün soruları cevapladın.</p>'}${early ? `<p class="xa-m-note">Not: Gerçek e-Sınav’da ilk ${EARLY_MIN} dakika dolmadan sınav bitirilemez. Bu bir deneme olduğu için bitirmene izin veriyoruz.</p>` : ''}`,
      [{ label: 'Sorulara dön', cancel: true, run: () => { closeModal(); if (empty) go(ex.ans.findIndex((a) => a == null)); } },
        { label: 'Sınavı bitir', primary: true, run: () => {
          modal('Son onay', '<p>Sınavını sonlandıran aday yeniden sınav ekranına dönemez. Sınav şimdi değerlendirilecek.</p>',
            [{ label: 'Vazgeç', cancel: true, run: closeModal }, { label: 'Evet, sınavı bitir', primary: true, run: () => { closeModal(); finish(false); } }]);
        } }]);
  }
  function askClose() {
    if (!ex || ex.done || app.dataset.view !== 'q') { closeApp(); return; }
    modal('Sınav ekranından çıkılsın mı?', '<p>Cevapların bu cihazda saklanır ve süre işlemeye devam eder. Sayfadaki “Devam et” düğmesiyle kaldığın yerden dönebilirsin.</p>',
      [{ label: 'Sınava dön', cancel: true, run: closeModal }, { label: 'Çık', primary: true, run: () => { closeModal(); save(); closeApp(); } }]);
  }
  function timeUp() {
    if (!ex || ex.done) return;
    closeSheet(); closeModal();
    finish(true);
    modal('Süre doldu', `<p>${MODES[ex.mode].min} dakikalık sınav süresi bitti; sınav ekranı kapandı ve cevapların değerlendirildi.</p>`, [{ label: 'Sonucu gör', primary: true, cancel: true, run: closeModal }]);
  }

  /* ---------- Değerlendirme ---------- */
  function evaluate(st) {
    const by = {};
    ORDER.forEach((s) => { by[s] = { c: 0, n: 0 }; });
    let c = 0, w = 0, e = 0;
    st.ids.forEach((id, i) => {
      const q = byId.get(id), a = st.ans[i];
      by[q.s].n++;
      if (a == null) e++;
      else if (st.perm[i][a] === q.a) { c++; by[q.s].c++; } else w++;
    });
    const score = Math.round((c / st.ids.length) * 100);
    return { c, w, e, score, pass: score >= PASS, by };
  }
  function finish(timeIsUp) {
    clearInterval(tick);
    ex.done = true;
    ex.end = Math.min(Date.now(), ex.deadline);
    ex.timeUp = !!timeIsUp;
    const r = evaluate(ex);
    store.del(K_ACTIVE);
    store.set(K_LAST, ex);
    const hist = store.get(K_HIST, []);
    hist.unshift({ t: ex.end, m: ex.mode, sc: r.score, ok: r.pass });
    store.set(K_HIST, hist.slice(0, 10));
    showResult(ex, true);
  }

  function showResult(st, fresh) {
    ex = st;
    app.dataset.phase = 'result';
    clearInterval(tick);
    const r = evaluate(st);
    const took = mmss((st.end || st.deadline) - st.start);
    A('mode').textContent = `${MODES[st.mode].label} · sonuç`;
    A('timer').textContent = took;
    $('.xa-timer small', app).textContent = 'Geçen süre';
    A('timerbox').classList.remove('warn');
    // zayıf dersler → akademi önerisi
    const weak = ORDER.filter((s) => r.by[s].n).map((s) => ({ s, p: r.by[s].c / r.by[s].n })).sort((a, b) => a.p - b.p);
    const missed = st.ids.map((id, i) => ({ q: byId.get(id), i })).filter(({ q, i }) => st.ans[i] == null || st.perm[i][st.ans[i]] !== q.a);
    const recs = [];
    weak.filter((x) => x.p < 1).slice(0, 2).forEach(({ s }) => {
      const counts = {};
      missed.filter(({ q }) => q.s === s).forEach(({ q }) => { const l = lessonFor(q); counts[l] = (counts[l] || 0) + 1; });
      const l = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      if (l && !recs.some((x) => x.l === l)) recs.push({ s, l });
    });
    const need = Math.ceil((PASS / 100) * st.ids.length);
    const res = $('.xa-result', app);
    res.innerHTML = `
      <div class="xr-head">
        <div class="xr-ring ${r.pass ? 'pass' : 'fail'}">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg"/></svg>
          <div><b data-k="scn">0</b><span>puan</span></div>
        </div>
        <div class="xr-sum">
          <span class="xr-stamp ${r.pass ? 'pass' : 'fail'}">${r.pass ? 'BAŞARILI' : 'BAŞARISIZ'}</span>
          <h3>${r.pass ? (r.score === 100 ? 'Kusursuz! Direksiyon seni bekliyor.' : 'Tebrikler, sınavı geçtin!') : `Geçme puanı ${PASS}; ${Math.max(0, need - r.c)} doğru daha gerekiyordu.`}</h3>
          <p>${st.timeUp ? 'Süre doldu. ' : ''}${MODES[st.mode].label} · ${st.ids.length} soru · geçen süre ${took}. Puan = doğru ÷ soru × 100; yanlışlar doğruları götürmez.</p>
          <ul class="xr-stats"><li class="c"><b>${r.c}</b>Doğru</li><li class="w"><b>${r.w}</b>Yanlış</li><li class="e"><b>${r.e}</b>Boş</li></ul>
        </div>
      </div>
      <div class="xr-subj">
        <h4>Derslere göre</h4>
        ${ORDER.filter((s) => r.by[s].n).map((s) => { const b = r.by[s], p = Math.round((b.c / b.n) * 100); return `<div class="xr-row" data-s="${s}"><span class="xr-name">${SUBJ[s]}</span><span class="xr-bar"><i style="--p:${p}%"></i></span><span class="xr-val"><b>${b.c}</b>/${b.n}</span></div>`; }).join('')}
      </div>
      ${recs.length ? `<div class="xr-recs"><h4>Önerilen Akademi dersleri</h4>${recs.map(({ s, l }) => `<button type="button" class="xr-rec" data-lesson="${l}"><span class="xa-subj" data-s="${s}">${SUBJ[s]}</span><b>${LESSON_NAME[l]}</b><svg class="ic"><use href="#i-arrow"/></svg></button>`).join('')}</div>` : ''}
      <div class="xr-act">
        <button type="button" class="btn btn-dark" data-x="review"><svg class="ic"><use href="#i-book"/></svg>Cevapları incele</button>
        <button type="button" class="btn btn-ghost" data-x="again"><svg class="ic"><use href="#i-refresh"/></svg>Yeni sınav</button>
        <a class="btn btn-red" href="#iletisim" data-x="kayit">Kayıt ol <svg class="ic"><use href="#i-arrow"/></svg></a>
      </div>`;
    showScreen('result');
    res.focus({ preventScroll: true });
    $('.xa-body', app).scrollTop = 0;
    const fg = $('.ring-fg', res), num = A('scn');
    const C = 326.73;
    fg.style.strokeDashoffset = C;
    requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = (C * (1 - r.score / 100)).toFixed(2); $$('.xr-bar i', res).forEach((i) => i.classList.add('go')); }));
    const t0 = performance.now();
    const count = (t) => { const k = Math.min(1, (t - t0) / 1100); num.textContent = Math.round(r.score * easeOut(k)); if (k < 1) requestAnimationFrame(count); };
    if (reduced) num.textContent = r.score; else requestAnimationFrame(count);
    if (fresh && r.pass) setTimeout(() => FX().burstFrom($('.xr-ring', res)), 500);
  }

  function showReview(filter = 'miss') {
    const st = ex;
    const items = st.ids.map((id, i) => ({ q: byId.get(id), i, a: st.ans[i] }));
    const isMiss = ({ q, i, a }) => a == null || st.perm[i][a] !== q.a;
    const list = filter === 'miss' ? items.filter(isMiss) : items;
    const nMiss = items.filter(isMiss).length;
    const rv = $('.xa-review', app);
    rv.innerHTML = `
      <div class="xv-head">
        <button type="button" class="xa-navbtn" data-x="back"><svg class="ic"><use href="#i-left"/></svg><span>Sonuca dön</span></button>
        <div class="chips" role="radiogroup" aria-label="Gösterilecek sorular">
          <button type="button" class="chip-btn${filter === 'miss' ? ' is-on' : ''}" role="radio" aria-checked="${filter === 'miss'}" data-f="miss">Yanlış ve boşlar (${nMiss})</button>
          <button type="button" class="chip-btn${filter === 'all' ? ' is-on' : ''}" role="radio" aria-checked="${filter === 'all'}" data-f="all">Tümü (${items.length})</button>
        </div>
      </div>
      ${list.length ? '' : '<p class="xv-empty">Hiç yanlışın ya da boşun yok. Harika! 🎉</p>'}
      <ol class="xv-list">${list.map(({ q, i, a }) => {
        const perm = st.perm[i];
        const right = perm.indexOf(q.a);
        const state = a == null ? 'e' : perm[a] === q.a ? 'c' : 'w';
        return `<li class="xv-item ${state}">
          <div class="xv-meta"><b>Soru ${i + 1}</b><span class="xa-subj" data-s="${q.s}">${SUBJ[q.s]}</span><span class="xv-st">${state === 'c' ? '✓ Doğru' : state === 'w' ? '✗ Yanlış' : '– Boş'}</span></div>
          <div class="xv-q">${q.v ? `<div class="xa-vis sm" data-kind="${q.v.split(':')[0]}" aria-hidden="true">${KIT.visual(q.v)}</div>` : ''}<p>${esc(q.q)}</p></div>
          <ul class="xv-opts">${perm.map((oi, k) => `<li class="${k === right ? 'right' : ''}${k === a && k !== right ? ' mine' : ''}"><span class="xa-key">${'ABCD'[k]}</span>${esc(q.o[oi])}${k === right ? '<em>Doğru cevap</em>' : k === a ? '<em>Senin cevabın</em>' : ''}</li>`).join('')}</ul>
          <p class="xv-e"><b>Açıklama:</b> ${esc(q.e)}</p>
        </li>`;
      }).join('')}</ol>`;
    showScreen('review');
    rv.focus({ preventScroll: true });
    $('.xa-body', app).scrollTop = 0;
    $$('[data-f]', rv).forEach((b) => b.addEventListener('click', () => showReview(b.dataset.f)));
  }

  /* ---------- Olaylar ---------- */
  app.addEventListener('click', (e) => {
    const opt = e.target.closest('.xa-opt');
    if (opt) { choose(Number(opt.dataset.o)); return; }
    const goBtn = e.target.closest('[data-go]');
    if (goBtn) { closeSheet(); go(Number(goBtn.dataset.go)); return; }
    const rec = e.target.closest('.xr-rec');
    if (rec) {
      closeApp({ scroll: false });
      if (window.YildizAcademy) window.YildizAcademy.open(rec.dataset.lesson);
      return;
    }
    if (e.target === A('sheet')) { closeSheet(); return; }
    const x = e.target.closest('[data-x]');
    if (!x) return;
    const act = x.dataset.x;
    if (act === 'prev') go(ex.cur - 1);
    else if (act === 'next') next();
    else if (act === 'panel') openSheet();
    else if (act === 'sheet-close') closeSheet();
    else if (act === 'finish') askFinish();
    else if (act === 'close') askClose();
    else if (act === 'review') showReview('miss');
    else if (act === 'back') showResult(ex, false);
    else if (act === 'again') { closeModal(); agree.checked = true; mode = ex.mode; paintLobby(); newExam(mode); }
    else if (act === 'kayit') { closeApp({ scroll: false }); FX().focusForm && FX().focusForm(null); }
  });
  document.addEventListener('keydown', (e) => {
    if (app.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!A('modal').hidden) { if (modalKeep) modalKeep.run(); return; }
      if (!A('sheet').hidden) { closeSheet(); return; }
      askClose();
      return;
    }
    if (e.key === 'Tab') { // odak sınav penceresinde kalsın
      const layer = !A('modal').hidden ? A('modal') : !A('sheet').hidden ? A('sheet') : app;
      const f = $$('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])', layer).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (app.dataset.view !== 'q' || !A('modal').hidden || !A('sheet').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    const map = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };
    const key = e.key.toLowerCase();
    if (key in map && !(e.target.closest && e.target.closest('.xa-dot, .xa-navbtn, .xa-btn'))) { e.preventDefault(); choose(map[key]); }
    else if (e.key === 'ArrowRight' && !e.target.closest('.xa-strip')) { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' && !e.target.closest('.xa-strip')) { e.preventDefault(); if (ex.cur > 0) go(ex.cur - 1); }
  });

  // Sayfa yüklendiğinde süresi dolmuş yarım sınavı değerlendir
  (() => {
    const act = store.get(K_ACTIVE, null);
    if (!act) return;
    if (!act.ids || !act.ids.every((id) => byId.has(id))) { store.del(K_ACTIVE); return; }
    if (act.deadline && act.deadline <= Date.now()) {
      ex = act; ex.done = true; ex.end = ex.deadline; ex.timeUp = true;
      const r = evaluate(ex);
      store.del(K_ACTIVE); store.set(K_LAST, ex);
      const hist = store.get(K_HIST, []); hist.unshift({ t: ex.end, m: ex.mode, sc: r.score, ok: r.pass }); store.set(K_HIST, hist.slice(0, 10));
      ex = null;
    } else if (!act.deadline) store.del(K_ACTIVE);
  })();
  paintLobby();
})();
