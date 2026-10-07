/* Ürgüp Yıldız Sürücü Kursu — Park simülatörü (2B / 3B)
   Direksiyon ve İleri/Geri pedallarıyla aracı park yerine sok: ileri park, geri geri park, paralel park.
   Kuşbakışı görünüm academy-top.js çizimlerini, 3B takip kamerası academy-3d.js izdüşümünü kullanır;
   3B araçlar alçak poligonlu dışbükey parçalardan oluşur ve uzaktan yakına (ressam algoritması) çizilir.
   Ders düzeni öteki uygulamalarla aynıdır: HUD etiketleri, hedef çubuğu (hedef · hata), geri bildirim satırı,
   sonuç kartı (1–3 yıldız) ve “Uygulama tamamlandı” bandı.
   Koordinatlar metre: x doğu, y güney (2B ekranda aşağı); 3B'de z = −y, yükseklik h.
   Araç yönü θ: 0 = kuzey, saat yönünde artar; ileri = (sin θ, −cos θ), sağ = (cos θ, sin θ). */
(() => {
  'use strict';

  const G = window.YildizGfx, R = window.YildizRoad, T = window.YildizTop;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const shell = $('.ps-shell');
  if (!shell || !G || !R || !T) return;
  const { TAU, clamp, lerp, store, shade, alpha, rng } = G;
  const panel = $('.lesson', shell), host = $('.sim', panel);
  const ID = 'parksim', GOAL = 3;
  const DONE_KEY = 'yildiz-akademi-v1', STAR_KEY = 'yildiz-akademi-yildiz-v1', VIEW_KEY = 'yildiz-park-gorunum';
  const reduced = G.reduced;
  const FX = () => window.YildizFX || { confetti() {}, burstFrom() {} };
  const tr = (n, d = 1) => n.toFixed(d).replace('.', ',');
  const DEG = Math.PI / 180;
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const toward0 = (v, d) => (Math.abs(v) <= d ? 0 : v - Math.sign(v) * d);

  /* =========================================================
     Araç: bisiklet modeli (arka aks etrafında döner)
     Direksiyon simidi ±540° (1,5 tur) döner, teker açısına doğrusal eşlenir.
     ========================================================= */
  const WB = 2.65, REAR = 1.32, MAXS = 38 * DEG, WHEEL_MAX = 540;
  const HW = 0.9, HL = 2.18;                                   // çarpışma kutusu (yarım genişlik / uzunluk)
  const VF = 2.6, VR = 1.8, ACC = 1.5, COAST = 2.4, BRAKE = 6;  // m/s ve m/s²
  // 3B modeller: gövde (b0–b1), kabin tabanı c0 ve tavanı c1 (ileri eksende arka/ön), teker yarıçapı wr
  const MODEL = {
    sedan: { L: 4.4, W: 1.84, b0: 0.26, b1: 0.8, top: 1.42, c0: [-1.36, 0.78], c1: [-0.98, 0.1], hood: 0.3, trunk: 0.14, wr: 0.31 },
    hatch: { L: 3.9, W: 1.78, b0: 0.26, b1: 0.82, top: 1.5, c0: [-1.66, 0.6], c1: [-1.56, -0.04], hood: 0.28, trunk: 0.05, wr: 0.3 },
    suv: { L: 4.6, W: 1.95, b0: 0.34, b1: 0.98, top: 1.72, c0: [-2.0, 0.7], c1: [-1.92, 0.02], hood: 0.22, trunk: 0.06, wr: 0.36 },
    minibus: { L: 5.3, W: 2.0, b0: 0.32, b1: 1.0, top: 2.3, c0: [-2.6, 1.72], c1: [-2.58, 1.22], hood: 0.2, trunk: 0.02, wr: 0.34 }
  };
  MODEL.taxi = MODEL.sedan; MODEL.player = MODEL.sedan;

  let wheelDeg = 0, centering = false, detent = 0;
  const KEY_RATE = 300, CENTER_RATE = 420;               // °/s: tuşla çevirme ve “Düz” ile ortalama hızı
  const steerRad = () => (wheelDeg / WHEEL_MAX) * MAXS;
  function integrate(p, d) {
    const da = (d / WB) * Math.tan(steerRad());
    const rx = p.x - Math.sin(p.ang) * REAR, ry = p.y + Math.cos(p.ang) * REAR;
    const am = p.ang + da / 2, na = p.ang + da;
    const nx = rx + Math.sin(am) * d, ny = ry - Math.cos(am) * d;
    return { x: nx + Math.sin(na) * REAR, y: ny - Math.cos(na) * REAR, ang: na };
  }

  /* ---------- Yönlü kutular (çarpışma, sensör, park denetimi) ---------- */
  function box(x, y, hw, hl, ang, kind) {
    const b = { x, y, hw, hl, ang, kind, rx: Math.cos(ang), ry: Math.sin(ang), fx: Math.sin(ang), fy: -Math.cos(ang) };
    b.rad = Math.hypot(hw, hl);
    return b;
  }
  // Köşeler: sol ön, sağ ön, sağ arka, sol arka
  function corners(b) {
    const { x, y, hw, hl, rx, ry, fx, fy } = b;
    return [[x - rx * hw + fx * hl, y - ry * hw + fy * hl], [x + rx * hw + fx * hl, y + ry * hw + fy * hl],
      [x + rx * hw - fx * hl, y + ry * hw - fy * hl], [x - rx * hw - fx * hl, y - ry * hw - fy * hl]];
  }
  // Ayırma ekseni sınaması (iki dikdörtgen)
  function overlap(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy > (a.rad + b.rad) ** 2) return false;
    for (const [ax, ay] of [[a.rx, a.ry], [a.fx, a.fy], [b.rx, b.ry], [b.fx, b.fy]]) {
      const ra = a.hw * Math.abs(a.rx * ax + a.ry * ay) + a.hl * Math.abs(a.fx * ax + a.fy * ay);
      const rb = b.hw * Math.abs(b.rx * ax + b.ry * ay) + b.hl * Math.abs(b.fx * ax + b.fy * ay);
      if (Math.abs(dx * ax + dy * ay) > ra + rb) return false;
    }
    return true;
  }
  function closest(b, px, py) {
    const dx = px - b.x, dy = py - b.y;
    const u = clamp(dx * b.rx + dy * b.ry, -b.hw, b.hw), w = clamp(dx * b.fx + dy * b.fy, -b.hl, b.hl);
    return [b.x + b.rx * u + b.fx * w, b.y + b.ry * u + b.fy * w];
  }

  /* =========================================================
     Sahneler: otopark (ileri / geri geri park) ve cadde (paralel park)
     ========================================================= */
  const SEQ = ['ileri', 'geri', 'paralel'];
  const NAME = { ileri: 'İleri park', geri: 'Geri geri park', paralel: 'Paralel park' };
  const COLORS = R.CAR_COLORS;
  const KINDS_LOT = [['sedan', 5], ['hatch', 3], ['suv', 3], ['taxi', 1]];
  const KINDS_ST = [['sedan', 5], ['hatch', 3], ['suv', 2], ['taxi', 1], ['minibus', 1]];
  function wpick(r, list) {
    let s = 0;
    for (const [, w] of list) s += w;
    let x = r() * s;
    for (const [k, w] of list) { x -= w; if (x <= 0) return k; }
    return list[0][0];
  }
  const colorFor = (r, kind) => (kind === 'taxi' ? '#f2c200' : COLORS[Math.floor(r() * COLORS.length)]);
  function scene(kind, bounds) { return { kind, bounds, areas: [], curbs: [], paint: [], cars: [], obs: [], trees: [], lamps: [], blds: [] }; }
  const area = (sc, t, x0, y0, x1, y1, h = 0) => sc.areas.push({ t, x0, y0, x1, y1, h });
  function seg(sc, x0, y0, x1, y1, w, c = 'w') {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * w / 2, ny = (dx / l) * w / 2;
    sc.paint.push({ c, pts: [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]] });
  }
  function dashed(sc, x0, y0, x1, y1, w, on, off) {
    const l = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / l, uy = (y1 - y0) / l;
    for (let s = 0; s < l; s += on + off) { const e = Math.min(l, s + on); seg(sc, x0 + ux * s, y0 + uy * s, x0 + ux * e, y0 + uy * e, w); }
  }
  // Yön oku (yerde): ang yönüne bakar
  function arrow(sc, x, y, ang) {
    const f = [Math.sin(ang), -Math.cos(ang)], r = [Math.cos(ang), Math.sin(ang)];
    const P = (u, w) => [x + r[0] * u + f[0] * w, y + r[1] * u + f[1] * w];
    sc.paint.push({ c: 'w', pts: [P(-0.15, -1.6), P(0.15, -1.6), P(0.15, 0.4), P(-0.15, 0.4)] });
    sc.paint.push({ c: 'w', pts: [P(-0.55, 0.35), P(0, 1.4), P(0.55, 0.35)] });
  }
  function addCar(sc, x, y, ang, kind, color) {
    const m = MODEL[kind];
    const c = { x, y, ang, kind, color };
    c.ob = box(x, y, m.W / 2 - 0.03, m.L / 2 - 0.03, ang, 'car');
    sc.cars.push(c); sc.obs.push(c.ob);
  }
  // Bordür: (nx, ny) yola doğru; çizginin arkasında 1 m kalınlığında engel
  function curb(sc, x0, y0, x1, y1, nx, ny, kind = 'curb') {
    sc.curbs.push({ x0, y0, x1, y1, nx, ny });
    const cx = (x0 + x1) / 2 - nx * 0.5, cy = (y0 + y1) / 2 - ny * 0.5;
    sc.obs.push(Math.abs(y1 - y0) < 0.01 ? box(cx, cy, Math.abs(x1 - x0) / 2, 0.5, 0, kind) : box(cx, cy, 0.5, Math.abs(y1 - y0) / 2, 0, kind));
  }
  function buildings(sc, r, x0, x1, y0, y1) {
    let x = x0;
    while (x < x1) {
      const w = 8 + r() * 6;
      sc.blds.push({ x0: x, y0, x1: Math.min(x1, x + w - 0.6), y1, h: 6.4 + Math.floor(r() * 3) * 3.1, ci: Math.floor(r() * 7), s: Math.floor(r() * 1e5), roof: r() < 0.3 ? 'tile' : null });
      x += w;
    }
  }

  // Otopark: ortada 7,2 m geçiş yolu, iki yanda 12'şer dik park yeri; sürücü batı ucundan doğuya bakarak başlar
  function lotScene(mode, hard, seed) {
    const r = rng(seed);
    const BW = hard ? 2.5 : 2.7, BD = 5.2, AH = 3.6, N = 12, X0 = (-N * BW) / 2, XE = -X0 + 6.4, YB = AH + BD;
    const sc = scene('lot', { x0: -XE - 9, y0: -YB - 10, x1: XE + 9, y1: YB + 10 });
    area(sc, 'earth', -XE - 70, -YB - 70, XE + 70, YB + 70);
    area(sc, 'grass', -XE - 12, -YB - 9, XE + 12, YB + 9);
    area(sc, 'asphalt', -XE, -YB, XE, YB);
    area(sc, 'walk', -XE - 2.6, -YB - 2.6, XE + 2.6, -YB, 0.15);
    area(sc, 'plant', -XE, YB, XE, YB + 2.4, 0.15);
    area(sc, 'walk', XE, -YB, XE + 2.6, YB + 2.4, 0.15);
    area(sc, 'walk', -XE - 2.6, -YB, -XE, YB + 2.4, 0.15);
    curb(sc, -XE, -YB, XE, -YB, 0, 1); curb(sc, -XE, YB, XE, YB, 0, -1);
    curb(sc, XE, -YB, XE, YB, -1, 0); curb(sc, -XE, -YB, -XE, YB, 1, 0);
    for (let i = 0; i <= N; i++) { const x = X0 + i * BW; seg(sc, x, -YB, x, -AH, 0.12); seg(sc, x, AH, x, YB, 0.12); }
    arrow(sc, -9, 0, Math.PI / 2); arrow(sc, 9, 0, Math.PI / 2);
    const row = mode === 'ileri' ? -1 : 1;
    const idx = hard ? 3 + Math.floor(r() * 6) : 6;
    sc.target = { type: 'bay', x: X0 + BW * (idx + 0.5), y: row * (AH + BD / 2), hw: BW / 2, hd: BD / 2, ax: [0, row], want: mode === 'ileri' ? 1 : -1 };
    const empty = new Set([row + ':' + idx]);
    if (mode === 'ileri' && !hard) empty.add(row + ':' + (idx - 1));
    for (let t = 0, n = empty.size + 2; empty.size < n && t < 60; t++) {
      const rw = r() < 0.5 ? -1 : 1, i = Math.floor(r() * N);
      if (rw === row && Math.abs(i - idx) <= 1) continue;
      empty.add(rw + ':' + i);
    }
    for (const rw of [-1, 1]) for (let i = 0; i < N; i++) {
      if (empty.has(rw + ':' + i)) continue;
      const kind = wpick(r, KINDS_LOT), m = MODEL[kind], noseIn = r() < 0.75;
      const depth = (BD - m.L) / 2 - 0.15 - r() * 0.2;
      const ang = (rw < 0 ? (noseIn ? 0 : Math.PI) : noseIn ? Math.PI : 0) + (r() - 0.5) * 3 * DEG;
      addCar(sc, X0 + BW * (i + 0.5) + (r() - 0.5) * (hard ? 0.36 : 0.24), rw * (AH + BD / 2 + depth), ang, kind, colorFor(r, kind));
    }
    for (let x = -XE + 2.3; x <= XE - 2; x += 4.6) if (Math.abs(Math.abs(x) - 9.2) > 1.2) sc.trees.push({ x, y: YB + 1.2, r: 1.2 + r() * 0.3, s: Math.floor(r() * 1e4) });
    for (let x = -XE - 6; x <= XE + 6; x += 6.5) sc.trees.push({ x: x + r(), y: -YB - 5.5 - r() * 1.5, r: 1.5 + r() * 0.5, s: Math.floor(r() * 1e4) });
    for (let y = -YB + 1; y <= YB + 2; y += 5.5) { sc.trees.push({ x: XE + 6 + r(), y, r: 1.6, s: Math.floor(r() * 1e4) }); sc.trees.push({ x: -XE - 6 - r(), y, r: 1.6, s: Math.floor(r() * 1e4) }); }
    for (const x of [-15, 0, 15]) sc.lamps.push({ x, y: -YB - 2.2, ang: Math.PI });
    for (const x of [-9.2, 9.2]) sc.lamps.push({ x, y: YB + 2.0, ang: 0 });
    buildings(sc, r, -XE - 16, XE + 16, -YB - 24, -YB - 9.2);
    buildings(sc, r, -XE - 16, XE + 16, YB + 9.2, YB + 22);
    sc.start = { x: -XE + 3.2, y: 1.8, ang: Math.PI / 2 };
    return sc;
  }

  // Cadde: iki yönlü yol, iki yanda park şeridi; sağdaki (güney) park şeridinde iki araç arasında boşluk
  function streetScene(hard, seed) {
    const r = rng(seed);
    const XE = 40, CS = 5.5, CN = -5.5, LN = 3.3;
    const Lg = hard ? 6.3 : 7.0, x0 = hard ? -3 + r() * 4 : -1.5, x1 = x0 + Lg;
    const sc = scene('street', { x0: -XE - 4, y0: CN - 9, x1: XE + 4, y1: CS + 9 });
    area(sc, 'earth', -XE - 70, CN - 70, XE + 70, CS + 70);
    area(sc, 'grass', -XE - 10, CN - 9.5, XE + 10, CS + 9.5);
    area(sc, 'asphalt', -XE - 10, CN, XE + 10, CS);
    area(sc, 'walk', -XE - 10, CS, XE + 10, CS + 3.2, 0.15);
    area(sc, 'walk', -XE - 10, CN - 3.2, XE + 10, CN, 0.15);
    curb(sc, -XE - 10, CS, XE + 10, CS, 0, -1); curb(sc, -XE - 10, CN, XE + 10, CN, 0, 1);
    sc.obs.push(box(-XE - 0.5, 0, 0.5, 6, 0, 'edge'), box(XE + 0.5, 0, 0.5, 6, 0, 'edge'));
    dashed(sc, -XE - 10, 0, XE + 10, 0, 0.12, 3, 3);
    dashed(sc, -XE - 10, LN, XE + 10, LN, 0.1, 1, 1.4);
    dashed(sc, -XE - 10, -LN, XE + 10, -LN, 0.1, 1, 1.4);
    sc.target = { type: 'slot', x0, x1, curb: CS, lane: LN, ang: Math.PI / 2 };
    const yS = (m) => CS - 0.28 - m.W / 2 + (r() - 0.5) * 0.1;
    const ang = () => Math.PI / 2 + (r() - 0.5) * 2.5 * DEG;
    // Boşluğun arkasındaki araçlar (batıya doğru) ve önündekiler (doğuya doğru)
    for (let x = x0, first = true; x > -XE + 3; first = false) {
      const kind = first ? wpick(r, KINDS_LOT) : wpick(r, KINDS_ST), m = MODEL[kind];
      addCar(sc, x - m.L / 2, yS(m), ang(), kind, colorFor(r, kind));
      x -= m.L + 0.8 + r() * (r() < 0.2 ? 3.5 : 0.9);
    }
    for (let x = x1, first = true; x < XE - 3; first = false) {
      const kind = first ? wpick(r, KINDS_LOT) : wpick(r, KINDS_ST), m = MODEL[kind];
      addCar(sc, x + m.L / 2, yS(m), ang(), kind, colorFor(r, kind));
      x += m.L + 0.8 + r() * (r() < 0.2 ? 3.5 : 0.9);
    }
    // Karşı taraftaki park şeridi (batıya bakan araçlar, aralıklı)
    for (let x = -XE + 4; x < XE - 4;) {
      const kind = wpick(r, KINDS_ST), m = MODEL[kind];
      if (r() < 0.7) addCar(sc, x + m.L / 2, CN + 0.28 + m.W / 2, -Math.PI / 2 + (r() - 0.5) * 2 * DEG, kind, colorFor(r, kind));
      x += m.L + 1 + r() * 2;
    }
    for (let x = -XE + 3; x < XE; x += 9) { sc.trees.push({ x: x + r() * 1.5, y: CS + 2.0, r: 1.3 + r() * 0.3, s: Math.floor(r() * 1e4) }); sc.trees.push({ x: x + 4.5 + r() * 1.5, y: CN - 2.0, r: 1.3 + r() * 0.3, s: Math.floor(r() * 1e4) }); }
    for (let x = -XE + 7; x < XE; x += 18) { sc.lamps.push({ x, y: CS + 2.6, ang: 0 }); sc.lamps.push({ x: x + 9, y: CN - 2.6, ang: Math.PI }); }
    buildings(sc, r, -XE - 14, XE + 14, CS + 4.2, CS + 17);
    buildings(sc, r, -XE - 14, XE + 14, CN - 17, CN - 4.2);
    sc.start = { x: x0 - 13, y: 1.65, ang: Math.PI / 2 };
    return sc;
  }

  /* =========================================================
     Ders durumu ve arayüz
     ========================================================= */
  let full = false;
  const stage = new G.Stage(host, {
    height: (w) => (full ? Math.round((window.visualViewport && visualViewport.height) || innerHeight)
      : w < 560 ? Math.round(clamp(w * 1.18, 380, 560)) : Math.round(clamp(w * 0.58, 380, 600)))
  });
  const k = (key) => $(`[data-k="${key}"]`, panel);
  function feedback(html, kind) { const fb = k('fb'); fb.innerHTML = html; fb.className = 'sim-feedback' + (kind ? ' ' + kind : ''); }
  // Hedef çubuğu: “Hedef ●●○ · Hata 0” — öteki uygulamalarla aynı
  const goal = (() => {
    const bx = k('goal');
    bx.innerHTML = `<span class="sg-l">Hedef</span><span class="sg-pips" role="img">${'<i></i>'.repeat(GOAL)}</span><span class="sg-err">Hata <b>0</b></span>`;
    const pips = $$('.sg-pips i', bx), err = $('.sg-err b', bx), wrap = $('.sg-pips', bx);
    let lastBad = 0;
    return {
      set(n, b) {
        pips.forEach((p, i) => p.classList.toggle('on', i < n));
        wrap.setAttribute('aria-label', `Hedef: ${Math.min(n, GOAL)} / ${GOAL}`);
        err.textContent = b;
        if (b > lastBad) { bx.classList.remove('err-pop'); void bx.offsetWidth; bx.classList.add('err-pop'); }
        lastBad = b;
        bx.classList.toggle('full', n >= GOAL);
      }
    };
  })();
  const stars = () => store.get(STAR_KEY, {});
  const starSVG = (n) => [1, 2, 3].map((i) => `<svg class="${i <= n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"/></svg>`).join('');
  const after = () => document.getElementById(shell.dataset.after || 'sorular');
  const AFTER_LABEL = shell.dataset.afterLabel || 'Sorulara geç';
  const goAfter = () => { if (full) setFull(false); const el = after(); if (el) el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' }); };
  const band = document.createElement('div');
  band.className = 'lesson-next';
  band.hidden = true;
  band.innerHTML = `<span class="ln-ok"><svg class="ic"><use href="#i-check"/></svg></span><b>Uygulama tamamlandı!</b><span class="ln-stars" role="img"></span><span class="ln-sub">İstersen park etmeye devam edebilirsin.</span><button type="button" class="ln-btn">${AFTER_LABEL}<svg class="ic"><use href="#i-arrow"/></svg></button>`;
  $('.lesson-main', panel).appendChild(band);
  $('.ln-btn', band).addEventListener('click', goAfter);
  function paintBand() {
    const n = stars()[ID] || 0;
    band.hidden = !n;
    const st = $('.ln-stars', band);
    st.innerHTML = n ? starSVG(n) : '';
    st.setAttribute('aria-label', n ? `En iyi sonuç: ${n} yıldız` : '');
  }

  // HUD
  const chipTask = stage.chip('l', 'gorev', 'Görev 1/3');
  const chipGear = stage.chip('r', 'vites', 'Vites · hız');
  const chipSens = stage.chip('r', 'sensor', 'Arka sensör');
  chipSens.show(false);

  // Dokunmatik denetimler: direksiyon (sol alt), el freni + ileri/geri pedalları (sağ alt)
  const ICON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 9h-4.5v5h-5v-5H5z"/></svg>';
  const ICON_DN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19l-7-9h4.5V5h5v5H19z"/></svg>';
  const WHEEL_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="41" fill="none" stroke="#1b1e25" stroke-width="12"/>
    <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.4"/>
    <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1.2"/>
    <path d="M12 52 Q50 42 88 52" fill="none" stroke="#1b1e25" stroke-width="10" stroke-linecap="round"/>
    <path d="M50 58 V90" fill="none" stroke="#1b1e25" stroke-width="10" stroke-linecap="round"/>
    <circle cx="50" cy="55" r="13" fill="#2a2f39" stroke="rgba(255,255,255,.28)" stroke-width="1.4"/>
    <path d="M50 47.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="rgba(255,255,255,.75)"/>
    <rect x="46" y="3.5" width="8" height="11" rx="2.5" fill="#ffc83d"/></svg>`;
  const ctl = document.createElement('div');
  ctl.className = 'ps-ctl';
  ctl.innerHTML = `<button class="ps-straight is-straight" type="button" aria-label="Direksiyonu düzelt (C)"><span class="ps-st-v">Düz</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="ps-wheel" role="slider" aria-label="Direksiyon (sol/sağ ok tuşları)" aria-valuemin="-540" aria-valuemax="540" aria-valuenow="0" aria-valuetext="Düz">${WHEEL_SVG}</div>
    <button class="ps-hb" type="button" aria-label="El frenini çek ve parkı bitir (P)"><b>P</b><small>El freni</small></button>
    <div class="ps-pedals"><button class="ps-ped" type="button" data-ped="fwd" aria-label="İleri git (yukarı ok)">${ICON_UP}<span>İleri</span></button><button class="ps-ped" type="button" data-ped="rev" aria-label="Geri git (aşağı ok)">${ICON_DN}<span>Geri</span></button></div>
    <button class="ps-exit" type="button"><svg class="ic"><use href="#i-x"/></svg><span>Küçült</span></button>`;
  stage.ui.appendChild(ctl);
  const wheelEl = $('.ps-wheel', ctl), wheelSvg = $('svg', wheelEl), hbBtn = $('.ps-hb', ctl);
  const straightBtn = $('.ps-straight', ctl), stVal = $('.ps-st-v', straightBtn);

  /* ---------- Durum ---------- */
  let sc = null, car = null, taskName = 'ileri', taskIdx = 0, seed = 1, hard = false, freeMode = false, gen = 0;
  let ok = 0, bad = 0, started = false, busy = false, visible = false;
  let view = store.get(VIEW_KEY, '3d') === '2d' ? '2d' : '3d';
  let stat = null, contact = 0, shake = 0, beepT = 0, sens = Infinity, sensDir = -1, ready = false, last = null;
  let wheelHeld = false, wheelLast = 0, orbit = null;
  const keys = new Set(), ped = { fwd: false, rev: false };
  const cam3 = { yaw: 0, off: 0, dist: 9.0, h: 3.8 };
  const cam2 = { x: 0, y: 0 };

  const TIPS = {
    ileri: ['Geçiş yolunun sağından, park yerine yaklaşırken <b>yavaşla</b>.',
      'Aracın önü park yerinin ilk çizgisine gelince direksiyonu park yerine doğru <b>sonuna kadar</b> çevir.',
      'Girerken iki yandaki araçlara uzaklığı izle; gerekirse dur, biraz geri gelip açını düzelt.',
      'Araç çizgilere paralel olunca direksiyonu düzelt; önündeki kaldırıma yaklaşmadan dur.'],
    geri: ['Park yerini geç; aracın arkası park yerinin uzak çizgisini <b>1–1,5 m</b> geçince dur.',
      '<b>Geri</b> gelirken direksiyonu park yerine doğru sonuna kadar çevir; yörünge çizgilerini izle.',
      'Araç park yerine paralel olunca direksiyonu düzelt, düz geri gel.',
      'Sensör sık ötmeye başlayınca yavaşla; kaldırıma değmeden dur.'],
    paralel: ['Öndeki aracın yanına, ona <b>0,5–1 m</b> uzaklıkta paralel gel; arka tamponlar hizalanınca dur.',
      '<b>Geri</b> gelirken direksiyonu sağa sonuna kadar çevir; araç yaklaşık <b>45°</b> olunca düzelt.',
      'Sol ön köşe öndeki aracın arka tamponunu geçince direksiyonu <b>sola</b> sonuna kadar çevir.',
      'Araç kaldırıma paralel olunca dur; gerekirse biraz ileri alıp ortala. Kaldırıma <b>50 cm</b>’den yakın ol.']
  };
  const GOAL_TXT = {
    ileri: 'Yeşil çerçeveli yere <b>önüyle</b> gir: <b>İleri</b>’ye basılı tutarak yaklaş, direksiyonu park yerine doğru çevir. Durunca <b>El freni</b>.',
    geri: 'Yeşil çerçeveli yere <b>geri geri</b> gir: yeri biraz geç, dur; <b>Geri</b>’ye basılı tutarak direksiyonu park yerine doğru çevir.',
    paralel: 'İki aracın arasına <b>paralel park</b> et: öndeki aracın yanına gel, dur; geri gelirken önce sağa, sonra sola kır.'
  };
  function paintTips() {
    const ol = k('tips');
    if (ol) ol.innerHTML = TIPS[taskName].map((t) => `<li>${t}</li>`).join('');
    const h = k('tips-h');
    if (h) h.textContent = NAME[taskName];
  }

  function load(name, s, isHard) {
    taskName = name; seed = s; hard = isHard; gen++;
    sc = name === 'paralel' ? streetScene(hard, seed) : lotScene(name, hard, seed);
    sc.id = name + seed + (hard ? 'h' : '');
    car = { x: sc.start.x, y: sc.start.y, ang: sc.start.ang, v: 0, gear: 'D', brake: false };
    wheelDeg = 0; contact = 0; shake = 0; sens = Infinity; ready = false; busy = false;
    stat = { t: 0, man: 0, hits: 0, dir: 0, moved: false, tries: 0 };
    cam3.yaw = car.ang; cam3.off = 0;
    const [tx, ty] = targetCenter();
    cam2.x = lerp(car.x, tx, 0.4); cam2.y = lerp(car.y, ty, 0.4);
    chipTask.label(freeMode ? 'Serbest park' : `Görev ${taskIdx + 1}/${GOAL}`).set(NAME[name]);
    paintTips();
    feedback(GOAL_TXT[name], '');
    hbBtn.classList.remove('ready');
  }
  function nextTask() {
    if (freeMode) { const n = SEQ[Math.floor(Math.random() * 3)]; load(n, Math.floor(Math.random() * 1e6), true); return; }
    taskIdx = Math.min(ok, GOAL - 1);
    load(SEQ[taskIdx], 11 + taskIdx * 7, false);
  }
  function resetAll() {
    ok = 0; bad = 0; freeMode = false; taskIdx = 0;
    goal.set(0, 0);
    load(SEQ[0], 11, false);
  }

  /* ---------- Park denetimi ---------- */
  const CORNER = ['sol ön', 'sağ ön', 'sağ arka', 'sol arka'];
  function check() {
    const t = sc.target, b = box(car.x, car.y, HW, HL, car.ang), cs = corners(b), f = [b.fx, b.fy];
    if (t.type === 'bay') {
      const ax = t.ax, px = [-ax[1], ax[0]];
      const cu = (car.x - t.x) * px[0] + (car.y - t.y) * px[1], cd = (car.x - t.x) * ax[0] + (car.y - t.y) * ax[1];
      if (Math.abs(cu) > t.hw + 1 || cd < -t.hd - 1.6 || cd > t.hd + 1) return { why: 'far' };
      const dot = f[0] * ax[0] + f[1] * ax[1];
      if (Math.abs(dot) > 0.5 && Math.sign(dot) !== t.want) return { why: t.want > 0 ? 'nose' : 'tail' };
      const ang = Math.acos(clamp(Math.abs(dot), 0, 1)) / DEG;
      if (ang > 15) return { why: 'ang', ang };
      const out = cs.map(([x, y]) => {
        const u = (x - t.x) * px[0] + (y - t.y) * px[1], d = (x - t.x) * ax[0] + (y - t.y) * ax[1];
        return Math.abs(u) > t.hw + 0.06 || d > t.hd + 0.1 || d < -t.hd - 0.25;
      });
      if (out.some(Boolean)) return { why: 'out', out };
      if (ang > 7) return { why: 'ang', ang };
      return { ok: true, off: Math.abs(cu), ang };
    }
    if (car.x < t.x0 - 4 || car.x > t.x1 + 4 || car.y < t.lane - 2.2) return { why: 'far' };
    const da = wrapA(car.ang - t.ang);
    if (Math.abs(da) > Math.PI / 2) return { why: 'dir' };
    const ang = Math.abs(da) / DEG;
    if (ang > 15) return { why: 'ang', ang };
    const out = cs.map(([x]) => x < t.x0 - 0.05 || x > t.x1 + 0.05);
    if (out.some(Boolean)) return { why: 'out', out };
    const ys = cs.map((c) => c[1]);
    if (Math.min(...ys) < t.lane - 0.3) return { why: 'lane' };
    if (ang > 6) return { why: 'ang', ang };
    const gap = t.curb - Math.max(...ys);
    if (gap > 0.5) return { why: 'curb', gap };
    return { ok: true, off: gap, ang };
  }
  function outMsg(out) {
    const s = out.map((o, i) => (o ? i : -1)).filter((i) => i >= 0), key = s.join('');
    const M = { '01': 'Aracın <b>önü</b> park yerinin dışında kaldı.', '23': 'Aracın <b>arkası</b> park yerinin dışında kaldı.', '03': 'Aracın <b>sol tarafı</b> çizgiyi aşıyor.', '12': 'Aracın <b>sağ tarafı</b> çizgiyi aşıyor.' };
    if (M[key]) return M[key];
    if (s.length === 1) return `Aracın <b>${CORNER[s[0]]}</b> köşesi park yerinin dışında.`;
    return 'Araç park yerine tam girmedi.';
  }
  function whyMsg(c) {
    switch (c.why) {
      case 'far': return 'Önce aracı <b>yeşil çerçeveli</b> park yerine sok, sonra el frenini çek.';
      case 'nose': return 'Bu görevde araç park yerine <b>önüyle (ileri)</b> girmeli.';
      case 'tail': return 'Bu görevde araç park yerine <b>geri geri</b> girmeli; aracın önü yola bakmalı.';
      case 'dir': return 'Araç yolun sağına, <b>trafik akışı yönünde</b> (ileriye bakarak) park edilmeli.';
      case 'out': return outMsg(c.out) + ' Biraz ileri–geri yaparak düzelt.';
      case 'lane': return 'Aracın sol tarafı yola taşıyor; <b>kaldırıma yaklaş</b>.';
      case 'ang': return `Araç park yerine göre <b>${Math.round(c.ang)}°</b> çapraz duruyor; ileri–geri yaparak düzelt.`;
      case 'curb': return `Kaldırıma <b>${tr(c.gap, 2)} m</b> uzaktasın; <b>50 cm</b>’den yakın olmalısın.`;
      default: return '';
    }
  }
  function handbrake() {
    if (!started || busy || stage.hasCard) return;
    if (Math.abs(car.v) > 0.05) { stage.toast('Önce aracı durdur', 'info', 1100); feedback('El frenini araç <b>tamamen durduktan sonra</b> çek: pedalları bırak ya da Boşluk ile fren yap.', ''); return; }
    const c = check();
    G.Sfx.play('tap');
    if (!c.ok) {
      stat.tries++;
      stage.toast('Henüz olmadı', 'info', 1100);
      feedback('✗ ' + whyMsg(c), 'bad');
      return;
    }
    success(c);
  }
  function success(c) {
    busy = true; car.gear = 'P'; car.v = 0;
    if (!freeMode) ok++;
    goal.set(Math.min(ok, GOAL), bad);
    G.Sfx.play('ok');
    stage.toast('✓ Park tamam!', 'ok', 1500);
    const q = sc.target.type === 'bay' ? `merkezden sapma ${Math.round(c.off * 100)} cm, açı ${Math.round(c.ang)}°` : `kaldırıma ${Math.round(c.off * 100)} cm, açı ${Math.round(c.ang)}°`;
    const st = `${stat.man} manevra · ${Math.round(stat.t)} sn · ${stat.hits ? stat.hits + ' çarpma' : 'çarpma yok'}`;
    feedback(`✓ ${NAME[taskName]} tamam! ${st}; ${q}.`, 'ok');
    const finishing = !freeMode && ok === GOAL, g = gen;
    setTimeout(() => {
      if (g !== gen) return;   // bu arada görev yeniden başlatıldı
      if (finishing) { finish(); return; }
      const nx = freeMode ? 'Yeni park yeri' : `Sonraki: ${NAME[SEQ[Math.min(ok, GOAL - 1)]]}`;
      stage.card({
        icon: '<svg class="ic"><use href="#i-check"/></svg>',
        title: `${NAME[taskName]} tamam!`,
        text: `${st}<br>${q[0].toUpperCase() + q.slice(1)}.`,
        buttons: [
          { label: `${nx} <svg class="ic"><use href="#i-arrow"/></svg>`, cls: 'btn-red', onClick: () => { stage.card(null); nextTask(); } },
          { label: 'Bu parkı tekrarla', cls: 'btn-ghost', onClick: () => { stage.card(null); load(taskName, seed, hard); } }
        ]
      });
    }, 1100);
  }
  function finish() {
    const n = bad === 0 ? 3 : bad <= 2 ? 2 : 1;
    const S = stars();
    if (!S[ID] || n > S[ID]) { S[ID] = n; store.set(STAR_KEY, S); }
    const done = store.get(DONE_KEY, []);
    if (!done.includes(ID)) { done.push(ID); store.set(DONE_KEY, done); }
    paintBand();
    document.dispatchEvent(new CustomEvent('yildiz-akademi', { detail: { id: ID } }));
    if (!full) FX().burstFrom(host);
    G.Sfx.play('win');
    stage.card({
      stars: n,
      title: n === 3 ? 'Kusursuz! Uygulama tamamlandı' : 'Uygulama tamamlandı!',
      text: `İleri, geri geri ve paralel parkı bitirdin${bad ? `; ${bad} kez çarptın` : ' ve hiç çarpmadın'}.` + (n < 3 ? ' <span class="sc-hint">Çarpmadan bitirirsen 3 yıldız alırsın.</span>' : ''),
      buttons: [
        { label: `${AFTER_LABEL} <svg class="ic"><use href="#i-arrow"/></svg>`, cls: 'btn-red', onClick: () => { stage.card(null); goAfter(); } },
        { label: 'Park etmeye devam et', cls: 'btn-ghost', onClick: () => { stage.card(null); freeMode = true; nextTask(); } }
      ]
    });
  }

  /* ---------- Çarpışma ve sensör ---------- */
  function hitAt(p) {
    const b = box(p.x, p.y, HW, HL, p.ang);
    for (const o of sc.obs) if (overlap(b, o)) return o;
    return null;
  }
  function onHit(o) {
    car.v = 0;
    const fresh = contact <= 0;
    contact = 0.8;
    if (!fresh) return;
    if (o.kind === 'edge') { stage.toast('Alanın sınırına geldin', 'info', 1100); return; }
    bad++; stat.hits++;
    goal.set(Math.min(ok, GOAL), bad);
    const what = o.kind === 'car' ? 'Park etmiş araca çarptın' : 'Kaldırıma çarptın';
    stage.toast('✗ ' + what, 'bad', 1500);
    feedback(`✗ ${what}. Gerçekte bu bir kaza olurdu: daha yavaş git, sensörü ve yörünge çizgilerini izle.`, 'bad');
    G.Sfx.play('thud'); G.Sfx.play('bad');
    if (!reduced) shake = 0.35;
  }
  function move(dt) {
    const dist = Math.abs(car.v) * dt;
    if (dist < 1e-6) return;
    const n = Math.ceil(dist / 0.03), d = (car.v * dt) / n;
    for (let i = 0; i < n; i++) {
      const np = integrate(car, d), o = hitAt(np);
      if (o) {
        // Temas noktasına yarılayarak yaklaş
        let lo = 0, hi = d;
        for (let j = 0; j < 5; j++) { const mid = (lo + hi) / 2; if (hitAt(integrate(car, mid))) hi = mid; else lo = mid; }
        if (lo) Object.assign(car, integrate(car, lo));
        onHit(o);
        return;
      }
      car.x = np.x; car.y = np.y; car.ang = np.ang;
    }
  }
  // Park sensörü: gidiş yönündeki tampon boyunca en yakın engel
  function sensor() {
    const dir = car.gear === 'R' ? -1 : 1, b = box(car.x, car.y, HW, HL, car.ang);
    let best = Infinity;
    for (const o of sc.obs) {
      if (o.kind === 'edge') continue;
      const dx = o.x - car.x, dy = o.y - car.y;
      if (dx * dx + dy * dy > (o.rad + 5) ** 2) continue;
      for (let u = -1; u <= 1; u += 0.5) {
        const px = car.x + b.rx * u * HW + b.fx * HL * dir, py = car.y + b.ry * u * HW + b.fy * HL * dir;
        const [qx, qy] = closest(o, px, py);
        // Yalnız tamponun önündeki (ya da arkasındaki) engeller: yandan geçen araçlar sayılmaz
        if (((qx - car.x) * b.fx + (qy - car.y) * b.fy) * dir < HL - 0.3 || Math.abs((qx - car.x) * b.rx + (qy - car.y) * b.ry) > HW + 0.35) continue;
        const dd = Math.hypot(qx - px, qy - py);
        if (dd < best) best = dd;
      }
    }
    sensDir = dir;
    return best;
  }

  /* ---------- Güncelleme ---------- */
  function update(dt) {
    // Direksiyon bırakılınca yerinde kalır; tuşla çevirirken ortadan geçerken kısa süre durur
    const kl = keys.has('left'), kr = keys.has('right');
    if (kl !== kr && !busy) {
      centering = false;
      if (detent > 0) detent -= dt;
      else {
        const prev = wheelDeg;
        wheelDeg = clamp(wheelDeg + (kr ? 1 : -1) * KEY_RATE * dt, -WHEEL_MAX, WHEEL_MAX);
        if (prev && Math.sign(prev) !== Math.sign(wheelDeg)) { wheelDeg = 0; detent = 0.35; buzz(); }
        else if (Math.abs(wheelDeg) === WHEEL_MAX && Math.abs(prev) < WHEEL_MAX) buzz();
      }
    } else {
      detent = 0;
      if (centering && !wheelHeld) { wheelDeg = toward0(wheelDeg, CENTER_RATE * dt); if (!wheelDeg) centering = false; }
    }
    const live = started && !busy && !stage.hasCard;
    const up = live && (keys.has('up') || ped.fwd), dn = live && (keys.has('down') || ped.rev), br = keys.has('brake');
    const want = up && !dn ? 1 : dn && !up ? -1 : 0;
    let v = car.v;
    car.brake = false;
    if (!live || br) { v = toward0(v, BRAKE * dt); car.brake = live && br; }
    else if (want > 0) { if (v < -0.01) { v = Math.min(0, v + BRAKE * dt); car.brake = true; } else { v = Math.min(VF, v + ACC * dt); car.gear = 'D'; } }
    else if (want < 0) { if (v > 0.01) { v = Math.max(0, v - BRAKE * dt); car.brake = true; } else { v = Math.max(-VR, v - ACC * dt); car.gear = 'R'; } }
    else { v = toward0(v, COAST * dt); car.brake = v !== 0; }
    car.v = v;
    move(dt);
    if (contact > 0) contact -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt);
    if (Math.abs(car.v) > 0.05 && live) {
      const d = Math.sign(car.v);
      if (d !== stat.dir) { stat.man++; stat.dir = d; }
      stat.moved = true;
    }
    if (stat.moved && live) stat.t += dt;
    // Sensör ve bip
    sens = sensor();
    const moving = Math.abs(car.v) > 0.03 || want !== 0;
    if (live && moving && sens < 1.6) {
      beepT -= dt;
      if (beepT <= 0) { G.Sfx.play('beat'); beepT = sens < 0.3 ? 0.075 : lerp(0.13, 0.62, (sens - 0.3) / 1.3); }
    } else beepT = 0;
    // Park yerinde mi? (canlı ipucu: çerçeve yeşile döner, El freni düğmesi parlar)
    ready = !!(started && !busy && check().ok);
    hbBtn.classList.toggle('ready', ready && Math.abs(car.v) < 0.05);
    // Kameralar
    const lookBack = car.gear === 'R';
    cam3.yaw += wrapA(car.ang + (lookBack ? Math.PI : 0) - cam3.yaw) * (1 - Math.exp(-dt * 2.6));
    if (!orbit && Math.abs(car.v) > 0.1) cam3.off *= Math.exp(-dt * 0.9);
    const f = [Math.sin(car.ang), -Math.cos(car.ang)], la = car.v * 0.9, [tx, ty] = targetCenter();
    const mixT = Math.hypot(tx - car.x, ty - car.y) < 30 ? 0.4 : 0;
    cam2.x += (lerp(car.x + f[0] * la, tx, mixT) - cam2.x) * (1 - Math.exp(-dt * 3));
    cam2.y += (lerp(car.y + f[1] * la, ty, mixT) - cam2.y) * (1 - Math.exp(-dt * 3));
    paintHud();
  }
  // Direksiyon konumu tur cinsinden: “½ tur sağa”, “Tam sola”, “Düz”
  function turnText(d) {
    const a = Math.abs(d);
    if (a < 12) return 'Düz';
    if (a >= WHEEL_MAX - 1) return d > 0 ? 'Tam sağa' : 'Tam sola';
    const q = Math.max(1, Math.round(a / 90));
    return `${['', '¼', '½', '¾', '1', '1¼', '1½'][q]} tur ${d > 0 ? 'sağa' : 'sola'}`;
  }
  const buzz = () => { if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) try { navigator.vibrate(12); } catch (e) { /* yoksay */ } };
  function paintHud() {
    const kmh = Math.round(Math.abs(car.v) * 3.6);
    const gt = car.gear === 'R' ? 'R · Geri' : car.gear === 'P' ? 'P · Park' : 'D · İleri';
    const key = gt + kmh;
    if (key !== last) { last = key; chipGear.set(`${gt} · ${kmh} km/sa`); }
    if (sens < 1.6 && started && !busy) {
      chipSens.show(true).label(sensDir < 0 ? 'Arka sensör' : 'Ön sensör');
      chipSens.set(sens < 0.05 ? 'DUR' : `${tr(sens, 2)} m`, sens < 0.35 ? '#ff8a80' : sens < 0.8 ? '#ffd166' : '#7df0a8');
    } else chipSens.show(false);
    const wv = Math.round(wheelDeg);
    wheelSvg.style.transform = `rotate(${wv}deg)`;
    if (wheelEl._v !== wv) {
      wheelEl._v = wv;
      const txt = turnText(wv);
      wheelEl.setAttribute('aria-valuenow', wv); wheelEl.setAttribute('aria-valuetext', txt);
      if (stVal.textContent !== txt) stVal.textContent = txt;
      straightBtn.classList.toggle('is-straight', Math.abs(wv) < 12);
      straightBtn.classList.toggle('is-lock', Math.abs(wv) >= WHEEL_MAX - 1);
    }
  }

  /* ---------- Hedef ve yörünge (iki görünüm ortak) ---------- */
  function targetPoly(pad = 0) {
    const t = sc.target;
    if (t.type === 'bay') {
      const ax = t.ax, px = [-ax[1], ax[0]], hw = t.hw - 0.08 + pad, hd = t.hd - 0.06 + pad;
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [t.x + px[0] * a * hw + ax[0] * b * hd, t.y + px[1] * a * hw + ax[1] * b * hd]);
    }
    return [[t.x0 + 0.1 - pad, t.lane + 0.1 - pad], [t.x1 - 0.1 + pad, t.lane + 0.1 - pad], [t.x1 - 0.1 + pad, t.curb - 0.12], [t.x0 + 0.1 - pad, t.curb - 0.12]];
  }
  const tColor = () => (ready ? '#1fbf6a' : '#ffc83d');
  function targetCenter() { const t = sc.target; return t.type === 'bay' ? [t.x, t.y] : [(t.x0 + t.x1) / 2, (t.lane + t.curb) / 2]; }
  // Yörünge çizgileri: direksiyonun şu anki açısıyla gidiş yönünde 5 m (geri vites kamerası gibi)
  function guidePts() {
    const dir = car.gear === 'R' ? -1 : 1, L = [], Rr = [];
    let p = { x: car.x, y: car.y, ang: car.ang };
    for (let s = 0; s <= 5.001; s += 0.25) {
      const f = [Math.sin(p.ang), -Math.cos(p.ang)], r = [Math.cos(p.ang), Math.sin(p.ang)];
      const bx = p.x + f[0] * HL * dir, by = p.y + f[1] * HL * dir;
      L.push([bx - r[0] * HW, by - r[1] * HW]); Rr.push([bx + r[0] * HW, by + r[1] * HW]);
      p = integrate(p, 0.25 * dir);
    }
    return [L, Rr];
  }
  const GUIDE_TICKS = [[4, '#ff5a4f'], [8, '#ffc83d'], [12, '#7df0a8']];

  /* =========================================================
     3B görünüm: WebGL (park-3d.js + three.js), ilk kullanımda yüklenir.
     Gökyüzü ve Kapadokya manzarası alttaki 2B tuvale academy-3d.js ile çizilir; ufuk WebGL kamerasıyla eşlenir.
     ========================================================= */
  const V = new R.View3D();
  let gl = null, glLoading = null, glFailed = false, glToast = false;
  function ensureGL() {
    if (gl || glLoading || glFailed) return glLoading;
    glLoading = import('./park-3d.js?v=1').then((m) => m.create()).then((g) => {
      gl = g;
      host.insertBefore(g.canvas, stage.ui);
      g.resize(stage.w, stage.h, stage.dpr);
      g.shadows(stage.narrow ? 1024 : 1536);
      g.canvas.hidden = view !== '3d';
    }).catch((e) => {
      console.error(e);
      glFailed = true;
      if (view === '3d') { setView('2d', true); stage.toast('3B görünüm bu cihazda açılamadı', 'info', 2200); }
      viewBtns.forEach((b) => { if (b.dataset.view === '3d') b.disabled = true; });
    });
    return glLoading;
  }
  stage.onResize((w, h) => { if (gl) gl.resize(w, h, stage.dpr); });
  // Uyarlanabilir kalite: çözünürlük en alta inmesine rağmen kareler yavaşsa gölgeleri kapat
  let glSlow = 0, glLow = false;
  function glQuality(dt) {
    if (glLow || !dt) return;
    glSlow = dt > 0.045 && stage.dpr <= 1 ? glSlow + dt : Math.max(0, glSlow - dt);
    if (glSlow > 2.5) { glLow = true; gl.shadows(0); }
  }
  function draw3(ctx, w, h, time) {
    if (!gl) {
      ensureGL();
      if (!glToast && started) { glToast = true; stage.toast('3B görünüm yükleniyor…', 'info', 1500); }
      draw2(ctx, w, h, time);
      return;
    }
    const P3 = R.palette(stage.night, 'dry');
    const yaw = cam3.yaw + cam3.off;
    const info = gl.frame({
      scene: Object.assign(sc, { targetPoly: targetPoly(), targetCenter: targetCenter() }), sceneKey: sc.id + (stage.night ? 'n' : 'd'), pal: P3,
      car: { x: car.x, y: car.y, ang: car.ang, v: car.v }, steer: steerRad(), brake: car.brake, rev: car.gear === 'R', night: stage.night,
      ready, busy, time, pulse: reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * 4), bob: reduced ? 0 : Math.sin(time * 3) * 0.18,
      guides: started && !busy ? guidePts() : null,
      cam: { yaw, dist: cam3.dist, h: cam3.h, jx: shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0, jy: shake > 0 ? (Math.random() - 0.5) * shake * 0.3 : 0 }
    }, w, h);
    // Gökyüzü (WebGL tuvalinin altında)
    V.viewport(0, 0, w, h, 0.3);
    V.cy = info.horizon; V.f = info.f;
    V.cam.yaw = yaw;
    R.drawSky(ctx, V, P3, time);
    ctx.fillStyle = P3.groundFar; ctx.fillRect(0, V.cy, w, h - V.cy);
  }

  /* =========================================================
     2B kuşbakışı görünüm (zemin ve park etmiş araçlar ekran dışı tuvale bir kez çizilir)
     ========================================================= */
  const V2 = new T.View2D();
  let bakeCv = null, bakeKey = '';
  const scale2 = (w, h) => (stage.narrow ? clamp(w / 20, 12, 28) : clamp(Math.min(w / 32, h / 20), 14, 34));
  function bake2(P, s) {
    const b = sc.bounds, W = (b.x1 - b.x0) * s, H = (b.y1 - b.y0) * s;
    const dpr = Math.min(stage.dpr, 4096 / W, 4096 / H);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vb = new T.View2D();
    vb.scale = s; vb.ox = -b.x0 * s; vb.oy = -b.y0 * s;
    x.save(); vb.apply(x);
    const D = T.D;
    for (const a of sc.areas) {
      const ax0 = Math.max(a.x0, b.x0 - 1), ay0 = Math.max(a.y0, b.y0 - 1), ax1 = Math.min(a.x1, b.x1 + 1), ay1 = Math.min(a.y1, b.y1 + 1);
      if (ax1 <= ax0 || ay1 <= ay0) continue;
      const args = [x, vb, P, ax0, ay0, ax1 - ax0, ay1 - ay0];
      if (a.t === 'asphalt') D.asphalt(...args);
      else if (a.t === 'walk') D.walk(...args);
      else if (a.t === 'grass' || a.t === 'plant') D.grass(...args);
      else D.earth(...args);
    }
    for (const c of sc.curbs) {
      const horiz = Math.abs(c.y1 - c.y0) < 0.01, x0 = Math.min(c.x0, c.x1), y0 = Math.min(c.y0, c.y1), len = horiz ? Math.abs(c.x1 - c.x0) : Math.abs(c.y1 - c.y0);
      x.fillStyle = P.curbShadow;
      if (horiz) x.fillRect(x0, c.ny > 0 ? c.y0 : c.y0 - 0.3, len, 0.3); else x.fillRect(c.nx > 0 ? c.x0 : c.x0 - 0.3, y0, 0.3, len);
      x.fillStyle = P.curb;
      if (horiz) x.fillRect(x0, c.ny > 0 ? c.y0 - 0.22 : c.y0, len, 0.22); else x.fillRect(c.nx > 0 ? c.x0 - 0.22 : c.x0, y0, 0.22, len);
    }
    x.fillStyle = alpha(P.roadLine, 0.92);
    for (const p of sc.paint) { x.beginPath(); p.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill(); }
    for (const bl of sc.blds) D.building(x, vb, P, bl.x0, bl.y0, bl.x1 - bl.x0, bl.y1 - bl.y0, { seed: bl.s, height: bl.h, roof: bl.roof });
    for (const c of sc.cars) {
      const sp = T.sprite(c.kind, c.color, s, P.night);
      x.save(); x.translate(c.x, c.y); x.rotate(c.ang); x.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); x.restore();
    }
    for (const t of sc.trees) D.tree(x, vb, P, t.x, t.y, t.r, t.s);
    for (const l of sc.lamps) { D.lamp(x, P, l.x, l.y, l.ang); if (P.night) D.lampGlow(x, P, l.x, l.y, l.ang, 6.5); }
    x.restore();
    return cv;
  }
  function draw2(ctx, w, h, time) {
    const P = T.palette(stage.night), s = scale2(w, h), b = sc.bounds;
    const key = [sc.id, s, stage.dpr, P.night ? 1 : 0].join('|');
    if (key !== bakeKey) { bakeCv = bake2(P, s); bakeKey = key; }
    const hwv = w / 2 / s, hhv = h / 2 / s;
    const cx = b.x1 - b.x0 <= hwv * 2 ? (b.x0 + b.x1) / 2 : clamp(cam2.x, b.x0 + hwv, b.x1 - hwv);
    const cy = b.y1 - b.y0 <= hhv * 2 ? (b.y0 + b.y1) / 2 : clamp(cam2.y, b.y0 + hhv, b.y1 - hhv);
    const jx = shake > 0 ? (Math.random() - 0.5) * shake * 8 : 0;
    V2.scale = s; V2.ox = Math.round(w / 2 - cx * s + jx); V2.oy = Math.round(h / 2 - cy * s);
    ctx.fillStyle = P.ground; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bakeCv, V2.X(b.x0), V2.Y(b.y0), (b.x1 - b.x0) * s, (b.y1 - b.y0) * s);
    ctx.save(); V2.apply(ctx);
    // Hedef
    const poly = targetPoly(), pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * 4);
    ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = alpha(tColor(), 0.14 + 0.12 * pulse); ctx.fill();
    ctx.strokeStyle = tColor(); ctx.lineWidth = 0.13; ctx.setLineDash(ready ? [] : [0.55, 0.35]); ctx.stroke(); ctx.setLineDash([]);
    const [tcx, tcy] = targetCenter();
    ctx.save(); ctx.translate(tcx, tcy);
    ctx.fillStyle = alpha('#ffffff', P.night ? 0.28 : 0.42); ctx.font = '800 1.9px "Plus Jakarta Sans", Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('P', 0, 0.1);
    ctx.restore();
    // Yörünge
    if (started && !busy) {
      const [L, Rr] = guidePts();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,214,90,.85)'; ctx.lineWidth = Math.max(0.07, 2 / s);
      for (const line of [L, Rr]) { ctx.beginPath(); line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
      for (const [i, col] of GUIDE_TICKS) { ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(L[i][0], L[i][1]); ctx.lineTo(Rr[i][0], Rr[i][1]); ctx.stroke(); }
    }
    // Sensör yayları
    if (started && sens < 1.6 && !busy) {
      const f = [Math.sin(car.ang), -Math.cos(car.ang)], bx = car.x + f[0] * HL * sensDir, by = car.y + f[1] * HL * sensDir;
      const col = sens < 0.35 ? '#ff5a4f' : sens < 0.8 ? '#ffc83d' : '#7df0a8';
      const base = Math.atan2(f[1] * sensDir, f[0] * sensDir), nArc = sens < 0.35 ? 3 : sens < 0.8 ? 2 : 1;
      ctx.strokeStyle = col; ctx.lineWidth = 0.12;
      for (let i = 0; i < nArc; i++) { ctx.globalAlpha = 0.9 - i * 0.22; ctx.beginPath(); ctx.arc(bx - f[0] * sensDir * 0.4, by - f[1] * sensDir * 0.4, 0.75 + i * 0.32, base - 0.75, base + 0.75); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    T.vehicle(ctx, V2, car.x, car.y, car.ang, { kind: 'player', brake: car.brake, night: P.night, head: P.night });
    if (car.gear === 'R') {
      const f = [Math.sin(car.ang), -Math.cos(car.ang)], r = [Math.cos(car.ang), Math.sin(car.ang)];
      ctx.globalCompositeOperation = 'lighter';
      for (const sd of [-1, 1]) G.glow(ctx, car.x - f[0] * (HL - 0.1) + r[0] * sd * 0.55, car.y - f[1] * (HL - 0.1) + r[1] * sd * 0.55, 0.9, '#ffffff', 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function draw(time) {
    if (!sc) return;
    const ctx = stage.begin();
    if (view === '3d') draw3(ctx, stage.w, stage.h, time); else draw2(ctx, stage.w, stage.h, time);
  }
  // Başlamadan önce 3B önizleme birkaç kare çizilip bekletilir (pil ve işlemci için)
  let idle = 0;
  const wake = () => { idle = 0; };
  const loop = G.loop((dt, t) => {
    stage.tick(dt);
    if (sc) update(dt);
    if (!started && view === '3d' && gl) { if (idle > 3) return; idle++; } else if (gl && view === '3d') glQuality(dt);
    draw(t / 1000);
  });
  stage.onResize(wake);
  stage.onTheme(wake);

  /* =========================================================
     Girdiler
     ========================================================= */
  // Direksiyon: simidi tutup döndür (fare / dokunma); bırakınca ortalanır
  const angOf = (e) => { const r = wheelEl.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  wheelEl.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    wheelHeld = true; wheelLast = angOf(e);
    try { wheelEl.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
    wheelEl.classList.add('is-held');
    if (!started) begin(view);
  });
  // Simit parmağın döndüğü kadar döner (1:1); merkeze yakın dokunuşlar ani sıçrama yapmasın diye sayılmaz
  wheelEl.addEventListener('pointermove', (e) => {
    if (!wheelHeld) return;
    const r = wheelEl.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const a = angOf(e);
    if (Math.hypot(dx, dy) < r.width * 0.16) { wheelLast = a; return; }
    const d = clamp(wrapA(a - wheelLast), -0.6, 0.6), prev = wheelDeg;
    wheelLast = a;
    centering = false;
    wheelDeg = clamp(wheelDeg + d / DEG, -WHEEL_MAX, WHEEL_MAX);
    if (Math.abs(wheelDeg) === WHEEL_MAX && Math.abs(prev) < WHEEL_MAX) buzz();
  });
  straightBtn.addEventListener('click', () => { centering = true; if (!started) begin(view); });
  const wheelUp = () => { wheelHeld = false; wheelEl.classList.remove('is-held'); };
  wheelEl.addEventListener('pointerup', wheelUp);
  wheelEl.addEventListener('pointercancel', wheelUp);
  wheelEl.addEventListener('lostpointercapture', wheelUp);
  for (const b of $$('.ps-ped', ctl)) {
    const which = b.dataset.ped;
    G.hold(b, () => { if (!started) begin(view); ped[which] = true; }, () => { ped[which] = false; });
  }
  hbBtn.addEventListener('click', handbrake);
  $('.ps-exit', ctl).addEventListener('click', () => setFull(false));
  // 3B: tuvali yatay sürükleyerek kamerayı aracın çevresinde döndür; çift tık ortalar
  const cv = stage.canvas;
  cv.addEventListener('pointerdown', (e) => {
    if (view !== '3d' || e.button > 0) return;
    orbit = { x: e.clientX, y: e.clientY, off: cam3.off, id: e.pointerId, moved: false };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!orbit || e.pointerId !== orbit.id) return;
    const dx = e.clientX - orbit.x;
    if (!orbit.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - orbit.y)) { orbit.moved = true; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ } }
    if (orbit.moved) cam3.off = orbit.off - dx * 0.008;
  });
  const orbitEnd = () => { orbit = null; };
  cv.addEventListener('pointerup', orbitEnd);
  cv.addEventListener('pointercancel', orbitEnd);
  cv.addEventListener('dblclick', () => { cam3.off = 0; });

  const CODES = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'brake' };
  function active() {
    if (!visible || document.documentElement.classList.contains('exam-open')) return false;
    if (full) return true;
    const r = host.getBoundingClientRect();
    return r.top < innerHeight * 0.7 && r.bottom > innerHeight * 0.3;
  }
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
    if (e.code === 'Escape' && full) { setFull(false); return; }
    if (!active() || stage.hasCard) return;
    const kk = CODES[e.code];
    if (kk) {
      if (kk === 'brake' && e.target.closest && e.target.closest('button:not(.ps-ped):not(.ps-hb), a')) return;
      e.preventDefault();
      keys.add(kk);
      if (!started) begin(view);
      return;
    }
    if (e.code === 'KeyP' || (e.code === 'Enter' && !(e.target.closest && e.target.closest('button, a')))) { e.preventDefault(); handbrake(); }
    else if (e.code === 'KeyV') { e.preventDefault(); setView(view === '3d' ? '2d' : '3d'); }
    else if (e.code === 'KeyC') { e.preventDefault(); centering = true; }
    else if (e.code === 'KeyF') { e.preventDefault(); setFull(!full); }
  });
  document.addEventListener('keyup', (e) => { const kk = CODES[e.code]; if (kk && keys.delete(kk) && active()) e.preventDefault(); });
  addEventListener('blur', () => { keys.clear(); ped.fwd = ped.rev = false; });

  /* ---------- Görünüm, tam ekran, başlangıç ---------- */
  const viewBtns = $$('[data-view]', panel);
  function setView(vw, quiet) {
    view = vw === '2d' ? '2d' : '3d';
    store.set(VIEW_KEY, view);
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    host.classList.toggle('sim-3d', view === '3d');
    if (gl) gl.canvas.hidden = view !== '3d';
    wake();
    if (view === '3d' && !quiet) ensureGL();
    cv.setAttribute('aria-label', view === '3d' ? 'Arkadan takip kamerasıyla park simülatörü (3B)' : 'Kuşbakışı park simülatörü (2B)');
    if (!quiet && started) stage.toast(view === '3d' ? '3B takip kamerası' : '2B kuşbakışı', 'info', 900);
  }
  viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  const fullBtn = $('[data-act="full"]', panel);
  function setFull(on) {
    if (on === full) return;
    full = on;
    host.classList.toggle('is-full', on);
    document.documentElement.classList.toggle('ps-lock', on);
    if (on) {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      if (!started) begin(view);
    } else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (fullBtn) $('span', fullBtn).textContent = on ? 'Küçült' : 'Tam ekran';
    requestAnimationFrame(() => stage.resize());
  }
  if (fullBtn) fullBtn.addEventListener('click', () => setFull(!full));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && full) setFull(false); else stage.resize(); });
  addEventListener('resize', () => { if (full) stage.resize(); });
  $('[data-act="retry"]', panel).addEventListener('click', () => { stage.card(null); load(taskName, seed, hard); started = true; G.Sfx.play('tap'); });
  $('[data-act="reset"]', panel).addEventListener('click', () => { stage.card(null); resetAll(); started = true; G.Sfx.play('tap'); });

  function begin(vw) {
    if (vw) setView(vw, true);
    started = true;
    stage.card(null);
    feedback(GOAL_TXT[taskName], '');
    G.Sfx.play('tap');
  }
  function intro() {
    const btn = (vw) => ({ label: vw === '3d' ? '3B ile başla' : '2B (kuşbakışı) başla', cls: view === vw ? 'btn-red' : 'btn-ghost', onClick: () => begin(vw) });
    stage.card({
      icon: '<svg class="ic"><use href="#i-wheel"/></svg>',
      title: 'Park simülatörü',
      text: 'Direksiyonu çevir; bıraktığında olduğu yerde kalır, <b>Düz</b> düğmesi ortalar. <b>İleri</b> ya da <b>Geri</b> pedalına basılı tut, aracı yeşil çerçeveli yere sok, durunca <b>El freni</b>’ni çek. Üç görev: ileri, geri geri ve paralel park.',
      keys: [['↑ ↓', 'İleri / geri'], ['← →', 'Direksiyon'], ['C', 'Direksiyonu düzelt'], ['Boşluk', 'Fren'], ['P', 'El freni'], ['V', '2B / 3B']],
      buttons: view === '3d' ? [btn('3d'), btn('2d')] : [btn('2d'), btn('3d')],
      focus: false
    });
  }

  // Ses düğmesi
  const snd = $('#ps-sound');
  if (snd) {
    const paint = (on) => { snd.setAttribute('aria-pressed', String(on)); $('use', snd).setAttribute('href', on ? '#i-sound' : '#i-mute'); $('span', snd).textContent = on ? 'Ses açık' : 'Ses kapalı'; };
    paint(G.Sfx.on);
    snd.addEventListener('click', () => G.Sfx.set(!G.Sfx.on));
    G.Sfx.onChange(paint);
  }
  stage.onTheme(() => { bakeKey = ''; });
  if ('IntersectionObserver' in window) {
    const pre = new IntersectionObserver(([e]) => { if (e.isIntersecting) { if (view === '3d') ensureGL(); pre.disconnect(); } }, { rootMargin: '700px 0px' });
    pre.observe(host);
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !document.hidden) loop.start(); else { loop.stop(); keys.clear(); ped.fwd = ped.rev = false; }
  }, { threshold: 0.05 }).observe(host);
  document.addEventListener('visibilitychange', () => { if (document.hidden) loop.stop(); else if (visible) loop.start(); });

  setView(view, true);
  resetAll();
  paintBand();
  intro();

  // Betikli denemeler için
  window.YildizParkSim = {
    debug: () => ({ gl: !!gl, glFailed, centering, task: taskName, ok, bad, started, busy, free: freeMode, view, full, ready, sens, wheel: wheelDeg, car: Object.assign({}, car), target: sc && sc.target, card: stage.hasCard, check: sc && check() }),
    pose(x, y, ang) { Object.assign(car, { x, y, ang, v: 0 }); },
    park: handbrake,
    start: (vw) => begin(vw || view),
    keys, ped, cam: cam3, gl: () => gl, scene: () => sc, lockQuality: () => { glLow = true; },
    setWheel: (d, hold = false) => { wheelDeg = clamp(d, -WHEEL_MAX, WHEEL_MAX); wheelHeld = hold; }
  };
})();
