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

  /* ---------------- Tema: aydınlık / karanlık ---------------- */
  const root = document.documentElement;
  const themeBtn = $('.theme-toggle');
  const metaTheme = $('meta[name="theme-color"]');
  const THEME_KEY = 'yildiz-tema';
  const paintThemeUI = () => {
    const dark = root.dataset.theme === 'dark';
    themeBtn.setAttribute('aria-pressed', String(dark));
    themeBtn.setAttribute('aria-label', dark ? 'Aydınlık temaya geç' : 'Karanlık temaya geç');
    if (metaTheme) metaTheme.setAttribute('content', dark ? '#0e1016' : '#fbf7f1');
  };
  const applyTheme = (t, persist) => {
    root.dataset.theme = t;
    if (persist) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* depolama kapalı olabilir */ } }
    paintThemeUI();
    document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  };
  paintThemeUI();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-anim')));
  themeBtn.addEventListener('click', (e) => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const r = themeBtn.getBoundingClientRect();
    root.style.setProperty('--tx', `${Math.round(r.left + r.width / 2)}px`);
    root.style.setProperty('--ty', `${Math.round(r.top + r.height / 2)}px`);
    if (document.startViewTransition && !reduced) document.startViewTransition(() => applyTheme(next, true));
    else applyTheme(next, true);
  });
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      let saved = null;
      try { saved = localStorage.getItem(THEME_KEY); } catch (err) { /* yok say */ }
      if (!saved) applyTheme(e.matches ? 'dark' : 'light', false);
    });
  } catch (e) { /* eski tarayıcı */ }

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
    const zone = el.dataset.zone ? parseFloat(el.dataset.zone) : null;
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
      (zone != null ? (() => {
        const zr = r - 7, z0 = 210 - 240 * (zone / max);
        const [zx, zy] = polar(cx, cy, zr, z0), [zx2, zy2] = polar(cx, cy, zr, -30);
        return `<path class="g-zone" d="M${zx.toFixed(2)} ${zy.toFixed(2)} A${zr} ${zr} 0 0 1 ${zx2.toFixed(2)} ${zy2.toFixed(2)}"/>`;
      })() : '') +
      `<path class="g-val" d="${arc}" stroke="url(#${id})" style="stroke-dasharray:${len.toFixed(1)};stroke-dashoffset:${len.toFixed(1)}"/>` +
      marks +
      `<g class="g-needle"><path d="M100 34 104.5 100h-9z" fill="#ff4a3d"/><circle class="g-hub" cx="100" cy="100" r="9"/><circle cx="100" cy="100" r="3.5" fill="#ff4a3d"/></g>` +
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
  window.YildizFX = { confetti, burstFrom, focusForm: (c) => focusForm(c) };

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
