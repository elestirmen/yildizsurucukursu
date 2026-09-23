/* Ürgüp Yıldız Sürücü Kursu — etkileşimler */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* depolama kapalı olabilir */ } }
  };
  const WA = '905324527722';
  const waLink = (text) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* ---------------- Üst menü ---------------- */
  const nav = $('#nav');
  const burger = $('.burger');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    document.documentElement.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  $$('#menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) setMenu(false); });

  const navLinks = $$('.nav-links > a[href^="#"]');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) navLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((l) => { const t = $(l.getAttribute('href')); if (t) spy.observe(t); });

  /* ---------------- Açık / kapalı durumu (İstanbul saati) ---------------- */
  const OPEN = 8 * 60 + 30, CLOSE = 17 * 60 + 30;
  function istanbulNow() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t).value;
      const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')];
      return { day, mins: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10) };
    } catch (e) {
      const d = new Date();
      return { day: d.getDay(), mins: d.getHours() * 60 + d.getMinutes() };
    }
  }
  function getStatus() {
    const { day, mins } = istanbulNow();
    const workday = day >= 1 && day <= 6;
    if (workday && mins >= OPEN && mins < CLOSE) {
      return { open: true, long: "Şu an açığız · 17:30'a kadar", short: "Açık · 17:30'a kadar", led: 'AÇIK', day };
    }
    if (workday && mins < OPEN) {
      return { open: false, long: "Şu an kapalıyız · Bugün 08:30'da açılıyoruz", short: "Kapalı · 08:30'da açılır", led: 'KAPALI', day };
    }
    const next = day === 6 ? 'Pazartesi' : 'Yarın';
    return { open: false, long: `Şu an kapalıyız · ${next} 08:30'da açılıyoruz`, short: `Kapalı · ${next} 08:30`, led: 'KAPALI', day };
  }
  function paintStatus() {
    const s = getStatus();
    $$('[data-status]').forEach((el) => {
      el.classList.toggle('closed', !s.open);
      const span = el.querySelector('span');
      if (span) span.textContent = el.dataset.status === 'short' ? s.short : s.long;
    });
    const led = $('[data-led]');
    if (led) { led.classList.toggle('off', !s.open); $('[data-led-text]').textContent = s.led; }
    $$('#hours-list li').forEach((li) => li.classList.toggle('today', Number(li.dataset.day) === s.day));
  }
  paintStatus();
  setInterval(paintStatus, 60 * 1000);

  /* ---------------- Görünür olunca belir ---------------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el) => revealIO.observe(el));

  /* ---------------- Hero: kaydırma efektleri ---------------- */
  const hero = $('.hero');
  const heroContent = $('.hero-content');
  const quickbar = $('.quickbar');
  new IntersectionObserver(([e]) => hero.classList.toggle('paused', !e.isIntersecting)).observe(hero);

  let ticking = false;
  function onScroll() {
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 30);
    quickbar.classList.toggle('show', y > innerHeight * 0.75);
    if (!reduced && y < innerHeight * 1.3) {
      heroContent.style.transform = `translate3d(0, ${(y * 0.28).toFixed(1)}px, 0)`;
      heroContent.style.opacity = String(Math.max(0, 1 - y / (innerHeight * 0.8)));
    }
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // Kaydırırken araç hızlanır (Web Animations API ile oynatma hızı)
  if (!reduced && typeof document.getAnimations === 'function') {
    let boost = 0, lastY = scrollY, raf = 0, anims = [];
    const collect = () => { anims = $$('.layer i, .lane, .car .spin').flatMap((el) => el.getAnimations()); };
    setTimeout(collect, 600);
    const tick = () => {
      boost *= 0.9;
      const rate = 1 + boost;
      anims.forEach((a) => { a.playbackRate = rate; });
      if (boost > 0.02) raf = requestAnimationFrame(tick);
      else { anims.forEach((a) => { a.playbackRate = 1; }); raf = 0; }
    };
    addEventListener('scroll', () => {
      const dy = Math.abs(scrollY - lastY);
      lastY = scrollY;
      if (hero.classList.contains('paused') || !anims.length) return;
      boost = Math.min(5, boost + dy / 45);
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  }

  /* ---------------- Gösterge paneli ---------------- */
  const polar = (cx, cy, r, deg) => { const a = (deg * Math.PI) / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const trNum = (n, d) => n.toFixed(d).replace('.', ',');
  let gid = 0;
  function buildGauge(el) {
    const v = parseFloat(el.dataset.value), max = parseFloat(el.dataset.max);
    const ticks = parseInt(el.dataset.ticks, 10), dec = parseInt(el.dataset.decimals, 10) || 0;
    const cx = 100, cy = 100, r = 80, id = 'gg' + (++gid);
    const [sx, sy] = polar(cx, cy, r, 210), [ex, ey] = polar(cx, cy, r, -30);
    const arc = `M${sx.toFixed(2)} ${sy.toFixed(2)} A${r} ${r} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
    const len = 2 * Math.PI * r * (240 / 360);
    const minor = ticks * 5;
    let marks = '';
    for (let i = 0; i <= minor; i++) {
      const deg = 210 - (240 * i) / minor, major = i % 5 === 0;
      const [x1, y1] = polar(cx, cy, r - 13, deg), [x2, y2] = polar(cx, cy, r - (major ? 25 : 19), deg);
      marks += `<line class="g-tick${major ? ' major' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
      if (major) {
        const [tx, ty] = polar(cx, cy, r - 36, deg);
        marks += `<text class="g-num" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}">${Math.round((max * i) / minor)}</text>`;
      }
    }
    el.innerHTML =
      `<svg viewBox="0 0 200 168" role="img" aria-label="${trNum(v, dec)} / ${max}">` +
      `<defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffc83d"/><stop offset="1" stop-color="#ff4a3d"/></linearGradient></defs>` +
      `<path class="g-track" d="${arc}"/>` +
      `<path class="g-val" d="${arc}" stroke="url(#${id})" style="stroke-dasharray:${len.toFixed(1)};stroke-dashoffset:${len.toFixed(1)}"/>` +
      marks +
      `<g class="g-needle"><path d="M100 34 104.5 100h-9z" fill="#ff4a3d"/><circle cx="100" cy="100" r="9" fill="#e9ecef"/><circle cx="100" cy="100" r="3.5" fill="#16171b"/></g>` +
      `<text class="g-value" x="100" y="160">${trNum(0, dec)}</text></svg>`;
    el._run = () => {
      const val = $('.g-val', el), needle = $('.g-needle', el), txt = $('.g-value', el);
      val.style.strokeDashoffset = (len * (1 - v / max)).toFixed(1);
      needle.style.transform = `rotate(${(-120 + 240 * (v / max)).toFixed(1)}deg)`;
      if (reduced) { txt.textContent = trNum(v, dec); return; }
      const t0 = performance.now(), dur = 1800;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        txt.textContent = trNum(v * easeOut(k), dec);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
  }
  const gauges = $$('.gauge');
  gauges.forEach(buildGauge);
  const gear = $$('.gear span');
  let gearIdx = 0, gearTimer = 0;
  const gearStep = () => { gear.forEach((s, i) => s.classList.toggle('on', i === gearIdx)); gearIdx = (gearIdx + 1) % gear.length; };
  new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        gauges.forEach((g) => { if (g._run) { const run = g._run; g._run = null; setTimeout(run, 250); } });
        if (!gearTimer && gear.length) { gearStep(); if (!reduced) gearTimer = setInterval(gearStep, 1100); }
      } else if (gearTimer) { clearInterval(gearTimer); gearTimer = 0; }
    });
  }, { threshold: 0.35 }).observe($('.dash'));

  /* ---------------- Kartlarda 3B eğim ---------------- */
  if (finePointer && !reduced) {
    $$('.tilt').forEach((card) => {
      card.addEventListener('pointerenter', () => { card.style.transition = 'transform .15s ease-out, border-color .3s, box-shadow .3s'; });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.transform = `perspective(1000px) rotateX(${((0.5 - py) * 7).toFixed(2)}deg) rotateY(${((px - 0.5) * 9).toFixed(2)}deg) translateY(-4px)`;
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', () => { card.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1), border-color .3s, box-shadow .3s'; card.style.transform = ''; });
    });
  }

  /* ---------------- Ön kayıt formuna yönlendirme ---------------- */
  const form = $('#apply');
  const focusForm = (course) => {
    if (course) {
      const radio = $$('input[name="egitim"]', form).find((r) => r.value === course);
      if (radio) radio.checked = true;
    }
    setTimeout(() => { const f = form.elements.ad; if (f) f.focus({ preventScroll: true }); }, 700);
  };
  $$('[data-wa]').forEach((a) => a.addEventListener('click', () => focusForm(a.dataset.wa)));
  $$('[data-kayit]').forEach((a) => a.addEventListener('click', () => focusForm(null)));

  /* ---------------- Yaş hesaplayıcı ---------------- */
  const CLASSES = [
    { k: 'M', name: 'Moped', age: 16, desc: '50 cm³ ve 45 km/s\'e kadar motorlu bisiklet' },
    { k: 'A1', name: 'Hafif motosiklet', age: 16, desc: '125 cm³ ve 11 kW\'a kadar', ours: true },
    { k: 'B1', name: 'Dört tekerlekli motosiklet', age: 16, desc: 'ATV / quad tipi araçlar' },
    { k: 'A2', name: 'Orta sınıf motosiklet', age: 18, desc: '35 kW\'a kadar motosiklet', ours: true },
    { k: 'B', name: 'Otomobil', age: 18, desc: 'Otomobil ve kamyonet', ours: true },
    { k: 'BE', name: 'Otomobil + römork', age: 18, desc: 'B sınıfı araç ve römork' },
    { k: 'C1', name: 'Hafif kamyon', age: 18, desc: '3.500–7.500 kg kamyon' },
    { k: 'F', name: 'Traktör', age: 18, desc: 'Lastik tekerlekli traktör' },
    { k: 'A', name: 'Tüm motosikletler', age: 20, alt: 24, desc: '20: 2 yıllık A2 ile · 24: deneyimsiz', ours: true },
    { k: 'C', name: 'Kamyon', age: 21, desc: 'Kamyon ve çekici' },
    { k: 'D1', name: 'Minibüs', age: 21, desc: 'Minibüs' },
    { k: 'D', name: 'Otobüs', age: 24, desc: 'Otobüs' }
  ];
  const board = $('#age-board'), birthInput = $('#birth'), summary = $('#age-summary');
  const addYears = (d, n) => new Date(d.getFullYear() + n, d.getMonth(), d.getDate());
  function diffYMD(a, b) {
    let y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth(), d = b.getDate() - a.getDate();
    if (d < 0) { m -= 1; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
    if (m < 0) { y -= 1; m += 12; }
    return { y, m, d };
  }
  const fmtDiff = ({ y, m, d }) => { const p = []; if (y) p.push(`${y} yıl`); if (m) p.push(`${m} ay`); if (d || !p.length) p.push(`${d} gün`); return p.join(' '); };
  const fmtDate = (dt) => dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const ICON = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;
  birthInput.max = new Date().toISOString().slice(0, 10);

  function renderAge() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let birth = null;
    if (birthInput.value) {
      const [Y, M, D] = birthInput.value.split('-').map(Number);
      const b = new Date(Y, M - 1, D);
      if (Y >= 1900 && b <= today) birth = b;
    }
    const age = birth ? diffYMD(birth, today).y : null;
    let okCount = 0, next = null;
    board.innerHTML = CLASSES.map((c) => {
      let cls = 'idle', st = `<span>${c.desc}</span>`;
      if (birth) {
        const need = c.age;
        if (c.alt && age >= c.alt) { cls = 'ok'; st = `${ICON('i-check')}<span>Alabilirsin</span>`; okCount++; }
        else if (c.alt && age >= need) { cls = 'soft'; st = `${ICON('i-check')}<span>2 yıllık A2 belgenle alabilirsin</span>`; okCount++; }
        else if (age >= need) { cls = 'ok'; st = `${ICON('i-check')}<span>Alabilirsin</span>`; okCount++; }
        else {
          const when = addYears(birth, need);
          cls = 'wait';
          st = `${ICON('i-clock')}<span>${fmtDiff(diffYMD(today, when))} sonra · ${fmtDate(when)}</span>`;
          if (!next || when < next.when) next = { k: c.k, when };
        }
      }
      return `<div class="cls ${cls}">${c.ours ? '<span class="ours">Kursumuzda</span>' : ''}` +
        `<div class="cls-k">${c.k}</div><div class="cls-n">${c.name}</div>` +
        `<div class="cls-age">${c.alt ? `${c.age} / ${c.alt} yaş` : `${c.age} yaş`}</div>` +
        `<div class="cls-st">${st}</div></div>`;
    }).join('');

    if (!birthInput.value) summary.textContent = 'Tarih girdiğinde sonuçlar burada belirecek.';
    else if (!birth) summary.textContent = 'Lütfen geçerli bir doğum tarihi gir.';
    else if (okCount === 0) summary.innerHTML = `<b>${age} yaşındasın.</b> 16 yaşını doldurduğunda M, A1 ve B1 sınıfları için başvurabilirsin — ${next ? `yani ${fmtDate(next.when)} tarihinde.` : ''}`;
    else if (!next) summary.innerHTML = `<b>${age} yaşındasın.</b> Listedeki tüm sınıflar için yaş şartını karşılıyorsun!`;
    else summary.innerHTML = `<b>${age} yaşındasın.</b> Şu an ${okCount} sınıf için yaş şartını karşılıyorsun. Sıradaki: <b>${next.k}</b> sınıfı, ${fmtDate(next.when)}.`;
  }
  birthInput.addEventListener('input', renderAge);
  birthInput.addEventListener('change', renderAge);
  renderAge();

  /* ---------------- Konfeti ---------------- */
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  let bits = [], confRAF = 0;
  function confetti(x, y, n = 150) {
    if (reduced) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#de2f29', '#ffc83d', '#1f5fd1', '#1fbf6a', '#ffffff', '#ff8a3d'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 9;
      bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 7, w: 6 + Math.random() * 6, h: 9 + Math.random() * 9, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length], t: 0 });
    }
    if (!confRAF) confRAF = requestAnimationFrame(drawConfetti);
  }
  function drawConfetti() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    bits.forEach((p) => {
      p.t++; p.vy += 0.28; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - p.t / 170); ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.t * 0.15)) + 1);
      ctx.restore();
    });
    bits = bits.filter((p) => p.t < 170 && p.y < innerHeight + 60);
    if (bits.length) confRAF = requestAnimationFrame(drawConfetti);
    else { confRAF = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  const burstFrom = (el) => { const r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2); };

  /* ---------------- Süreç: kaydırmayla ilerleyen araç ---------------- */
  const J = $('#journey');
  const roadSvg = $('.road-svg', J);
  const roadPaths = $$('path', roadSvg);
  const mainPath = $('.r-asphalt', roadSvg), donePath = $('.r-done', roadSvg);
  const marksG = $('.r-marks', roadSvg), carG = $('.r-car', roadSvg);
  const stepsEl = $$('.step', J);
  let total = 0, stepLens = [], built = false, carL = 0, targetL = 0, rafJ = 0, finished = false, jVisible = false, marks = [];

  function lenAtY(y) {
    let lo = 0, hi = total;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (mainPath.getPointAtLength(mid).y < y) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function buildRoad() {
    const W = J.clientWidth, H = J.offsetHeight;
    if (!W || !H) return;
    roadSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const mobile = W < 700;
    const cx = mobile ? 29 : W / 2, amp = mobile ? 7 : Math.min(72, W * 0.06);
    const top = J.getBoundingClientRect().top;
    const pts = [{ x: cx, y: 0 }];
    stepsEl.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      pts.push({ x: cx + (i % 2 ? amp : -amp), y: r.top - top + Math.min(r.height / 2, 90) });
    });
    pts.push({ x: cx, y: H });
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], k = (b.y - a.y) * 0.5;
      d += ` C${a.x.toFixed(1)} ${(a.y + k).toFixed(1)} ${b.x.toFixed(1)} ${(b.y - k).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }
    roadPaths.forEach((p) => p.setAttribute('d', d));
    total = mainPath.getTotalLength();
    const stops = pts.slice(1, -1);
    stepLens = stops.map((p) => lenAtY(p.y));
    const rr = mobile ? 13 : 18;
    marksG.innerHTML = stops.map((p, i) => `<g class="r-mark" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})"><circle class="bg" r="${rr}"/><text>${i + 1}</text></g>`).join('');
    marks = $$('.r-mark', marksG);
    // Bitiş çizgisi: son duraktan biraz sonra, yola dik damalı şerit
    const fl = Math.min(total - 2, stepLens[stepLens.length - 1] + (mobile ? 30 : 44));
    const f1 = mainPath.getPointAtLength(fl), f2 = mainPath.getPointAtLength(fl + 1);
    const fa = (Math.atan2(f2.y - f1.y, f2.x - f1.x) * 180) / Math.PI + 90, fw = mobile ? 33 : 57;
    $('.r-finish', roadSvg).innerHTML = `<rect x="${-fw / 2}" y="-7" width="${fw}" height="14" fill="url(#checker)" transform="translate(${f1.x.toFixed(1)} ${f1.y.toFixed(1)}) rotate(${fa.toFixed(1)})"/>`;
    built = true;
    updateRoad(true);
  }
  function updateRoad(instant) {
    if (!built) return;
    const rect = J.getBoundingClientRect();
    const y = Math.max(0, Math.min(J.offsetHeight, innerHeight * 0.62 - rect.top));
    targetL = lenAtY(y);
    if (instant === true || reduced) carL = targetL;
    if (!rafJ) rafJ = requestAnimationFrame(driveCar);
  }
  function driveCar() {
    rafJ = 0;
    carL += (targetL - carL) * 0.16;
    if (Math.abs(targetL - carL) < 0.4) carL = targetL;
    const L = Math.max(0.01, Math.min(total - 1, carL));
    const p = mainPath.getPointAtLength(L), q = mainPath.getPointAtLength(L + 1);
    const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + 90;
    const sc = J.clientWidth < 700 ? 0.72 : 1;
    carG.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${sc})`);
    donePath.style.strokeDasharray = `${Math.max(0, carL).toFixed(1)} ${(total + 50).toFixed(0)}`;
    stepLens.forEach((len, i) => {
      const on = carL >= len - 6;
      if (marks[i]) marks[i].classList.toggle('done', on);
      stepsEl[i].classList.toggle('active', on);
    });
    if (!finished && stepLens.length && carL >= stepLens[stepLens.length - 1] - 6) {
      finished = true;
      const fc = $('.step-final .step-card'), fr = fc.getBoundingClientRect();
      if (fr.top < innerHeight && fr.bottom > 0) burstFrom(fc);
    }
    if (carL !== targetL) rafJ = requestAnimationFrame(driveCar);
  }
  new IntersectionObserver(([e]) => { jVisible = e.isIntersecting; if (jVisible) updateRoad(); }, { rootMargin: '200px 0px' }).observe(J);
  addEventListener('scroll', () => { if (jVisible) updateRoad(); }, { passive: true });
  let rbT = 0;
  const rebuild = () => { clearTimeout(rbT); rbT = setTimeout(buildRoad, 120); };
  addEventListener('resize', rebuild);
  if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(J);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildRoad);
  addEventListener('load', buildRoad);
  buildRoad();

  /* ---------------- Evrak listesi ---------------- */
  const KEY = 'yildiz-evrak-v1';
  const saved = store.get(KEY, {});
  const checks = $$('#checklist input');
  const pCard = $('.progress-card');
  const MSGS = ['Hadi başlayalım!', 'Güzel başlangıç!', 'İyi gidiyorsun.', 'Yarıyı geçtin!', 'Son bir belge kaldı!', 'Harika! Evrakların tamam, seni bekliyoruz 🎉'];
  function paintDocs(fromUser) {
    const req = checks.filter((c) => c.hasAttribute('data-req'));
    const done = req.filter((c) => c.checked).length;
    $('#docs-count').textContent = `${done}/${req.length}`;
    $('#ring-fg').style.strokeDashoffset = (2 * Math.PI * 50 * (1 - done / req.length)).toFixed(2);
    $('#docs-msg').textContent = MSGS[Math.min(done, MSGS.length - 1)];
    const complete = done === req.length;
    if (fromUser && complete && !pCard.classList.contains('done')) burstFrom(pCard);
    pCard.classList.toggle('done', complete);
  }
  checks.forEach((c) => {
    c.checked = !!saved[c.dataset.doc];
    c.addEventListener('change', () => { saved[c.dataset.doc] = c.checked; store.set(KEY, saved); paintDocs(true); });
  });
  paintDocs(false);

  /* ---------------- Deneme sınavı ---------------- */
  const octagon = (R) => Array.from({ length: 8 }, (_, i) => {
    const a = ((22.5 + i * 45) * Math.PI) / 180;
    return `${(50 + R * Math.cos(a)).toFixed(2)},${(50 - R * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  const FONT = 'font-family="Archivo, Arial, sans-serif"';
  const V = {
    dur: `<svg viewBox="0 0 100 100"><polygon points="${octagon(49)}" fill="#fff"/><polygon points="${octagon(45)}" fill="#d71920"/><polygon points="${octagon(41.5)}" fill="none" stroke="#fff" stroke-width="1.8"/><text x="50" y="51" ${FONT} font-weight="900" font-size="27" fill="#fff" text-anchor="middle" dominant-baseline="central">DUR</text></svg>`,
    yolver: `<svg viewBox="0 0 100 100"><polygon points="6,12 94,12 50,90" fill="#d71920" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><polygon points="21.4,21 78.6,21 50,71.7" fill="#fff"/></svg>`,
    girisyok: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#fff"/><circle cx="50" cy="50" r="45" fill="#d71920"/><rect x="17" y="41.5" width="66" height="17" rx="1.5" fill="#fff"/></svg>`,
    hiz50: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#fff"/><circle cx="50" cy="50" r="46" fill="#d71920"/><circle cx="50" cy="50" r="35" fill="#fff"/><text x="50" y="52" ${FONT} font-weight="800" font-size="36" fill="#111" text-anchor="middle" dominant-baseline="central">50</text></svg>`,
    parkyok: `<svg viewBox="0 0 100 100"><defs><clipPath id="pc"><circle cx="50" cy="50" r="44"/></clipPath></defs><circle cx="50" cy="50" r="48" fill="#fff"/><circle cx="50" cy="50" r="46" fill="#d71920"/><circle cx="50" cy="50" r="36" fill="#1e5aa8"/><line x1="18" y1="18" x2="82" y2="82" stroke="#d71920" stroke-width="9" clip-path="url(#pc)"/></svg>`,
    anayol: `<svg viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" rx="3" transform="rotate(45 50 50)" fill="#fff" stroke="#333" stroke-width="1.2"/><rect x="29" y="29" width="42" height="42" transform="rotate(45 50 50)" fill="#f7c600"/></svg>`,
    sehir: `<svg viewBox="0 0 100 100"><rect x="4" y="18" width="92" height="64" rx="8" fill="#fff" stroke="#111" stroke-width="3"/><rect x="10" y="24" width="80" height="52" rx="4" fill="none" stroke="#111" stroke-width="1.5"/><text x="50" y="51" ${FONT} font-weight="900" font-size="20" fill="#111" text-anchor="middle" dominant-baseline="central">ÜRGÜP</text></svg>`,
    bolunmus: `<svg viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" rx="18" fill="#2a2c32"/><path d="M50 8v84" stroke="#6ba34f" stroke-width="10"/><path d="M26 10v80M74 10v80" stroke="#fff" stroke-width="3" stroke-dasharray="10 9"/><path d="M8 8v84M92 8v84" stroke="#fff" stroke-width="2.5"/></svg>`,
    ilkyardim: `<svg viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="18" fill="#0f8a4a"/><path d="M40 20h20v20h20v20H60v20H40V60H20V40h20z" fill="#fff"/></svg>`,
    polis: `<svg viewBox="0 0 100 100"><rect x="30" y="4" width="40" height="92" rx="14" fill="#1b1c20"/><circle cx="50" cy="24" r="10" fill="#ff3b30"/><circle cx="50" cy="50" r="10" fill="#3a3c42"/><circle cx="50" cy="76" r="10" fill="#34c759"/><path d="M78 30c8 4 14 10 16 18M78 44c4 2 7 5 8 9" stroke="#ffc83d" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
    abs: `<svg viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" rx="22" fill="#16171b"/><circle cx="50" cy="50" r="24" fill="none" stroke="#ffb020" stroke-width="5"/><path d="M20 30a36 36 0 0 0 0 40M80 30a36 36 0 0 1 0 40" stroke="#ffb020" stroke-width="5" fill="none" stroke-linecap="round"/><text x="50" y="51" ${FONT} font-weight="900" font-size="16" fill="#ffb020" text-anchor="middle" dominant-baseline="central">ABS</text></svg>`,
    yaya: `<svg viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="10" fill="#1e5aa8"/><polygon points="50,14 88,82 12,82" fill="#fff"/><circle cx="52" cy="38" r="5" fill="#111"/><path d="M50 45l-6 14 7 4-3 14M50 45l8 9 7 1M44 59l-8 16" stroke="#111" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 78h48" stroke="#111" stroke-width="4" stroke-dasharray="6 4"/></svg>`
  };
  const POOL = [
    { v: 'dur', q: 'Bu trafik işareti sürücüye neyi bildirir?', o: ['Dur: tamamen durmadan geçme', 'Yol ver', 'Park etmek yasaktır', 'Taşıt giremez'], a: 0, e: 'Kırmızı sekizgen DUR levhasında tamamen durulur; yol kontrol edilip geçiş hakkı olanlara yol verildikten sonra geçilir.' },
    { v: 'yolver', q: 'Kavşağa yaklaşırken bu işaretle karşılaşan sürücü ne yapmalıdır?', o: ['Hızını artırıp önce geçmeli', 'Hızını azaltıp geçiş hakkı olan araçlara yol vermeli', 'Korna çalarak geçmeli', 'Her durumda durup bir dakika beklemeli'], a: 1, e: 'Ters üçgen “Yol ver” işaretidir. Hız azaltılır, gerekirse durulur ve geçiş hakkı olan araçlara yol verilir.' },
    { v: 'girisyok', q: 'Bu işaret neyi bildirir?', o: ['Tek yönlü yol', 'Girişi olmayan yol', 'Duraklamak yasaktır', 'Ana yol bitti'], a: 1, e: 'Kırmızı daire içindeki beyaz yatay bant “Girişi olmayan yol” anlamına gelir; bu yöne taşıtla girilemez.' },
    { v: 'hiz50', q: 'Bu işaret neyi bildirir?', o: ['Asgari hız sınırı 50 km/s', 'Azami hız sınırı 50 km/s', '50 metre sonra kavşak', 'Tavsiye edilen hız 50 km/s'], a: 1, e: 'Kırmızı çerçeveli yuvarlak levha azami hızı gösterir. Asgari hız levhaları mavi zeminlidir.' },
    { v: 'parkyok', q: 'Bu işaret neyi bildirir?', o: ['Duraklamak ve park etmek yasaktır', 'Park etmek yasaktır', 'Girişi olmayan yol', 'Taşıt trafiğine kapalı yol'], a: 1, e: 'Mavi zemin üzerindeki tek çapraz çizgi park yasağını gösterir. Çarpı (X) şeklinde iki çizgi varsa duraklamak da yasaktır.' },
    { v: 'anayol', q: 'Sarı eşkenar dörtgen şeklindeki bu işaret neyi bildirir?', o: ['Ana yol', 'Ana yol bitti', 'Dikkat, kavşak var', 'Yol çalışması'], a: 0, e: 'Bu levha “Ana yol”u gösterir; kavşaklarda geçiş hakkı sizdedir. Yine de dikkatli olunmalıdır.' },
    { v: 'sehir', q: 'Yerleşim yeri içinde, aksine bir işaret yoksa otomobiller için azami hız kaç km/s\'tir?', o: ['30', '50', '70', '90'], a: 1, e: 'Yerleşim yeri içinde otomobiller için azami hız 50 km/s\'tir.' },
    { v: 'bolunmus', q: 'Yerleşim yeri dışındaki bölünmüş yollarda otomobiller için azami hız kaç km/s\'tir?', o: ['90', '100', '110', '130'], a: 2, e: 'Bölünmüş yollarda otomobiller için azami hız 110, otoyollarda 120 km/s\'tir.' },
    { v: 'ilkyardim', q: 'Yetişkin bir kazazedeye temel yaşam desteği uygulanırken göğüs basısı ve suni solunum hangi oranda yapılır?', o: ['15 : 2', '30 : 2', '5 : 1', '30 : 1'], a: 1, e: 'Yetişkinlerde 30 göğüs basısının ardından 2 suni solunum yapılır.' },
    { v: 'polis', q: 'Trafik görevlisinin işareti ile trafik ışığı farklı şeyler gösteriyorsa sürücü hangisine uyar?', o: ['Trafik ışığına', 'Trafik görevlisine', 'Trafik levhalarına', 'Kendi değerlendirmesine'], a: 1, e: 'Öncelik sırası: trafik görevlisi, ışıklı işaretler, trafik işaretleri ve son olarak trafik kuralları.' },
    { v: 'abs', q: 'Göstergede uyarı lambası da bulunan ABS sistemi ne işe yarar?', o: ['Yakıt tüketimini azaltır', 'Ani frenlemede tekerleklerin kilitlenmesini önler', 'Motor hararetini düşürür', 'Lastik basıncını ölçer'], a: 1, e: 'ABS ani frenlemede tekerleklerin kilitlenmesini önler; böylece fren yaparken direksiyon hâkimiyeti korunur.' },
    { v: 'yaya', q: 'Yaya geçidine yaklaşırken geçitte karşıya geçen bir yaya varsa sürücü ne yapmalıdır?', o: ['Korna çalarak uyarmalı', 'Hızlanıp yayadan önce geçmeli', 'Durup yayaya yol vermeli', 'Selektör yaparak geçmeli'], a: 2, e: 'Yaya geçitlerinde öncelik yayalarındır; sürücü durarak yayaya yol verir.' }
  ];
  const quiz = $('#quiz');
  const screens = $$('.quiz-screen', quiz);
  const show = (name) => screens.forEach((s) => s.classList.toggle('is-active', s.dataset.screen === name));
  const qNum = $('#q-num'), qTime = $('#q-time'), qProg = $('#q-prog'), qVis = $('#q-visual'), qText = $('#q-text'), qOpts = $('#q-opts'), qFb = $('#q-feedback'), qNext = $('#q-next');
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const N = 10;
  let set = [], idx = 0, correct = 0, answered = false, t0 = 0, timer = 0;
  const mmss = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const clockIcon = qTime.querySelector('svg').outerHTML;

  function startQuiz() {
    set = shuffle(POOL).slice(0, N).map((q) => {
      const order = shuffle(q.o.map((_, i) => i));
      return { ...q, opts: order.map((i) => q.o[i]), ans: order.indexOf(q.a) };
    });
    idx = 0; correct = 0;
    show('count');
    const tl = $('.q-count .tl', quiz), txt = $('.count-text', quiz);
    const seq = [['r', 'Kırmızı…'], ['y', 'Sarı…'], ['g', 'Yeşil, başla!']];
    const d = reduced ? 150 : 650;
    seq.forEach(([c, label], i) => setTimeout(() => { tl.className = 'tl tl-big ' + c; txt.textContent = label; }, i * d));
    setTimeout(() => {
      show('play'); t0 = Date.now(); clearInterval(timer);
      timer = setInterval(() => { qTime.innerHTML = clockIcon + mmss(Date.now() - t0); }, 500);
      renderQ();
    }, seq.length * d + 150);
  }
  function renderQ() {
    const q = set[idx];
    answered = false;
    qNum.textContent = `Soru ${idx + 1}/${N}`;
    qProg.style.width = `${(idx / N) * 100}%`;
    qVis.innerHTML = V[q.v] || '';
    qText.textContent = q.q;
    qOpts.innerHTML = q.opts.map((o, i) => `<button class="opt" type="button" data-i="${i}"><span class="k">${'ABCD'[i]}</span><span>${o}</span></button>`).join('');
    qFb.innerHTML = '';
    qNext.hidden = true;
    const first = qOpts.querySelector('.opt');
    if (first && finePointer) first.focus({ preventScroll: true });
  }
  function answer(i) {
    if (answered) return;
    answered = true;
    const q = set[idx], btns = $$('.opt', qOpts);
    btns.forEach((b, j) => {
      b.disabled = true;
      if (j === q.ans) b.classList.add('right');
      else if (j === i) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    const ok = i === q.ans;
    if (ok) correct++;
    qFb.innerHTML = `<b class="${ok ? 'ok' : 'no'}">${ok ? 'Doğru!' : 'Yanlış.'}</b> ${q.e}`;
    qProg.style.width = `${((idx + 1) / N) * 100}%`;
    qNext.hidden = false;
    qNext.innerHTML = idx === N - 1 ? 'Sonucu gör <svg class="ic"><use href="#i-flag"/></svg>' : 'Sonraki soru <svg class="ic"><use href="#i-arrow"/></svg>';
    qNext.focus({ preventScroll: true });
  }
  function nextQ() {
    if (!answered) return;
    if (idx < N - 1) { idx++; renderQ(); } else finish();
  }
  function finish() {
    clearInterval(timer);
    const took = mmss(Date.now() - t0), score = correct * 10;
    show('result');
    const ring = $('.score-ring', quiz), fg = $('#score-fg');
    ring.classList.toggle('pass', score >= 70);
    fg.style.strokeDashoffset = '326.73';
    requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = (326.73 * (1 - score / 100)).toFixed(2); }));
    const num = $('#score-num'), tS = performance.now();
    const count = (t) => { const k = Math.min(1, (t - tS) / 1100); num.textContent = Math.round(score * easeOut(k)); if (k < 1) requestAnimationFrame(count); };
    requestAnimationFrame(count);
    let title, text;
    if (score === 100) { title = 'Kusursuz! 🏁'; text = `${correct}/${N} doğru, süre ${took}. Direksiyon seni bekliyor!`; }
    else if (score >= 70) { title = 'Tebrikler, geçtin!'; text = `${correct}/${N} doğru, süre ${took}. Gerçek e-Sınav'da da bu tempoyu koru.`; }
    else if (score >= 40) { title = 'Az kaldı!'; text = `${correct}/${N} doğru, süre ${took}. Geçme puanı 70; eksik konuları derslerimizde birlikte tamamlayalım.`; }
    else { title = 'Her şey bir yerden başlar.'; text = `${correct}/${N} doğru, süre ${took}. Teorik derslerimizde her konuyu adım adım işliyoruz.`; }
    $('#score-title').textContent = title;
    $('#score-text').textContent = text;
    if (score >= 70) setTimeout(() => burstFrom(ring), 500);
  }
  $$('[data-quiz-start]', quiz).forEach((b) => b.addEventListener('click', startQuiz));
  qOpts.addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (b) answer(Number(b.dataset.i)); });
  qNext.addEventListener('click', nextQ);
  quiz.addEventListener('keydown', (e) => {
    if (!$('.q-play', quiz).classList.contains('is-active')) return;
    const map = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };
    const k = e.key.toLowerCase();
    if (!answered && k in map) { e.preventDefault(); answer(map[k]); }
    else if (answered && (e.key === 'Enter' || e.key === 'ArrowRight') && e.target !== qNext) { e.preventDefault(); nextQ(); }
  });

  /* ---------------- Kursiyer paylaşımları ---------------- */
  const track = $('#story-track');
  $$('[data-slide]').forEach((b) => b.addEventListener('click', () => {
    const card = track.querySelector('.story');
    const w = card.getBoundingClientRect().width + 18;
    track.scrollBy({ left: w * Number(b.dataset.slide), behavior: reduced ? 'auto' : 'smooth' });
  }));

  /* ---------------- Ön kayıt formu → WhatsApp ---------------- */
  const err = $('#form-error');
  const fail = (input, msg) => {
    err.textContent = msg;
    if (input) { input.closest('.field').classList.add('invalid'); input.focus(); }
    return false;
  };
  form.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); if (err.textContent) err.textContent = ''; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ad = form.elements.ad.value.trim(), tel = form.elements.tel.value.trim();
    const egitim = form.elements.egitim.value, mesaj = form.elements.mesaj.value.trim();
    if (ad.length < 3) return fail(form.elements.ad, 'Lütfen adını ve soyadını yaz.');
    if (tel.replace(/\D/g, '').length < 10) return fail(form.elements.tel, 'Lütfen geçerli bir telefon numarası yaz.');
    if (!form.elements.onay.checked) return fail(null, 'Devam etmek için onay kutusunu işaretlemelisin.');
    err.textContent = '';
    const text = `Merhaba, web sitenizden ön kayıt yaptırmak istiyorum.\n\nAd Soyad: ${ad}\nTelefon: ${tel}\nİlgilendiğim eğitim: ${egitim}` + (mesaj ? `\nNot: ${mesaj}` : '');
    window.open(waLink(text), '_blank', 'noopener');
    let ok = $('.form-ok', form);
    if (!ok) { ok = document.createElement('p'); ok.className = 'form-ok'; ok.setAttribute('role', 'status'); err.after(ok); }
    ok.textContent = 'WhatsApp açılıyor… Mesajı göndermeyi unutma. Açılmadıysa 0532 452 77 22\'ye yazabilirsin.';
  });

  /* ---------------- Yıl ---------------- */
  const yr = $('#year');
  if (yr) yr.textContent = String(new Date().getFullYear());
})();
