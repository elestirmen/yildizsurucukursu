/* Ürgüp Yıldız Sürücü Kursu — Trafik Akademisi (etkileşimli dersler)
   Bütün dersler aynı düzeni izler: tuval sahnesi + HUD etiketleri, hedef çubuğu (hedef · hata),
   renkli geri bildirim satırı, sonuç kartı (yıldız), “Ders tamamlandı → Sonraki ders” bandı ve kural kartı.
   Çizim motoru: academy-gfx.js (çekirdek), academy-3d.js (3B yol), academy-top.js (kuşbakışı).
   Levhalar ve gösterge ışıkları e-Sınav ile ortak olan YildizKit'ten gelir. */
(() => {
  'use strict';

  const G = window.YildizGfx, R = window.YildizRoad, T = window.YildizTop, KIT = window.YildizKit;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const shell = $('.academy-shell');
  if (!shell || !KIT || !G || !R) return;
  const reduced = G.reduced;
  const { clamp, lerp, rand, pick, shuffle, store, shade, alpha, mix, rr } = G;
  const FX = () => window.YildizFX || { confetti() {}, burstFrom() {} };
  const tr = (n, d = 1) => n.toFixed(d).replace('.', ',');
  const tabs = $$('.lesson-tab', shell);
  const panels = $$('.lesson', shell);
  const panelOf = (id) => panels.find((p) => p.dataset.lesson === id);
  const ORDER = tabs.map((t) => t.dataset.lesson);
  const NAMES = Object.fromEntries(tabs.map((t) => [t.dataset.lesson, $('b', t).textContent]));

  /* ---------- Ortak yardımcılar ---------- */
  const k = (panel, key) => $(`[data-k="${key}"]`, panel);
  function feedback(panel, html, kind) {
    const fb = k(panel, 'fb');
    fb.innerHTML = html;
    fb.className = 'sim-feedback' + (kind ? ' ' + kind : '');
  }
  // Hedef çubuğu: “Hedef ●●○○ · Hata 0” — her derste aynı
  function goalBar(panel, total) {
    const box = k(panel, 'goal');
    box.innerHTML = `<span class="sg-l">Hedef</span><span class="sg-pips" role="img">${'<i></i>'.repeat(total)}</span><span class="sg-err">Hata <b>0</b></span>`;
    const pips = $$('.sg-pips i', box), err = $('.sg-err b', box), wrap = $('.sg-pips', box);
    let lastN = 0, lastBad = 0;
    const set = (n, bad = 0) => {
      pips.forEach((p, i) => p.classList.toggle('on', i < n));
      wrap.setAttribute('aria-label', `Hedef: ${Math.min(n, total)} / ${total}`);
      err.textContent = bad;
      if (bad > lastBad) { box.classList.remove('err-pop'); void box.offsetWidth; box.classList.add('err-pop'); }
      lastN = n; lastBad = bad;
      box.classList.toggle('full', n >= total);
    };
    set(0, 0);
    return { set, total, get n() { return lastN; } };
  }
  // Duraklat düğmesi: toggle() yeni duraklatma durumunu döndürür
  function pauseButton(panel, toggle) {
    const b = $('[data-act="pause"]', panel);
    if (!b) return;
    b.addEventListener('click', () => {
      const now = toggle();
      if (now) { b.dataset.paused = '1'; $('span', b).textContent = 'Devam'; $('use', b).setAttribute('href', '#i-play'); }
      else { delete b.dataset.paused; $('span', b).textContent = 'Duraklat'; $('use', b).setAttribute('href', '#i-pause'); }
    });
  }
  function resetPause(panel) { const b = $('[data-act="pause"]', panel); if (b && b.dataset.paused) { delete b.dataset.paused; $('span', b).textContent = 'Duraklat'; $('use', b).setAttribute('href', '#i-pause'); } }

  /* ---------- İlerleme ve yıldızlar ---------- */
  const DONE_KEY = 'yildiz-akademi-v1', STAR_KEY = 'yildiz-akademi-yildiz-v1';
  const done = new Set(store.get(DONE_KEY, []).filter((id) => ORDER.includes(id)));
  const stars = Object.assign({}, store.get(STAR_KEY, {}));
  const apFill = $('#ap-fill'), apText = $('#ap-text'), grad = $('#academy-grad');
  const starSVG = (n) => [1, 2, 3].map((i) => `<svg class="${i <= n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"/></svg>`).join('');
  function nextLesson(id) {
    const i = ORDER.indexOf(id);
    for (let j = 1; j <= ORDER.length; j++) { const c = ORDER[(i + j) % ORDER.length]; if (!done.has(c)) return c; }
    return ORDER[(i + 1) % ORDER.length];
  }
  function paintNext(id) {
    const box = $('.lesson-next', panelOf(id));
    if (!box) return;
    box.hidden = !done.has(id);
    const nx = nextLesson(id), btn = $('[data-next]', box);
    btn.dataset.next = nx;
    btn.innerHTML = `Sonraki ders: <b>${NAMES[nx]}</b><svg class="ic"><use href="#i-arrow"/></svg>`;
    const st = $('.ln-stars', box);
    st.innerHTML = stars[id] ? starSVG(stars[id]) : '';
    st.setAttribute('aria-label', stars[id] ? `En iyi sonuç: ${stars[id]} yıldız` : '');
  }
  function paintProgress() {
    tabs.forEach((t) => {
      const lid = t.dataset.lesson;
      t.classList.toggle('done', done.has(lid));
      const s = $('.lt-stars', t);
      if (s) s.innerHTML = stars[lid] ? starSVG(stars[lid]) : '';
    });
    apFill.style.width = `${(done.size / tabs.length) * 100}%`;
    apText.textContent = `${done.size}/${tabs.length} ders tamamlandı`;
    grad.hidden = done.size < tabs.length;
    ORDER.forEach(paintNext);
  }
  function complete(id, from) {
    if (done.has(id)) return;
    done.add(id);
    store.set(DONE_KEY, [...done]);
    paintProgress();
    const src = from || tabs.find((t) => t.dataset.lesson === id);
    if (src) FX().burstFrom(src);
    if (done.size === tabs.length) setTimeout(() => FX().burstFrom(grad), 600);
  }
  // Sonuç kartı: hatalara göre 1–3 yıldız, en iyisi saklanır
  function finishCard(stage, id, bad, text, onContinue) {
    const n = bad === 0 ? 3 : bad <= 2 ? 2 : 1;
    if (!stars[id] || n > stars[id]) { stars[id] = n; store.set(STAR_KEY, stars); paintProgress(); }
    G.Sfx.play('win');
    const nx = nextLesson(id);
    stage.card({
      stars: n,
      title: n === 3 ? 'Kusursuz! Ders tamamlandı' : 'Ders tamamlandı!',
      text: text + (n < 3 ? ' <span class="sc-hint">Hatasız bitirirsen 3 yıldız alırsın.</span>' : ''),
      buttons: [
        { label: `Sonraki ders: ${NAMES[nx]} <svg class="ic"><use href="#i-arrow"/></svg>`, cls: 'btn-red', onClick: () => { stage.card(null); select(nx, { scroll: true, focus: true, into: true }); } },
        { label: 'Bu derste devam et', cls: 'btn-ghost', onClick: () => { stage.card(null); if (onContinue) onContinue(); } }
      ]
    });
  }
  panels.forEach((p) => {
    const d = document.createElement('div');
    d.className = 'lesson-next';
    d.hidden = true;
    d.innerHTML = '<span class="ln-ok"><svg class="ic"><use href="#i-check"/></svg></span><b>Ders tamamlandı!</b><span class="ln-stars" role="img"></span><span class="ln-sub">İstersen denemeye devam edebilirsin.</span><button type="button" class="ln-btn" data-next></button>';
    $('.lesson-main', p).appendChild(d);
    $('[data-next]', d).addEventListener('click', (e) => select(e.currentTarget.dataset.next, { scroll: true, focus: true, into: true }));
  });

  /* =========================================================
     DERS 1 — Trafik ışıkları (3B sürüş)
     Fren basılı tutulur; araç durunca bekler, “Kalk” ile yeniden hareket eder.
     Her kavşakta ışığın ne zaman değişeceği aracın konumuna göre planlanır:
     yeşilde geç, erken sarıda dur, geç sarıda geç, kırmızıda bekle, kırmızı+sarıda kalkma.
     ========================================================= */
  const lessonIsik = (() => {
    const id = 'isik', panel = panelOf(id), host = $('.sim', panel);
    const stage = new G.Stage(host, { height: (w) => (w < 560 ? Math.round(w * 1.04) : Math.round(clamp(w * 0.56, 330, 540))) });
    const v = new R.View3D();
    const GOAL = 5, CRUISE = 50 / 3.6, ACC = 2.7, DEC = 6.4, HALF = 2.2, CAM_BACK = 9.6;
    const goal = goalBar(panel, GOAL);
    const mainBtn = $('[data-act="brake"]', panel);
    const TEXT = { green: 'Yeşil — yol açık, dikkatle geç', amber: 'Sarı — güvenle durabiliyorsan dur', red: 'Kırmızı — dur ve bekle', redamber: 'Kırmızı + sarı — hazırlan, geçme' };
    const SHORT = { green: 'Yeşil — geç', amber: 'Sarı — durabiliyorsan dur', red: 'Kırmızı — dur', redamber: 'Kırmızı + sarı — bekle' };
    const DOT = { green: '#27d35f', amber: '#ffb300', red: '#ff3b30', redamber: '#ff8a00' };
    const chipL = stage.chip('l', 'isik', 'Trafik ışığı', '<i class="hc-dot"></i>');
    const chipS = stage.chip('r', 'hiz', 'Hız');
    const chipD = stage.chip('r', 'cizgi', 'Durma çizgisi');
    const PEOPLE = [['#e07a3a', '#3a4a6b', '#3b2a1f'], ['#2f7bff', '#2b2f36', '#1c1a18'], ['#7b3fa0', '#4a3b2a', '#6b4a2a'], ['#1aa39a', '#303848', '#2a2220'], ['#d63a6a', '#2b3550', '#c9a36b']];
    let world, car, oncoming, cross, peds, walkers, parts, ok, bad, started, paused, flash, shake, bag, lastPlan, hint, keyBrake, ptrBrake, time, built, spawnOn, rtShown;

    function stopZ(it) { return it.z - 9.5; }
    const front = () => car.z + HALF;
    function current() { return world.nextInter(front() - 10); }
    function planFor(k) {
      if (k === 0) return 'green';
      if (k === 1) return 'stop';
      if (!bag.length) bag = shuffle(['stop', 'late', 'r2g', 'dilemma', 'green', 'dilemma', 'r2g']);
      let p = bag.shift();
      if (p === lastPlan && bag.length) { bag.push(p); p = bag.shift(); }
      lastPlan = p;
      return p;
    }
    function sigOf(it) {
      if (!it.sig) {
        const plan = planFor(it.id);
        it.sig = { plan, phase: plan === 'r2g' ? 'red' : 'green', t: 0, trig: plan === 'stop' ? rand(58, 70) : plan === 'dilemma' ? rand(29, 35) : plan === 'r2g' ? rand(30, 44) : 0, fired: false, evaluated: false, stopped: false, gap: null, amberCan: null, stopT: 0, pedWarn: false, pedsSpawned: false };
        if (plan === 'r2g') spawnPeds(it, 1.5);
      }
      return it.sig;
    }
    function setPhase(it, ph) {
      const S = it.sig;
      S.phase = ph; S.t = 0;
      if (ph === 'amber') {
        const d = stopZ(it) - front();
        S.amberCan = d > car.v * 0.6 + (car.v * car.v) / (2 * DEC) + 0.5;
      }
      if (ph === 'red' && !S.pedsSpawned) spawnPeds(it, 0.6);
    }
    function build() {
      world = new R.World({ kind: 'town', seed: 20 + Math.floor(Math.random() * 1000), spacing: 150, first: 125 });
      // Her kavşağa iki trafik ışığı: sağ köşede direk, şeridin üstüne uzanan kollu
      world.o.extras = (W, z0, z1) => {
        for (const it of W.inters) {
          if (it.z < z0 - 12 || it.z >= z1 - 12) continue;
          const st = () => sigOf(it).phase;
          W.add({ type: 'signal', x: 4.35, z: it.z - 10.1, state: st, k: 1.45 });
          W.add({ type: 'signal', x: 4.75, z: it.z - 9.0, state: st, mast: true, k: 1.3 });
        }
      };
      car = { x: 1.75, z: 0, v: CRUISE * 0.55, brk: 0, hold: false };
      oncoming = []; cross = []; peds = []; walkers = []; parts = new G.Particles();
      ok = 0; bad = 0; flash = 0; shake = 0; bag = []; lastPlan = null; hint = ''; time = 0; spawnOn = 2; rtShown = false;
      world.ensure(car.z + 520);
      goal.set(0, 0);
      setBtn();
    }
    function setBtn() {
      const stopped = car && car.hold;
      mainBtn.classList.toggle('btn-red', !stopped);
      mainBtn.classList.toggle('btn-wa', !!stopped);
      $('span', mainBtn).textContent = !started ? 'Başla' : stopped ? 'Kalk' : 'Fren';
      $('use', mainBtn).setAttribute('href', !started || stopped ? '#i-play' : '#i-pause');
      $('kbd', mainBtn).textContent = 'Boşluk';
    }
    function score(isOk, msg, toast) {
      if (isOk) ok++; else bad++;
      goal.set(ok, bad);
      feedback(panel, msg, isOk ? 'ok' : 'bad');
      stage.toast(toast || (isOk ? '✓ Doğru karar' : '✗ Hatalı karar'), isOk ? 'ok' : 'bad');
      G.Sfx.play(isOk ? 'ok' : 'bad');
      if (isOk && ok === GOAL) {
        complete(id, host);
        setTimeout(() => {
          paused = true;
          finishCard(stage, id, bad, `${GOAL} kavşakta ışıklara göre doğru karar verdin${bad ? `, ${bad} hata yaptın` : ', hiç hata yapmadın'}.`, () => { paused = false; });
        }, 900);
      }
    }
    // Kırmızı ışık ihlali: flaş + kavşaktaki aracın ani frenlemesi
    function violation(it, msg, toast) {
      flash = G.reduced ? 0.3 : 1; shake = G.reduced ? 0 : 0.5;
      G.Sfx.play('flash');
      setTimeout(() => G.Sfx.play('horn'), 250);
      for (const c of cross) if (c.it === it && Math.abs(c.x) < 22) { c.panic = true; c.v = Math.min(c.v, 6); }
      score(false, msg, toast);
    }
    function onCross(it) {
      const S = sigOf(it);
      if (S.evaluated) return;
      S.evaluated = true;
      const ph = S.phase;
      if (ph === 'green') {
        if (S.stopped) score(true, `✓ Kırmızıda bekledin, yeşil yanınca geçtin.${S.gap != null && S.gap <= 6 ? ' Duruşun da mükemmeldi: çizgiye ' + tr(Math.max(0, S.gap), 1) + ' m.' : ''}`, S.gap != null && S.gap <= 6 ? '✓ Mükemmel duruş + kalkış' : '✓ Yeşilde geçtin');
        else score(true, '✓ Yeşil ışıkta, yayalara dikkat ederek geçtin. Doğru karar.', '✓ Yeşilde geçtin');
      } else if (ph === 'amber') {
        if (S.amberCan === false) score(true, '✓ Sarı yandığında duramayacak kadar yakındın; ani fren yerine kavşağı boşaltman doğruydu.', '✓ Sarıda geçmek doğruydu');
        else score(false, '✗ Sarı yandığında güvenle durabilecek mesafedeydin. Sarı “yol kapanmak üzere” demektir: durabiliyorsan dur.', '✗ Sarıda durmalıydın');
      } else if (ph === 'redamber') violation(it, '✗ Kırmızı + sarı “hazırlan” demektir; yeşil yanmadan kavşağa girilmez.', '✗ Yeşili beklemeliydin');
      else violation(it, '✗ Kırmızı ışıkta geçtin! Kavşaktaki araçlar ve yayalar için büyük tehlike; ihlal kamerası seni kaydetti.', '📸 Kırmızı ışık ihlali');
    }
    function onStop() {
      const it = current();
      if (!it) return;
      const S = sigOf(it), gap = stopZ(it) - front();
      if (gap >= -0.35 && gap < 60) {
        S.stopped = true; S.gap = gap;
        const where = gap <= 6 ? `Tam yerinde durdun (çizgiye ${tr(Math.max(0, gap), 1)} m).` : gap <= 16 ? `Durdun; çizgiye ${Math.round(gap)} m var, biraz daha yaklaşabilirdin.` : `Çizgiye çok uzakta (${Math.round(gap)} m) durdun. “Kalk”a basıp yavaşça yaklaşabilirsin.`;
        if (S.phase === 'green') feedback(panel, `Yeşil yanıyor; durmana gerek yok. <b>“Kalk”a bas</b> ve trafiği aksatmadan devam et.`, '');
        else if (S.phase === 'redamber') feedback(panel, `${where} Kırmızı + sarı yanıyor: hazırlan, yeşili bekle.`, '');
        else feedback(panel, `${where} Işık yeşile dönünce <b>“Kalk”</b>a bas.`, '');
        if (gap <= 6 && S.phase !== 'green') stage.toast('Mükemmel duruş', 'ok', 1100);
      } else if (gap < -0.35 && front() < it.z - 3.6) {
        if (!S.evaluated && S.phase !== 'green') { S.evaluated = true; score(false, '✗ Durma çizgisini geçerek, yaya geçidinin üstünde durdun. Frene daha erken bas.', '✗ Çizgiyi geçtin'); }
      } else if (front() >= it.z - 3.6 && front() < it.z + 4) {
        if (!S.evaluated) { S.evaluated = true; score(false, '✗ Kavşağın ortasında durdun; diğer yönlerin trafiğini kapattın.', '✗ Kavşakta durma'); }
        else feedback(panel, 'Kavşağın içinde durmamalısın. “Kalk”a basıp kavşağı boşalt.', 'bad');
      } else feedback(panel, 'Burada durmak için bir neden yok; trafiği aksatmamak için “Kalk”a bas.', '');
    }
    function go() {
      if (!car.hold) return;
      car.hold = false; car.v = Math.max(car.v, 0.5);
      setBtn();
      G.Sfx.play('tap');
    }
    function press() {
      if (!started) { begin(); return; }
      if (paused) return;
      if (car.hold) go(); else ptrBrake = true;
    }
    function release() { ptrBrake = false; }
    function begin() {
      started = true; paused = false;
      stage.card(null);
      setBtn();
      feedback(panel, 'Yola çıktın. Işığı izle: <b>frene basılı tutarak</b> yavaşla, durunca araç bekler; yeşilde <b>“Kalk”</b>.', '');
      G.Sfx.play('tap');
    }
    function spawnPeds(it, delay) {
      const S = it.sig;
      if (S) S.pedsSpawned = true;
      if (Math.random() < 0.3) return;
      const n = 1 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const dir = (i + Math.floor(Math.random() * 2)) % 2 ? 1 : -1, pp = pick(PEOPLE);
        peds.push({ it, x: -dir * 5.3, z: it.z - 6.35 + rand(-1.2, 1.2), dir, sp: rand(1.9, 2.3), delay: delay * 0.3 + i * rand(0.25, 0.6), phase: rand(0, 6), shirt: pp[0], pants: pp[1], hair: pp[2] });
      }
    }
    function spawnCross(it) {
      for (const dir of [1, -1]) {
        const lane = it.z - dir * 1.75;
        const mine = cross.filter((c) => c.it === it && c.dir === dir);
        const last = mine.reduce((m, c) => (dir > 0 ? Math.min(m, c.x) : Math.max(m, c.x)), dir > 0 ? 999 : -999);
        if (mine.length < 3 && (mine.length === 0 || Math.abs(last) < 55)) {
          const x0 = -dir * (60 + rand(0, 25));
          if (mine.length && Math.abs(x0 - last) < 9) continue;
          cross.push({ it, dir, x: x0, z: lane, v: rand(8, 10), color: pick(R.CAR_COLORS), panic: false });
        }
      }
    }
    function simulate(dt) {
      time += dt;
      const braking = ptrBrake || keyBrake;
      if (car.hold) car.v = 0;
      else if (braking) {
        car.brk = Math.min(1, car.brk + dt / 0.2);
        car.v = Math.max(0, car.v - DEC * car.brk * dt);
        if (car.v === 0) { car.hold = true; setBtn(); onStop(); }
      } else {
        car.brk = Math.max(0, car.brk - dt / 0.12);
        car.v = Math.min(CRUISE, car.v + ACC * dt);
      }
      const f0 = front();
      car.z += car.v * dt;
      const f1 = front();
      world.ensure(car.z + 520);
      world.prune(car.z - 40);
      // Kavşaklar
      for (const it of world.intersIn(car.z - 60, car.z + 460)) {
        if (it.z < car.z - 60) continue;
        if (it.z > car.z + 460) break;
        const S = sigOf(it);
        S.t += dt;
        const dist = stopZ(it) - f1;
        if (car.hold && dist > -0.4 && dist < 60) S.stopT += dt; else if (!car.hold) S.stopT = 0;
        const pedInLane = peds.some((p) => p.it === it && p.delay <= 0 && p.x > -0.6 && p.x < 4.2);
        const pedOnRoad = peds.some((p) => p.it === it && p.delay <= 0 && Math.abs(p.x) < 5.2);
        if (S.phase === 'green') {
          if (!S.fired && dist > 2) {
            if ((S.plan === 'stop' || S.plan === 'dilemma') && dist <= S.trig) { S.fired = true; setPhase(it, 'amber'); }
            else if (S.plan === 'late' && car.v > 6 && dist / car.v <= 0.95) { S.fired = true; setPhase(it, 'amber'); }
          }
        } else if (S.phase === 'amber') { if (S.t >= 3) setPhase(it, 'red'); }
        else if (S.phase === 'red') {
          if (S.plan === 'r2g' && !S.fired) { if (dist < S.trig || S.stopT > 1.6) { S.fired = true; setPhase(it, 'redamber'); } }
          else if (S.t > 3 && (S.stopT > 2.2 || dist < -3) && !pedOnRoad) setPhase(it, 'redamber');
        } else if (S.phase === 'redamber' && S.t >= 1.5) setPhase(it, 'green');
        // Durma çizgisini geçiş anı
        const sz = stopZ(it);
        if (f0 < sz - 0.25 && f1 >= sz - 0.25) onCross(it);
        // Yaya geçidinde yaya varken geçmek
        if (!S.pedWarn && f1 > it.z - 8.6 && f0 < it.z - 4.1 && pedInLane) {
          S.pedWarn = true;
          score(false, '✗ Yaya geçidinde karşıya geçen yaya vardı! Işık ne olursa olsun geçişini tamamlamamış yayaya yol verilir.', '✗ Yayaya yol ver');
        }
        if (Math.abs(it.z - car.z) < 170 && it.z > car.z - 20) spawnCross(it);
      }
      // Kavşak trafiği
      for (const c of cross) {
        const S = c.it.sig || { phase: 'green', t: 0 };
        const goOk = S.phase === 'red' && S.t > 1.1;
        const stopX = -c.dir * 11.6, before = c.dir > 0 ? c.x < stopX : c.x > stopX;
        let target = 10;
        if (c.panic) target = 0;
        else if (!goOk && before) { const gapToLine = Math.abs(stopX - c.x); target = gapToLine < 1 ? 0 : Math.min(10, Math.sqrt(2 * 4.5 * Math.max(0, gapToLine - 0.5))); }
        // Öndeki araca yaklaşma
        for (const o of cross) if (o !== c && o.it === c.it && o.dir === c.dir) { const gp = (o.x - c.x) * c.dir; if (gp > 0 && gp < 7.5) target = Math.min(target, Math.max(0, (gp - 5.5) * 2)); }
        c.v += clamp(target - c.v, -9 * dt, 3.2 * dt);
        if (c.panic && c.v < 0.3) { c.panicT = (c.panicT || 0) + dt; if (c.panicT > 1.8) c.panic = false; }
        c.x += c.dir * c.v * dt;
      }
      cross = cross.filter((c) => Math.abs(c.x) < 95 && c.it.z > car.z - 40);
      // Yayalar
      // Yayalar yalnızca kendi ışıkları yeşilken (bizim kırmızımız) karşıya geçmeye başlar
      for (const p of peds) {
        if (p.delay > 0) { if (p.it.sig && p.it.sig.phase === 'red') p.delay -= dt; continue; }
        p.x += p.dir * p.sp * dt; p.phase += p.sp * 5.2 * dt;
      }
      peds = peds.filter((p) => (p.delay > 0 || Math.abs(p.x) < 5.4) && p.it.z > car.z - 40);
      // Karşı yönden gelen araçlar
      spawnOn -= dt;
      if (spawnOn <= 0) { oncoming.push({ x: -1.75, z: car.z + 360, v: 12.5, color: pick(R.CAR_COLORS), kind: Math.random() < 0.18 ? 'taxi' : Math.random() < 0.12 ? 'minibus' : 'sedan' }); spawnOn = rand(4.5, 9); }
      oncoming.sort((a, b) => a.z - b.z);
      for (let i = 0; i < oncoming.length; i++) {
        const o = oncoming[i];
        let target = 12.5;
        const it = world.prevInter(o.z - 2.2 - 9.9 + 0.5);
        const g2 = it ? (o.z - 2.2) - (it.z + 9.9) : 99;
        if (it && g2 < 40 && it.sig && it.sig.phase !== 'green') target = g2 < 0.8 ? 0 : Math.min(target, Math.sqrt(2 * 4 * Math.max(0, g2 - 0.5)));
        const ahead = oncoming[i - 1];
        if (ahead) { const gp = o.z - ahead.z; if (gp < 9) target = Math.min(target, Math.max(0, (gp - 6.5) * 2)); }
        o.v += clamp(target - o.v, -8 * dt, 3 * dt);
        o.z -= o.v * dt;
      }
      oncoming = oncoming.filter((o) => o.z > car.z - 30);
      // Kaldırımda yürüyenler
      while (walkers.length < 7) { const side = Math.random() < 0.5 ? 1 : -1, pp = pick(PEOPLE); walkers.push({ x: side * rand(4.6, 5.1), z: car.z + rand(30, 300), dz: Math.random() < 0.5 ? 1 : -1, sp: rand(1.1, 1.5), phase: rand(0, 6), shirt: pp[0], pants: pp[1], hair: pp[2] }); }
      for (const w of walkers) { w.z += w.dz * w.sp * dt; w.phase += w.sp * 5 * dt; }
      walkers = walkers.filter((w) => w.z > car.z - 20 && !world.interNear(w.z, -2));
      if (flash > 0) flash = Math.max(0, flash - dt * 2.6);
      if (shake > 0) shake = Math.max(0, shake - dt);
      parts.update(dt);
    }
    function paintHud() {
      const it = current();
      const S = it ? sigOf(it) : null;
      const ph = S ? S.phase : 'green';
      chipL.set((stage.narrow ? SHORT : TEXT)[ph]);
      chipL.el.querySelector('.hc-dot').style.background = DOT[ph];
      chipL.el.querySelector('.hc-dot').style.boxShadow = `0 0 12px ${DOT[ph]}`;
      chipS.set(`${Math.round(car.v * 3.6)} km/s`);
      const dist = it ? stopZ(it) - front() : 999;
      chipD.show(dist < 130 && dist > -1).set(`${Math.max(0, Math.round(dist))} m`, dist < 18 && ph !== 'green' ? '#ffb4ab' : '');
      $$('.rule-list li', panel).forEach((li) => li.classList.toggle('now', li.dataset.phase === ph));
    }
    function draw(t) {
      const ctx = stage.begin(), W = stage.w, H = stage.h;
      if (!W) return;
      const narrow = stage.narrow;
      v.hfov = narrow ? 58 : 62;
      v.viewport(0, 0, W, H, narrow ? 0.36 : 0.34);
      const dip = car.brk * (car.v > 0.5 ? 1 : 0) * 5 - (car.v < CRUISE - 0.5 && !car.brk && !car.hold && started ? 2 : 0);
      v.cy += dip;
      if (shake > 0 && !G.reduced) { v.cx += Math.sin(t * 0.09) * shake * 6; v.cy += Math.cos(t * 0.11) * shake * 4; }
      v.cam.x = lerp(v.cam.x || 1.2, 1.2, 0.1); v.cam.y = 2.55; v.cam.z = car.z - CAM_BACK; v.cam.yaw = 0;
      const P = R.palette(stage.night);
      const dyn = [];
      dyn.push({ type: 'car', view: 'rear', kind: 'player', x: car.x, z: car.z, brake: car.brk > 0.05 || car.hold, bias: -0.5 });
      for (const o of oncoming) dyn.push({ type: 'car', view: 'front', x: o.x, z: o.z, color: o.color, kind: o.kind, head: stage.night });
      for (const c of cross) dyn.push({ type: 'car', view: 'side', x: c.x, z: c.z, dir: c.dir, color: c.color, brake: c.v < 2 });
      for (const p of peds) if (p.delay <= 0) dyn.push({ type: 'ped', x: p.x, z: p.z, dir: p.dir, phase: p.phase, shirt: p.shirt, pants: p.pants, hair: p.hair });
      for (const w of walkers) dyn.push({ type: 'ped', x: w.x, z: w.z, dir: w.x > 0 ? -1 : 1, phase: w.phase, shirt: w.shirt, pants: w.pants, hair: w.hair });
      const lights = stage.night ? [{ kind: 'beam', x: car.x, z: front() + 0.2, dir: 1, len: 38, a: 0.5 }, ...oncoming.map((o) => ({ kind: 'beam', x: o.x, z: o.z - 2.3, dir: -1, len: 18, a: 0.3 }))] : [];
      R.render(ctx, v, world, P, dyn, {
        time: t / 1000, lights,
        decals: (c, vv) => {
          if (!started || car.hold || car.v < 1) return;
          // “Şimdi frene bassan burada durursun” bandı
          const it = current(), S = it && sigOf(it);
          const sd = (car.v * car.v) / (2 * DEC), fz = front();
          const danger = S && S.phase !== 'green' && fz + sd > stopZ(it) - 0.3 && fz < stopZ(it);
          const col = danger ? '255,70,60' : S && S.phase !== 'green' ? '60,220,120' : '255,255,255';
          vv.quad(c, car.x - 1.05, car.x + 1.05, fz + 0.3, fz + sd, `rgba(${col},${danger ? 0.26 : 0.16})`);
          vv.quad(c, car.x - 1.15, car.x + 1.15, fz + sd, fz + sd + 0.35, `rgba(${col},${danger ? 0.8 : 0.55})`);
        }
      });
      parts.draw(ctx);
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${(flash * 0.85).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    }
    const L = G.loop((dt, t) => {
      stage.tick(dt);
      if (started && !paused && !stage.hasCard) simulate(dt);
      paintHud();
      draw(t);
    });
    G.hold(mainBtn, press, release);
    stage.canvas.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); press(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => stage.canvas.addEventListener(n, release));
    pauseButton(panel, () => { paused = !paused; return paused; });
    $('[data-act="reset"]', panel).addEventListener('click', () => { build(); started = true; paused = false; stage.card(null); setBtn(); resetPause(panel); feedback(panel, 'Baştan başladın. Işığı izle ve doğru anda karar ver.', ''); });
    function intro() {
      stage.card({
        icon: '<svg class="ic"><use href="#i-light"/></svg>',
        title: 'Direksiyon sende',
        text: 'Kavşaklara yaklaşırken ışığı izle. <b>Frene basılı tutarak</b> yavaşla ve dur; araç durunca bekler, yeşil yanınca <b>Kalk</b>’a bas.',
        keys: [['Boşluk', 'Fren (basılı tut)'], ['Boşluk / ↑', 'Kalk'], ['Dokun', 'Sahneye basılı tut = fren']],
        buttons: [{ label: 'Başla <svg class="ic"><use href="#i-play"/></svg>', cls: 'btn-red', onClick: begin }],
        focus: false
      });
    }
    return {
      init() {
        if (!built) { built = true; build(); started = false; paused = false; setBtn(); intro(); feedback(panel, 'Hazır olduğunda <b>Başla</b>’ya bas.', ''); }
      },
      start() { this.init(); L.start(); },
      stop() { L.stop(); ptrBrake = false; keyBrake = false; },
      key(e) {
        if (e.code === 'Space' || e.code === 'ArrowDown') { if (!started) { begin(); return true; } if (car.hold) go(); else keyBrake = true; return true; }
        if (e.code === 'ArrowUp' || e.code === 'Enter') { if (car.hold) { go(); return true; } }
        return false;
      },
      keyup(e) { if (e.code === 'Space' || e.code === 'ArrowDown') { keyBrake = false; return true; } return false; },
      debug() { const it = current(); return { z: car.z, v: car.v, hold: car.hold, ok, bad, started, next: it && { z: it.z, stop: stopZ(it) - front(), phase: sigOf(it).phase, plan: sigOf(it).plan } }; }
    };
  })();

  /* =========================================================
     DERS 2 — Kim önce geçer? (kuşbakışı kavşak bulmacası)
     Araçlara geçiş sırasına göre dokunulur. Yanlış seçimde araçlar kıl payı fren yapar ve geri çekilir.
     ========================================================= */
  const lessonGecis = (() => {
    const id = 'gecis', panel = panelOf(id), host = $('.sim', panel);
    const stage = new G.Stage(host, { height: (w) => (w < 560 ? Math.round(w * 1.08) : Math.round(clamp(w * 0.64, 380, 580))) });
    const v = new T.View2D(), D = T.D;
    const RC = 9; // dönel kavşak şerit yarıçapı
    const ringPt = (a) => [RC * Math.cos(a), RC * Math.sin(a)];
    const ROUTES = {
      'S-N': [{ p: [1.75, 11.9] }, { p: [1.75, -46] }],
      'N-S': [{ p: [-1.75, -11.9] }, { p: [-1.75, 46] }],
      'W-E': [{ p: [-11.9, 1.75] }, { p: [46, 1.75] }],
      'E-W': [{ p: [11.9, -1.75] }, { p: [-46, -1.75] }],
      'S-W': [{ p: [1.75, 11.9] }, { p: [1.75, 4.6] }, { q: [1.75, -1.75], p: [-4.6, -1.75] }, { p: [-46, -1.75] }],
      'RING-A': [{ p: ringPt(0.8 * Math.PI) }, { arc: [0, 0, RC, 0.8 * Math.PI, 0.55] }, { q: [9.7, 1.75], p: [13.2, 1.75] }, { p: [46, 1.75] }],
      'RING-B': [{ p: [1.75, 17.3] }, { p: [1.75, 13.2] }, { q: [1.75, 9.4], p: ringPt(1.02) }, { arc: [0, 0, RC, 1.02, -1.02] }, { q: [1.75, -9.4], p: [1.75, -13.2] }, { p: [1.75, -46] }]
    };
    const SIGN = (sid) => G.svgImage(KIT.sign(sid), 192);
    const SCEN = [
      { kind: 'x', title: 'İşaretsiz kavşak', cars: [{ id: 'A', route: 'S-N', kindV: 'player' }, { id: 'B', route: 'E-W', color: '#2f63c8' }], order: ['B', 'A'],
        hint: 'Levha ya da ışık yok. A aracına göre hangi araç sağdan geliyor?',
        why: 'İşaretsiz kavşakta <b>sağdan gelene yol verilir</b>. A aracına göre B sağdan geliyor; önce B geçer.' },
      { kind: 'x', title: 'Ana yol – tali yol', yieldS: true, signs: [['yolver', 5.2, 10.6], ['anayol', -10.6, 5.2]], cars: [{ id: 'A', route: 'W-E', color: '#2f63c8' }, { id: 'B', route: 'S-N', kindV: 'player' }], order: ['A', 'B'],
        hint: 'Levhalara bak: B aracının önünde hangi levha var?',
        why: 'Sağdan gelen kuralına göre B önce geçerdi; ama <b>levhalar genel kuraldan önce gelir</b>. “Yol ver” levhalı tali yoldaki B, ana yoldaki A’ya yol verir.' },
      { kind: 'o', title: 'Dönel kavşak', signs: [['ada', 5.4, 16.2], ['yolver', 5.4, 19.6]], cars: [{ id: 'A', route: 'RING-A', kindV: 'taxi', color: '#f5c518' }, { id: 'B', route: 'RING-B', kindV: 'player', blink: 'L' }], order: ['A', 'B'],
        hint: 'Biri kavşağın içinde dönüyor, diğeri girmeyi bekliyor.',
        why: '<b>Dönel kavşağa giren, kavşağın içindeki araca yol verir.</b> Önce içerideki A geçer, sonra B kavşağa girer.' },
      { kind: 'x', title: 'Geçiş üstünlüğü', cars: [{ id: 'A', route: 'S-N', kindV: 'player' }, { id: 'B', route: 'W-E', kindV: 'ambulance', siren: true }], order: ['B', 'A'],
        hint: 'Işıklarını yakıp siren çalan bir ambulans var.',
        why: 'Normalde sağdan gelen A önce geçerdi; ama <b>ışıklı ve sesli uyarı veren ambulansa her durumda yol verilir.</b>' },
      { kind: 'x', title: 'Sola dönüş', cars: [{ id: 'A', route: 'S-W', kindV: 'player', blink: 'L' }, { id: 'B', route: 'N-S', color: '#3f7d55' }], order: ['B', 'A'],
        hint: 'A sola dönmek istiyor, B karşıdan düz geliyor.',
        why: '<b>Sola dönen araç, karşı yönden gelip düz giden araca yol verir.</b> Önce B geçer, sonra A döner.' },
      { kind: 'x', title: 'Trafik görevlisi', police: true, lights: { S: 'green', W: 'red' }, cars: [{ id: 'A', route: 'S-N', kindV: 'player' }, { id: 'B', route: 'W-E', color: '#8c2f2b' }], order: ['B', 'A'],
        hint: 'A’nın ışığı yeşil; ama kavşakta kollarını yana açmış bir trafik görevlisi var.',
        why: '<b>Trafik görevlisinin işareti ışıklardan önce gelir.</b> Kollar yana açıkken görevlinin göğsü ve sırtı tarafındaki araçlar (A) durur; yanlarındaki araçlar (B) geçer.' }
    ];
    const goal = goalBar(panel, SCEN.length);
    const nextBtn = $('[data-act="next"]', panel);
    const chip = stage.chip('l', 'durum', 'Durum');
    let si = 0, step = 0, busy = false, solved = new Set(), cars = [], bad = 0, built = false, bg = null, bgKey = '', marks = [], bubbles = [], t0 = 0;

    function car(c) {
      const r = T.route(ROUTES[c.route]);
      const p = r.at(0);
      return Object.assign({}, c, { r, d: 0, x: p.x, y: p.y, ang: p.ang, gone: false, moving: false, brake: true, ord: 0 });
    }
    function drawStatic(ctx, sc, P) {
      ctx.save(); v.apply(ctx);
      const E = 60;
      D.earth(ctx, v, P, -E, -E, 2 * E, 2 * E);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) D.walk(ctx, v, P, sx < 0 ? -E : 3.5, sy < 0 ? -E : 3.5, E - 3.5, E - 3.5);
      if (sc.kind === 'o') {
        D.asphalt(ctx, v, P, -3.5, -E, 7, 2 * E); D.asphalt(ctx, v, P, -E, -3.5, 2 * E, 7);
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 12.8, 0, Math.PI * 2); ctx.clip(); D.asphalt(ctx, v, P, -13, -13, 26, 26); ctx.restore();
        ctx.strokeStyle = P.curb; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.arc(0, 0, 12.8, 0, Math.PI * 2); ctx.stroke();
        // Adaya giden yollar ve ayırıcı adacıklar
        for (let k = 0; k < 4; k++) {
          ctx.save(); ctx.rotate((k * Math.PI) / 2);
          ctx.fillStyle = P.walk; ctx.beginPath(); ctx.moveTo(0, 12.9); ctx.lineTo(-0.9, 18.5); ctx.quadraticCurveTo(0, 19.3, 0.9, 18.5); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = P.curb; ctx.lineWidth = 0.16; ctx.stroke();
          // Yol ver çizgisi + köpek dişi
          ctx.fillStyle = P.roadLine;
          for (let x = 0.5; x < 3.3; x += 0.9) { ctx.beginPath(); ctx.moveTo(x, 14.4); ctx.lineTo(x + 0.7, 14.4); ctx.lineTo(x + 0.35, 15.1); ctx.closePath(); ctx.fill(); }
          ctx.restore();
        }
        // Ada
        ctx.fillStyle = shade(P.walk, -0.04); ctx.beginPath(); ctx.arc(0, 0, 6.1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = P.curb; ctx.lineWidth = 0.2; ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 5.3, 0, Math.PI * 2); ctx.clip(); D.grass(ctx, v, P, -6, -6, 12, 12); ctx.restore();
        ctx.strokeStyle = alpha(P.roadLine, 0.7); ctx.lineWidth = 0.12; ctx.setLineDash([0.6, 0.5]); ctx.beginPath(); ctx.arc(0, 0, 6.35, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        const fl = ['#e8412f', '#ffd24a', '#ff8a3d', '#f4f1e8'];
        for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; ctx.fillStyle = fl[i % 4]; ctx.beginPath(); ctx.arc(Math.cos(a) * 3.9, Math.sin(a) * 3.9, 0.32, 0, Math.PI * 2); ctx.fill(); }
        D.tree(ctx, v, P, 0, 0, 2.3, 7);
        D.line(ctx, P, 0, -E, 0, -19.4, { dash: [3, 3] }); D.line(ctx, P, 0, 19.4, 0, E, { dash: [3, 3] });
        D.line(ctx, P, -E, 0, -19.4, 0, { dash: [3, 3] }); D.line(ctx, P, 19.4, 0, E, 0, { dash: [3, 3] });
      } else {
        D.asphalt(ctx, v, P, -3.5, -E, 7, 2 * E); D.asphalt(ctx, v, P, -E, -3.5, 2 * E, 7);
        for (const s of [-1, 1]) {
          D.curb(ctx, P, -E, s * 3.5, -3.5, s * 3.5); D.curb(ctx, P, 3.5, s * 3.5, E, s * 3.5);
          D.curb(ctx, P, s * 3.5, -E, s * 3.5, -3.5); D.curb(ctx, P, s * 3.5, 3.5, s * 3.5, E);
        }
        D.line(ctx, P, 0, -E, 0, -9.6, { dash: [3, 3] }); D.line(ctx, P, 0, 9.6, 0, E, { dash: [3, 3] });
        D.line(ctx, P, -E, 0, -9.6, 0, { dash: [3, 3] }); D.line(ctx, P, 9.6, 0, E, 0, { dash: [3, 3] });
        D.zebra(ctx, P, -3.3, 4.4, 3.3, 8.4, true); D.zebra(ctx, P, -3.3, -8.4, 3.3, -4.4, true);
        D.zebra(ctx, P, 4.4, -3.3, 8.4, 3.3, false); D.zebra(ctx, P, -8.4, -3.3, -4.4, 3.3, false);
        if (sc.yieldS) {
          D.line(ctx, P, 0.2, 9.3, 3.4, 9.3, { w: 0.28, dash: [0.6, 0.4] });
          ctx.fillStyle = P.roadLine; for (let x = 0.4; x < 3.2; x += 0.9) { ctx.beginPath(); ctx.moveTo(x, 9.7); ctx.lineTo(x + 0.7, 9.7); ctx.lineTo(x + 0.35, 10.4); ctx.closePath(); ctx.fill(); }
        } else D.line(ctx, P, 0.1, 9.3, 3.4, 9.3, { w: 0.4 });
        D.line(ctx, P, -3.4, -9.3, -0.1, -9.3, { w: 0.4 });
        D.line(ctx, P, -9.3, 0.1, -9.3, 3.4, { w: 0.4 }); D.line(ctx, P, 9.3, -3.4, 9.3, -0.1, { w: 0.4 });
      }
      // Köşe binaları ve ağaçlar
      const bs = sc.kind === 'o' ? 15.5 : 9;
      D.building(ctx, v, P, -bs - 16, -bs - 14, 15, 13, { seed: 3 + si, height: 7 });
      D.building(ctx, v, P, bs + 0.5, -bs - 14, 15, 13, { seed: 5 + si, roof: 'tile', height: 6 });
      D.building(ctx, v, P, -bs - 14, bs + 0.5, 13, 15, { seed: 7 + si, roof: 'tile', height: 6 });
      D.building(ctx, v, P, bs + 1, bs + 1.5, 15, 14, { seed: 9 + si, height: 9 });
      const tr = sc.kind === 'o' ? [[-16, -5.6], [16, 5.6], [5.6, -16], [-5.6, 16]] : [[-5.6, -13], [5.6, 14.5], [13, -5.6], [-14.5, 5.6], [-5.6, -21], [21, -5.6]];
      tr.forEach(([x, y], i) => D.tree(ctx, v, P, x, y, 1.6, 11 + i + si * 3));
      const lampPts = sc.kind === 'o' ? [[13.6, 5], [-13.6, -5]] : [[4.3, -5.3, -Math.PI / 2], [-4.3, 5.3, Math.PI / 2]];
      lampPts.forEach(([x, y, a = 0]) => { D.lamp(ctx, P, x, y, a); if (P.night) D.lampGlow(ctx, P, x, y, a); });
      ctx.restore();
    }
    function render() {
      const sc = SCEN[si];
      step = 0; busy = false; marks = []; bubbles = [];
      cars = sc.cars.map(car);
      stage.clearSpots();
      cars.forEach((c) => {
        const b = stage.spot(c.id, `${c.id} aracı${c.kindV === 'ambulance' ? ' (ambulans)' : ''}`, () => pick(c));
        c.spot = b;
      });
      chip.label(`Durum ${si + 1}/${SCEN.length}`).set(sc.title);
      goal.set(solved.size, bad);
      feedback(panel, `Hangi araç önce geçer? Araçlara <b>geçiş sırasına göre</b> dokun. <span class="fb-hint">İpucu: ${sc.hint}</span>`, '');
      nextBtn.hidden = true;
      bgKey = '';
    }
    function layout() {
      const W = stage.w, H = stage.h;
      const sc = SCEN[si];
      const R0 = sc.kind === 'o' ? 20.5 : 17.5;
      v.fit(W, H, -R0, -R0, R0, R0, 6);
    }
    function drive(c, dist, ms, easeFn = G.easeInOut) {
      c.moving = true; c.brake = false;
      const d0 = c.d;
      return G.tween(ms, (e) => { c.d = d0 + (dist - d0) * e; const p = c.r.at(c.d); c.x = p.x; c.y = p.y; c.ang = p.ang; }, easeFn);
    }
    async function pick(c) {
      if (busy || c.gone) return;
      const sc = SCEN[si];
      const want = sc.order[step];
      if (c.id !== want) {
        busy = true; bad++; goal.set(solved.size, bad);
        G.Sfx.play('screech');
        const other = cars.find((o) => o.id === want);
        feedback(panel, `✗ ${c.id} şimdi geçemez! <span class="fb-hint">İpucu: ${sc.hint}</span>`, 'bad');
        stage.toast(`✗ Önce ${want} geçmeliydi`, 'bad');
        await Promise.all([drive(c, 4.6, 650, G.easeOut), other && !other.gone ? drive(other, 2.6, 650, G.easeOut) : Promise.resolve()]);
        c.brake = true; if (other) other.brake = true;
        const mx = other ? (c.x + other.x) / 2 : c.x, my = other ? (c.y + other.y) / 2 : c.y;
        marks.push({ x: mx, y: my, t: performance.now() });
        if (sc.police) bubbles.push({ x: 0, y: -1.2, text: 'Düüüt! Dur!', color: '#1f5fd1', t: performance.now() });
        G.Sfx.play('horn');
        await G.wait(750);
        await Promise.all([drive(c, 0, 600), other && !other.gone ? drive(other, 0, 600) : Promise.resolve()]);
        c.moving = false; if (other) other.moving = false;
        marks = []; bubbles = [];
        busy = false;
        return;
      }
      busy = true;
      step++;
      c.ord = step;
      G.Sfx.play('tap');
      feedback(panel, `✓ ${c.id} geçiyor…`, 'ok');
      c.blinkOn = true;
      await drive(c, c.r.len, Math.max(1500, c.r.len * 34), (u) => u * u * (3 - 2 * u) * 0.35 + u * 0.65);
      c.gone = true; c.moving = false;
      busy = false;
      if (step === sc.order.length) {
        solved.add(si);
        goal.set(solved.size, bad);
        G.Sfx.play('ok');
        stage.toast('✓ Doğru sıra: ' + sc.order.join(' → '), 'ok');
        feedback(panel, `✓ Doğru sıra: ${sc.order.join(' → ')}. ${sc.why}`, 'ok');
        nextBtn.hidden = false;
        $('span', nextBtn).textContent = solved.size === SCEN.length && si === SCEN.length - 1 ? 'Baştan oyna' : 'Sonraki durum';
        if (solved.size === SCEN.length && !done.has(id)) {
          complete(id, host);
          setTimeout(() => finishCard(stage, id, bad, `Altı kavşak durumunun hepsinde doğru geçiş sırasını buldun${bad ? ` (${bad} hata)` : ', hem de hatasız'}.`), 700);
        }
      }
    }
    function nextScen() {
      if (solved.size === SCEN.length && si === SCEN.length - 1) si = 0;
      else {
        let n = (si + 1) % SCEN.length, guard = 0;
        while (solved.has(n) && guard++ < SCEN.length && solved.size < SCEN.length) n = (n + 1) % SCEN.length;
        si = n;
      }
      render(); layout();
    }
    function frame(dt, now) {
      const ctx = stage.begin(), W = stage.w, H = stage.h;
      if (!W) return;
      const sc = SCEN[si], P = T.palette(stage.night);
      const key = si + '|' + W + 'x' + H + '|' + stage.theme + '|' + stage.dpr;
      if (key !== bgKey) { layout(); bg = T.bake(stage, (c) => drawStatic(c, sc, P)); bgKey = key; }
      ctx.drawImage(bg, 0, 0, W, H);
      ctx.save(); v.apply(ctx);
      // Levhalar ve ışıklar
      (sc.signs || []).forEach(([sid, x, y]) => D.sign(ctx, P, x, y, SIGN(sid), 2.6));
      if (sc.lights) { D.signal(ctx, P, 4.6, 9.8, 0, sc.lights.S, now / 1000); D.signal(ctx, P, -9.8, 4.6, 0, sc.lights.W, now / 1000); }
      // Rota önizlemesi: bekleyen araçların önünde kesikli ok
      for (const c of cars) {
        if (c.gone || c.moving) continue;
        const len = Math.min(c.r.len, c.route.startsWith('RING') ? 11 : c.route === 'S-W' ? 15 : 10);
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 0.34; ctx.setLineDash([0.9, 0.7]); ctx.lineCap = 'round';
        ctx.beginPath();
        for (let d = 3.2; d <= len; d += 0.4) { const p = c.r.at(d); if (d <= 3.21) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
        ctx.stroke(); ctx.setLineDash([]);
        const e = c.r.at(len), e0 = c.r.at(len - 0.6);
        const a = Math.atan2(e.y - e0.y, e.x - e0.x);
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * 0.9, e.y + Math.sin(a) * 0.9); ctx.lineTo(e.x + Math.cos(a + 2.4) * 0.8, e.y + Math.sin(a + 2.4) * 0.8); ctx.lineTo(e.x + Math.cos(a - 2.4) * 0.8, e.y + Math.sin(a - 2.4) * 0.8); ctx.closePath(); ctx.fill();
      }
      if (sc.police) T.ped(ctx, v, 0, 0, Math.PI, { officer: true, walk: false, k: 2.2 });
      for (const c of cars) {
        if (c.gone) continue;
        const blink = c.blink && !c.gone && (!c.moving || c.d < c.r.len * 0.45);
        T.vehicle(ctx, v, c.x, c.y, c.ang, { kind: c.kindV || 'sedan', color: c.color, brake: c.brake && !c.moving, blinkL: blink && c.blink === 'L', blinkR: blink && c.blink === 'R', siren: c.siren, night: stage.night });
      }
      ctx.restore();
      // Ekran uzayı: rozetler, sıra numaraları, uyarılar
      for (const c of cars) {
        if (c.gone) { if (c.spot) c.spot.disabled = true; continue; }
        const X = v.X(c.x), Y = v.Y(c.y);
        const pad = Math.max(56, v.scale * 5);
        if (c.spot) stage.placeSpot(c.spot, X, Y, pad, pad);
        T.badge(ctx, X - v.scale * 1.9, Y - v.scale * 1.9, c.id, c.ord ? '#1fbf6a' : '#16171b', Math.max(11, v.scale * 0.85));
        if (c.ord) T.badge(ctx, X + v.scale * 1.9, Y - v.scale * 1.9, String(c.ord), '#1fbf6a', Math.max(9, v.scale * 0.65));
      }
      for (const m of marks) {
        const X = v.X(m.x), Y = v.Y(m.y), k = 1 + Math.sin((now - m.t) / 60) * 0.08;
        ctx.save(); ctx.translate(X, Y); ctx.scale(k, k);
        ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(19, 12); ctx.lineTo(-19, 12); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '900 20px Archivo, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 2);
        ctx.restore();
      }
      for (const b of bubbles) T.bubble(ctx, v.X(b.x), v.Y(b.y) - 18, b.text, b.color);
    }
    const L = G.loop((dt, t) => { stage.tick(dt); frame(dt, t); });
    nextBtn.addEventListener('click', nextScen);
    $('[data-act="reset"]', panel).addEventListener('click', () => { if (busy) return; si = 0; solved = new Set(); bad = 0; render(); layout(); });
    return {
      init() { if (!built) { built = true; render(); } },
      start() { this.init(); L.start(); },
      stop() { L.stop(); },
      key(e) {
        if (e.code === 'Enter' && !nextBtn.hidden) { nextScen(); return true; }
        const m = { KeyA: 'A', KeyB: 'B', KeyC: 'C' }[e.code];
        if (m) { const c = cars.find((q) => q.id === m); if (c) { pick(c); return true; } }
        return false;
      }
    };
  })();

  /* =========================================================
     DERS 3 — Levhaların dili (3B “levha avı”)
     Kırsal yolda ilerlerken yol kenarındaki levhalar yaklaşır; levhayı geçmeden grubunu seç.
     Yanlış bildiğin ya da kaçırdığın levha birazdan yeniden karşına çıkar.
     ========================================================= */
  const lessonLevha = (() => {
    const id = 'levha', panel = panelOf(id), host = $('.sim', panel);
    const stage = new G.Stage(host, { height: (w) => (w < 560 ? Math.round(w * 0.98) : Math.round(clamp(w * 0.5, 320, 480))) });
    const v = new R.View3D();
    const GOAL = 8, SPEED = 60 / 3.6, GAP = 105, VIEW = 150, HALF = 2.2;
    const POOL = Object.entries(KIT.SIGNS).filter(([sid, s]) => ['uyari', 'yasak', 'mecburi', 'bilgi'].includes(s.cat) && !['hizsonu', 'yasaksonu', 'hiz30', 'yerlesim'].includes(sid)).map(([sid, s]) => ({ id: sid, ...s }));
    const CATN = { uyari: 'Tehlike uyarı', yasak: 'Yasaklama / kısıtlama', mecburi: 'Mecburiyet', bilgi: 'Bilgi' };
    const CAT = {
      uyari: 'üçgen ve kırmızı çerçeveli: <b>tehlike uyarı</b> işareti',
      yasak: 'yuvarlak ve kırmızı çerçeveli: <b>yasaklama / kısıtlama</b> işareti',
      mecburi: 'yuvarlak ve mavi zeminli: <b>mecburiyet</b> işareti',
      bilgi: 'kare ve mavi zeminli: <b>bilgi</b> işareti'
    };
    const DESC = { girisyok: 'yuvarlak ve kırmızı zeminli: <b>yasaklama</b> işareti', parkyasak: 'yuvarlak, kırmızı çerçeveli ve mavi zeminli: <b>yasaklama</b> işareti', durakparkyasak: 'yuvarlak, kırmızı çerçeveli ve mavi zeminli: <b>yasaklama</b> işareti' };
    const goal = goalBar(panel, GOAL);
    const cats = $$('.lv-cat', panel);
    const chipL = stage.chip('l', 'lv', 'Levha avı');
    // Sağ üstte büyütülmüş levha önizlemesi ve süre halkası
    const prev = document.createElement('div');
    prev.className = 'lv-prev';
    prev.innerHTML = '<svg class="lv-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54"/><circle class="lv-ring-v" cx="60" cy="60" r="54"/></svg><img class="lv-img" alt=""><span class="lv-cap">İlerideki levha</span>';
    stage.hudR.appendChild(prev);
    const prevImg = $('.lv-img', prev), prevCap = $('.lv-cap', prev), ringV = $('.lv-ring-v', prev);
    const imgs = {};
    const imgOf = (sid) => imgs[sid] || (imgs[sid] = G.svgImage(KIT.sign(sid), 256));
    const urlOf = (sid) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(KIT.sign(sid));
    let world, car, signs, queue, ok, bad, streak, best, started, paused, built, nextZ, parts, flash, held = null, clock = 0;

    function newDeck() {
      const by = (c) => shuffle(POOL.filter((s) => s.cat === c));
      return shuffle([...by('uyari').slice(0, 3), ...by('yasak').slice(0, 3), ...by('mecburi').slice(0, 2), ...by('bilgi').slice(0, 2)]).map((s) => s.id);
    }
    function build() {
      world = new R.World({ kind: 'rural', seed: 40 + Math.floor(Math.random() * 1000) });
      car = { z: 0, v: SPEED * 0.6 };
      signs = []; queue = newDeck(); ok = 0; bad = 0; streak = 0; best = 0; nextZ = 95; parts = new G.Particles(); flash = null; held = null;
      world.ensure(520);
      goal.set(0, 0);
      cats.forEach((c) => { c.disabled = false; c.classList.remove('right', 'wrong'); });
      paintPrev(null);
    }
    function spawn() {
      while (nextZ < car.z + 460) {
        if (!queue.length) queue = newDeck();
        const sid = queue.shift();
        signs.push({ sid, z: nextZ, img: imgOf(sid), state: null, halo: null });
        nextZ += GAP + rand(0, 30);
      }
    }
    // Önizlemedeki levha: cevaplanan levha 1,6 sn (ya da geçilene dek) sonucuyla kalır, sonra sıradaki gelir
    function active() {
      if (held && clock < held.until && held.s.z > car.z + HALF) return null;
      held = null;
      return signs.find((s) => !s.state && s.z > car.z + HALF + 1 && s.z - car.z < VIEW) || null;
    }
    function paintPrev(s) {
      if (!s) { prev.classList.remove('show'); return; }
      if (prev.dataset.sid !== s.sid) { prev.dataset.sid = s.sid; prevImg.src = urlOf(s.sid); prev.classList.remove('ok', 'bad'); prevCap.textContent = 'Bu levha hangi gruba girer?'; }
      prev.classList.add('show');
      const f = clamp((s.z - car.z - HALF) / (VIEW - HALF), 0, 1);
      ringV.style.strokeDashoffset = String((1 - f) * 339.3);
      ringV.style.stroke = f < 0.3 ? '#ff5a4e' : f < 0.6 ? '#ffc83d' : '#3ddc84';
    }
    function answer(cat) {
      if (!started) { begin(); return; }
      if (paused) return;
      const s = active();
      if (!s) { stage.toast('Yaklaşan levhayı bekle', 'info', 900); return; }
      const S = KIT.SIGNS[s.sid], right = cat === S.cat;
      s.state = right ? 'ok' : 'bad';
      s.halo = right ? '#27d35f' : '#ff3b30';
      held = { s, until: clock + 1.6 };
      if (right) { ok++; streak++; best = Math.max(best, streak); } else { bad++; streak = 0; queue.splice(Math.min(queue.length, 2), 0, s.sid); }
      goal.set(ok, bad);
      cats.forEach((c) => { c.classList.remove('right', 'wrong'); if (c.dataset.cat === S.cat) c.classList.add('right'); else if (c.dataset.cat === cat) c.classList.add('wrong'); });
      clearTimeout(answer._t); answer._t = setTimeout(() => cats.forEach((c) => c.classList.remove('right', 'wrong')), 1100);
      prev.classList.add(right ? 'ok' : 'bad');
      prevCap.textContent = S.name;
      G.Sfx.play(right ? 'ok' : 'bad');
      stage.toast(right ? (streak >= 3 ? `✓ ${CATN[S.cat]} · Seri x${streak}` : `✓ ${CATN[S.cat]}`) : `✗ Doğrusu: ${CATN[S.cat]}`, right ? 'ok' : 'bad', 1300);
      feedback(panel, `${right ? '✓ Doğru!' : '✗ Yanlış.'} Bu levha ${DESC[s.sid] || CAT[S.cat]} — “${S.name}”.${right ? '' : ' <span class="fb-hint">Birazdan yeniden karşına çıkacak.</span>'}`, right ? 'ok' : 'bad');
      if (right && ok === GOAL && !done.has(id)) {
        complete(id, host);
        setTimeout(() => { paused = true; finishCard(stage, id, bad, `${GOAL} levhayı doğru grupladın${best >= 4 ? `; en uzun serin ${best} levha` : ''}.`, () => { paused = false; }); }, 1200);
      }
    }
    function miss(s) {
      s.state = 'miss'; s.halo = '#ff3b30';
      held = { s, until: clock + 1.2 };
      bad++; streak = 0;
      queue.splice(Math.min(queue.length, 2), 0, s.sid);
      goal.set(ok, bad);
      const S = KIT.SIGNS[s.sid];
      prev.classList.add('bad'); prevCap.textContent = S.name;
      G.Sfx.play('bad');
      stage.toast(`✗ Kaçırdın: ${CATN[S.cat]}`, 'bad', 1300);
      feedback(panel, `✗ Levhayı geçmeden seçmedin. Bu levha ${DESC[s.sid] || CAT[S.cat]} — “${S.name}”.`, 'bad');
    }
    function begin() {
      started = true; paused = false; stage.card(null);
      feedback(panel, 'Yola çıktın. Levha yaklaşınca sağ üstte büyür: <b>geçmeden</b> grubunu seç (1–4).', '');
      G.Sfx.play('tap');
    }
    function simulate(dt) {
      clock += dt;
      car.v = Math.min(SPEED, car.v + 3 * dt);
      car.z += car.v * dt;
      world.ensure(car.z + 520); world.prune(car.z - 40);
      spawn();
      for (const s of signs) if (!s.state && s.z < car.z + HALF + 0.5) miss(s);
      signs = signs.filter((s) => s.z > car.z - 30);
      parts.update(dt);
    }
    function draw(t) {
      const ctx = stage.begin(), W = stage.w, H = stage.h;
      if (!W) return;
      v.hfov = stage.narrow ? 56 : 60;
      v.viewport(0, 0, W, H, stage.narrow ? 0.36 : 0.35);
      v.cam.x = 1.4; v.cam.y = 2.5; v.cam.z = car.z - 9.4; v.cam.yaw = 0;
      const P = R.palette(stage.night);
      const dyn = [{ type: 'car', view: 'rear', kind: 'player', x: 1.75, z: car.z, bias: -0.5 }];
      for (const s of signs) dyn.push({ type: 'sign', x: 4.9, z: s.z, img: s.img, k: 1.55, halo: s.halo });
      R.render(ctx, v, world, P, dyn, { time: t / 1000, lights: stage.night ? [{ kind: 'beam', x: 1.75, z: car.z + 2.4, dir: 1, len: 40, a: 0.5 }] : [] });
    }
    const L = G.loop((dt, t) => {
      stage.tick(dt);
      if (started && !paused && !stage.hasCard) simulate(dt);
      const s = active();
      if (s) paintPrev(s); else if (!held) paintPrev(null);
      chipL.set(`Doğru ${ok}/${GOAL}${streak >= 2 ? ` · Seri x${streak}` : ''}`);
      draw(t);
    });
    cats.forEach((c) => c.addEventListener('click', () => answer(c.dataset.cat)));
    pauseButton(panel, () => { paused = !paused; return paused; });
    $('[data-act="reset"]', panel).addEventListener('click', () => { build(); started = true; paused = false; stage.card(null); resetPause(panel); feedback(panel, 'Baştan başladın. Levhalar yaklaşıyor…', ''); });
    function intro() {
      stage.card({
        icon: '<svg class="ic"><use href="#i-sign"/></svg>',
        title: 'Levha avı',
        text: 'Yol kenarındaki levhalar yaklaşıyor. Levhayı <b>geçmeden</b> şekline ve rengine bakıp grubunu seç. Yanlış bildiğin levha yeniden gelir.',
        keys: [['1', 'Tehlike uyarı'], ['2', 'Yasaklama'], ['3', 'Mecburiyet'], ['4', 'Bilgi']],
        buttons: [{ label: 'Başla <svg class="ic"><use href="#i-play"/></svg>', cls: 'btn-red', onClick: begin }],
        focus: false
      });
    }
    return {
      init() { if (!built) { built = true; build(); started = false; paused = false; spawn(); intro(); feedback(panel, 'Hazır olduğunda <b>Başla</b>’ya bas.', ''); } },
      start() { this.init(); L.start(); },
      stop() { L.stop(); },
      key(e) {
        const m = { Digit1: 'uyari', Digit2: 'yasak', Digit3: 'mecburi', Digit4: 'bilgi', Numpad1: 'uyari', Numpad2: 'yasak', Numpad3: 'mecburi', Numpad4: 'bilgi' }[e.code];
        if (m) { answer(m); return true; }
        if (e.code === 'Space' && !started) { begin(); return true; }
        return false;
      },
      debug() { const s = active(); return { ok, bad, z: car.z, active: s && { sid: s.sid, cat: KIT.SIGNS[s.sid].cat, dist: s.z - car.z } }; }
    };
  })();

  /* =========================================================
     DERS 4 — Yol çizgileri ve sollama (3B sürüş)
     Traktörün arkasında sür; orta çizgi ve karşı şerit uygunsa “Solla” ile sinyal verip çık,
     traktörü geçince “Sağa dön” ile güvenli mesafede şeridine dön.
     ========================================================= */
  const lessonSerit = (() => {
    const id = 'serit', panel = panelOf(id), host = $('.sim', panel);
    const stage = new G.Stage(host, { height: (w) => (w < 560 ? Math.round(w * 1.02) : Math.round(clamp(w * 0.54, 330, 520))) });
    const v = new R.View3D();
    const GOAL = 3, CRUISE = 72 / 3.6, PASS = 90 / 3.6, TRAC = 25 / 3.6, HALF = 2.2, LANE_R = 1.75, LANE_L = -1.75;
    const ALLOWED = { kesik: true, kesikduz: true, duz: false, cift: false, duzkesik: false };
    const NAME = { kesik: 'Kesik çizgi', duz: 'Düz çizgi', cift: 'Çift düz çizgi', kesikduz: 'Kesik + düz (sende kesik)', duzkesik: 'Düz + kesik (sende düz)' };
    const SHORT = { kesik: 'Kesik', duz: 'Düz', cift: 'Çift düz', kesikduz: 'Kesik + düz', duzkesik: 'Düz + kesik' };
    const goal = goalBar(panel, GOAL);
    const mainBtn = $('[data-act="overtake"]', panel);
    const chipC = stage.chip('l', 'cizgi', 'Orta çizgi');
    const chipN = stage.chip('l', 'sonra', 'İleride');
    const chipS = stage.chip('r', 'hiz', 'Hız');
    const chipK = stage.chip('r', 'karsi', 'Karşı şerit');
    let world, segs, car, trac, onc, man, ok, bad, started, paused, built, spawnT, signs, lastSegEnd, toastT;

    function genSegs(until) {
      const types = ['kesik', 'duz', 'kesikduz', 'cift', 'kesik', 'duzkesik', 'kesik', 'duz'];
      while (lastSegEnd < until) {
        const last = segs.length ? segs[segs.length - 1].t : null;
        let t = segs.length === 0 ? 'duz' : segs.length === 1 ? 'kesik' : types[Math.floor(Math.random() * types.length)];
        if (t === last) t = ALLOWED[t] ? 'duz' : 'kesik';
        const len = segs.length === 0 ? 150 : ALLOWED[t] ? rand(230, 360) : rand(140, 230);
        const sg = { z0: lastSegEnd, z1: lastSegEnd + len, t };
        segs.push(sg);
        if (!ALLOWED[t] && (t === 'duz' || t === 'cift') && segs.length > 1) {
          signs.push({ sid: 'sollamayasak', z: sg.z0 - 12, img: G.svgImage(KIT.sign('sollamayasak'), 192) });
          signs.push({ sid: 'yasaksonu', z: sg.z1 + 6, img: G.svgImage(KIT.sign('yasaksonu'), 192) });
        }
        lastSegEnd += len;
      }
    }
    const segAt = (z) => { for (const s of segs) if (z >= s.z0 && z < s.z1) return s; return segs[segs.length - 1]; };
    const lineAt = (z) => segAt(z).t;
    function build() {
      segs = []; signs = []; lastSegEnd = -200;
      genSegs(900);
      world = new R.World({ kind: 'rural', seed: 60 + Math.floor(Math.random() * 1000), center: (z) => lineAt(z) });
      world.ensure(560);
      car = { x: LANE_R, z: 0, v: CRUISE * 0.7, blink: 0 };
      trac = { z: 110, v: TRAC, color: pick(['#c8322b', '#2d6fb6', '#c8322b']) };
      onc = []; man = null; ok = 0; bad = 0; spawnT = 2.5; toastT = 0;
      goal.set(0, 0);
      setBtn();
    }
    function setBtn() {
      const inLeft = man && (man.phase === 'out' || man.phase === 'pass');
      $('span', mainBtn).textContent = !started ? 'Başla' : inLeft ? 'Sağa dön' : 'Solla';
      $('use', mainBtn).setAttribute('href', !started ? '#i-play' : inLeft ? '#i-right' : '#i-left2');
      mainBtn.classList.toggle('btn-red', !inLeft); mainBtn.classList.toggle('btn-wa', !!inLeft);
    }
    const gapToTrac = () => trac.z - HALF - (car.z + HALF); // arkadan ön tampona
    function nearestOnc() { let best = null; for (const o of onc) { const d = o.z - (car.z + HALF); if (d > -4 && (!best || d < best.d)) best = { o, d }; } return best; }
    function bump(isOk, msg, toast) {
      if (isOk) ok++; else bad++;
      goal.set(ok, bad);
      feedback(panel, msg, isOk ? 'ok' : 'bad');
      stage.toast(toast, isOk ? 'ok' : 'bad', 1500);
      G.Sfx.play(isOk ? 'ok' : 'bad');
      if (isOk && ok === GOAL && !done.has(id)) {
        complete(id, host);
        setTimeout(() => { paused = true; finishCard(stage, id, bad, `${GOAL} kez çizgiye ve karşı şeride bakarak güvenle solladın.`, () => { paused = false; }); }, 1100);
      }
    }
    function toggle() {
      if (!started) { begin(); return; }
      if (paused) return;
      if (!man) startOvertake();
      else if (man.phase === 'out' || man.phase === 'pass') startReturn(false);
    }
    function startOvertake() {
      const g = gapToTrac();
      if (g > 70 || g < -2) { feedback(panel, 'Önünde sollanacak yakın bir araç yok. Önce traktöre yaklaş.', ''); stage.toast('Önce traktöre yaklaş', 'info', 1000); return; }
      const f = car.z + HALF;
      const bad1 = [f, f + 15, f + 30].map(lineAt).find((t) => !ALLOWED[t]);
      man = { phase: 'signal', t: 0, violated: false, solidWarned: false };
      car.blink = -1;
      G.Sfx.play('blink');
      if (bad1) {
        man.violated = true;
        bump(false, `✗ ${NAME[bad1]}: senin tarafındaki çizgi düz olduğu için buradan sollama yapılmaz. Kesik çizginin başlamasını bekle.`, '✗ Düz çizgi — sollama yasak');
        man = { phase: 'abort', t: 0, violated: true }; car.blink = 0;
        return;
      }
      feedback(panel, 'Ayna, sinyal, omuz kontrolü… Karşı şerit boşsa çık!', '');
      setBtn();
    }
    function startReturn(forced) {
      if (!man) return;
      if (!forced && gapToTrac() > -1.5 && car.z + HALF > trac.z - HALF - 6) {
        // Traktörün yanındayken sağa dönülmez
        if (car.z - HALF < trac.z + HALF + 0.5) { stage.toast('Traktör hâlâ yanında!', 'info', 900); return; }
      }
      man.phase = 'in'; man.t = 0; man.x0 = car.x;
      car.blink = 1;
      setBtn();
    }
    function simulate(dt) {
      // Çizgiler, dünya ve karşı trafik üretimi
      genSegs(car.z + 900);
      world.ensure(car.z + 560); world.prune(car.z - 40);
      signs = signs.filter((s) => s.z > car.z - 30);
      spawnT -= dt;
      if (spawnT <= 0) {
        onc.push({ z: car.z + 520 + rand(0, 120), v: rand(21, 25), color: pick(R.CAR_COLORS), kind: Math.random() < 0.15 ? 'minibus' : Math.random() < 0.2 ? 'taxi' : 'sedan', high: false });
        spawnT = Math.random() < 0.45 ? rand(2.2, 4.5) : rand(7, 11);
      }
      for (const o of onc) o.z -= o.v * dt;
      onc = onc.filter((o) => o.z > car.z - 40);
      trac.z += trac.v * dt;
      // Manevra
      let target = CRUISE;
      if (man) {
        man.t += dt;
        if (man.phase === 'signal') { target = Math.min(CRUISE, trac.v + Math.max(0, gapToTrac() - 8) * 0.7); if (man.t > 0.6) { man.phase = 'out'; man.t = 0; man.x0 = car.x; setBtn(); } }
        else if (man.phase === 'out') { car.x = lerp(man.x0, LANE_L, G.easeInOut(Math.min(1, man.t / 1.0))); target = PASS; if (man.t >= 1.0) { man.phase = 'pass'; man.t = 0; car.blink = 0; } }
        else if (man.phase === 'pass') target = PASS;
        else if (man.phase === 'in') {
          car.x = lerp(man.x0, LANE_R, G.easeInOut(Math.min(1, man.t / 1.0)));
          target = PASS * 0.95;
          if (man.t >= 1.0) {
            car.x = LANE_R; car.blink = 0;
            const g = car.z - HALF - (trac.z + HALF);
            if (!man.violated) {
              if (g < -1) feedback(panel, 'Sollamadan vazgeçip traktörün arkasına döndün. Karşı şerit tamamen boşken yeniden dene.', '');
              else if (g < 8) bump(false, `✗ Traktörün önünü çok yakın kestin (${Math.max(0, Math.round(g))} m). Sağa dönmeden önce geçtiğin aracı iç aynada tamamen görene kadar ilerle.`, '✗ Çok yakın döndün');
              else bump(true, `✓ Güvenli sollama! Kesik çizgide, karşı şerit boşken sinyal verip çıktın ve traktörle arana ${Math.round(g)} m mesafe bırakıp döndün.`, '✓ Güvenli sollama');
            }
            man = null; setBtn();
            if (g > 20) trac = { z: car.z + rand(120, 170), v: TRAC * rand(0.9, 1.1), color: pick(['#c8322b', '#2d6fb6', '#3f7d3a']) };
          }
        } else if (man.phase === 'abort') { car.x = lerp(car.x, LANE_R, Math.min(1, dt * 4)); if (man.t > 0.8) { car.x = LANE_R; man = null; setBtn(); } }
        // Sol şeritteyken tehlikeler
        if (man && (man.phase === 'out' || man.phase === 'pass' || man.phase === 'in') && car.x < 0.4) {
          const n = nearestOnc();
          if (n && n.d < 70) n.o.high = true;
          if (n && n.d < 70 && n.d > -3) {
            if (!man.violated) { man.violated = true; G.Sfx.play('horn'); bump(false, '✗ Karşıdan gelen araçla kafa kafaya çarpışma riski! Sollamaya karşı şeritte yeterli boşluk varken başla; bu hızla yaklaşık 250 m boş yol gerekir.', '✗ Çarpışma riski!'); }
            if (man.phase !== 'in') { startReturn(true); if (car.z - HALF < trac.z + HALF + 3) { car.v = Math.min(car.v, trac.v); car.z = Math.min(car.z, trac.z - 2 * HALF - 4); } }
          }
          const t = lineAt(car.z);
          if (!ALLOWED[t] && !man.solidWarned && !man.violated && man.phase !== 'in') { man.solidWarned = true; man.violated = true; bump(false, `✗ Sollama sürerken ${NAME[t].toLowerCase()} başladı. Sollamaya, bitirebileceğin kadar kesik çizgi varken başla.`, '✗ Düz çizgide sollama'); }
        }
      }
      if (!man || man.phase === 'signal') {
        const g = gapToTrac();
        if (g > -1 && g < 60) target = Math.min(CRUISE, trac.v + Math.max(0, g - 12) * 0.55);
      }
      car.v += clamp(target - car.v, -7 * dt, 2.6 * dt);
      car.z += car.v * dt;
      if (!man && car.x > 0.4 && gapToTrac() < 3) { car.z = trac.z - 2 * HALF - 3; car.v = trac.v; }
    }
    function paintHud() {
      const f = car.z + HALF, t = lineAt(f);
      chipC.set(NAME[t], ALLOWED[t] ? '#7df0a8' : '#ffb4ab');
      const sg = segAt(f), dist = sg.z1 - f, nt = segAt(sg.z1 + 1).t;
      chipN.show(dist < 160).set(`${Math.max(0, Math.round(dist / 10) * 10)} m sonra: ${SHORT[nt]}`, ALLOWED[nt] ? '' : '#ffd08a');
      chipS.set(`${Math.round(car.v * 3.6)} km/s`);
      const n = nearestOnc();
      if (!n || n.d > 380) chipK.set('Boş ✓', '#7df0a8');
      else chipK.set(`Araç var · ${Math.round(n.d / 10) * 10} m`, n.d < 220 ? '#ffb4ab' : '#ffd08a');
    }
    function draw(t) {
      const ctx = stage.begin(), W = stage.w, H = stage.h;
      if (!W) return;
      v.hfov = stage.narrow ? 58 : 62;
      v.viewport(0, 0, W, H, stage.narrow ? 0.36 : 0.34);
      v.cam.x = lerp(v.cam.x || 1.2, car.x * 0.7, 0.12); v.cam.y = 2.55; v.cam.z = car.z - 9.6; v.cam.yaw = 0;
      const P = R.palette(stage.night);
      const blinkL = car.blink < 0, blinkR = car.blink > 0;
      const roll = man && (man.phase === 'out' || man.phase === 'in') ? (man.phase === 'out' ? -1 : 1) * Math.sin(Math.min(1, man.t) * Math.PI) * 0.035 : 0;
      const dyn = [{ type: 'car', view: 'rear', kind: 'player', x: car.x, z: car.z, blinkL, blinkR, brake: car.v < CRUISE * 0.6 && !man, roll, bias: -0.5 }];
      dyn.push({ type: 'tractor', x: LANE_R, z: trac.z, color: trac.color });
      for (const o of onc) dyn.push({ type: 'car', view: 'front', x: LANE_L, z: o.z, color: o.color, kind: o.kind, head: stage.night || o.high, high: o.high });
      for (const s of signs) dyn.push({ type: 'sign', x: 5.0, z: s.z, img: s.img, k: 1.3 });
      const lights = stage.night ? [{ kind: 'beam', x: car.x, z: car.z + 2.4, dir: 1, len: 40, a: 0.5 }, ...onc.map((o) => ({ kind: 'beam', x: LANE_L, z: o.z - 2.3, dir: -1, len: o.high ? 36 : 20, a: o.high ? 0.5 : 0.3, high: o.high }))] : [];
      R.render(ctx, v, world, P, dyn, { time: t / 1000, lights });
    }
    const L = G.loop((dt, t) => {
      stage.tick(dt);
      if (started && !paused && !stage.hasCard) simulate(dt);
      paintHud();
      draw(t);
    });
    mainBtn.addEventListener('click', toggle);
    pauseButton(panel, () => { paused = !paused; return paused; });
    $('[data-act="reset"]', panel).addEventListener('click', () => { build(); started = true; paused = false; stage.card(null); resetPause(panel); setBtn(); feedback(panel, 'Baştan başladın. Traktöre yetiş ve doğru anı bekle.', ''); });
    function begin() {
      started = true; paused = false; stage.card(null); setBtn();
      feedback(panel, 'Traktöre yetiş. <b>Orta çizgi senin tarafında kesikse</b> ve <b>karşı şerit boşsa</b> “Solla”ya bas.', '');
      G.Sfx.play('tap');
    }
    function intro() {
      stage.card({
        icon: '<svg class="ic"><use href="#i-lanes"/></svg>',
        title: 'Güvenli sollama',
        text: 'Önünde yavaş bir traktör var. Orta çizgi senin tarafında <b>kesik</b> ve karşı şerit <b>boşken</b> “Solla”ya bas; traktörü geçince “Sağa dön” ile şeridine dön.',
        keys: [['Boşluk', 'Solla / Sağa dön'], ['←', 'Solla'], ['→', 'Sağa dön']],
        buttons: [{ label: 'Başla <svg class="ic"><use href="#i-play"/></svg>', cls: 'btn-red', onClick: begin }],
        focus: false
      });
    }
    return {
      init() { if (!built) { built = true; build(); started = false; paused = false; setBtn(); intro(); feedback(panel, 'Hazır olduğunda <b>Başla</b>’ya bas.', ''); } },
      start() { this.init(); L.start(); },
      stop() { L.stop(); },
      key(e) {
        if (e.code === 'Space' || e.code === 'KeyS') { toggle(); return true; }
        if (e.code === 'ArrowLeft') { if (!started) begin(); else if (!man) startOvertake(); return true; }
        if (e.code === 'ArrowRight') { if (man && (man.phase === 'out' || man.phase === 'pass')) startReturn(false); return true; }
        return false;
      },
      debug() { const n = nearestOnc(); return { ok, bad, z: car.z, x: car.x, v: car.v, gap: gapToTrac(), line: lineAt(car.z + HALF), lineAhead: [lineAt(car.z + 20), lineAt(car.z + 60), lineAt(car.z + 120)], onc: n ? n.d : null, man: man && man.phase, tracZ: trac.z }; }
    };
  })();

  /* =========================================================
     DERS 5 — Park ve duraklama (kuşbakışı sokak)
     Numaralı yerlerden birine dokun: araç oraya geri geri park eder. Kurala aykırıysa ceza fişi kesilir.
     Yerin üstüne gelince en yakın yasak noktaya uzaklık ölçülür. Dar ekranda sokak sürüklenerek kaydırılır.
     ========================================================= */
  const lessonPark = (() => {
    const id = 'park', panel = panelOf(id), host = $('.sim', panel);
    const stage = new G.Stage(host, { height: (w) => (w < 560 ? Math.round(clamp(w * 1.0, 330, 420)) : Math.round(clamp(w * 0.38, 290, 360))) });
    const v = new T.View2D(), D = T.D;
    const GOAL = 4, LEN = 80;
    const Y = { farB: -12, farWalk: -3.4, road: 0, mid: 3.2, lane: 4.85, strip: 6.6, curb: 9.0, walk2: 12.4, nearB: 21 };
    const PARK_Y = 7.8;
    const REASON = {
      kavsak: 'Kavşakta ve yerleşim yerinde kavşağa <b>5 m</b> mesafe içinde duraklamak da park etmek de yasaktır.',
      yaya: '<b>Yaya geçidinin üzerinde</b> duraklamak da park etmek de yasaktır.',
      durak: 'Otobüs durağı levhasına iki yönden <b>15 m</b> mesafe içinde park edilmez.',
      musluk: 'Yangın musluğuna her iki yönden <b>5 m</b> mesafe içinde park edilmez.',
      garaj: 'Garaj girişi gibi <b>geçiş yollarının önüne</b> park edilmez.',
      engelli: 'Bu yer <b>engelli araçları</b> için ayrılmıştır; başkaları park edemez.'
    };
    const LABEL = { kavsak: 'Kavşak ±5 m', yaya: 'Yaya geçidi', durak: 'Durak ±15 m', musluk: 'Musluk ±5 m', garaj: 'Garaj girişi', engelli: 'Engelli yeri' };
    const NAMEF = { kavsak: 'Kavşak', yaya: 'Yaya geçidi', durak: 'Otobüs durağı', musluk: 'Yangın musluğu', garaj: 'Garaj girişi', engelli: 'Engelli park yeri' };
    const TO = { kavsak: 'Kavşağa', yaya: 'Yaya geçidine', durak: 'Durağa', musluk: 'Musluğa', garaj: 'Garaj girişine', engelli: 'Engelli yerine' };
    const goal = goalBar(panel, GOAL);
    const chip = stage.chip('l', 'sokak', 'Sokak 1');
    const zonesBtn = $('[data-act="zones"]', panel);
    const SIGNP = G.svgImage(KIT.sign('parkyasak'), 160);
    let street = null, ok = 0, bad = 0, busy = false, built = false, showZones = false, round = 0, hover = -1, bg = null, bgKey = '';
    let carS = null, panX = 0, panTarget = 0, drag = null, dragged = false, ticket = null, reveal = 0, peds = [], lastPointer = 'mouse';

    const zoneOf = (f) => {
      if (f.t === 'kavsak') return { t: f.t, a: f.a - 5, b: f.b + 5 };
      if (f.t === 'durak') return { t: f.t, a: f.x - 15, b: f.x + 15 };
      if (f.t === 'musluk') return { t: f.t, a: f.x - 5, b: f.x + 5 };
      return { t: f.t, a: f.a, b: f.b };
    };
    const overlap = (a, b, c, d) => Math.min(b, d) - Math.max(a, c);
    function generate() {
      for (let tries = 0; tries < 400; tries++) {
        const occ = [];
        const place = (len, pad) => {
          for (let t = 0; t < 60; t++) {
            const a = Math.round(rand(3, 77 - len));
            if (occ.every(([x, y]) => a + len + pad <= x || a - pad >= y)) { occ.push([a, a + len]); return a; }
          }
          return null;
        };
        const feats = [];
        const ka = place(10, 9);
        if (ka == null) continue;
        feats.push({ t: 'kavsak', a: ka, b: ka + 10 });
        let fine = true;
        for (const t of shuffle(['durak', 'musluk', 'garaj', 'yaya', 'engelli']).slice(0, 3)) {
          const len = { durak: 1, musluk: 1, garaj: 4, yaya: 4, engelli: 6 }[t];
          const a = place(len, t === 'durak' ? 12 : 7);
          if (a == null) { fine = false; break; }
          feats.push(t === 'durak' || t === 'musluk' ? { t, x: a + 0.5 } : { t, a, b: a + len });
        }
        if (!fine) continue;
        const zones = feats.map(zoneOf);
        const legal = [], illegal = [];
        for (let s = 1; s <= 73; s++) {
          const e = s + 6;
          const hits = zones.filter((z) => z.t !== 'engelli' && overlap(s, e, z.a, z.b) >= 2.5);
          const near = zones.some((z) => overlap(s, e, z.a - 1.2, z.b + 1.2) > 0);
          if (!near) legal.push({ a: s, b: e, legal: true });
          else if (hits.length) illegal.push({ a: s, b: e, legal: false, z: hits[0] });
        }
        const chosen = [];
        const fits = (sp) => chosen.every((c) => sp.b + 1.5 <= c.a || sp.a >= c.b + 1.5);
        const eng = feats.find((f) => f.t === 'engelli');
        if (eng) chosen.push({ a: eng.a, b: eng.b, legal: false, z: zones.find((z) => z.t === 'engelli') });
        const types = new Set(chosen.map((c) => c.z.t));
        for (const sp of shuffle(illegal)) { if (chosen.length >= (eng ? 4 : 3)) break; if (!types.has(sp.z.t) && fits(sp)) { chosen.push(sp); types.add(sp.z.t); } }
        let nl = 0;
        for (const sp of shuffle(legal)) { if (nl >= 3) break; if (fits(sp)) { chosen.push(sp); nl++; } }
        if (nl < 2 || chosen.length < 5) continue;
        chosen.sort((p, q) => p.a - q.a);
        // Dekor: uygun boşluklarda park etmiş başka araçlar
        const others = [];
        for (const sp of shuffle(legal)) { if (others.length >= 3) break; if (chosen.every((c) => sp.b + 1 <= c.a || sp.a >= c.b + 1) && others.every((c) => sp.b + 1 <= c.a || sp.a >= c.b + 1)) others.push(sp); }
        return { feats, zones, spots: chosen, others };
      }
      return null;
    }
    const featX = (f) => (f.x != null ? f.x : (f.a + f.b) / 2);
    function drawStatic(ctx, st, P) {
      ctx.save(); v.apply(ctx);
      const X0 = -40, X1 = LEN + 40;
      D.earth(ctx, v, P, X0, -30, X1 - X0, 70);
      D.walk(ctx, v, P, X0, Y.farWalk, X1 - X0, -Y.farWalk);
      D.walk(ctx, v, P, X0, Y.curb, X1 - X0, Y.walk2 - Y.curb);
      D.asphalt(ctx, v, P, X0, Y.road, X1 - X0, Y.curb - Y.road);
      const kav = st.feats.find((f) => f.t === 'kavsak');
      // Yan sokak
      if (kav) {
        D.walk(ctx, v, P, kav.a - 3, Y.curb, kav.b - kav.a + 6, 40);
        D.asphalt(ctx, v, P, kav.a, Y.curb - 0.2, kav.b - kav.a, 40);
        D.curb(ctx, P, kav.a, Y.curb + 0.1, kav.a, 40); D.curb(ctx, P, kav.b, Y.curb + 0.1, kav.b, 40);
        D.line(ctx, P, (kav.a + kav.b) / 2, Y.walk2 + 2.5, (kav.a + kav.b) / 2, 40, { dash: [2.5, 2.5] });
        D.zebra(ctx, P, kav.a + 0.3, Y.curb + 0.4, kav.b - 0.3, Y.walk2 - 0.2, true);
        D.line(ctx, P, (kav.a + kav.b) / 2, Y.walk2 + 0.6, kav.b - 0.2, Y.walk2 + 0.6, { w: 0.35 });
      }
      D.curb(ctx, P, X0, Y.road, X1, Y.road);
      if (kav) { D.curb(ctx, P, X0, Y.curb, kav.a, Y.curb); D.curb(ctx, P, kav.b, Y.curb, X1, Y.curb); } else D.curb(ctx, P, X0, Y.curb, X1, Y.curb);
      D.line(ctx, P, X0, Y.mid, X1, Y.mid, { dash: [3, 3] });
      D.line(ctx, P, X0, Y.strip, X1, Y.strip, { w: 0.1, dash: [0.8, 0.8], color: alpha(P.roadLine, 0.55) });
      // Özellikler
      for (const f of st.feats) {
        if (f.t === 'yaya') D.zebra(ctx, P, f.a, Y.road + 0.3, f.b, Y.curb - 0.3, false);
        if (f.t === 'engelli') {
          ctx.fillStyle = P.night ? '#1f3f73' : '#2a62b8'; ctx.fillRect(f.a + 0.1, Y.strip + 0.15, f.b - f.a - 0.2, Y.curb - Y.strip - 0.3);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
          const cx = (f.a + f.b) / 2, cy = (Y.strip + Y.curb) / 2;
          ctx.beginPath(); ctx.arc(cx - 0.1, cy - 0.62, 0.14, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx - 0.1, cy - 0.42); ctx.lineTo(cx - 0.1, cy + 0.05); ctx.lineTo(cx + 0.35, cy + 0.05); ctx.lineTo(cx + 0.55, cy + 0.5); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx - 0.12, cy + 0.2, 0.42, Math.PI * 0.75, Math.PI * 2.1); ctx.stroke();
        }
        if (f.t === 'durak') {
          ctx.strokeStyle = P.yellow; ctx.lineWidth = 0.12; ctx.beginPath();
          for (let k = 0; k <= 14; k++) { const x = f.x - 7 + k, y = k % 2 ? Y.curb - 0.25 : Y.curb - 0.85; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          ctx.stroke();
          ctx.save(); ctx.shadowColor = P.shadow; ctx.shadowBlur = 6;
          ctx.fillStyle = P.night ? 'rgba(90,110,140,.55)' : 'rgba(120,150,180,.5)'; rr(ctx, f.x - 2.4, Y.curb + 1.3, 4.8, 1.5, 0.2); ctx.fill();
          ctx.restore();
          ctx.strokeStyle = P.night ? '#4d5566' : '#5d6570'; ctx.lineWidth = 0.1; rr(ctx, f.x - 2.4, Y.curb + 1.3, 4.8, 1.5, 0.2); ctx.stroke();
          ctx.fillStyle = P.night ? '#3a3027' : '#8a6a48'; ctx.fillRect(f.x - 1.8, Y.curb + 2.3, 3.6, 0.35);
          ctx.fillStyle = '#1e5aa8'; rr(ctx, f.x - 0.45, Y.curb + 0.15, 0.9, 0.9, 0.12); ctx.fill();
          ctx.fillStyle = '#fff'; rr(ctx, f.x - 0.3, Y.curb + 0.3, 0.6, 0.45, 0.08); ctx.fill();
          ctx.fillStyle = '#1e5aa8'; ctx.fillRect(f.x - 0.24, Y.curb + 0.36, 0.48, 0.14);
        }
        if (f.t === 'musluk') {
          ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.arc(f.x + 0.12, Y.curb + 0.95, 0.42, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#c7262a'; ctx.beginPath(); ctx.arc(f.x, Y.curb + 0.8, 0.38, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#9e1c20'; ctx.fillRect(f.x - 0.58, Y.curb + 0.7, 1.16, 0.2);
          ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(f.x, Y.curb + 0.8, 0.2, 0, Math.PI * 2); ctx.fill();
        }
        if (f.t === 'garaj') {
          ctx.fillStyle = P.night ? '#30343f' : '#cdbfa6'; ctx.fillRect(f.a, Y.curb, f.b - f.a, Y.walk2 - Y.curb);
          ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 0.06;
          for (let y = Y.curb + 0.4; y < Y.walk2; y += 0.5) { ctx.beginPath(); ctx.moveTo(f.a, y); ctx.lineTo(f.b, y); ctx.stroke(); }
        }
      }
      // Binalar: karşı taraf dükkânlar (tente), bu taraf evler; yan sokak ve garaj boşlukları
      const awn = [['#c8423a', '#f4efe6'], ['#2f6e4a', '#f4efe6'], ['#2f5d9a', '#f4efe6'], ['#b8860b', '#f7f0de']];
      let x = X0 + 2, i = 0;
      const rnd = G.rng(round * 31 + 7);
      while (x < X1) { const w = 8 + rnd() * 7; D.building(ctx, v, P, x, Y.farB, w - 0.4, Y.farWalk - Y.farB - 0.2, { seed: round * 13 + i, height: 8, roof: rnd() < 0.3 ? 'tile' : null }); if (rnd() < 0.7) D.awning(ctx, P, x + 0.8, Y.farWalk, w - 2, 1.2, awn[i % 4]); x += w; i++; }
      x = X0 + 1;
      while (x < X1) {
        const w = 8 + rnd() * 6;
        const blocked = kav && x < kav.b + 3 && x + w > kav.a - 3;
        if (!blocked) D.building(ctx, v, P, x, Y.walk2 + 0.3, w - 0.4, Y.nearB - Y.walk2, { seed: round * 17 + i, height: 7, roof: rnd() < 0.45 ? 'tile' : null });
        else if (x + w < kav.a - 3 || x > kav.b + 3) D.building(ctx, v, P, x, Y.walk2 + 0.3, w - 0.4, Y.nearB - Y.walk2, { seed: i });
        x += w; i++;
      }
      if (kav) { D.building(ctx, v, P, kav.a - 11, Y.walk2 + 0.3, 8, Y.nearB - Y.walk2, { seed: 91 + round, height: 7 }); D.building(ctx, v, P, kav.b + 3, Y.walk2 + 0.3, 8, Y.nearB - Y.walk2, { seed: 93 + round, height: 7, roof: 'tile' }); }
      for (const f of st.feats) if (f.t === 'garaj') {
        ctx.fillStyle = P.night ? '#3b404b' : '#9aa0a8'; ctx.fillRect(f.a, Y.walk2 + 0.3, f.b - f.a, 0.9);
        ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 0.06; for (let y = Y.walk2 + 0.45; y < Y.walk2 + 1.2; y += 0.18) { ctx.beginPath(); ctx.moveTo(f.a, y); ctx.lineTo(f.b, y); ctx.stroke(); }
      }
      // Ağaçlar ve lambalar (özelliklerin önüne düşmesin)
      const busy2 = (xx) => st.feats.some((f) => { const z = zoneOf(f); return xx > Math.min(z.a, featX(f) - 3) - 1 && xx < Math.max(z.b, featX(f) + 3) + 1 && f.t !== 'engelli' && f.t !== 'durak'; });
      for (let tx = X0 + 4; tx < X1; tx += 11) D.tree(ctx, v, P, tx, Y.farWalk + 1.6, 1.35, 100 + tx);
      for (let tx = X0 + 9; tx < X1; tx += 13) if (!busy2(tx) && !(kav && tx > kav.a - 2 && tx < kav.b + 2)) D.tree(ctx, v, P, tx, Y.curb + 1.9, 1.3, 200 + tx);
      for (let lx = X0 + 6; lx < X1; lx += 26) { D.lamp(ctx, P, lx, Y.farWalk + 0.5, Math.PI); if (P.night) D.lampGlow(ctx, P, lx, Y.farWalk + 0.5, Math.PI, 6.5); }
      // Cetvel (karşı kaldırım kenarında)
      ctx.fillStyle = alpha(P.night ? '#c9ccd3' : '#3b3d44', 0.7);
      ctx.font = `700 ${Math.max(0.8, 11 / v.scale)}px JetBrains Mono, monospace`; ctx.textBaseline = 'bottom';
      for (let m = 0; m <= LEN; m += 5) { ctx.fillRect(m - 0.04, Y.road - (m % 10 ? 0.45 : 0.8), 0.08, m % 10 ? 0.45 : 0.8); if (m % 10 === 0 && m < LEN) ctx.fillText(m + (m === 0 ? ' m' : ''), m + 0.25, Y.road - 0.35); }
      ctx.restore();
    }
    function newStreet() {
      round++;
      street = generate();
      busy = false; hover = -1; ticket = null; reveal = 0;
      carS = { x: -4, y: Y.lane, ang: Math.PI / 2, brake: false, rev: false, blinkR: false };
      stage.clearSpots();
      street.spots.forEach((sp, i) => {
        sp.el = stage.spot('p' + i, `${i + 1} numaralı park yeri adayı`, () => {
          if (dragged) return;
          // Dokunmatik ekranda ilk dokunuş ölçüyü gösterir, ikincisi park eder
          if (lastPointer === 'touch' && hover !== i && !busy) { hover = i; panTo((sp.a + sp.b) / 2); stage.toast('Park etmek için tekrar dokun', 'info', 1400); return; }
          choose(i);
        });
        sp.el.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });
        sp.el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') hover = i; });
        sp.el.addEventListener('pointerleave', (e) => { if (hover === i && e.pointerType !== 'touch') hover = -1; });
        sp.el.addEventListener('focus', () => { let kb = true; try { kb = sp.el.matches(':focus-visible'); } catch (e) { /* eski tarayıcı */ } if (kb) { hover = i; panTo((sp.a + sp.b) / 2); } });
        sp.el.addEventListener('blur', () => { if (hover === i) hover = -1; });
        sp.state = null;
      });
      peds = [];
      const yaya = street.feats.find((f) => f.t === 'yaya');
      if (yaya) peds.push({ x: yaya.a + 1.2, y: Y.curb + 0.8, ang: 0, shirt: '#2f7bff' });
      const dur = street.feats.find((f) => f.t === 'durak');
      if (dur) { peds.push({ x: dur.x - 1, y: Y.curb + 1.9, ang: 0, shirt: '#e07a3a' }); peds.push({ x: dur.x + 0.8, y: Y.curb + 2.0, ang: 0, shirt: '#7b3fa0', elder: true }); }
      chip.label(`Sokak ${round}`).set('Kurallara uygun bir yer seç');
      panX = 0; panTarget = 0; bgKey = '';
      drive(carS, [{ p: [-12, Y.lane] }, { p: [2, Y.lane] }], 900);
      feedback(panel, 'Aracı park edeceğin numaralı yere dokun. <span class="fb-hint">Bir yerin üstüne gelince en yakın yasak noktaya uzaklığı görürsün.</span>', '');
    }
    function drive(c, segs, ms, reverse = false) {
      const r = T.route(segs);
      c.rev = reverse; c.brake = false;
      return G.tween(ms, (e) => { const p = r.at(r.len * e); c.x = p.x; c.y = p.y; c.ang = reverse ? p.ang + Math.PI : p.ang; }, G.easeInOut).then(() => { c.rev = false; });
    }
    async function choose(i) {
      if (busy || !street) return;
      const sp = street.spots[i];
      if (sp.state) return;
      busy = true;
      const xc = (sp.a + sp.b) / 2;
      chip.set(`${i + 1} numaralı yere park ediliyor…`);
      G.Sfx.play('tap');
      panTo(xc);
      // İleri git, dur, geri geri yanaş
      await drive(carS, [{ p: [carS.x, Y.lane] }, { p: [xc + 5.6, Y.lane] }], clamp(Math.abs(xc + 5.6 - carS.x) * 55, 700, 2600));
      carS.brake = true; carS.blinkR = true;
      await G.wait(350);
      carS.brake = false;
      await drive(carS, [{ p: [xc + 5.6, Y.lane] }, { q: [xc + 3.1, Y.lane], p: [xc + 2.5, (Y.lane + PARK_Y) / 2] }, { q: [xc + 1.9, PARK_Y], p: [xc - 0.3, PARK_Y] }], 1500, true);
      await drive(carS, [{ p: [xc - 0.3, PARK_Y] }, { p: [xc, PARK_Y] }], 300);
      carS.brake = true; carS.blinkR = false;
      if (!sp.legal) {
        bad++; goal.set(ok, bad);
        sp.state = 'no';
        reveal = 1;
        ticket = { x: xc, y: PARK_Y, t: performance.now(), z: sp.z };
        G.Sfx.play('bad');
        stage.toast('✗ Park cezası!', 'bad', 1600);
        feedback(panel, `✗ ${i + 1} numaralı yer uygun değil. ${REASON[sp.z.t]}`, 'bad');
        chip.set(`${NAMEF[sp.z.t]}: park yasak`, '#ffb4ab');
        await G.wait(1900);
        ticket = null;
        carS.brake = false; carS.blinkR = false;
        await drive(carS, [{ p: [xc, PARK_Y] }, { q: [xc + 3.5, PARK_Y], p: [xc + 5.2, (Y.lane + PARK_Y) / 2] }, { q: [xc + 6.4, Y.lane], p: [xc + 9, Y.lane] }, { p: [LEN + 14, Y.lane] }], clamp((LEN + 14 - xc) * 40, 1200, 3200));
        carS.x = -12; carS.y = Y.lane; carS.ang = Math.PI / 2;
        panTo(0);
        await drive(carS, [{ p: [-12, Y.lane] }, { p: [2, Y.lane] }], 900);
        chip.set('Başka bir yer seç');
        busy = false;
        return;
      }
      ok++; goal.set(ok, bad);
      sp.state = 'yes';
      reveal = 1;
      G.Sfx.play('ok');
      stage.toast('✓ Kurallara uygun park', 'ok', 1500);
      feedback(panel, `✓ Doğru! ${i + 1} numaralı yerin çevresinde yasak bölge yok; aracını kurallara uygun park ettin.`, 'ok');
      chip.set('Kurallara uygun park ✓', '#7df0a8');
      if (ok === GOAL && !done.has(id)) {
        complete(id, host);
        setTimeout(() => finishCard(stage, id, bad, `${GOAL} kez kurallara uygun park ettin: kavşak, geçit, durak, musluk ve girişlerin çevresini biliyorsun.`, () => newStreet()), 900);
        return;
      }
      await G.wait(2200);
      newStreet();
    }
    function panTo(x) { if (!stage.narrow) return; const visW = stage.w / v.scale; panTarget = clamp(x - visW / 2, -2, LEN + 2 - visW); }
    function layout() {
      const W = stage.w, H = stage.h;
      if (stage.narrow) { v.scale = clamp(W / 28, 10, 15); }
      else v.scale = W / (LEN + 4);
      const cy = 4.2;
      v.oy = H / 2 - cy * v.scale + (stage.narrow ? 6 : 8);
      v.ox = stage.narrow ? -panX * v.scale : 2 * v.scale;
    }
    function frame(dt, now) {
      const ctx = stage.begin(), W = stage.w, H = stage.h;
      if (!W || !street) return;
      const P = T.palette(stage.night);
      panX += (panTarget - panX) * Math.min(1, dt * 6);
      if (!busy && !drag && stage.narrow && carS && Math.abs(panTarget - panX) < 0.01) { /* sabit */ }
      layout();
      const key = round + '|' + W + 'x' + H + '|' + stage.theme + '|' + (stage.narrow ? 'n' : 'w') + '|' + stage.dpr;
      if (key !== bgKey) {
        // Dar ekranda sokağın tamamını tek seferde pişir, sonra kaydır
        const vx = v.ox;
        v.ox = stage.narrow ? 0 : v.ox;
        const full = stage.narrow ? { w: Math.ceil((LEN + 4) * v.scale), h: H, dpr: stage.dpr } : stage;
        bg = T.bake(full, (c) => { c.translate(stage.narrow ? 2 * v.scale : 0, 0); drawStatic(c, street, P); });
        v.ox = vx; bgKey = key;
      }
      if (stage.narrow) ctx.drawImage(bg, (-panX - 2) * v.scale, 0, bg.width / stage.dpr, H);
      else ctx.drawImage(bg, 0, 0, W, H);
      ctx.save(); v.apply(ctx);
      for (const f of street.feats) if (f.t === 'garaj') D.sign(ctx, P, f.b + 0.9, Y.walk2 + 0.2, SIGNP, 1.7);
      // Yasak bölgeler
      if (reveal > 0 || showZones || hover >= 0) {
        for (const z of street.zones) {
          if (z.t === 'engelli') continue;
          const strong = ticket && ticket.z && ticket.z.t === z.t;
          const a = Math.max(-1, z.a), b = Math.min(LEN + 1, z.b);
          const alphaZ = showZones || reveal > 0 ? (strong ? 0.38 : 0.2) : hover >= 0 ? 0.12 : 0;
          if (alphaZ <= 0) continue;
          ctx.fillStyle = `rgba(255,59,48,${alphaZ})`; ctx.fillRect(a, Y.strip, b - a, Y.curb - Y.strip);
          ctx.strokeStyle = `rgba(255,90,78,${Math.min(1, alphaZ * 3)})`; ctx.lineWidth = 0.1;
          ctx.beginPath(); ctx.moveTo(a, Y.strip - 0.5); ctx.lineTo(b, Y.strip - 0.5); ctx.moveTo(a, Y.strip - 0.8); ctx.lineTo(a, Y.strip - 0.2); ctx.moveTo(b, Y.strip - 0.8); ctx.lineTo(b, Y.strip - 0.2); ctx.stroke();
        }
      }
      // Park etmiş diğer araçlar
      (street.others || []).forEach((o, i) => T.vehicle(ctx, v, (o.a + o.b) / 2, PARK_Y, Math.PI / 2, { kind: i % 2 ? 'hatch' : 'sedan', color: R.CAR_COLORS[(round + i * 3) % R.CAR_COLORS.length], night: stage.night, beams: false, head: false }));
      // Aday yerler
      street.spots.forEach((sp, i) => {
        const x0 = sp.a + 0.25, w = sp.b - sp.a - 0.5, y0 = Y.strip + 0.18, h = Y.curb - Y.strip - 0.36;
        const st2 = sp.state, hov = hover === i && !st2;
        ctx.fillStyle = st2 === 'no' ? 'rgba(255,59,48,.22)' : st2 === 'yes' ? 'rgba(31,191,106,.22)' : hov ? 'rgba(255,200,61,.34)' : 'rgba(255,200,61,.12)';
        rr(ctx, x0, y0, w, h, 0.4); ctx.fill();
        ctx.setLineDash(st2 ? [] : [0.55, 0.4]);
        ctx.strokeStyle = st2 === 'no' ? '#ff3b30' : st2 === 'yes' ? '#1fbf6a' : '#ffc83d'; ctx.lineWidth = hov ? 0.2 : 0.14; rr(ctx, x0, y0, w, h, 0.4); ctx.stroke();
        ctx.setLineDash([]);
      });
      for (const p of peds) T.ped(ctx, v, p.x, p.y, p.ang, { walk: false, shirt: p.shirt, elder: p.elder, k: 1.7 });
      if (carS) T.vehicle(ctx, v, carS.x, carS.y, carS.ang, { kind: 'player', brake: carS.brake, blinkR: carS.blinkR, night: stage.night });
      if (carS && carS.rev) { ctx.save(); ctx.translate(carS.x, carS.y); ctx.rotate(carS.ang); ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, -0.6, 2.2, 0.7, '#ffffff', 0.8); G.glow(ctx, 0.6, 2.2, 0.7, '#ffffff', 0.8); ctx.restore(); }
      ctx.restore();
      // Ekran uzayı: numaralar, etiketler, ölçü çizgisi, ceza fişi
      street.spots.forEach((sp, i) => {
        const X = v.X((sp.a + sp.b) / 2), Yc = v.Y((Y.strip + Y.curb) / 2);
        if (sp.el) { stage.placeSpot(sp.el, X, Yc, Math.max(46, (sp.b - sp.a - 0.4) * v.scale), Math.max(40, (Y.curb - Y.strip) * v.scale + 8)); sp.el.disabled = busy || !!sp.state; }
        const occupied = carS && Math.abs(carS.y - PARK_Y) < 0.6 && Math.abs(carS.x - (sp.a + sp.b) / 2) < 3;
        if (occupied) return;
        T.badge(ctx, X, Yc, String(i + 1), sp.state === 'no' ? '#d7372f' : sp.state === 'yes' ? '#1fbf6a' : '#16171b', Math.max(10, v.scale * 0.95));
      });
      ctx.font = `700 ${stage.narrow ? 10.5 : 11}px JetBrains Mono, monospace`;
      for (const f of street.feats) {
        const X = v.X(featX(f)), Yl = v.Y(Y.walk2 + 1.6);
        const t = NAMEF[f.t];
        const w = ctx.measureText(t).width + 14;
        ctx.fillStyle = stage.night ? 'rgba(10,12,18,.72)' : 'rgba(22,23,27,.72)';
        rr(ctx, X - w / 2, Yl - 10, w, 20, 10); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, X, Yl + 0.5);
      }
      if (showZones || reveal > 0) {
        ctx.font = '700 10.5px JetBrains Mono, monospace';
        for (const z of street.zones) { if (z.t === 'engelli') continue; const X = v.X((Math.max(-1, z.a) + Math.min(LEN + 1, z.b)) / 2), Yz = v.Y(Y.strip - 1.1); ctx.fillStyle = '#ff6b60'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LABEL[z.t], X, Yz); }
      }
      if (hover >= 0 && !busy) measure(ctx, street.spots[hover]);
      if (ticket) drawTicket(ctx, now);
      // Kaydırma ipucu
      if (stage.narrow) {
        const visW = W / v.scale;
        const g1 = ctx.createLinearGradient(0, 0, 28, 0); g1.addColorStop(0, 'rgba(0,0,0,.28)'); g1.addColorStop(1, 'rgba(0,0,0,0)');
        const g2 = ctx.createLinearGradient(W - 28, 0, W, 0); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.28)');
        ctx.fillStyle = '#fff'; ctx.font = '900 22px Archivo, Arial, sans-serif'; ctx.textBaseline = 'middle';
        if (panX > 0.5) { ctx.fillStyle = g1; ctx.fillRect(0, 0, 28, H); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('‹', 8, H * 0.46); }
        if (panX < LEN + 2 - visW - 0.5) { ctx.fillStyle = g2; ctx.fillRect(W - 28, 0, 28, H); ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText('›', W - 8, H * 0.46); }
      }
      if (reveal > 0 && !busy) reveal = Math.max(0, reveal - dt * 0.35);
    }
    // En yakın yasak noktaya ölçü çizgisi
    function measure(ctx, sp) {
      if (!sp) return;
      let best = null;
      for (const f of street.feats) {
        const fa = f.x != null ? f.x : f.a, fb = f.x != null ? f.x : f.b;
        const d = sp.b <= fa ? fa - sp.b : sp.a >= fb ? sp.a - fb : 0;
        if (!best || d < best.d) best = { d, f, from: sp.b <= fa ? sp.b : sp.a >= fb ? sp.a : (sp.a + sp.b) / 2, to: sp.b <= fa ? fa : sp.a >= fb ? fb : (sp.a + sp.b) / 2 };
      }
      if (!best) return;
      const yy = v.Y(Y.lane - 0.2), x1 = v.X(best.from), x2 = v.X(best.to);
      ctx.save();
      ctx.strokeStyle = '#ffc83d'; ctx.fillStyle = '#ffc83d'; ctx.lineWidth = 2;
      if (Math.abs(x2 - x1) > 4) {
        ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x2, yy); ctx.stroke();
        for (const [x, dir] of [[x1, Math.sign(x2 - x1)], [x2, -Math.sign(x2 - x1)]]) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + dir * 7, yy - 4); ctx.lineTo(x + dir * 7, yy + 4); ctx.fill(); ctx.fillRect(x - 1, yy - 8, 2, 16); }
      }
      const txt = best.d === 0 ? `${NAMEF[best.f.t]} üzerinde` : `${TO[best.f.t]} ${tr(best.d, best.d < 10 ? 1 : 0)} m`;
      ctx.font = '800 12.5px Archivo, Arial, sans-serif';
      const w = ctx.measureText(txt).width + 16, mx = clamp((x1 + x2) / 2, w / 2 + 6, stage.w - w / 2 - 6);
      ctx.fillStyle = '#16171b'; rr(ctx, mx - w / 2, yy - 28, w, 22, 11); ctx.fill();
      ctx.fillStyle = '#ffc83d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, mx, yy - 17);
      ctx.restore();
    }
    function drawTicket(ctx, now) {
      const u = clamp((now - ticket.t) / 350, 0, 1), k = 0.6 + 0.4 * G.easeOut(u);
      const X = v.X(ticket.x), Yt = v.Y(ticket.y) - 16;
      ctx.save(); ctx.translate(X, Yt); ctx.scale(k, k); ctx.rotate(-0.06);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#fffdf6'; rr(ctx, -64, -74, 128, 72, 8); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#d7372f'; rr(ctx, -64, -74, 128, 22, 8); ctx.fill(); ctx.fillRect(-64, -60, 128, 8);
      ctx.fillStyle = '#fff'; ctx.font = '900 12px Archivo, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TRAFİK CEZASI', 0, -62);
      ctx.fillStyle = '#16171b'; ctx.font = '800 11px Archivo, Arial, sans-serif'; ctx.fillText(ticket.z ? NAMEF[ticket.z.t] : '', 0, -38);
      ctx.fillStyle = '#6b6e76'; ctx.font = '600 10px JetBrains Mono, monospace'; ctx.fillText('Park yasağı ihlali', 0, -22);
      ctx.restore();
    }
    // Dar ekranda yatay sürükleyerek kaydırma (dikey kaydırma sayfaya kalır)
    host.addEventListener('pointerdown', (e) => { if (!stage.narrow || e.button > 0) return; drag = { x: e.clientX, p: panX, id: e.pointerId }; dragged = false; }, true);
    host.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 8) dragged = true;
      if (dragged) { const visW = stage.w / v.scale; panX = panTarget = clamp(drag.p - dx / v.scale, -2, LEN + 2 - visW); }
    }, true);
    const endDrag = () => { drag = null; setTimeout(() => { dragged = false; }, 0); };
    host.addEventListener('pointerup', endDrag, true); host.addEventListener('pointercancel', endDrag, true);
    const L = G.loop((dt, t) => { stage.tick(dt); frame(dt, t); });
    zonesBtn.addEventListener('click', (e) => {
      showZones = !showZones;
      e.currentTarget.setAttribute('aria-pressed', String(showZones));
      $('span', e.currentTarget).textContent = showZones ? 'Yasak bölgeleri gizle' : 'Yasak bölgeleri göster';
    });
    $('[data-act="reset"]', panel).addEventListener('click', () => { if (busy) return; ok = 0; bad = 0; round = 0; goal.set(0, 0); newStreet(); });
    return {
      init() { if (!built) { built = true; newStreet(); } },
      start() { this.init(); L.start(); },
      stop() { L.stop(); },
      key(e) { const n = Number(e.key); if (n >= 1 && street && n <= street.spots.length) { choose(n - 1); return true; } return false; },
      debug() { return { ok, bad, busy, hover, lastPointer, spots: street && street.spots.map((s) => ({ legal: s.legal, state: s.state })) }; }
    };
  })();

  /* =========================================================
     DERS 6 — Duruş mesafesi (3B fizik laboratuvarı)
     Hızı, yol durumunu ve tepki türünü seç, “Sür”e bas: park etmiş araçların arasından yola top fırlar.
     Kendi tepkinle (ya da standart 1 sn) frene basılır; tepki + fren mesafesi ölçülüp çizelgeye işlenir.
     ========================================================= */
  const lessonDurus = (() => {
    const id = 'durus', panel = panelOf(id), host = $('.sim', panel);
    const stage = new G.Stage(host, { height: (w) => (w < 560 ? Math.round(w * 0.96) : Math.round(clamp(w * 0.5, 320, 470))) });
    const v = new R.View3D();
    const GEE = 9.81, GOAL = 3, HALF = 2.2, BALL_AT = 50, FOOT = 0.3;
    const SURF = { 0.8: 'kuru', 0.5: 'ıslak', 0.25: 'karlı', 0.1: 'buzlu' };
    const WX = { 0.8: 'dry', 0.5: 'rain', 0.25: 'snow', 0.1: 'ice' };
    const goal = goalBar(panel, GOAL);
    const runBtn = $('[data-act="run"]', panel), speedIn = k(panel, 'speedIn'), resBox = k(panel, 'result');
    const chipS = stage.chip('r', 'hiz', 'Hız');
    const chipB = stage.chip('r', 'top', 'Topa');
    const chipR = stage.chip('l', 'kosul', 'Koşul');
    const chipT = stage.chip('l', 'tepki', 'Tepki');
    const weather = new R.Weather();
    let speed = 50, mu = 0.8, rtMode = 'me', built = false, run = null, world, carZ = 0, crashes = 0, lastT = 0;
    const tried = new Map();
    const dist = (kmh, m = mu, t = 1) => { const vv = kmh / 3.6; return { r: vv * t, b: (vv * vv) / (2 * m * GEE) }; };

    function newWorld() {
      world = new R.World({ kind: 'suburb', seed: 70 + Math.floor(Math.random() * 1000) });
      // Sağ şeritte park etmiş araçlar
      world.o.extras = (W, z0, z1) => {
        for (let z = Math.ceil(z0 / 6.5) * 6.5; z < z1; z += 6.5) if (Math.random() < 0.7) W.add({ type: 'car', view: 'rear', x: 4.72, z: z + 3.2, color: pick(R.CAR_COLORS), kind: Math.random() < 0.15 ? 'minibus' : 'sedan', parked: true });
      };
      world.ensure(560);
    }
    function paintChips() {
      chipR.set(`${speed} km/s · ${SURF[mu][0].toLocaleUpperCase('tr-TR') + SURF[mu].slice(1)} yol`);
      chipT.set(rtMode === 'me' ? 'Senin tepkin' : 'Standart · 1,0 sn');
    }
    function setBusy(on) {
      speedIn.disabled = on;
      $$('.chip-btn', panel).forEach((b) => { b.disabled = on; });
    }
    function setBtn(state) {
      runBtn.classList.toggle('is-alert', state === 'brake');
      $('span', runBtn).textContent = state === 'brake' ? 'FREN!' : state === 'wait' ? 'Bekle…' : 'Sür';
      $('use', runBtn).setAttribute('href', state === 'brake' ? '#i-pause' : '#i-play');
    }
    function start() {
      if (run) { press(); return; }
      resBox.hidden = true;
      carZ = 0; newWorld();
      const vv = speed / 3.6;
      run = { v: vv, v0: vv, t: 0, ballT: rand(1.4, 2.8), ballZ: null, ballX: 4.6, ballS: 0, pressT: null, brakeT: null, skid: null, hit: false, hitV: 0, stopZ: null, done: false, early: false, ballRot: 0, ballHop: 0, ballVZ: 0 };
      setBusy(true); setBtn(rtMode === 'me' ? 'brake' : 'wait');
      runBtn.disabled = rtMode !== 'me';
      feedback(panel, rtMode === 'me' ? 'Hazır ol… Top yola çıktığı anda <b>FREN</b>’e bas (boşluk tuşu ya da sahneye dokun).' : 'Araç ilerliyor… Tepki süresi 1 saniye alınacak.', '');
      G.Sfx.play('tap');
    }
    function press() {
      if (!run || run.done) return;
      if (run.ballZ == null) {
        if (!run.early) { run.early = true; stage.toast('Erken bastın! Topu bekle', 'bad', 1100); G.Sfx.play('bad'); }
        return;
      }
      if (run.pressT != null) return;
      run.pressT = run.t;
      run.brakeT = run.t + FOOT;
      setBtn('wait'); runBtn.disabled = true;
      G.Sfx.play('tick');
    }
    function step(dt) {
      const r = run;
      if (!r || r.done) return;
      r.t += dt;
      const front = carZ + HALF;
      // Top yola fırlar
      if (r.ballZ == null && r.t >= r.ballT) {
        r.ballZ = front + BALL_AT; r.appearT = r.t; r.ballX = 4.9;
        G.Sfx.play('pop');
        stage.toast('⚠ Top yola çıktı!', 'bad', 900);
        if (rtMode === 'std') { r.pressT = r.t + 1.0 - FOOT; r.brakeT = r.t + 1.0; }
      }
      // Top park etmiş araçların arasından çıkıp şeridin ortasında durur
      if (r.ballZ != null && !r.hit) { const target = 1.55, sp = Math.max(0.3, (r.ballX - target) * 3.2); if (r.ballX > target) { r.ballX = Math.max(target, r.ballX - sp * dt); r.ballRot -= (sp / 0.34) * dt; } }
      // Tepki süresi dolmadıysa otomatik fren (3 sn)
      if (r.ballZ != null && r.brakeT == null && r.t - r.appearT > 3) { r.pressT = r.t - FOOT; r.brakeT = r.t; r.late = true; }
      const braking = r.brakeT != null && r.t >= r.brakeT;
      if (braking) {
        if (!r.skid) r.skid = { z0: front };
        r.v = Math.max(0, r.v - mu * GEE * dt);
      }
      const z0 = carZ;
      carZ += r.v * dt;
      // Çarpma
      if (r.ballZ != null && !r.hit && carZ + HALF >= r.ballZ - 0.3 && r.v > 0.3) {
        r.hit = true; r.hitV = r.v; r.ballVZ = r.v * 1.25 + 2; r.ballHop = 0.01; r.ballVY = 3 + r.v * 0.15;
        G.Sfx.play('thud');
      }
      if (r.hit) { r.ballZ += r.ballVZ * dt; r.ballVZ = Math.max(0, r.ballVZ - 3 * dt); r.ballVY -= 9.8 * dt; r.ballHop = Math.max(0, r.ballHop + r.ballVY * dt); if (r.ballHop === 0 && r.ballVY < 0) r.ballVY = -r.ballVY * 0.45; r.ballRot += r.ballVZ * dt * 3; }
      world.ensure(carZ + 560); world.prune(carZ - 40);
      if (braking && r.v === 0) finish();
      void z0;
    }
    function finish() {
      const r = run;
      r.done = true;
      const reaction = r.brakeT - r.appearT; // saniye
      const dd = dist(speed, mu, reaction), total = dd.r + dd.b, stopped = !r.hit;
      const combo = `${speed}-${mu}-${rtMode}`, fresh = !tried.has(combo);
      tried.set(combo, { speed, mu, rtMode, reaction, total, ok: stopped });
      if (!stopped) crashes++;
      goal.set(Math.min(tried.size, GOAL), crashes);
      const R_ = tr(dd.r), B = tr(dd.b), Tt = tr(total);
      const quad = speed >= 70 ? `Hızın yarısıyla (${speed / 2} km/s) fren mesafesi ${tr(dist(speed / 2).b, 0)} m olurdu — yaklaşık 4’te 1.` : `Aynı yolda 2 kat hız (${speed * 2} km/s) fren mesafesini ${tr(dist(speed * 2).b, 0)} m yapar — yaklaşık 4 kat.`;
      const rtTxt = rtMode === 'me' ? `Tepkin <b>${tr(reaction, 2)} sn</b> (göz-el ${tr(Math.max(0, reaction - FOOT), 2)} sn + ayağı frene götürme ${tr(FOOT, 1)} sn)${r.late ? ' — çok geç kaldın' : ''}` : 'Tepki süresi <b>1,0 sn</b>';
      const again = fresh ? '' : ' <span class="fb-hint">Bu koşulu zaten denedin; hedef için farklı bir hız, yol ya da tepki seç.</span>';
      if (stopped) { feedback(panel, `✓ Toptan <b>${tr(BALL_AT - total)} m</b> önce durdun. ${rtTxt}. Duruş mesafen ${Tt} m (tepki ${R_} + fren ${B}). ${quad}${again}`, 'ok'); stage.toast(`✓ ${tr(BALL_AT - total, 1)} m önce durdun`, 'ok', 1800); G.Sfx.play('ok'); }
      else { feedback(panel, `✗ Duramadın! ${rtTxt}. Duruş mesafen <b>${Tt} m</b> (tepki ${R_} + fren ${B}); topla aran 50 m idi, yaklaşık <b>${tr(r.hitV * 3.6, 0)} km/s</b> hızla çarptın. ${quad}${again}`, 'bad'); stage.toast(`✗ ${tr(r.hitV * 3.6, 0)} km/s ile çarptın`, 'bad', 1800); G.Sfx.play('bad'); }
      paintResult(dd, reaction, stopped);
      setTimeout(() => { run = null; setBusy(false); setBtn('idle'); runBtn.disabled = false; }, 600);
      if (tried.size >= GOAL && !done.has(id)) {
        complete(id, host);
        setTimeout(() => finishCard(stage, id, 0, `${tried.size} farklı koşulda duruş mesafesini ölçtün. Hız 2 katına çıkınca fren mesafesi 4 katına çıkar; ıslak, karlı ve buzlu yolda çok daha uzar.`), 1400);
      }
    }
    // Sonuç paneli: tepki + fren şeridi ve hıza göre toplam duruş çubukları
    function paintResult(dd, reaction, stopped) {
      const total = dd.r + dd.b, maxM = Math.max(60, Math.ceil((total + 6) / 10) * 10), W = 640, sx = (m) => 20 + (m / maxM) * (W - 40);
      const ticks = [];
      const stepM = maxM <= 80 ? 10 : maxM <= 200 ? 20 : 50;
      for (let m = 0; m <= maxM; m += stepM) ticks.push(`<line x1="${sx(m)}" y1="58" x2="${sx(m)}" y2="64"/><text x="${sx(m)}" y="78">${m}</text>`);
      const speeds = [30, 50, 70, 90, 110, 130];
      const rt = rtMode === 'me' ? reaction : 1;
      const tots = speeds.map((s) => { const d = dist(s, mu, rt); return { s, r: d.r, b: d.b, t: d.r + d.b }; });
      const mx = Math.max(...tots.map((x) => x.t), 50);
      const bars = tots.map((x, i) => {
        const bw = 44, gx = 20 + i * ((W - 40) / speeds.length) + 8, hR = (x.r / mx) * 110, hB = (x.b / mx) * 110, cur = x.s === speed;
        return `<g class="${cur ? 'cur' : ''}"><rect class="rb" x="${gx}" y="${140 - hR - hB}" width="${bw}" height="${hB}" rx="4"/><rect class="rr" x="${gx}" y="${140 - hR}" width="${bw}" height="${hR}" rx="4"/><text class="rv" x="${gx + bw / 2}" y="${134 - hR - hB}">${Math.round(x.t)} m</text><text class="rs" x="${gx + bw / 2}" y="158">${x.s}</text></g>`;
      }).join('');
      const y50 = 140 - (50 / mx) * 110;
      const hist = [...tried.values()].map((h) => `<li class="${h.ok ? 'ok' : 'bad'}"><b>${h.speed}</b> km/s · ${SURF[h.mu]} · ${h.rtMode === 'me' ? tr(h.reaction, 2) + ' sn' : '1 sn'} → <b>${tr(h.total, 0)} m</b> ${h.ok ? '✓' : '✗'}</li>`).join('');
      resBox.innerHTML = `
        <div class="ds-card">
          <div class="ds-h"><b>Duruş mesafesi: ${tr(total)} m</b><span>${speed} km/s · ${SURF[mu]} yol · tepki ${tr(reaction, 2)} sn</span></div>
          <svg class="ds-strip" viewBox="0 0 ${W} 84" role="img" aria-label="Tepki mesafesi ${tr(dd.r)} metre, fren mesafesi ${tr(dd.b)} metre">
            <rect class="ds-road" x="10" y="14" width="${W - 20}" height="38" rx="8"/>
            <rect class="ds-r" x="${sx(0)}" y="22" width="${Math.max(2, sx(dd.r) - sx(0))}" height="22" rx="5"/>
            <rect class="ds-b" x="${sx(dd.r)}" y="22" width="${Math.max(2, sx(total) - sx(dd.r))}" height="22" rx="5"/>
            <line class="ds-ball" x1="${sx(50)}" y1="8" x2="${sx(50)}" y2="58"/><circle class="ds-ballc" cx="${sx(50)}" cy="8" r="6"/>
            <text class="ds-lbl" x="${(sx(0) + sx(dd.r)) / 2}" y="38">${dd.r * 1 >= 7 ? 'Tepki ' + tr(dd.r, 0) + ' m' : ''}</text>
            <text class="ds-lbl" x="${(sx(dd.r) + sx(total)) / 2}" y="38">${dd.b >= 7 ? 'Fren ' + tr(dd.b, 0) + ' m' : ''}</text>
            <g class="ds-ticks">${ticks.join('')}</g>
          </svg>
          <div class="ds-row">
            <svg class="ds-bars" viewBox="0 0 ${W} 166" role="img" aria-label="Aynı yol ve tepkiyle hıza göre toplam duruş mesafesi">
              <line class="ds-50" x1="14" y1="${y50}" x2="${W - 14}" y2="${y50}"/><text class="ds-50t" x="${W - 16}" y="${y50 - 5}">50 m</text>
              ${bars}
            </svg>
            <ul class="ds-hist">${hist}</ul>
          </div>
          <p class="ds-legend"><i class="lr"></i>Tepki mesafesi <i class="lb"></i>Fren mesafesi · Çubuklar: aynı yol ve tepkiyle farklı hızlarda toplam duruş (km/s)</p>
        </div>`;
      resBox.hidden = false;
      void stopped;
    }
    function draw(tms) {
      const ctx = stage.begin(), W = stage.w, H = stage.h;
      if (!W) return;
      const dt = lastT ? Math.min(0.05, (tms - lastT) / 1000) : 0; lastT = tms;
      v.hfov = stage.narrow ? 58 : 62;
      v.viewport(0, 0, W, H, stage.narrow ? 0.36 : 0.34);
      const braking = run && run.brakeT != null && run.t >= run.brakeT && run.v > 0;
      v.cy += braking ? 5 : 0;
      v.cam.x = 1.3; v.cam.y = 2.5; v.cam.z = carZ - 9.4; v.cam.yaw = 0;
      const P = R.palette(stage.night, WX[mu]);
      weather.set(WX[mu]);
      weather.update(dt, v, run ? run.v : 0);
      const dyn = [{ type: 'car', view: 'rear', kind: 'player', x: 1.75, z: carZ, brake: braking || (run && run.done), bias: -0.5 }];
      if (run && run.ballZ != null) dyn.push({ type: 'ball', x: run.ballX, z: run.ballZ, r: 0.34, rot: run.ballRot, hop: run.ballHop || 0 });
      const lights = stage.night ? [{ kind: 'beam', x: 1.75, z: carZ + 2.4, dir: 1, len: 42, a: 0.55 }] : [];
      R.render(ctx, v, world, P, dyn, {
        time: tms / 1000, lights, wet: mu === 0.5 || mu === 0.1,
        decals: (c, vv) => {
          if (!run || !run.skid) return;
          const z1 = carZ + HALF - 0.6, a = mu === 0.8 ? 0.55 : 0.35;
          const col = mu >= 0.5 ? `rgba(20,20,22,${a})` : `rgba(255,255,255,${a * 0.8})`;
          for (const x of [1.75 - 0.72, 1.75 + 0.72]) vv.quad(c, x - 0.12, x + 0.12, run.skid.z0 - 3.6, z1, col);
        }
      });
      weather.draw(ctx, v, stage.night);
      if (mu === 0.1 && !stage.night) { const g = ctx.createLinearGradient(0, v.cy, 0, H); g.addColorStop(0, 'rgba(200,225,255,0)'); g.addColorStop(1, 'rgba(200,225,255,.16)'); ctx.fillStyle = g; ctx.fillRect(0, v.cy, W, H - v.cy); }
      chipS.set(`${Math.round((run ? run.v : speed / 3.6) * 3.6)} km/s`);
      if (run && run.ballZ != null && !run.done) chipB.show(true).set(`${Math.max(0, Math.round(run.ballZ - (carZ + HALF)))} m`, '#ffb4ab');
      else chipB.show(false);
    }
    const L = G.loop((dt, t) => { stage.tick(dt); if (run && !run.done) step(dt); draw(t); });
    speedIn.addEventListener('input', () => { speed = Number(speedIn.value); k(panel, 'speed').textContent = speed; paintChips(); });
    $$('.chip-btn[data-mu]', panel).forEach((b) => b.addEventListener('click', () => {
      if (run) return;
      $$('.chip-btn[data-mu]', panel).forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', String(x === b)); });
      mu = Number(b.dataset.mu); paintChips();
    }));
    $$('.chip-btn[data-rt]', panel).forEach((b) => b.addEventListener('click', () => {
      if (run) return;
      $$('.chip-btn[data-rt]', panel).forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', String(x === b)); });
      rtMode = b.dataset.rt; paintChips();
    }));
    G.hold(runBtn, () => start(), () => {});
    stage.canvas.addEventListener('pointerdown', (e) => { if (run && !run.done) { e.preventDefault(); press(); } });
    $('[data-act="reset"]', panel).addEventListener('click', () => {
      if (run) return;
      tried.clear(); crashes = 0; goal.set(0, 0); resBox.hidden = true; carZ = 0; newWorld();
      feedback(panel, 'Hızı, yol durumunu ve tepki türünü seç, sonra “Sür”e bas. Hedef: 3 farklı koşulu denemek.', '');
    });
    return {
      init() {
        if (!built) { built = true; newWorld(); paintChips(); setBtn('idle'); feedback(panel, 'Hızı, yol durumunu ve tepki türünü seç, sonra “Sür”e bas. Hedef: 3 farklı koşulu denemek.', ''); }
      },
      start() { this.init(); L.start(); },
      stop() { L.stop(); },
      key(e) { if (e.code === 'Space' || e.code === 'Enter') { if (run) press(); else start(); return true; } return false; },
      debug() { return { run: run && { t: run.t, ball: run.ballZ != null, v: run.v, done: run.done }, tried: tried.size, crashes }; }
    };
  })();

  /* =========================================================
     DERS 7 — Ayna ayarı ve kör nokta
     Üstte sol ayna, iç ayna ve sağ ayna görüntüsü (3B), altta kuşbakışı görüş konileri ve kör noktalar.
     Aynaları ayarla, sonra omuz kontrolüyle iki kez güvenli şerit değiştir.
     ========================================================= */
  const lessonAyna = (() => {
    const id = 'ayna', panel = panelOf(id), host = $('.sim', panel);
    const stage = new G.Stage(host, { height: (w) => (w < 560 ? Math.round(clamp(w * 1.36, 440, 580)) : Math.round(clamp(w * 0.7, 440, 610))) });
    const v = new T.View2D(), D = T.D;
    const LANE = 3.6, HALF = 15, HALF_I = 12, EYE = { x: -0.38, y: -0.3 }, SPEED = 24;
    const ML = { x: -1.02, y: -0.85 }, MR = { x: 1.02, y: -0.85 }, MI = { x: 0, y: 2.2 };
    const goal = goalBar(panel, 3);
    const lIn = k(panel, 'lIn'), rIn = k(panel, 'rIn');
    const chipB = stage.chip('l', 'kor', 'Kör nokta');
    const chipL = stage.chip('r', 'serit', 'Şerit');
    const views = { L: new R.View3D(), I: new R.View3D(), Rr: new R.View3D() };
    let aL = 4, aR = 4, lane = 0, laneX = 0, veh = [], carZ = 0, world, built = false, shoulder = null, lastShoulder = { L: -99, R: -99 }, clock = 0;
    let goodSet = false, safe = 0, bad = 0, man = null, bestA = 16, bestPct = 0, blindCv = null, spawnT = 1, flash = 0, hatch = null, roadCv = null, roadKey = '';
    const rad = (d) => (d * Math.PI) / 180;

    // Bir nokta (arabaya göre, metre; y arkaya doğru +) aynalardan ya da doğrudan görülüyor mu?
    function seenBy(px, py, al, ar, sh) {
      if (py < -0.2) return 'direct';
      const inSide = (M, a, s) => {
        const dx = (px - M.x) * s, dy = py - M.y;
        if (dy <= 0.1 || Math.hypot(dx, dy) > 70) return false;
        const th = Math.atan2(-dx, dy) * 180 / Math.PI; // dışa doğru açı (derece)
        return th >= Math.max(a - HALF, 1.4) && th <= a + HALF;
      };
      if (px < 0 && inSide(ML, al, 1)) return 'mirror';
      if (px > 0 && inSide(MR, ar, -1)) return 'mirror';
      if (py > MI.y + 0.3 && Math.abs(Math.atan2(px, py - MI.y) * 180 / Math.PI) < HALF_I) return 'mirror';
      if (sh) {
        const s = sh === 'L' ? -1 : 1;
        if (Math.sign(px) === s && Math.hypot(px - EYE.x, py - EYE.y) < 14) { const th = Math.atan2(Math.abs(px - EYE.x), py - EYE.y) * 180 / Math.PI; if (th > 30 && th < 115) return 'shoulder'; }
      }
      return null;
    }
    function blindPct(al, ar) {
      let blind = 0, total = 0;
      for (const [x0, x1] of [[-5.4, -1.8], [1.8, 5.4]]) for (let y = 0; y < 12; y += 0.5) for (let x = x0 + 0.25; x < x1; x += 0.5) { total++; if (!seenBy(x, y, al, ar, null)) blind++; }
      return (blind / total) * 100;
    }
    (() => { let best = 99; for (let a = 0; a <= 30; a++) { const p = blindPct(a, a); if (p < best - 0.01) { best = p; bestA = a; } } bestPct = best; })();

    function build() {
      world = new R.World({ kind: 'highway', seed: 90 + Math.floor(Math.random() * 1000), center: () => 'none' });
      carZ = 0; world.ensure(carZ + 300);
      veh = [
        { lane: -1, y: 5.5, vy: -0.9, kind: 'moto', color: '#2f63c8' },
        { lane: 1, y: 14, vy: -2.4, kind: 'sedan', color: '#e68a2e' }
      ];
      aL = 4; aR = 4; lIn.value = 4; rIn.value = 4; lane = 0; laneX = 0; man = null; shoulder = null; lastShoulder = { L: -99, R: -99 };
      goodSet = false; safe = 0; bad = 0; spawnT = 3; clock = 0;
      paintGoal();
    }
    const paintGoal = () => goal.set((goodSet ? 1 : 0) + safe, bad);
    function judge(quiet) {
      const pct = blindPct(aL, aR);
      k(panel, 'blind').textContent = `%${Math.round(pct)}`;
      k(panel, 'l').textContent = `${aL}°`; k(panel, 'r').textContent = `${aR}°`;
      const good = Math.abs(aL - bestA) <= 4 && Math.abs(aR - bestA) <= 4;
      if (good && !goodSet) {
        goodSet = true; paintGoal(); G.Sfx.play('ok'); stage.toast('✓ Aynalar doğru ayarlandı', 'ok');
        feedback(panel, `✓ Çok iyi ayar! Kör nokta küçüldü (%${Math.round(pct)}) ama tamamen yok olmadı. Şimdi <b>omuz kontrolü</b> yapıp güvenli şekilde şerit değiştir.`, 'ok');
        checkDone();
      } else if (!quiet && !goodSet) {
        if (aL < 9 || aR < 9) feedback(panel, 'Aynalar kendi aracına bakıyor: ayna görüntüsünün büyük kısmında kendi kapını görüyorsun. Aynaları dışa doğru çevir.', '');
        else if (aL > bestA + 4 || aR > bestA + 4) feedback(panel, 'Aynaları fazla dışa çevirdin: aracının hemen arkası görünmez oldu. Biraz içe al.', '');
        else feedback(panel, `Kör nokta %${Math.round(pct)}. Biraz daha dışa çevirmeyi dene.`, '');
      }
      return pct;
    }
    function checkDone() {
      if (goodSet && safe >= 2 && !done.has(id)) {
        complete(id, host);
        setTimeout(() => finishCard(stage, id, bad, 'Aynaları doğru ayarladın ve omuz kontrolü yaparak iki kez güvenle şerit değiştirdin. Ayna → sinyal → omuz kontrolü → manevra!'), 900);
      }
    }
    function shoulderCheck() {
      if (shoulder) return;
      G.Sfx.play('whoosh');
      shoulder = { side: 'L', t: 0 };
      feedback(panel, 'Başını sola çevirdin: aynaların göremediği bölgeyi (yeşil) doğrudan görüyorsun…', '');
    }
    function laneChange(s) {
      if (man) return;
      const target = lane + s;
      if (target < -1 || target > 1) { stage.toast(s < 0 ? 'Solda başka şerit yok' : 'Sağda başka şerit yok', 'info', 900); return; }
      const side = s < 0 ? 'L' : 'R';
      const checked = clock - lastShoulder[side] < 5;
      const conflict = veh.find((q) => q.lane === target && q.y > -4.6 && q.y < 8.5);
      man = { from: lane, to: target, t: 0, abort: !!conflict, blink: s };
      G.Sfx.play('blink');
      if (conflict) {
        conflict.honk = 1.2; conflict.vy = Math.max(conflict.vy, 2.5);
        bad++; paintGoal();
        setTimeout(() => G.Sfx.play('horn'), 500);
        flash = 1;
        feedback(panel, `✗ ${side === 'L' ? 'Sol' : 'Sağ'} şeritte araç vardı${seenBy(conflict.lane * LANE - laneX, conflict.y, aL, aR, null) ? '' : ' — hem de kör noktada'}! Şerit değiştirmeden önce aynaya bak, sinyal ver ve <b>omuz kontrolü</b> yap.`, 'bad');
        stage.toast('✗ Kör noktada araç vardı!', 'bad', 1500);
      } else if (!checked) {
        bad++; paintGoal();
        feedback(panel, '✗ Şerit boştu, şanslıydın; ama <b>omuz kontrolü yapmadan</b> şerit değiştirdin. Kör noktadaki motosikleti aynalar göstermez.', 'bad');
        stage.toast('✗ Omuz kontrolü yapmadın', 'bad', 1400);
        G.Sfx.play('bad');
      } else {
        safe++; paintGoal();
        feedback(panel, `✓ Güvenli şerit değiştirme: ayna, sinyal, omuz kontrolü ve boş şerit. (${Math.min(safe, 2)}/2)`, 'ok');
        stage.toast('✓ Güvenli şerit değiştirme', 'ok', 1300);
        G.Sfx.play('ok');
        checkDone();
      }
    }
    function simulate(dt) {
      clock += dt;
      carZ += SPEED * dt;
      world.ensure(carZ + 300); world.prune(carZ - 320);
      if (man) {
        man.t += dt;
        const u = clamp((man.t - 0.5) / 1.2, 0, 1);
        if (man.abort) { const k2 = man.t < 1.1 ? Math.sin(Math.min(1, (man.t - 0.4) / 0.7) * Math.PI / 2) * 0.35 : Math.max(0, 0.35 - (man.t - 1.1)); laneX = lerp(man.from * LANE, man.to * LANE, clamp(k2, 0, 0.35)); if (man.t > 1.6) { laneX = man.from * LANE; man = null; } }
        else { laneX = lerp(man.from * LANE, man.to * LANE, G.easeInOut(u)); if (u >= 1) { lane = man.to; laneX = lane * LANE; man = null; } }
      }
      if (shoulder) {
        shoulder.t += dt;
        if (shoulder.side === 'L' && shoulder.t > 0.9) { lastShoulder.L = clock; shoulder = { side: 'R', t: 0 }; feedback(panel, '…şimdi sağ omzunun üzerinden. Şerit değiştirmeden hemen önce bu kontrolü yap.', ''); }
        else if (shoulder.side === 'R' && shoulder.t > 0.9) { lastShoulder.R = clock; shoulder = null; feedback(panel, 'Omuz kontrolü tamam. 5 saniye içinde güvenliyse şerit değiştirebilirsin.', ''); }
      }
      for (const q of veh) { q.y += q.vy * dt; if (q.honk) q.honk = Math.max(0, q.honk - dt); }
      veh = veh.filter((q) => q.y > -26 && q.y < 30);
      spawnT -= dt;
      if (spawnT <= 0 && veh.length < 3) {
        const lanes = [-1, 0, 1].filter((l) => l !== lane || Math.random() < 0.3);
        const ln = pick(lanes);
        const kind = Math.random() < 0.35 ? 'moto' : Math.random() < 0.2 ? 'minibus' : pick(['sedan', 'suv', 'hatch']);
        if (!veh.some((q) => q.lane === ln && q.y > 6)) veh.push({ lane: ln, y: 24, vy: -rand(1.6, 3.2), kind, color: pick(['#2f63c8', '#e68a2e', '#3f7d55', '#8c2f2b', '#6b7380', '#2b2f36', '#d63a2f']) });
        spawnT = rand(3.2, 6);
      }
      if (flash > 0) flash = Math.max(0, flash - dt * 2);
    }
    // Üstteki ayna görüntüleri
    function mirrorRects(W, top) {
      const pad = stage.narrow ? 8 : 14, gap = stage.narrow ? 6 : 12, inner = W - pad * 2 - gap * 2;
      const sw = inner * 0.32, iw = inner * 0.36, h = top - pad - (stage.narrow ? 14 : 18);
      return { L: { x: pad, y: pad, w: sw, h }, I: { x: pad + sw + gap, y: pad, w: iw, h: h * 0.82 }, Rr: { x: pad + sw + gap + iw + gap, y: pad, w: sw, h } };
    }
    function drawMirror(ctx, key, r, P, t) {
      const vw = views[key];
      const cx = laneX;
      vw.hfov = key === 'I' ? 2 * HALF_I + 6 : 2 * HALF;
      vw.mirror = true;
      vw.far = 170;
      vw.viewport(r.x, r.y, r.w, r.h, key === 'I' ? 0.5 : 0.46, 0);
      if (key === 'L') vw.cam = { x: cx + ML.x, y: 1.05, z: carZ - ML.y, yaw: Math.PI + rad(aL) };
      else if (key === 'Rr') vw.cam = { x: cx + MR.x, y: 1.05, z: carZ - MR.y, yaw: Math.PI - rad(aR) };
      else vw.cam = { x: cx, y: 1.28, z: carZ - 0.4, yaw: Math.PI };
      const dyn = veh.map((q) => (q.kind === 'moto' ? { type: 'moto', view: 'front', x: q.lane * LANE, z: carZ - q.y, color: q.color, head: q.honk > 0 } : { type: 'car', view: 'front', x: q.lane * LANE, z: carZ - q.y, color: q.color, kind: q.kind === 'minibus' ? 'minibus' : 'sedan', head: P.night || q.honk > 0, high: q.honk > 0 }));
      ctx.save();
      // Ayna gövdesi
      const R0 = key === 'I' ? 12 : 18;
      ctx.fillStyle = '#1b1d22'; rr(ctx, r.x - 5, r.y - 5, r.w + 10, r.h + 10, R0 + 5); ctx.fill();
      rr(ctx, r.x, r.y, r.w, r.h, R0); ctx.clip();
      R.render(ctx, vw, world, P, dyn, { time: t / 1000, noRidge: false, balloons: false, lights: [], lod: 1 });
      // Kendi aracın (yan aynanın iç kenarında)
      if (key !== 'I') {
        const a = key === 'L' ? aL : aR;
        const frac = clamp((HALF - a + 1.4) / (2 * HALF), 0, 0.9);
        if (frac > 0.01) {
          const bw = r.w * frac, bx = key === 'L' ? r.x + r.w - bw : r.x;
          const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
          const edge = P.night ? '#9aa3b1' : '#e8ecf1', mid = P.night ? '#c7ced8' : '#ffffff';
          if (key === 'L') { g.addColorStop(0, edge); g.addColorStop(1, mid); } else { g.addColorStop(0, mid); g.addColorStop(1, edge); }
          ctx.fillStyle = g; ctx.fillRect(bx, r.y + r.h * 0.18, bw, r.h * 0.82);
          ctx.fillStyle = P.night ? '#141821' : '#2d3846'; ctx.fillRect(bx, r.y, bw, r.h * 0.2);
          ctx.fillStyle = '#de2f29'; ctx.fillRect(bx, r.y + r.h * 0.62, bw, Math.max(2, r.h * 0.05));
          ctx.fillStyle = '#1f5fd1'; ctx.fillRect(bx, r.y + r.h * 0.68, bw, Math.max(1, r.h * 0.02));
          ctx.fillStyle = 'rgba(0,0,0,.18)'; if (bw > 22) { const hx = key === 'L' ? bx + bw * 0.35 : bx + bw * 0.45; rr(ctx, hx, r.y + r.h * 0.4, Math.min(22, bw * 0.3), 5, 2.5); ctx.fill(); }
        }
      } else {
        // İç ayna: arka cam çerçevesi ve koltuk başlıkları
        ctx.fillStyle = P.night ? '#0b0d12' : '#23262d';
        ctx.beginPath();
        ctx.rect(r.x, r.y, r.w, r.h);
        const ix = r.x + r.w * 0.1, iw = r.w * 0.8, iy = r.y + r.h * 0.12, ih = r.h * 0.62;
        ctx.moveTo(ix + 14, iy); ctx.lineTo(ix + iw - 14, iy); ctx.quadraticCurveTo(ix + iw, iy, ix + iw + 6, iy + ih); ctx.lineTo(ix - 6, iy + ih); ctx.quadraticCurveTo(ix, iy, ix + 14, iy);
        ctx.fill('evenodd');
        ctx.fillStyle = P.night ? '#1a1d24' : '#3a3f48';
        for (const hx of [0.3, 0.7]) { rr(ctx, r.x + r.w * hx - r.w * 0.07, r.y + r.h * 0.6, r.w * 0.14, r.h * 0.32, 8); ctx.fill(); }
      }
      // Cam parlaması
      const gl = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
      gl.addColorStop(0, 'rgba(255,255,255,.16)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,.04)');
      ctx.fillStyle = gl; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, R0); ctx.stroke();
      const lbl = key === 'L' ? `SOL AYNA · ${aL}°` : key === 'Rr' ? `SAĞ AYNA · ${aR}°` : 'İÇ AYNA';
      ctx.font = `700 ${stage.narrow ? 9.5 : 11}px JetBrains Mono, monospace`; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(lbl, r.x + r.w / 2, r.y + r.h + (stage.narrow ? 4 : 6));
    }
    function hatchPat(ctx) {
      if (hatch) return hatch;
      const c = document.createElement('canvas'); c.width = c.height = 12;
      const x = c.getContext('2d');
      x.fillStyle = 'rgba(255,59,48,.28)'; x.fillRect(0, 0, 12, 12);
      x.strokeStyle = 'rgba(255,59,48,.75)'; x.lineWidth = 2.2;
      x.beginPath(); x.moveTo(-3, 15); x.lineTo(15, -3); x.moveTo(-9, 9); x.lineTo(9, -9); x.moveTo(3, 21); x.lineTo(21, 3); x.stroke();
      hatch = ctx.createPattern(c, 'repeat');
      return hatch;
    }
    function coneWedge(ctx, M, dirAng, half, len) {
      // dirAng: arkaya göre dışa açı (sağa +), ekran koordinatında
      ctx.beginPath(); ctx.moveTo(M.x, M.y);
      const a0 = Math.PI / 2 - rad(dirAng + half), a1 = Math.PI / 2 - rad(dirAng - half);
      ctx.arc(M.x, M.y, len, a0, a1); ctx.closePath();
    }
    function frame(dt, now) {
      if (!built || !stage.w) return;
      simulate(dt);
      const ctx = stage.begin(), W = stage.w, H = stage.h;
      const P3 = R.palette(stage.night), P = T.palette(stage.night);
      const top = stage.narrow ? clamp(W * 0.3, 96, 128) : clamp(W * 0.19, 120, 160);
      stage.hudL.style.top = stage.hudR.style.top = (top + 10) + 'px';
      // Arka plan: araç içi bandı
      const bgG = ctx.createLinearGradient(0, 0, 0, top);
      bgG.addColorStop(0, '#0f1116'); bgG.addColorStop(1, '#1b1e25');
      ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, top);
      // Kuşbakışı otoyol
      const areaH = H - top;
      v.scale = Math.min(areaH / 25, W / 17);
      v.ox = W / 2 - laneX * v.scale * 0; v.oy = top + areaH * 0.42;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, top, W, areaH); ctx.clip();
      // Kayan yol zemini: 36 m'de bir tekrar eden şerit, bir kez pişirilir
      const yA = -areaH * 0.42 / v.scale - 1, yB = areaH * 0.58 / v.scale + 1, PER = 36;
      const bkey = W + 'x' + H + '|' + stage.theme + '|' + v.scale.toFixed(3) + '|' + stage.dpr;
      if (bkey !== roadKey) {
        roadKey = bkey;
        const hM = yB - yA + PER, wM = W / v.scale + 30;
        roadCv = T.bake({ w: Math.ceil(wM * v.scale), h: Math.ceil(hM * v.scale), dpr: stage.dpr }, (c) => {
          c.save(); c.scale(v.scale, v.scale); c.translate(wM / 2, 0);
          const vv = { scale: v.scale };
          D.grass(c, vv, P, -wM / 2, 0, wM, hM);
          c.fillStyle = shade(P.road, 0.12); c.fillRect(-7.4, 0, 14.8, hM);
          D.asphalt(c, vv, P, -5.4, 0, 10.8, hM);
          c.fillStyle = P.night ? '#6b717b' : '#bcc2ca'; c.fillRect(-7.7, 0, 0.25, hM); c.fillRect(7.45, 0, 0.25, hM);
          c.strokeStyle = P.roadLine; c.lineWidth = 0.15; c.setLineDash([4, 8]);
          for (const lx of [-1.8, 1.8]) { c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, hM); c.stroke(); }
          c.setLineDash([]); c.beginPath(); c.moveTo(-5.25, 0); c.lineTo(-5.25, hM); c.moveTo(5.25, 0); c.lineTo(5.25, hM); c.stroke();
          for (let ty = 4; ty < hM + 9; ty += 9) for (const sx of [-1, 1]) D.tree(c, vv, P, sx * (11.5 + (Math.round(ty / 9) % 3)), ty % hM, 1.3, 50 + Math.round(ty / 9) * 3 + (sx > 0 ? 1 : 0));
          c.restore();
        });
        roadCv._wM = wM; roadCv._hM = hM;
      }
      const off = ((carZ % PER) + PER) % PER;
      ctx.drawImage(roadCv, v.X(-roadCv._wM / 2 - laneX), v.Y(yA - PER + off), roadCv._wM * v.scale, roadCv._hM * v.scale);
      ctx.save(); v.apply(ctx);
      // Görüş konileri
      const L0 = 32;
      const effL = [Math.max(aL - HALF, 1.4), aL + HALF], effR = [Math.max(aR - HALF, 1.4), aR + HALF];
      const cone = (M, dirA, half, col) => { const g = ctx.createRadialGradient(M.x, M.y, 0, M.x, M.y, L0); g.addColorStop(0, alpha(col, 0.34)); g.addColorStop(1, alpha(col, 0)); ctx.fillStyle = g; coneWedge(ctx, M, dirA, half, L0); ctx.fill(); ctx.strokeStyle = alpha(col, 0.55); ctx.lineWidth = 0.06; ctx.stroke(); };
      cone(ML, -((effL[0] + effL[1]) / 2), (effL[1] - effL[0]) / 2, '#ffc83d');
      cone(MR, (effR[0] + effR[1]) / 2, (effR[1] - effR[0]) / 2, '#ffc83d');
      cone(MI, 0, HALF_I, '#6fb4ff');
      if (shoulder) { const s = shoulder.side === 'L' ? -1 : 1; cone(EYE, s * 72, 42, '#3ddc84'); }
      ctx.restore();
      // Kör nokta bölgesi (ekran dışı katmanda, konileri silerek)
      const dpr = stage.dpr;
      const blindKey = [W, H, dpr, aL, aR, lane, !!man, shoulder ? shoulder.side : '', v.scale.toFixed(2)].join('|');
      if (!blindCv || blindCv.width !== Math.round(W * dpr) || blindCv.height !== Math.round(H * dpr)) { blindCv = document.createElement('canvas'); blindCv.width = Math.round(W * dpr); blindCv.height = Math.round(H * dpr); blindCv._key = ''; }
      const bx = blindCv.getContext('2d');
      if (blindCv._key !== blindKey) {
      blindCv._key = blindKey;
      bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, blindCv.width, blindCv.height);
      bx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bx.save(); v.apply(bx);
      bx.fillStyle = hatchPat(ctx);
      for (const [x0, x1, has] of [[-5.4, -1.8, lane > -1], [1.8, 5.4, lane < 1]]) {
        if (!has || man) continue;
        bx.save(); bx.translate(x0, -0.2); bx.scale(1 / v.scale, 1 / v.scale); bx.fillRect(0, 0, (x1 - x0) * v.scale, 12.2 * v.scale); bx.restore();
      }
      bx.globalCompositeOperation = 'destination-out';
      bx.fillStyle = '#000';
      coneWedge(bx, ML, -((effL[0] + effL[1]) / 2), (effL[1] - effL[0]) / 2, 80); bx.fill();
      coneWedge(bx, MR, (effR[0] + effR[1]) / 2, (effR[1] - effR[0]) / 2, 80); bx.fill();
      coneWedge(bx, MI, 0, HALF_I, 80); bx.fill();
      if (shoulder) { const s = shoulder.side === 'L' ? -1 : 1; coneWedge(bx, EYE, s * 72, 42, 14); bx.fill(); }
      // Uzak arka: 12 m sonrasını yumuşat
      const fade = bx.createLinearGradient(0, 8, 0, 12); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      bx.fillStyle = fade; bx.fillRect(-8, 8, 16, 4.2);
      bx.restore();
      }
      ctx.save(); ctx.globalAlpha = 0.85 + 0.15 * Math.sin(now / 250); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(blindCv, 0, 0); ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Araçlar
      ctx.save(); v.apply(ctx);
      for (const q of veh) T.vehicle(ctx, v, q.lane * LANE - laneX, q.y, 0, { kind: q.kind, color: q.color, night: stage.night, beams: false, head: q.honk > 0 });
      T.vehicle(ctx, v, 0, 0, man ? (man.to - man.from) * 0.12 * Math.sin(clamp((man.t - 0.5) / 1.2, 0, 1) * Math.PI) * (man.abort ? 0.5 : 1) : 0, { kind: 'player', night: stage.night, blinkL: man && man.blink < 0 && man.t < 1.7, blinkR: man && man.blink > 0 && man.t < 1.7 });
      ctx.fillStyle = '#ffc83d'; ctx.beginPath(); ctx.arc(EYE.x, EYE.y, 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.restore();
      // Kör noktadaki araç uyarısı
      for (const q of veh) {
        const rx = q.lane * LANE - laneX;
        const reach = q.kind === 'moto' ? 0.9 : 2.1;
        const seen = [0, -reach, reach].some((d) => seenBy(rx, q.y + d, aL, aR, shoulder ? shoulder.side : null));
        q.blind = q.lane !== lane && q.y > -1.5 && q.y < 11 && !seen;
        if (q.blind) {
          const X = v.X(rx), Y = v.Y(q.y), rr2 = (q.kind === 'moto' ? 1.6 : 2.9) * v.scale;
          ctx.save(); ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2.5 + Math.sin(now / 140) * 0.8; ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.ellipse(X, Y, rr2 * 0.55, rr2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          T.bubble(ctx, X, Y - rr2 - 2, 'Kör noktada!', '#ffffff', '#d7372f', 12);
        }
      }
      // Aynalar
      for (const key of ['L', 'I', 'Rr']) drawMirror(ctx, key, mirrorRects(W, top)[key], P3, now);
      if (flash > 0) { ctx.fillStyle = `rgba(255,59,48,${flash * 0.25})`; ctx.fillRect(0, 0, W, H); }
      const pct = blindPct(aL, aR);
      chipB.set(`%${Math.round(pct)}`, pct <= bestPct + 6 ? '#7df0a8' : pct > 55 ? '#ffb4ab' : '#ffd08a');
      chipL.set(['Sol', 'Orta', 'Sağ'][lane + 1] + ' şerit');
    }
    const L = G.loop((dt, t) => { stage.tick(dt); frame(dt, t); });
    lIn.addEventListener('input', () => { aL = Number(lIn.value); judge(); });
    rIn.addEventListener('input', () => { aR = Number(rIn.value); judge(); });
    $('[data-act="shoulder"]', panel).addEventListener('click', shoulderCheck);
    $('[data-act="left"]', panel).addEventListener('click', () => laneChange(-1));
    $('[data-act="right"]', panel).addEventListener('click', () => laneChange(1));
    $('[data-act="ideal"]', panel).addEventListener('click', () => {
      const from = [aL, aR];
      G.tween(700, (e) => { aL = Math.round(lerp(from[0], bestA, e)); aR = Math.round(lerp(from[1], bestA, e)); lIn.value = aL; rIn.value = aR; k(panel, 'l').textContent = `${aL}°`; k(panel, 'r').textContent = `${aR}°`; }).then(() => judge());
    });
    $('[data-act="reset"]', panel).addEventListener('click', () => { build(); judge(true); feedback(panel, 'Aynalar şu an kendi aracına bakıyor. Sürgülerle dışa doğru çevir: hem ayna görüntüsünü hem de kırmızı kör noktayı izle.', ''); });
    return {
      init() { if (!built) { built = true; build(); judge(true); feedback(panel, 'Aynalar şu an kendi aracına bakıyor. Sürgülerle dışa doğru çevir: hem ayna görüntüsünü hem de kırmızı kör noktayı izle.', ''); } },
      start() { this.init(); L.start(); },
      stop() { L.stop(); },
      key(e) {
        if (e.code === 'Space') { shoulderCheck(); return true; }
        if (e.code === 'ArrowLeft') { laneChange(-1); return true; }
        if (e.code === 'ArrowRight') { laneChange(1); return true; }
        return false;
      },
      debug() { return { aL, aR, bestA, bestPct, lane, safe, bad, goodSet, veh: veh.map((q) => ({ lane: q.lane, y: +q.y.toFixed(1), blind: q.blind })) }; }
    };
  })();

  /* =========================================================
     DERS 8 — Temel yaşam desteği (İlk Yardım)
     Yan görünüm sahne: kaza yeri, kazazede ve ilk yardımcı. Önce adımlar doğru sırayla seçilir,
     sonra ritim şeridindeki vuruşlara denk getirerek 30 göğüs basısı + 2 suni solunum (iki tur).
     ========================================================= */
  const lessonTyd = (() => {
    const id = 'tyd', panel = panelOf(id), host = $('.sim', panel);
    const stage = new G.Stage(host, { height: (w) => (w < 560 ? Math.round(w * 0.98) : Math.round(clamp(w * 0.5, 320, 460))) });
    const STEPS = [
      { id: 'guvenlik', ic: 'i-shield', label: 'Olay yerini güvenli hâle getir', sub: 'Kontak kapalı, reflektör ve dörtlüler', ok: 'Olay yeri güvende: reflektör kondu, dörtlüler yanıyor.' },
      { id: 'bilinc', ic: 'i-users', label: 'Bilincini kontrol et', sub: 'Omuzlara dokun, “İyi misiniz?” diye seslen', ok: 'Kazazede yanıt vermiyor; bilinci kapalı.' },
      { id: 'ara', ic: 'i-phone', label: '112’yi ara', sub: 'Yeri ve kazazedenin durumunu bildir', ok: '112 arandı, ambulans yolda. Telefonun hoparlörünü açık tut.' },
      { id: 'havayolu', ic: 'i-heart', label: 'Hava yolunu aç', sub: 'Baş geri – çene yukarı', ok: 'Hava yolu açıldı: baş geri, çene yukarı.' },
      { id: 'solunum', ic: 'i-eye', label: 'Solunumu kontrol et', sub: 'En fazla 10 sn bak – dinle – hisset', ok: 'Solunum yok! Hemen göğüs basısına başla: 30 bası, 2 solunum.' }
    ];
    const NEED = { guvenlik: [], bilinc: ['guvenlik'], ara: ['bilinc'], havayolu: ['bilinc'], solunum: ['havayolu'] };
    const WHY = {
      bilinc: 'Önce <b>kendi güvenliğini ve olay yerinin güvenliğini</b> sağla (Koru).',
      ara: 'Önce <b>bilinç kontrolü</b> yap; 112’ye kazazedenin durumunu bildireceksin.',
      havayolu: 'Önce <b>bilinç kontrolü</b> yapmalısın.',
      solunum: 'Önce <b>hava yolunu açmalısın</b>; kapalı hava yolunda solunum değerlendirilemez.'
    };
    const BPM = 110, BEAT = 60 / BPM;
    const goal = goalBar(panel, STEPS.length + 2);
    const stepBox = k(panel, 'steps'), pressBtn = $('[data-act="press"]', panel);
    const chipL = stage.chip('l', 'tyd', 'İlk yardım');
    const chipR = stage.chip('r', 'rit', 'Ritim');
    const fakeV = { fc: (c) => c, fog: () => 0 };
    let doneSteps, order, stage2, count, breaths, cycles, bad, busy, built, st, beats, t0, hits, presses, rating, clock, amb, bubbles, zoom;

    function reset() {
      doneSteps = new Set(); order = []; stage2 = 'steps'; count = 0; breaths = 0; cycles = 0; bad = 0; busy = false; hits = []; presses = []; rating = null; clock = 0; amb = null; bubbles = []; zoom = 0;
      st = { tri: 0, haz: false, helper: 0, tilt: 0, press: 0, lean: 0, ring: 0, rise: 0, phone: 0 };
      beats = null;
      pressBtn.hidden = true;
      renderSteps();
      paintGoal();
      chipL.set('Kazazede yerde yatıyor');
      chipR.show(false);
      feedback(panel, 'Bir araç kaza yaptı, sürücü yol kenarında hareketsiz yatıyor. Adımları <b>doğru sırayla</b> seç.', '');
    }
    function paintGoal() { goal.set(doneSteps.size + cycles, bad); }
    function renderSteps() {
      if (stage2 !== 'steps') { stepBox.hidden = true; return; }
      stepBox.hidden = false;
      const list = order.length ? order : (order = shuffle(STEPS));
      stepBox.innerHTML = list.map((s, i) => {
        const d = doneSteps.has(s.id), n = d ? [...doneSteps].indexOf(s.id) + 1 : null;
        return `<button type="button" class="tyd-step${d ? ' done' : ''}" data-step="${s.id}"${d ? ' disabled' : ''}><span class="ts-k">${d ? n : i + 1}</span><svg class="ic ts-ic"><use href="#${s.ic}"/></svg><b>${s.label}</b><small>${s.sub}</small></button>`;
      }).join('');
    }
    const say = (text, ms = 1800, who = 'helper', color) => { bubbles.push({ text, until: clock + ms / 1000, who, color }); };
    async function doStep(sid) {
      if (busy || doneSteps.has(sid) || stage2 !== 'steps') return;
      const missing = NEED[sid].filter((n) => !doneSteps.has(n));
      if (missing.length) {
        bad++; paintGoal();
        G.Sfx.play('bad');
        feedback(panel, `✗ Henüz değil. ${WHY[sid]}`, 'bad');
        const b = $(`[data-step="${sid}"]`, stepBox); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        return;
      }
      busy = true;
      const s = STEPS.find((x) => x.id === sid);
      doneSteps.add(sid);
      paintGoal(); renderSteps();
      G.Sfx.play('tap');
      chipL.set(`${doneSteps.size}/5 · ${s.label}`);
      if (sid === 'guvenlik') { await G.tween(600, (e) => { st.tri = e; }); st.haz = true; }
      else if (sid === 'bilinc') { await G.tween(700, (e) => { st.helper = e; }); say('İyi misiniz?', 1500); await G.wait(1300); say('…', 1200, 'victim', '#8a8f99'); await G.wait(800); }
      else if (sid === 'ara') { await G.tween(400, (e) => { st.phone = e; }); say('112: Ambulans yolda', 2600, 'phone', '#d7372f'); await G.wait(900); }
      else if (sid === 'havayolu') { await G.tween(800, (e) => { st.tilt = e; }); }
      else if (sid === 'solunum') { await G.tween(2400, (e) => { st.ring = e; }); st.ring = 0; say('Solunum yok!', 1600, 'helper', '#d7372f'); await G.wait(500); }
      feedback(panel, `✓ ${s.ok}`, 'ok');
      G.Sfx.play('ok');
      busy = false;
      if (doneSteps.size === STEPS.length) startCPR();
    }
    function startCPR() {
      stage2 = 'comp'; count = 0; presses = []; hits = [];
      renderSteps();
      pressBtn.hidden = false;
      $('span', pressBtn).textContent = 'Bas';
      t0 = clock + 1.0;
      beats = Array.from({ length: 30 }, (_, i) => ({ t: t0 + i * BEAT, hit: null }));
      chipR.show(true).set('0/30');
      chipL.set(`Göğüs basısı · Tur ${cycles + 1}/2`);
      feedback(panel, 'Solunum yok: noktalar halkaya geldiğinde <b>“Bas”</b> (boşluk tuşu ya da kazazedenin göğsü). Dakikada ~110 ritimle 30 bası.', '');
      if (pressBtn.offsetParent && document.activeElement && document.activeElement.closest && document.activeElement.closest('.tyd-steps')) pressBtn.focus({ preventScroll: true });
    }
    function press() {
      if (stage2 === 'comp') {
        const now = clock;
        presses.push(now);
        count++;
        st.press = 1;
        G.Sfx.play('beat');
        // En yakın vuruşa göre değerlendir
        let best = null;
        for (const b of beats) if (!b.hit) { const d = now - b.t; if (!best || Math.abs(d) < Math.abs(best.d)) best = { b, d }; }
        let r = 'Geç';
        if (best && Math.abs(best.d) <= 0.09) r = 'Mükemmel';
        else if (best && Math.abs(best.d) <= 0.18) r = 'İyi';
        else if (best && best.d < 0) r = 'Erken';
        if (best && Math.abs(best.d) <= 0.3) best.b.hit = r;
        hits.push(r);
        rating = { text: r, t: now };
        const bpm = bpmOf(presses.slice(-6));
        chipR.set(`${count}/30${bpm ? ` · ${Math.round(bpm)}/dk` : ''}`, !bpm ? '' : bpm >= 100 && bpm <= 120 ? '#7df0a8' : '#ffd08a');
        if (count >= 30) {
          const all = bpmOf(presses), good = hits.filter((h) => h === 'Mükemmel' || h === 'İyi').length / hits.length;
          if (all >= 95 && all <= 130 && good >= 0.55) {
            stage2 = 'breath'; breaths = 0; beats = null;
            $('span', pressBtn).textContent = 'Nefes ver';
            G.Sfx.play('ok');
            feedback(panel, `✓ 30 bası tamam: ritmin <b>${Math.round(all)}/dk</b>, isabet %${Math.round(good * 100)}. Şimdi baş geri – çene yukarı pozisyonunda <b>2 suni solunum</b>: “Nefes ver”e iki kez bas.`, 'ok');
            chipL.set(`Suni solunum · 0/2 · Tur ${cycles + 1}/2`);
          } else {
            bad++; paintGoal();
            G.Sfx.play('bad');
            feedback(panel, `✗ Ritmin <b>${Math.round(all)}/dk</b>, isabet %${Math.round(good * 100)} — ${all < 100 ? 'çok yavaş' : all > 120 ? 'çok hızlı' : 'düzensiz'}. Dakikada 100–120 olmalı; halkaya gelen noktaları takip ederek 30 basıyı yeniden yap.`, 'bad');
            count = 0; presses = []; hits = [];
            t0 = clock + 1.2; beats = Array.from({ length: 30 }, (_, i) => ({ t: t0 + i * BEAT, hit: null }));
          }
        }
      } else if (stage2 === 'breath') {
        if (busy) return;
        busy = true; breaths++;
        G.Sfx.play('whoosh');
        G.tween(1000, (e, u) => { st.lean = Math.sin(u * Math.PI); st.rise = Math.sin(Math.max(0, u - 0.25) / 0.75 * Math.PI); }).then(() => {
          busy = false; st.lean = 0; st.rise = 0;
          if (breaths < 2) { chipL.set(`Suni solunum · 1/2 · Tur ${cycles + 1}/2`); return; }
          cycles++; paintGoal();
          if (cycles >= 2) finish();
          else { startCPR(); feedback(panel, '✓ 2 solunum verildi. Hemen yeniden 30 göğüs basısına dön.', 'ok'); }
        });
      }
    }
    function finish() {
      stage2 = 'done'; beats = null; pressBtn.hidden = true;
      chipR.show(false); chipL.set('Sağlık ekibi geldi');
      amb = { x: 1.25, t: 0 };
      G.Sfx.play('win');
      feedback(panel, '🎉 İki tur 30:2 tamamlandı! Gerçekte bunu sağlık ekibi gelene ya da kazazede kendine gelene kadar kesintisiz sürdürürsün. Ders tamamlandı.', 'ok');
      if (!done.has(id)) { complete(id, host); setTimeout(() => finishCard(stage, id, bad, 'Olay yerini korudun, bildirdin ve iki tur 30:2 temel yaşam desteği uyguladın. Sağlık ekibi yolda!', () => {}), 1800); }
    }
    function bpmOf(list) { if (list.length < 2) return 0; const iv = []; for (let i = 1; i < list.length; i++) iv.push(list[i] - list[i - 1]); iv.sort((a, b) => a - b); return 60 / iv[Math.floor(iv.length / 2)]; }

    /* ---------- Çizim ---------- */
    function sceneTransform(W, H) {
      // Tasarım alanı 800×420; dar ekranda kazazede çevresine odaklan
      const s = stage.narrow ? H / 330 : Math.min(W / 800, H / 420);
      const focusX = stage.narrow ? 330 : 400, focusY = stage.narrow ? 250 : 210;
      const z = 1 + zoom * 0.28;
      return { s: s * z, ox: W / 2 - focusX * s * z, oy: H / 2 - focusY * s * z + (stage.narrow ? 0 : 0) };
    }
    function drawBackdrop(ctx, P, night, t) {
      const g = ctx.createLinearGradient(0, 0, 0, 240);
      g.addColorStop(0, night ? '#070b1c' : '#6aaee6'); g.addColorStop(1, night ? '#27304c' : '#efe2c8');
      ctx.fillStyle = g; ctx.fillRect(-400, -200, 1600, 440);
      if (night) { ctx.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t + i); ctx.fillRect((i * 137) % 1400 - 300, (i * 53) % 160 - 40, 1.4, 1.4); } ctx.globalAlpha = 1; }
      else { G.glow(ctx, 660, 50, 120, '#fff1c8', 0.5); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(660, 50, 22, 0, Math.PI * 2); ctx.fill(); }
      // Peri bacaları silueti
      const rock = night ? ['#232a40', '#1c2233'] : ['#e5cda7', '#d4b48a'];
      ctx.fillStyle = rock[1];
      ctx.beginPath(); ctx.moveTo(-400, 240);
      // Uzak düz tepeli kayalık
      ctx.fillStyle = rock[0];
      ctx.beginPath(); ctx.moveTo(-300, 240); ctx.quadraticCurveTo(-200, 170, -120, 168); ctx.lineTo(140, 164); ctx.quadraticCurveTo(220, 170, 300, 240); ctx.fill();
      ctx.beginPath(); ctx.moveTo(520, 240); ctx.quadraticCurveTo(600, 186, 680, 184); ctx.lineTo(900, 182); ctx.quadraticCurveTo(980, 190, 1100, 240); ctx.fill();
      ctx.fillStyle = rock[1];
      ctx.beginPath(); ctx.moveTo(-400, 240);
      const cones = [[-40, 70, 18], [8, 96, 20], [46, 62, 16], [360, 84, 20], [398, 58, 15], [612, 104, 22], [652, 70, 17], [860, 88, 20], [904, 60, 15]];
      for (const [x, h, w] of cones) { ctx.lineTo(x - w, 240); ctx.quadraticCurveTo(x - w * 0.35, 240 - h * 0.7, x - w * 0.22, 240 - h); ctx.lineTo(x + w * 0.22, 240 - h); ctx.quadraticCurveTo(x + w * 0.35, 240 - h * 0.7, x + w, 240); }
      ctx.lineTo(1200, 240); ctx.closePath(); ctx.fill();
      ctx.fillStyle = night ? '#171b2a' : '#7a695c';
      for (const [x, h, w] of cones) { ctx.beginPath(); ctx.ellipse(x, 240 - h, w * 0.4, w * 0.18, 0, 0, Math.PI * 2); ctx.fill(); }
      // Tarla ve yol
      const gg = ctx.createLinearGradient(0, 236, 0, 330);
      gg.addColorStop(0, night ? '#1a2030' : '#cdbd84'); gg.addColorStop(1, night ? '#1c2620' : '#b9c47f');
      ctx.fillStyle = gg; ctx.fillRect(-400, 236, 1600, 100);
      ctx.fillStyle = night ? '#2a2d36' : '#bcae90'; ctx.fillRect(-400, 328, 1600, 12);
      ctx.fillStyle = night ? '#23272f' : '#4b4f58'; ctx.fillRect(-400, 338, 1600, 140);
      ctx.fillStyle = night ? '#c9ccd3' : '#f2efe7'; for (let x = -400; x < 1200; x += 70) ctx.fillRect(x, 402, 38, 5);
      ctx.fillRect(-400, 342, 1600, 3);
    }
    function drawCar(ctx, night, t) {
      const P = R.palette(night);
      const p = { X: 610, Y: 352, s: 44, d: 0 };
      R.Draw.carSide(ctx, fakeV, { dir: -1, color: '#2f63c8', brake: false }, P, p);
    }
    function hazard(ctx, t) {
      if (!st.haz || Math.floor(t * 1.6) % 2) return;
      ctx.globalCompositeOperation = 'lighter';
      G.glow(ctx, 512, 318, 26, '#ffb000', 0.9); G.glow(ctx, 708, 318, 26, '#ffb000', 0.9);
      ctx.globalCompositeOperation = 'source-over';
    }
    function drawTriangle(ctx) {
      if (st.tri <= 0) return;
      ctx.save(); ctx.globalAlpha = st.tri; ctx.translate(772, 346 - (1 - st.tri) * 30);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(4, 2, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(20, -4); ctx.lineTo(-20, -4); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#2b2d33'; ctx.fillRect(-14, -4, 28, 4);
      ctx.restore();
    }
    // Kazazede (sırtüstü, başı solda)
    function drawVictim(ctx) {
      const bx = 250, by = 312, dip = st.press * 4, rise = st.rise * 4;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(bx + 90, by + 16, 120, 7, 0, 0, Math.PI * 2); ctx.fill();
      // Bacaklar
      ctx.fillStyle = '#2f3b52'; rr(ctx, bx + 108, by - 6, 100, 18, 9); ctx.fill();
      ctx.fillStyle = '#26303f'; rr(ctx, bx + 110, by - 1, 96, 14, 7); ctx.fill();
      ctx.fillStyle = '#1b1d22'; rr(ctx, bx + 204, by - 14, 12, 26, 5); ctx.fill();
      // Gövde (göğüs basıda çöker, solukta kabarır)
      ctx.fillStyle = '#b8472f';
      ctx.beginPath(); ctx.moveTo(bx + 18, by + 12); ctx.lineTo(bx + 18, by - 10 + dip - rise); ctx.quadraticCurveTo(bx + 60, by - 20 + dip - rise, bx + 112, by - 10); ctx.lineTo(bx + 112, by + 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(bx + 18, by + 4, 94, 8);
      // Kol
      ctx.fillStyle = '#9f3d28'; rr(ctx, bx + 30, by + 2, 70, 10, 5); ctx.fill();
      ctx.fillStyle = '#e1ad86'; ctx.beginPath(); ctx.arc(bx + 102, by + 7, 5.5, 0, Math.PI * 2); ctx.fill();
      // Baş (baş geri – çene yukarı eğilir)
      ctx.save(); ctx.translate(bx + 14, by - 2); ctx.rotate(-0.38 * st.tilt);
      ctx.fillStyle = '#e1ad86'; rr(ctx, -4, -6, 10, 12, 3); ctx.fill();
      ctx.beginPath(); ctx.arc(-14, -2, 13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-18, -14); ctx.lineTo(-20, -19); ctx.lineTo(-13, -15); ctx.fill();
      ctx.fillStyle = '#3b2a1f'; ctx.beginPath(); ctx.arc(-16, 1, 13.5, Math.PI * 0.45, Math.PI * 1.25); ctx.fill();
      ctx.fillStyle = '#c99571'; ctx.beginPath(); ctx.arc(-11, 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6b4a36'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-20, -8); ctx.lineTo(-16, -8); ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
    // İlk yardımcı (kazazedenin arkasında diz çökmüş)
    function drawHelperBack(ctx) {
      if (st.helper <= 0) return;
      const x = 318, g = 300, a = st.helper, dn = st.press * 6, lean = st.lean;
      ctx.save(); ctx.globalAlpha = a; ctx.translate((1 - a) * 60, 0);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x + 20, g + 14, 38, 5, 0, 0, Math.PI * 2); ctx.fill();
      // Bacaklar (diz çökmüş)
      ctx.fillStyle = '#2b3448'; rr(ctx, x + 6, g - 4, 46, 16, 8); ctx.fill();
      ctx.fillStyle = '#1b1d22'; rr(ctx, x + 44, g - 2, 14, 12, 4); ctx.fill();
      // Gövde
      ctx.save(); ctx.translate(x + 14, g - 6 + dn); ctx.rotate(-0.28 - lean * 0.55);
      ctx.fillStyle = '#d63a3a'; rr(ctx, -13, -54, 26, 56, 11); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(ctx, -9, -50, 7, 46, 4); ctx.fill();
      ctx.fillStyle = '#e8b48c'; ctx.beginPath(); ctx.arc(-2, -66, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1d16'; ctx.beginPath(); ctx.arc(1, -69, 12.5, Math.PI * 1.05, Math.PI * 2.2); ctx.fill();
      ctx.restore();
      ctx.restore();
    }
    function drawHelperArms(ctx) {
      if (st.helper <= 0) return;
      const a = st.helper, dn = st.press * 6, lean = st.lean;
      ctx.save(); ctx.globalAlpha = a; ctx.translate((1 - a) * 60, 0);
      const sx = 318 + 4 - lean * 20, sy = 300 - 52 + dn + lean * 10;
      const hx = lean > 0.05 ? lerp(302, 262, lean) : 302, hy = (lean > 0.05 ? lerp(300, 296, lean) : 298) + st.press * 4;
      ctx.strokeStyle = '#c93434'; ctx.lineWidth = 11; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx + 2, hy - 8); ctx.stroke();
      ctx.fillStyle = '#e8b48c'; ctx.beginPath(); ctx.ellipse(hx, hy - 4, 9, 6, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function drawBubbles(ctx, T0) {
      bubbles = bubbles.filter((b) => b.until > clock);
      for (const b of bubbles) {
        const pos = b.who === 'victim' ? [232, 282] : b.who === 'phone' ? [380, 300] : [322, 222];
        const X = T0.ox + pos[0] * T0.s, Y = T0.oy + pos[1] * T0.s;
        T.bubble(ctx, X, Y, b.text, b.color || '#16171b', '#ffffff', stage.narrow ? 12.5 : 14);
      }
    }
    function drawPhone(ctx) {
      if (st.phone <= 0) return;
      // Hoparlörü açık telefon yerde
      ctx.save(); ctx.globalAlpha = st.phone; ctx.translate(372, 318);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(2, 3, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1d22'; rr(ctx, -13, -4, 26, 6, 3); ctx.fill();
      ctx.fillStyle = '#7fd0ff'; rr(ctx, -11, -3.4, 22, 3, 1.5); ctx.fill();
      if (Math.floor(clock * 2) % 2 === 0) { ctx.strokeStyle = '#7fd0ff'; ctx.lineWidth = 1.5; for (const r0 of [8, 13]) { ctx.beginPath(); ctx.arc(0, -6, r0, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); } }
      ctx.restore();
    }
    function drawRing(ctx) {
      if (st.ring <= 0) return;
      ctx.save(); ctx.translate(236, 300);
      ctx.strokeStyle = 'rgba(59,140,255,.25)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#3b8cff'; ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + st.ring * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#3b8cff'; ctx.font = '800 11px Archivo, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.ceil(10 - st.ring * 10)} sn`, 0, 0);
      ctx.restore();
    }
    function drawAmbulance(ctx, t) {
      if (!amb) return;
      amb.t += 1 / 60;
      const x = lerp(1100, 740, G.easeOut(Math.min(1, amb.t / 2.2)));
      const P = R.palette(stage.night);
      ctx.save();
      const p = { X: x, Y: 410, s: 50, d: 0 };
      R.Draw.carSide(ctx, fakeV, { dir: -1, color: '#f4f5f7' }, P, p);
      ctx.fillStyle = '#e02b25'; ctx.fillRect(x - 100, 392, 200, 6);
      const ph = Math.floor(t * 4) % 2;
      ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, x + (ph ? -30 : 30), 336, 40, ph ? '#ff2a2a' : '#2f7bff', 0.9); ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    // Ritim şeridi (ekran uzayında, altta)
    function drawRhythm(ctx, W, H) {
      if (!beats) return;
      const h = stage.narrow ? 50 : 58, y = H - h - 10, x0 = 12, w = W - 24, tx = x0 + 46, pxs = stage.narrow ? 105 : 150;
      ctx.save();
      ctx.fillStyle = 'rgba(13,15,21,.72)'; rr(ctx, x0, y, w, h, h / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
      const cy = y + h / 2;
      const beatNow = ((clock - t0) % BEAT + BEAT) % BEAT;
      const pulse = clock > t0 - 0.2 ? Math.max(0, 1 - beatNow / 0.25) : 0;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, cy, h * 0.33 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,59,48,${0.25 + pulse * 0.5})`; ctx.beginPath(); ctx.arc(tx, cy, h * 0.27, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(tx + 4, y, w - (tx - x0) - 8, h); ctx.clip();
      for (const b of beats) {
        const bx = tx + (b.t - clock) * pxs;
        if (bx < tx - 40 || bx > x0 + w + 20) continue;
        ctx.fillStyle = b.hit ? (b.hit === 'Mükemmel' ? '#3ddc84' : b.hit === 'İyi' ? '#9be26a' : '#ffb000') : '#ff6b5e';
        ctx.globalAlpha = b.hit ? 0.35 : 1;
        ctx.beginPath(); ctx.arc(bx, cy, h * 0.16, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.font = '800 12px JetBrains Mono, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(`${count}/30`, x0 + w - 16, cy);
      if (rating && clock - rating.t < 0.6) {
        const c = rating.text === 'Mükemmel' ? '#3ddc84' : rating.text === 'İyi' ? '#b5ec7f' : '#ffc83d';
        ctx.fillStyle = c; ctx.font = '900 15px Archivo, sans-serif'; ctx.textAlign = 'left';
        ctx.globalAlpha = 1 - (clock - rating.t) / 0.6;
        ctx.fillText(rating.text + '!', tx + h * 0.45, y - 12 + (clock - rating.t) * -20);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    function frame(dt, now) {
      if (!built) return;
      clock += dt;
      if (st.press > 0) st.press = Math.max(0, st.press - dt * 7);
      zoom += ((stage2 === 'comp' || stage2 === 'breath' ? 1 : 0) - zoom) * Math.min(1, dt * 2.5);
      // Kaçırılan vuruşlar
      if (beats) for (const b of beats) if (!b.hit && clock - b.t > 0.3 && presses.length) b.hit = 'miss';
      const ctx = stage.begin(), W = stage.w, H = stage.h;
      if (!W) return;
      const night = stage.night;
      const T0 = sceneTransform(W, H);
      ctx.save(); ctx.translate(T0.ox, T0.oy); ctx.scale(T0.s, T0.s);
      drawBackdrop(ctx, null, night, now / 1000);
      drawTriangle(ctx);
      drawCar(ctx, night, now / 1000);
      hazard(ctx, now / 1000);
      drawAmbulance(ctx, now / 1000);
      drawHelperBack(ctx);
      drawVictim(ctx);
      drawHelperArms(ctx);
      drawPhone(ctx);
      drawRing(ctx);
      ctx.restore();
      drawBubbles(ctx, T0);
      drawRhythm(ctx, W, H);
    }
    const L = G.loop((dt, t) => { stage.tick(dt); frame(dt, t); });
    stepBox.addEventListener('click', (e) => { const b = e.target.closest('[data-step]'); if (b) doStep(b.dataset.step); });
    G.hold(pressBtn, () => press(), () => {});
    stage.canvas.addEventListener('pointerdown', (e) => { if (stage2 === 'comp' || stage2 === 'breath') { e.preventDefault(); press(); } });
    $('[data-act="reset"]', panel).addEventListener('click', () => { if (!busy) { order = []; reset(); } });
    return {
      init() { if (!built) { built = true; reset(); } },
      start() { this.init(); L.start(); },
      stop() { L.stop(); },
      key(e) {
        if (e.code === 'Space' && (stage2 === 'comp' || stage2 === 'breath')) { press(); return true; }
        const n = Number(e.key);
        if (stage2 === 'steps' && n >= 1 && n <= 5) { const b = $$('.tyd-step', stepBox)[n - 1]; if (b) doStep(b.dataset.step); return true; }
        return false;
      },
      debug() { return { stage: stage2, count, cycles, bad, steps: [...doneSteps], order: order.map((s) => s.id), nextBeat: beats && beats.find((b) => !b.hit && b.t > clock - 0.05) ? beats.find((b) => !b.hit && b.t > clock - 0.05).t - clock : null }; }
    };
  })();

  /* =========================================================
     DERS 9 — Gösterge ışıkları (Araç Tekniği)
     Üstte ön camdan yol, altta dijital gösterge paneli. Kontak açılınca lamba testi ve ibre taraması;
     sürüş sırasında bir uyarı ışığı yanar, ne yapacağını seç: araç duruma göre sağa çekip durur, yavaşlar ya da devam eder.
     ========================================================= */
  const lessonGosterge = (() => {
    const id = 'gosterge', panel = panelOf(id), host = $('.sim', panel);
    const stage = new G.Stage(host, { height: (w) => (w < 560 ? Math.round(clamp(w * 1.18, 380, 500)) : Math.round(clamp(w * 0.62, 400, 560))) });
    const v = new R.View3D();
    const IDS = ['yag', 'aku', 'hararet', 'fren', 'kemer', 'abs', 'motor', 'lastik', 'yakit', 'uzun', 'kisa', 'sison', 'sinyal'];
    const GROUP = { red: 'dur', amber: 'dikkat', green: 'bilgi', blue: 'bilgi' };
    const INFO = {
      yag: 'Motor yağ basıncı düştü. Motor hasar görmeden hemen güvenli bir yerde dur, motoru kapat ve yağ seviyesini kontrol et.',
      aku: 'Şarj sistemi arızalı; akü şarj olmuyor. Alternatör veya kayış arızası olabilir: güvenli bir yerde durup kontrol ettir.',
      hararet: 'Motor aşırı ısındı. Güvenli bir yerde dur, motoru soğumaya bırak; radyatör kapağını sıcakken açma.',
      fren: 'El freni çekili olabilir; indirdiğin hâlde yanıyorsa fren hidroliği azalmış veya fren sistemi arızalıdır. Sürüşe devam etme.',
      kemer: 'Emniyet kemeri takılmamış. Hemen kemerini tak ve yolcuların da takmasını sağla.',
      abs: 'ABS devre dışı. Normal frenler çalışır ama ani frende tekerlekler kilitlenebilir: dikkatle sür, en kısa sürede servise git.',
      motor: 'Motor yönetim sisteminde arıza var. Dikkatle devam et ve en kısa sürede servise git.',
      lastik: 'Lastik basıncı düştü. Hızını azalt ve ilk fırsatta lastikleri kontrol ettir.',
      yakit: 'Yakıt yedek seviyede. İlk istasyonda yakıt al; yakıtsız kalmak yolda tehlikeli durum yaratır.',
      uzun: 'Uzun hüzmeli farlar açık. Karşıdan araç gelince en az 150 m kala kısa fara geç.',
      kisa: 'Kısa hüzmeli farlar açık. Arıza değil, bilgilendirme ışığıdır.',
      sison: 'Ön sis farları açık. Yalnızca sis, kar ve yoğun yağışta kullan.',
      sinyal: 'Sinyal (dönüş göstergesi) çalışıyor. Manevradan sonra söndüğünden emin ol.'
    };
    const ACT = { dur: 'Güvenli bir yerde dur', dikkat: 'Dikkatle devam et, kontrol ettir', bilgi: 'Bilgi: sistem çalışıyor' };
    const GOAL = 8;
    const goal = goalBar(panel, GOAL);
    const choices = $$('.gs-choice', panel);
    const onImg = {}, offImg = {};
    IDS.forEach((lid) => { onImg[lid] = G.svgImage(KIT.lamp(lid, true), 128); offImg[lid] = G.svgImage(KIT.lamp(lid, false), 128); });
    const colorWord = { red: 'Kırmızı', amber: 'Sarı', green: 'Yeşil', blue: 'Mavi' };
    let world, car, deck, cur, ok, bad, locked, built, started, phase, clock, nextAt, test, tft, needle, hazard, blinkR, pull, speedT;

    function build() {
      world = new R.World({ kind: 'rural', seed: 120 + Math.floor(Math.random() * 1000) });
      world.ensure(520);
      car = { x: 1.75, z: 0, v: 0 };
      deck = shuffle(IDS); cur = null; ok = 0; bad = 0; locked = true; phase = 'off'; clock = 0; nextAt = 0; test = 0; tft = null; needle = { s: 0, r: 0 }; hazard = false; blinkR = false; pull = null; speedT = 0;
      goal.set(0, 0);
      choices.forEach((c) => { c.disabled = true; c.classList.remove('right', 'wrong'); });
    }
    function ignition() {
      if (phase !== 'off') return;
      stage.card(null);
      phase = 'test'; test = 0;
      G.Sfx.play('chime');
      feedback(panel, 'Kontak açıldı: <b>bütün lambalar kısa süre yanar</b> (lamba testi). Motor çalışınca sönmeyen lamba bir arıza işaretidir.', '');
    }
    function nextLamp() {
      if (!deck.length) deck = shuffle(IDS);
      cur = { id: deck.shift(), t: clock };
      cur.color = KIT.LAMPS[cur.id].color;
      locked = false;
      tft = { mode: 'ask' };
      G.Sfx.play('chime');
      choices.forEach((c) => { c.disabled = false; c.classList.remove('right', 'wrong'); });
      feedback(panel, 'Sürüş sırasında göstergede bir ışık yandı. Ne yapmalısın? <span class="fb-hint">Rengine ve sembolüne bak (1–3).</span>', '');
    }
    function answer(gid) {
      if (phase === 'off') { ignition(); return; }
      if (locked || !cur) return;
      locked = true;
      const want = GROUP[cur.color], right = want === gid;
      if (right) ok++; else { bad++; deck.splice(Math.min(deck.length, 3), 0, cur.id); }
      goal.set(ok, bad);
      choices.forEach((c) => { c.disabled = true; if (c.dataset.g === want) c.classList.add('right'); else if (c.dataset.g === gid) c.classList.add('wrong'); });
      const L = KIT.LAMPS[cur.id];
      tft = { mode: 'show', right };
      G.Sfx.play(right ? 'ok' : 'bad');
      stage.toast(right ? `✓ ${ACT[want]}` : `✗ Doğrusu: ${ACT[want]}`, right ? 'ok' : 'bad', 1600);
      feedback(panel, `${right ? '✓ Doğru!' : '✗ Yanlış.'} <b>${L.name}</b> (${colorWord[L.color]}): ${INFO[cur.id]}`, right ? 'ok' : 'bad');
      // Aracın tepkisi
      if (want === 'dur') { pull = { t: 0 }; blinkR = true; }
      else if (want === 'dikkat') speedT = 55 / 3.6;
      else speedT = 80 / 3.6;
      nextAt = clock + (want === 'dur' ? 6.2 : right ? 3.4 : 4.4);
      if (right && ok === GOAL && !done.has(id)) {
        complete(id, host);
        setTimeout(() => finishCard(stage, id, bad, `${GOAL} uyarı ışığını doğru yorumladın. Kırmızı: dur, sarı: kontrol ettir, yeşil/mavi: bilgi.`, () => {}), 1600);
      }
    }
    function simulate(dt) {
      clock += dt;
      if (phase === 'test') {
        test += dt;
        const u = test / 2.2;
        needle.s = u < 0.5 ? G.easeInOut(u * 2) : G.easeInOut(2 - u * 2);
        needle.r = needle.s;
        if (test > 2.2) { phase = 'drive'; needle.s = 0; needle.r = 0.1; speedT = 80 / 3.6; nextAt = clock + rand(2.2, 3.2); feedback(panel, 'Motor çalıştı, lambalar söndü. Yola çıktın — göstergeyi izle.', ''); }
        return;
      }
      if (phase !== 'drive') return;
      if (pull) {
        pull.t += dt;
        const t = pull.t;
        if (t < 2.4) { car.x = lerp(1.75, 3.9, G.easeInOut(Math.min(1, t / 2.4))); car.v = Math.max(0, car.v - 5.5 * dt); }
        else if (t < 4.6) { car.v = Math.max(0, car.v - 7 * dt); if (car.v === 0) { hazard = true; blinkR = false; } }
        else if (t < 6.2) { hazard = false; blinkR = false; car.v = Math.min(12, car.v + 3 * dt); car.x = lerp(3.9, 1.75, G.easeInOut(Math.min(1, (t - 4.6) / 1.6))); }
        else { pull = null; car.x = 1.75; speedT = 80 / 3.6; }
      } else car.v += clamp(speedT - car.v, -4 * dt, 3 * dt);
      car.z += car.v * dt;
      world.ensure(car.z + 520); world.prune(car.z - 40);
      if (clock >= nextAt && (locked || !cur)) { cur = null; tft = null; nextLamp(); }
      needle.s = car.v / (200 / 3.6);
      needle.r = car.v < 0.5 ? 0.1 : clamp(0.16 + car.v / 60 + Math.sin(clock * 1.3) * 0.01, 0, 0.9);
    }
    /* ---------- Gösterge çizimi ---------- */
    function gauge(ctx, cx, cy, r, val, max, step, label, unit, digits, hot) {
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ang = (u) => a0 + (a1 - a0) * u;
      ctx.save();
      const bg = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r * 1.05);
      bg.addColorStop(0, '#1b1f27'); bg.addColorStop(1, '#07080b');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, a0, a1); ctx.stroke();
      const u = clamp(val, 0, 1);
      const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      if (hot) { grad.addColorStop(0, '#ffb000'); grad.addColorStop(1, '#ff3b30'); } else { grad.addColorStop(0, '#2fd0ff'); grad.addColorStop(1, '#bff3ff'); }
      if (u > 0.002) { ctx.strokeStyle = grad; ctx.shadowColor = hot ? '#ff7a1a' : '#2fd0ff'; ctx.shadowBlur = r * 0.18; ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, a0, ang(u)); ctx.stroke(); ctx.shadowBlur = 0; }
      for (let vv = 0; vv <= max + 1e-6; vv += step / 2) {
        const a = ang(vv / max), major = Math.abs((vv / step) - Math.round(vv / step)) < 1e-6;
        const r1 = r * 0.78, r2 = r * (major ? 0.68 : 0.72);
        ctx.strokeStyle = hot && vv >= max * 0.75 ? '#ff5a4e' : major ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.3)';
        ctx.lineWidth = major ? 2.2 : 1.2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
        if (major && r > 60) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `700 ${Math.round(r * 0.11)}px JetBrains Mono, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.round(vv)), cx + Math.cos(a) * r * 0.57, cy + Math.sin(a) * r * 0.57); }
      }
      const na = ang(u);
      ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = Math.max(2, r * 0.03); ctx.shadowColor = '#ff3b30'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(na) * r * 0.2, cy + Math.sin(na) * r * 0.2); ctx.lineTo(cx + Math.cos(na) * r * 0.8, cy + Math.sin(na) * r * 0.8); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0c0e12'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = `900 ${Math.round(r * 0.25)}px Archivo, Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(digits, cx, cy - r * 0.04);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `700 ${Math.round(r * 0.095)}px JetBrains Mono, monospace`;
      ctx.fillText(unit, cx, cy + r * 0.17);
      if (label) ctx.fillText(label, cx, cy + r * 0.66);
      ctx.restore();
    }
    function drawCluster(ctx, x, y, W, H) {
      const narrow = stage.narrow;
      const bg = ctx.createLinearGradient(0, y, 0, y + H);
      bg.addColorStop(0, '#0e1015'); bg.addColorStop(1, '#16181e');
      ctx.fillStyle = bg; ctx.fillRect(x, y, W, H);
      // Gösterge kalkanı
      ctx.fillStyle = '#050608'; rr(ctx, x + 10, y + 8, W - 20, H - 16, narrow ? 22 : 34); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 2; ctx.stroke();
      const lampTest = phase === 'test' && test < 1.8;
      const rowH = narrow ? 64 : 46;
      const gy = y + (H - rowH) / 2 + 4;
      const r = Math.min((H - rowH) * 0.43, W * (narrow ? 0.21 : 0.17));
      const kmh = Math.round((phase === 'test' ? needle.s * 200 : car.v * 3.6));
      gauge(ctx, x + W * (narrow ? 0.22 : 0.2), gy, r, needle.s, 200, 20, '', 'km/s', String(kmh), false);
      gauge(ctx, x + W * (narrow ? 0.78 : 0.8), gy, r, needle.r, 8, 1, '× 1000', 'd/dk', (needle.r * 8).toFixed(1).replace('.', ','), true);
      // Orta ekran
      const tw = narrow ? W * 0.38 : W * 0.3, th = (H - rowH) * 0.78, tx = x + W / 2 - tw / 2, ty = gy - th / 2;
      const scr = ctx.createLinearGradient(0, ty, 0, ty + th);
      scr.addColorStop(0, '#0a1016'); scr.addColorStop(1, '#05080c');
      ctx.fillStyle = scr; rr(ctx, tx, ty, tw, th, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(120,200,255,.18)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.save(); rr(ctx, tx, ty, tw, th, 14); ctx.clip();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (phase === 'off') { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = `800 ${narrow ? 12 : 14}px Archivo, sans-serif`; ctx.fillText('KONTAK KAPALI', tx + tw / 2, ty + th / 2); }
      else if (phase === 'test') { ctx.fillStyle = '#7fd0ff'; ctx.font = `800 ${narrow ? 11 : 13}px Archivo, sans-serif`; ctx.fillText('Lamba testi', tx + tw / 2, ty + th * 0.42); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = `600 ${narrow ? 10 : 11}px JetBrains Mono, monospace`; ctx.fillText('ÜRGÜP YILDIZ', tx + tw / 2, ty + th * 0.6); }
      else if (cur && tft) {
        const im = onImg[cur.id], s0 = Math.min(th * 0.55, tw * 0.5), pulse = tft.mode === 'ask' ? 1 + Math.sin(clock * 6) * 0.03 : 1;
        const col = G.alpha(KIT.LC[cur.color], 0.18);
        const gg = ctx.createRadialGradient(tx + tw / 2, ty + th * 0.4, 0, tx + tw / 2, ty + th * 0.4, s0);
        gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(tx, ty, tw, th);
        if (G.ready(im)) ctx.drawImage(im, tx + tw / 2 - (s0 * pulse) / 2, ty + th * 0.4 - (s0 * pulse) / 2, s0 * pulse, s0 * pulse);
        ctx.font = `800 ${narrow ? 10.5 : 12.5}px Archivo, sans-serif`;
        if (tft.mode === 'ask') { ctx.fillStyle = '#ffffff'; ctx.fillText('Ne yapmalısın?', tx + tw / 2, ty + th * 0.82); }
        else { ctx.fillStyle = tft.right ? '#7df0a8' : '#ffb4ab'; const nm = KIT.LAMPS[cur.id].name; ctx.fillText(nm.length > 26 && narrow ? nm.slice(0, 24) + '…' : nm, tx + tw / 2, ty + th * 0.8); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = `700 ${narrow ? 9.5 : 11}px JetBrains Mono, monospace`; ctx.fillText(ACT[GROUP[cur.color]].toLocaleUpperCase('tr-TR'), tx + tw / 2, ty + th * 0.92); }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `700 ${narrow ? 10 : 11.5}px JetBrains Mono, monospace`;
        const odo = String(48213 + Math.floor(car.z / 1000)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' km';
        ctx.fillText(narrow ? odo : '16°C   ·   ' + odo, tx + tw / 2, ty + th * 0.2);
        // Üstten araç simgesi ve yol çizgileri
        ctx.strokeStyle = 'rgba(127,208,255,.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -(car.z * 4) % 12;
        ctx.beginPath(); ctx.moveTo(tx + tw * 0.3, ty + th * 0.95); ctx.lineTo(tx + tw * 0.42, ty + th * 0.35); ctx.moveTo(tx + tw * 0.7, ty + th * 0.95); ctx.lineTo(tx + tw * 0.58, ty + th * 0.35); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(127,208,255,.8)'; rr(ctx, tx + tw / 2 - 11, ty + th * 0.6, 22, 36, 8); ctx.fill();
        if (pull || hazard) { ctx.fillStyle = '#ffb000'; ctx.font = `800 ${narrow ? 10.5 : 12}px Archivo, sans-serif`; ctx.fillText(hazard ? 'Güvenli yerde durdun' : 'Sağa çekiliyor…', tx + tw / 2, ty + th * 0.45); }
      }
      ctx.restore();
      // Uyarı ışıkları sırası
      const n = IDS.length, rows = narrow ? 2 : 1, per = Math.ceil(n / rows), size = narrow ? Math.min(26, (W - 40) / per - 3) : Math.min(30, (W - 60) / n - 4);
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / per), col = i % per, cnt = row === rows - 1 ? n - per * (rows - 1) : per;
        const lx = x + W / 2 - (cnt * (size + 4)) / 2 + col * (size + 4), ly = y + H - rowH + (narrow ? row * (size + 5) : (rowH - size) / 2) - 2;
        const lid = IDS[i];
        let on = lampTest || (cur && cur.id === lid && phase === 'drive');
        if (lid === 'sinyal' && (blinkR || hazard)) on = Math.floor(clock * 2.6) % 2 === 0;
        const im = on ? onImg[lid] : offImg[lid];
        if (G.ready(im)) { ctx.globalAlpha = on ? 1 : 0.55; ctx.drawImage(im, lx, ly, size, size); ctx.globalAlpha = 1; }
        if (on) { ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, lx + size / 2, ly + size / 2, size * 0.9, KIT.LC[KIT.LAMPS[lid].color], 0.45); ctx.globalCompositeOperation = 'source-over'; }
      }
    }
    function draw(tms) {
      const ctx = stage.begin(), W = stage.w, H = stage.h;
      if (!W) return;
      const clusterH = stage.narrow ? Math.round(H * 0.56) : Math.round(H * 0.46);
      const wsH = H - clusterH;
      // Ön camdan görünüm
      v.hfov = 66;
      v.viewport(0, 0, W, wsH + 30, 0.5, 0);
      v.cam.x = car.x - 0.38; v.cam.y = 1.22; v.cam.z = car.z + 0.2; v.cam.yaw = 0;
      const P = R.palette(stage.night);
      R.render(ctx, v, world, P, [], { time: tms / 1000, lights: stage.night ? [{ kind: 'beam', x: car.x, z: car.z + 2, dir: 1, len: 45, a: 0.6 }] : [] });
      // Araç içi: A sütunları, torpido üstü, dikiz aynası
      ctx.fillStyle = '#0c0d11';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.07, 0); ctx.lineTo(W * 0.02, wsH); ctx.lineTo(0, wsH); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W * 0.93, 0); ctx.lineTo(W * 0.98, wsH); ctx.lineTo(W, wsH); ctx.closePath(); ctx.fill();
      ctx.fillRect(0, 0, W, Math.max(6, wsH * 0.04));
      const mw = Math.min(170, W * 0.22), mh = Math.max(20, wsH * 0.12);
      ctx.fillStyle = '#15171c'; rr(ctx, W / 2 - mw / 2, wsH * 0.05, mw, mh, mh / 2); ctx.fill();
      ctx.fillStyle = 'rgba(160,190,220,.28)'; rr(ctx, W / 2 - mw / 2 + 4, wsH * 0.05 + 4, mw - 8, mh - 8, (mh - 8) / 2); ctx.fill();
      const dash = ctx.createLinearGradient(0, wsH - 26, 0, wsH + 4);
      dash.addColorStop(0, 'rgba(12,13,17,0)'); dash.addColorStop(1, '#0c0d11');
      ctx.fillStyle = dash; ctx.fillRect(0, wsH - 26, W, 30);
      if (hazard && Math.floor(clock * 2.6) % 2 === 0) { ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, W / 2, wsH - 4, 60, '#ffb000', 0.5); ctx.globalCompositeOperation = 'source-over'; }
      drawCluster(ctx, 0, wsH, W, clusterH);
    }
    const L = G.loop((dt, t) => {
      stage.tick(dt); if (built && !stage.hasCard) simulate(dt); draw(t); });
    choices.forEach((c) => c.addEventListener('click', () => answer(c.dataset.g)));
    $('[data-act="reset"]', panel).addEventListener('click', () => { build(); intro(); feedback(panel, 'Kontağı açarak başla.', ''); });
    function intro() {
      stage.card({
        icon: '<svg class="ic"><use href="#i-battery"/></svg>',
        title: 'Kontağı aç',
        text: 'Kontak açılınca bütün uyarı lambaları <b>kısa süre yanar</b> ve ibreler tarama yapar. Sonra yola çıkacaksın: sürüş sırasında yanan ışığın rengine ve sembolüne göre ne yapacağına karar ver.',
        keys: [['1', 'Dur'], ['2', 'Dikkatle devam'], ['3', 'Bilgi']],
        buttons: [{ label: 'Kontağı aç <svg class="ic"><use href="#i-bolt"/></svg>', cls: 'btn-red', onClick: ignition }],
        focus: false
      });
    }
    return {
      init() { if (!built) { built = true; build(); intro(); feedback(panel, 'Kontağı açarak başla.', ''); } },
      start() { this.init(); L.start(); },
      stop() { L.stop(); },
      key(e) {
        const m = { Digit1: 'dur', Digit2: 'dikkat', Digit3: 'bilgi', Numpad1: 'dur', Numpad2: 'dikkat', Numpad3: 'bilgi' }[e.code];
        if (m) { answer(m); return true; }
        if ((e.code === 'Space' || e.code === 'Enter') && phase === 'off') { ignition(); return true; }
        return false;
      },
      debug() { return { phase, ok, bad, cur: cur && { id: cur.id, g: GROUP[cur.color] }, locked }; }
    };
  })();

  /* =========================================================
     DERS 10 — Trafik adabı (kuşbakışı durum sahneleri)
     Her durumda üç davranıştan birini seç; seçiminin sonucu sahnede canlandırılır. Yanlış seçilen durum yeniden gelir.
     ========================================================= */
  const lessonAdab = (() => {
    const id = 'adab', panel = panelOf(id), host = $('.sim', panel);
    const stage = new G.Stage(host, { height: (w) => (w < 560 ? Math.round(clamp(w * 1.0, 320, 400)) : Math.round(clamp(w * 0.42, 300, 380))) });
    const v = new T.View2D(), D = T.D;
    const GOAL = 5, SW = 60;
    const goal = goalBar(panel, GOAL);
    const box = k(panel, 'choices'), nextBtn = $('[data-act="next"]', panel);
    const chip = stage.chip('l', 'durum', 'Durum');
    const parts = new G.Particles();
    const DIS = G.svgImage(KIT.sign('parkyasak'), 128);
    let A = {}, cur = null, queue = [], ok = 0, bad = 0, busy = false, built = false, nth = 0, bg = null, bgKey = '', bubbles = [], flash = null, focusX = 30, clock = 0, rain = [];

    /* Ortak sahne parçaları (metre, y aşağı) */
    function street(ctx, P, o = {}) {
      const X0 = -20, X1 = SW + 20;
      D.earth(ctx, v, P, X0, -30, X1 - X0, 70);
      D.walk(ctx, v, P, X0, -3.4, X1 - X0, 3.4);
      D.walk(ctx, v, P, X0, 7, X1 - X0, 3.4);
      D.asphalt(ctx, v, P, X0, 0, X1 - X0, 7);
      D.curb(ctx, P, X0, 0, X1, 0); D.curb(ctx, P, X0, 7, X1, 7);
      D.line(ctx, P, X0, 3.5, X1, 3.5, { dash: [3, 3] });
      const r = G.rng(o.seed || 3);
      let x = X0;
      let i = 0;
      while (x < X1) { const w = 8 + r() * 6; D.building(ctx, v, P, x, -12, w - 0.5, 8.4, { seed: (o.seed || 3) * 7 + i, height: 8, roof: r() < 0.4 ? 'tile' : null }); x += w; i++; }
      x = X0 + 3;
      while (x < X1) { const w = 8 + r() * 6; D.building(ctx, v, P, x, 10.7, w - 0.5, 9, { seed: (o.seed || 3) * 11 + i, height: 7, roof: r() < 0.5 ? 'tile' : null }); x += w; i++; }
      for (let tx = X0 + 5; tx < X1; tx += 12) D.tree(ctx, v, P, tx, -1.8, 1.3, 300 + tx + (o.seed || 0));
      for (let tx = X0 + 11; tx < X1; tx += 14) if (!o.noTreesBottom || tx < o.noTreesBottom[0] || tx > o.noTreesBottom[1]) D.tree(ctx, v, P, tx, 8.8, 1.3, 400 + tx + (o.seed || 0));
      for (let lx = X0 + 8; lx < X1; lx += 22) { D.lamp(ctx, P, lx, 7.5, 0); if (P.night) D.lampGlow(ctx, P, lx, 7.5, 0, 6); }
    }
    const car = (x, y, ang, o = {}) => Object.assign({ type: 'car', x, y, ang, kind: 'sedan', color: '#2f63c8' }, o);
    const ped = (x, y, ang, o = {}) => Object.assign({ type: 'ped', x, y, ang, phase: 0, walk: false }, o);
    const E = Math.PI / 2, Wd = -Math.PI / 2, N = 0, S = Math.PI;
    const move = (a, ms, to, ease = G.easeInOut) => { const from = { x: a.x, y: a.y, ang: a.ang }; return G.tween(ms, (e) => { if (to.x != null) a.x = lerp(from.x, to.x, e); if (to.y != null) a.y = lerp(from.y, to.y, e); if (to.ang != null) a.ang = lerp(from.ang, to.ang, e); if (a.type === 'ped') { a.walk = true; a.phase += 0.22; } }, ease).then(() => { if (a.type === 'ped') a.walk = false; }); };
    const say = (x, y, text, color = '#16171b', bgc = '#fff', ms = 2200) => bubbles.push({ x, y, text, color, bgc, until: clock + ms / 1000 });
    const doFlash = (color = '#ff3b30', a = 0.35) => { flash = { color, a, t: clock }; };

    const SCEN = [
      { title: 'Yağmurlu havada su birikintisi', rain: true,
        q: 'Yağmur yağıyor. Kaldırımdaki yayanın hemen önünde büyük bir su birikintisi var. Ne yaparsın?',
        o: ['Yavaşlar, yayayı ıslatmadan geçerim', 'Hızımı koruyarak geçerim', 'Korna çalıp yayayı uzaklaştırırım'],
        why: 'Su birikintisinden hızla geçmek yayayı ıslatır, aracın kaymasına da yol açabilir. <b>Nazik sürücü yavaşlar.</b>',
        bg(ctx, P) { street(ctx, P, { seed: 5 }); ctx.fillStyle = G.alpha(P.water, 0.55); ctx.beginPath(); ctx.ellipse(38, 6.1, 3.4, 0.85, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = G.alpha('#ffffff', 0.25); ctx.lineWidth = 0.08; ctx.beginPath(); ctx.ellipse(38, 6.1, 3.0, 0.62, 0, 0, Math.PI * 2); ctx.stroke(); },
        init() { A = { me: car(4, 5.25, E, { kind: 'player' }), p: ped(38.6, 8.1, N, { umbrella: '#e8412f', shirt: '#ff8a3d' }) }; focusX = 20; },
        async play(good) {
          if (good) { focusX = 34; await move(A.me, 1300, { x: 30 }, G.easeOut); A.me.brake = true; await move(A.me, 1800, { x: 45 }, (u) => u); A.me.brake = false; await move(A.me, 900, { x: 72 }, G.easeIn); }
          else {
            focusX = 38; await move(A.me, 750, { x: 35 }, (u) => u);
            G.Sfx.play('splash');
            parts.emit(34, () => ({ x: 38 + rand(-2, 2), y: 6.4, vx: rand(-2, 3), vy: rand(2.5, 5.5), g: 6, drag: 1.2, life: rand(0.5, 0.9), size: rand(2, 4), color: '#79aee8' }));
            await move(A.me, 450, { x: 50 }, (u) => u);
            say(38.6, 7.4, 'Sırılsıklam oldum!', '#d7372f'); doFlash();
            A.p.shake = 0.8;
            await move(A.me, 700, { x: 72 }, (u) => u);
          }
        } },
      { title: 'Yeşil yandı ama yaya geçmedi',
        q: 'Işık sana yeşil yandı; ama yaşlı bir yaya yaya geçidinde, tam aracının önünde, yavaşça karşıya geçiyor. Ne yaparsın?',
        o: ['Geçişini tamamlamasını sabırla beklerim', 'Korna çalarak acele ettiririm', 'Yayanın arkasından dolanarak geçerim'],
        why: 'Işık yeşile dönse de geçişini tamamlamamış yayaya <b>yol verilir</b>. Yaşlı, engelli ve çocuk yayalara karşı özellikle sabırlı ol.',
        bg(ctx, P) { street(ctx, P, { seed: 7, noTreesBottom: [36, 46] }); D.zebra(ctx, P, 40.2, 0.3, 44.2, 6.7, false); D.line(ctx, P, 39.4, 3.7, 39.4, 6.8, { w: 0.4 }); },
        fg(ctx, P) { D.signal(ctx, P, 38.6, 8.4, 0, 'green', clock); },
        init() { A = { me: car(35.2, 5.25, E, { kind: 'player', brake: true }), p: ped(42.2, 5.6, N, { elder: true, cane: true, shirt: '#8a6fb0' }) }; focusX = 38; },
        async play(good) {
          if (good) { await move(A.p, 3200, { y: -1.6 }, (u) => u); A.me.brake = false; await move(A.me, 1600, { x: 72 }, G.easeIn); }
          else { say(34, 3.6, 'DIIIT!', '#9a6a00', '#ffe27a', 1400); G.Sfx.play('horn'); A.p.shake = 0.9; await G.wait(500); say(42.2, 4.4, 'Ayy!', '#d7372f'); doFlash(); await move(A.p, 1300, { y: 1.5 }, (u) => u); }
        } },
      { title: 'Arkadan ambulans geliyor',
        q: 'Arkandan ışıklı ve sesli uyarı işaretlerini çalıştıran bir ambulans yaklaşıyor. Ne yaparsın?',
        o: ['Sağa yanaşıp yavaşlarım, gerekirse dururum', 'Hızlanıp önünden kaçarım', 'Olduğum yerde aniden fren yaparım'],
        why: 'Geçiş üstünlüğü olan araçlara <b>sağa yanaşarak ve gerekirse durarak</b> yol verilir. Ani fren ve hızlanma kazaya yol açabilir.',
        bg(ctx, P) { street(ctx, P, { seed: 9 }); },
        init() { A = { me: car(30, 5.25, E, { kind: 'player' }), amb: car(3, 5.25, E, { kind: 'ambulance', siren: true }) }; focusX = 22; },
        async play(good) {
          if (good) { A.me.blinkR = true; await Promise.all([move(A.me, 1100, { x: 33, y: 6.2 }), move(A.amb, 1100, { x: 18 }, (u) => u)]); A.me.brake = true; await move(A.amb, 1700, { x: 72, y: 4.4 }, (u) => u); A.me.brake = false; A.me.blinkR = false; focusX = 40; }
          else { focusX = 38; await Promise.all([move(A.me, 1700, { x: 50 }, (u) => u), move(A.amb, 1700, { x: 42 }, (u) => u)]); say(42, 3.8, 'Ambulans geçemiyor!', '#d7372f'); G.Sfx.play('horn'); doFlash(); }
        } },
      { title: 'Seni sollamak isteyen araç',
        q: 'Arkandaki araç seni sollamak için karşı şeride çıktı. Ne yaparsın?',
        o: ['Hızımı artırmam, gerekirse sağa yanaşırım', 'Hızlanıp geçmesini zorlaştırırım', 'Sola kayıp yolu kapatırım'],
        why: 'Sollanan aracın sürücüsü <b>hızını artıramaz</b>; gerekirse sağa yanaşarak sollamanın güvenle bitmesine yardım eder.',
        bg(ctx, P) { street(ctx, P, { seed: 11 }); },
        init() { A = { me: car(24, 5.25, E, { kind: 'player' }), ov: car(15, 1.9, E, { color: '#2f63c8', blinkL: true }), on: car(78, 1.75, Wd, { color: '#3f7d55' }) }; focusX = 26; },
        async play(good) {
          if (good) { await Promise.all([move(A.me, 2600, { x: 34, y: 5.9 }), (async () => { await move(A.ov, 1500, { x: 42 }, (u) => u); A.ov.blinkL = false; A.ov.blinkR = true; await move(A.ov, 1100, { x: 58, y: 5.25 }); A.ov.blinkR = false; })(), move(A.on, 2600, { x: 44 }, (u) => u)]); await move(A.on, 1200, { x: -12 }, (u) => u); focusX = 40; }
          else { focusX = 44; await Promise.all([move(A.me, 2000, { x: 52 }, (u) => u), move(A.ov, 2000, { x: 46 }, (u) => u), move(A.on, 2000, { x: 54 }, (u) => u)]); say(51, 0.2, 'Kafa kafaya çarpışma riski!', '#d7372f'); G.Sfx.play('screech'); doFlash(); }
        } },
      { title: 'Gece, karşıdan araç geliyor', night: true,
        q: 'Gece şehirlerarası yolda uzun farla gidiyorsun; karşıdan bir araç yaklaşıyor. Ne yaparsın?',
        o: ['Kısa hüzmeli fara geçerim', 'Uzun farla devam ederim', 'Selektör yaparak onu uyarırım'],
        why: 'Karşılaşmalarda karşıdaki sürücünün gözünü almamak için <b>en az 150 m kala kısa fara</b> geçilir.',
        bg(ctx, P) {
          const X0 = -20, X1 = SW + 20;
          D.grass(ctx, v, P, X0, -30, X1 - X0, 70);
          ctx.fillStyle = P.dirt; ctx.fillRect(X0, -1.2, X1 - X0, 1.2); ctx.fillRect(X0, 7, X1 - X0, 1.2);
          D.asphalt(ctx, v, P, X0, 0, X1 - X0, 7);
          D.line(ctx, P, X0, 0.3, X1, 0.3); D.line(ctx, P, X0, 6.7, X1, 6.7); D.line(ctx, P, X0, 3.5, X1, 3.5, { dash: [3, 3] });
          for (let tx = X0; tx < X1; tx += 7) { D.tree(ctx, v, P, tx, -4.5, 1.4, 500 + tx); D.tree(ctx, v, P, tx + 3.5, 11.5, 1.4, 600 + tx); }
        },
        init() { A = { me: car(8, 5.25, E, { kind: 'player', high: true }), on: car(80, 1.75, Wd, { color: '#7b3fa0' }) }; focusX = 22; },
        async play(good) {
          if (good) { await move(A.on, 900, { x: 60 }, (u) => u); A.me.high = false; stage.toast('Kısa fara geçtin', 'info', 1000); await Promise.all([move(A.me, 2600, { x: 36 }, (u) => u), move(A.on, 2600, { x: -14 }, (u) => u)]); focusX = 30; }
          else {
            await Promise.all([move(A.me, 1800, { x: 22 }, (u) => u), move(A.on, 1800, { x: 36 }, (u) => u)]);
            say(36, 0.4, 'Gözüm kamaştı!', '#d7372f'); doFlash('#fff6c8', 0.55);
            await G.tween(900, (e, u) => { A.on.x = lerp(36, 26, u); A.on.y = 1.75 + Math.sin(u * 14) * 0.5 * (1 - u); A.on.ang = Wd + Math.sin(u * 14) * 0.15 * (1 - u); });
          }
        } },
      { title: 'Trafik sıkışık, emniyet şeridi boş',
        q: 'Otoyolda trafik durdu. Sağdaki emniyet şeridi bomboş. Ne yaparsın?',
        o: ['Şeridimde sabırla beklerim', 'Emniyet şeridinden ilerlerim', 'Korna çalarak öndekileri uyarırım'],
        why: 'Emniyet şeridi ambulans, itfaiye gibi acil durum araçlarının yoludur. <b>Burayı kullanmak hem yasak hem de haksızlıktır.</b>',
        bg(ctx, P) {
          const X0 = -20, X1 = SW + 20;
          D.grass(ctx, v, P, X0, -30, X1 - X0, 70);
          ctx.fillStyle = shade(P.road, 0.1); ctx.fillRect(X0, 7.2, X1 - X0, 3);
          D.asphalt(ctx, v, P, X0, -0.2, X1 - X0, 7.4);
          ctx.fillStyle = P.night ? '#6b717b' : '#bcc2ca'; ctx.fillRect(X0, -0.9, X1 - X0, 0.25); ctx.fillRect(X0, 10.4, X1 - X0, 0.25);
          D.line(ctx, P, X0, 0, X1, 0); D.line(ctx, P, X0, 3.6, X1, 3.6, { dash: [3, 4] }); D.line(ctx, P, X0, 7.2, X1, 7.2, { w: 0.2 });
          ctx.fillStyle = G.alpha(P.roadLine, 0.55); ctx.font = `900 ${Math.max(0.8, 13 / v.scale)}px Archivo, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (const x of [8, 30, 52]) ctx.fillText('EMNİYET ŞERİDİ', x, 8.75);
          for (let tx = X0; tx < X1; tx += 9) { D.tree(ctx, v, P, tx, -4, 1.5, 700 + tx); D.tree(ctx, v, P, tx + 4, 13.5, 1.5, 800 + tx); }
        },
        init() {
          const jam = [[8, 1.8, '#2f63c8'], [16, 1.8, '#e68a2e'], [24, 1.8, '#6b7380'], [36, 1.8, '#3f7d55'], [44, 1.8, '#2b2f36'], [52, 1.8, '#8c2f2b'], [10, 5.4, '#7b3fa0'], [18.5, 5.4, '#3f7d55'], [40, 5.4, '#e68a2e'], [48, 5.4, '#6b7380']];
          A = { me: car(29.5, 5.4, E, { kind: 'player', brake: true }), amb: car(-8, 8.7, E, { kind: 'ambulance', siren: true }) };
          jam.forEach(([x, y, c], i) => { A['j' + i] = car(x, y, E, { color: c, brake: true, kind: i % 4 === 3 ? 'minibus' : 'sedan' }); });
          focusX = 24;
        },
        async play(good) {
          if (good) { await move(A.amb, 3000, { x: 74 }, (u) => u); focusX = 40; }
          else { A.me.brake = false; A.me.blinkR = true; await move(A.me, 1000, { x: 33, y: 8.7 }); A.me.blinkR = false; A.me.brake = true; focusX = 24; await move(A.amb, 1500, { x: 24 }, G.easeOut); say(24, 7.4, 'Emniyet şeridi kapandı!', '#d7372f'); G.Sfx.play('horn'); doFlash(); }
        } },
      { title: 'Otoparkta tek boş yer',
        q: 'Otoparkta boş olan tek yer engelliler için ayrılmış. Aceleniz var. Ne yaparsın?',
        o: ['Başka bir park yeri ararım', 'Kısa süreliğine engelli yerine park ederim', 'Dörtlüleri yakıp engelli yerine park ederim'],
        why: 'Engelli park yerleri, bu yerlere gerçekten ihtiyacı olanlar içindir. <b>Kısa süreliğine bile olsa park etmek yasak ve saygısızlıktır.</b>',
        bg(ctx, P) {
          const X0 = -20, X1 = SW + 20;
          D.walk(ctx, v, P, X0, -30, X1 - X0, 70);
          D.asphalt(ctx, v, P, X0, -7, X1 - X0, 15);
          for (let i = 0; i <= 17; i++) D.line(ctx, P, 4 + i * 3, -6.8, 4 + i * 3, -1.2, { w: 0.12 });
          ctx.fillStyle = P.night ? '#1f3f73' : '#2a62b8'; ctx.fillRect(31.1, -6.7, 2.8, 5.4);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.16; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(32.4, -4.9, 0.16, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(32.4, -4.6); ctx.lineTo(32.4, -3.9); ctx.lineTo(32.9, -3.9); ctx.lineTo(33.15, -3.3); ctx.stroke();
          ctx.beginPath(); ctx.arc(32.38, -3.6, 0.5, Math.PI * 0.7, Math.PI * 2.1); ctx.stroke();
          D.line(ctx, P, X0, 2.4, X1, 2.4, { dash: [2, 2], color: G.alpha(P.roadLine, 0.5) });
          for (let tx = X0; tx < X1; tx += 10) D.tree(ctx, v, P, tx, 11, 1.4, 900 + tx);
        },
        init() {
          const cols = ['#2f63c8', '#e68a2e', '#6b7380', '#3f7d55', '#7b3fa0', '#2b2f36', '#8c2f2b', '#d9c7a2', '#2f63c8', '#e68a2e', '#6b7380', '#3f7d55', '#7b3fa0', '#2b2f36', '#8c2f2b', '#d9c7a2', '#2f63c8'];
          A = { me: car(2, 3.8, E, { kind: 'player' }), other: car(-10, 3.8, E, { color: '#eef0f3', badge: true }) };
          for (let i = 0; i < 17; i++) if (i !== 9) A['p' + i] = car(5.5 + i * 3, -4, S, { color: cols[i], kind: i % 5 === 2 ? 'hatch' : 'sedan' });
          focusX = 22;
        },
        async play(good) {
          if (good) { focusX = 40; await move(A.me, 1800, { x: 74 }, (u) => u); focusX = 28; await move(A.other, 1700, { x: 29.5 }, G.easeOut); await move(A.other, 1100, { x: 32.5, y: -4, ang: 0 }); }
          else { focusX = 30; await move(A.me, 1500, { x: 29.5 }, G.easeOut); await move(A.me, 1100, { x: 32.5, y: -4, ang: 0 }); A.me.brake = true; await move(A.other, 1500, { x: 24 }, G.easeOut); say(24, 2.4, 'Park edecek yerim kalmadı!', '#d7372f'); doFlash(); }
        } }
    ];

    function restart() { ok = 0; bad = 0; nth = 0; goal.set(0, 0); queue = shuffle(SCEN.map((_, i) => i)); show(); }
    function show() {
      if (!queue.length) queue = shuffle(SCEN.map((_, i) => i));
      cur = queue.shift();
      nth++;
      const sc = SCEN[cur];
      bubbles = []; flash = null; parts.clear();
      sc.init();
      chip.label(`Durum ${nth}`).set(sc.title);
      const order = shuffle([0, 1, 2]);
      box.innerHTML = order.map((oi, j) => `<button type="button" class="ad-choice" data-o="${oi}"><span class="gs-k">${j + 1}</span><span>${sc.o[oi]}</span></button>`).join('');
      nextBtn.hidden = true;
      busy = false;
      bgKey = '';
      feedback(panel, sc.q, '');
    }
    async function choose(oi, btn) {
      if (busy) return;
      busy = true;
      const sc = SCEN[cur], good = oi === 0;
      $$('.ad-choice', box).forEach((b) => { b.disabled = true; if (Number(b.dataset.o) === 0) b.classList.add('right'); else if (b === btn) b.classList.add('wrong'); });
      if (good) ok++; else { bad++; queue.splice(Math.min(queue.length, 2), 0, cur); }
      goal.set(ok, bad);
      G.Sfx.play(good ? 'ok' : 'bad');
      feedback(panel, good ? '✓ Doğru davranış! İzle…' : '✗ Bu davranışın sonucunu izle…', good ? 'ok' : 'bad');
      await sc.play(good);
      stage.toast(good ? '✓ Nazik ve güvenli' : '✗ Doğrusu: ' + sc.o[0], good ? 'ok' : 'bad', 1800);
      feedback(panel, `${good ? '✓ Doğru!' : '✗ Doğrusu: “' + sc.o[0] + '”.'} ${sc.why}`, good ? 'ok' : 'bad');
      nextBtn.hidden = false;
      $('span', nextBtn).textContent = 'Sonraki durum';
      if (ok === GOAL && good && !done.has(id)) { complete(id, host); setTimeout(() => finishCard(stage, id, bad, `${GOAL} durumda saygılı ve güvenli davrandın. Trafik adabı: sabır, empati ve nezaket.`, () => {}), 700); }
    }
    const VIS = () => (stage.narrow ? 30 : 46);
    function layout() {
      const W = stage.w, H = stage.h;
      v.scale = W / VIS();
      const cy = cur != null && SCEN[cur].title.startsWith('Otopark') ? 1 : 3.5;
      v.oy = H / 2 - cy * v.scale;
      const half = VIS() / 2;
      v.ox = W / 2 - clamp(focusX, half - 4, SW + 4 - half) * v.scale;
    }
    function frame(dt, now) {
      if (!built || cur == null) return;
      clock += dt;
      const ctx = stage.begin(), W = stage.w, H = stage.h;
      if (!W) return;
      const sc = SCEN[cur];
      const P = T.palette(sc.night ? true : stage.night);
      // Kamera, odak noktasını yumuşakça izler
      layout();
      const target = v.ox;
      v.ox = frame._ox == null || frame._key !== cur ? target : lerp(frame._ox, target, Math.min(1, dt * 3));
      frame._ox = v.ox; frame._key = cur;
      const key = cur + '|' + W + 'x' + H + '|' + (sc.night ? 'night' : stage.theme) + '|' + stage.dpr;
      if (key !== bgKey) {
        const saveOx = v.ox;
        const fullW = Math.ceil((SW + 8) * v.scale);
        v.ox = 4 * v.scale;
        bg = T.bake({ w: fullW, h: H, dpr: stage.dpr }, (c) => { c.save(); v.apply(c); sc.bg(c, P); c.restore(); });
        bg._ox = v.ox;
        v.ox = saveOx; bgKey = key;
      }
      ctx.drawImage(bg, v.ox - bg._ox, 0, bg.width / stage.dpr, H);
      ctx.save(); v.apply(ctx);
      if (sc.fg) sc.fg(ctx, P);
      const list = Object.values(A);
      for (const a of list) {
        if (a.type === 'ped') { const sh = a.shake ? Math.sin(clock * 60) * 0.12 * a.shake : 0; if (a.shake) a.shake = Math.max(0, a.shake - dt); T.ped(ctx, v, a.x + sh, a.y, a.ang, a); }
      }
      for (const a of list) {
        if (a.type !== 'car') continue;
        T.vehicle(ctx, v, a.x, a.y, a.ang, { kind: a.kind, color: a.color, brake: a.brake, blinkL: a.blinkL, blinkR: a.blinkR, siren: a.siren, night: P.night, high: a.high, head: P.night });
        if (a.badge) { ctx.fillStyle = '#1e5aa8'; ctx.fillRect(a.x - 0.35, a.y - 0.35, 0.7, 0.7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(a.x, a.y + 0.05, 0.18, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.restore();
      // Yağmur
      if (sc.rain) {
        while (rain.length < 140) rain.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.8 });
        ctx.fillStyle = 'rgba(40,60,90,.14)'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(220,232,250,.55)'; ctx.lineWidth = 1; ctx.beginPath();
        for (const r of rain) { r.y += 520 * r.s * dt; r.x -= 60 * r.s * dt; if (r.y > H) { r.y = -10; r.x = Math.random() * (W + 40); } ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + 2, r.y - 10 * r.s); }
        ctx.stroke();
        const pz = { x: v.X(38), y: v.Y(6.1) };
        ctx.strokeStyle = 'rgba(220,235,255,.5)'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { const u = ((clock * 0.8 + i / 3) % 1); ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.ellipse(pz.x + (i - 1) * 18, pz.y, 4 + u * 16, (4 + u * 16) * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      parts.update(dt);
      parts.draw(ctx, (p) => ({ x: v.X(p.x), y: v.Y(p.y), scale: 1 }));
      bubbles = bubbles.filter((b) => b.until > clock);
      for (const b of bubbles) T.bubble(ctx, v.X(b.x), v.Y(b.y), b.text, b.color, b.bgc, stage.narrow ? 12 : 13.5);
      if (flash) { const u = (clock - flash.t) / 0.6; if (u >= 1) flash = null; else { ctx.fillStyle = G.alpha(flash.color, flash.a * (1 - u)); ctx.fillRect(0, 0, W, H); } }
    }
    const L = G.loop((dt, t) => { stage.tick(dt); frame(dt, t); });
    box.addEventListener('click', (e) => { const b = e.target.closest('.ad-choice'); if (b) choose(Number(b.dataset.o), b); });
    nextBtn.addEventListener('click', show);
    $('[data-act="reset"]', panel).addEventListener('click', () => { if (!busy || !nextBtn.hidden) restart(); });
    return {
      init() { if (!built) { built = true; restart(); } },
      start() { this.init(); L.start(); },
      stop() { L.stop(); },
      key(e) {
        const n = Number(e.key);
        if (n >= 1 && n <= 3 && !busy) { const b = $$('.ad-choice', box)[n - 1]; if (b) choose(Number(b.dataset.o), b); return true; }
        if (e.code === 'Enter' && !nextBtn.hidden) { show(); return true; }
        return false;
      },
      debug() { return { cur, title: cur != null && SCEN[cur].title, ok, bad, busy, next: !nextBtn.hidden }; }
    };
  })();


  /* ---------- Sekmeler ---------- */
  const LESSONS = { isik: lessonIsik, gecis: lessonGecis, levha: lessonLevha, serit: lessonSerit, park: lessonPark, durus: lessonDurus, ayna: lessonAyna, tyd: lessonTyd, gosterge: lessonGosterge, adab: lessonAdab };
  let current = ORDER[0], visible = false;
  function select(lid, opts = {}) {
    if (!LESSONS[lid]) return;
    if (current && current !== lid) LESSONS[current].stop();
    current = lid;
    tabs.forEach((t) => { const on = t.dataset.lesson === lid; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && opts.focus) t.focus({ preventScroll: true }); });
    panels.forEach((p) => { const on = p.dataset.lesson === lid; p.hidden = !on; p.classList.toggle('is-active', on); });
    LESSONS[lid].init();
    const r = shell.getBoundingClientRect();
    visible = r.bottom > 0 && r.top < innerHeight;
    if (visible && !document.hidden) LESSONS[lid].start();
    if (opts.scroll) {
      const tab = tabs.find((t) => t.dataset.lesson === lid);
      const bar = $('.lesson-tabs', shell);
      if (tab && bar && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: tab.offsetLeft - bar.clientWidth / 2 + tab.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
    }
    if (opts.into) shell.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }
  tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.lesson, { scroll: true })));
  $('.lesson-tabs', shell).addEventListener('keydown', (e) => {
    const i = ORDER.indexOf(current);
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n != null) { e.preventDefault(); select(ORDER[n], { focus: true, scroll: true }); }
  });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    const Ls = LESSONS[current];
    if (visible && !document.hidden) Ls.start(); else Ls.stop();
  }, { threshold: 0.12 }).observe(shell);
  document.addEventListener('visibilitychange', () => {
    const Ls = LESSONS[current];
    if (document.hidden) Ls.stop(); else if (visible) Ls.start();
  });
  // Klavye: rakam tuşları her zaman derse gider; Boşluk/Enter yalnızca bir düğme odakta değilse
  // (dersin kendi kontrol çubuğundaki düğmeler hariç — orada Boşluk basılı tutma içindir)
  function keyTarget(e) {
    if (!visible || e.altKey || e.ctrlKey || e.metaKey || document.documentElement.classList.contains('exam-open')) return false;
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return false;
    const activate = e.code === 'Space' || e.code === 'Enter' || e.key === ' ';
    if (activate && e.target.closest && e.target.closest('button, a, [role="button"], [role="tab"], label')) {
      const inBar = e.target.closest('.lesson.is-active .sim-bar [data-act="brake"], .lesson.is-active .sim-bar [data-act="overtake"], .lesson.is-active .sim-bar [data-act="run"], .lesson.is-active .sim-bar [data-act="press"]');
      if (!inBar) return false;
    }
    if (e.target.closest && e.target.closest('.sim-card')) return false;
    const r = shell.getBoundingClientRect();
    if (r.top > innerHeight * 0.6 || r.bottom < innerHeight * 0.3) return false;
    return true;
  }
  document.addEventListener('keydown', (e) => {
    if (!keyTarget(e)) return;
    if (e.repeat && (e.code === 'Space' || e.code.startsWith('Arrow'))) { e.preventDefault(); return; }
    if (LESSONS[current].key(e)) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => {
    const L = LESSONS[current];
    if (!L.keyup || document.documentElement.classList.contains('exam-open')) return;
    if (L.keyup(e) && visible) e.preventDefault();
  });
  // Ses aç/kapat
  const snd = $('#academy-sound');
  if (snd) {
    const paint = (on) => { snd.setAttribute('aria-pressed', String(on)); $('use', snd).setAttribute('href', on ? '#i-sound' : '#i-mute'); $('span', snd).textContent = on ? 'Ses açık' : 'Ses kapalı'; };
    paint(G.Sfx.on);
    snd.addEventListener('click', () => G.Sfx.set(!G.Sfx.on));
    G.Sfx.onChange(paint);
  }
  window.YildizAcademy = {
    debug: (lid) => (LESSONS[lid] && LESSONS[lid].debug ? LESSONS[lid].debug() : null),
    open(lid) {
      const sec = $('#egitim');
      select(lid, { scroll: true });
      (sec || shell).scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    }
  };
  paintProgress();
  select(ORDER[0]);
})();
