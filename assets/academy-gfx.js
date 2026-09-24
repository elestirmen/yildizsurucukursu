/* Ürgüp Yıldız Sürücü Kursu — Trafik Akademisi çizim motoru (çekirdek)
   Tuval sahnesi, tema, renk yardımcıları, parçacıklar, ses efektleri ve sahne üstü arayüz.
   3B yol görünümü academy-3d.js, kuşbakışı çizimler academy-top.js dosyasındadır. */
(() => {
  'use strict';

  /* ---------- Matematik ---------- */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Tohumlu rastgele sayı üreteci (mulberry32): aynı sahne her çizimde aynı görünsün
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Renk ---------- */
  const _rgb = new Map();
  function rgb(c) {
    let v = _rgb.get(c);
    if (v) return v;
    let h = c.charAt(0) === '#' ? c.slice(1) : c;
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    _rgb.set(c, v);
    return v;
  }
  const hx = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  const _mix = new Map();
  function mix(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const k = a + b + Math.round(t * 64);
    let v = _mix.get(k);
    if (v) return v;
    const A = rgb(a), B = rgb(b), q = Math.round(t * 64) / 64;
    v = '#' + hx(lerp(A[0], B[0], q)) + hx(lerp(A[1], B[1], q)) + hx(lerp(A[2], B[2], q));
    if (_mix.size > 6000) _mix.clear();
    _mix.set(k, v);
    return v;
  }
  const shade = (c, amt) => (amt >= 0 ? mix(c, '#ffffff', amt) : mix(c, '#000000', -amt));
  const alpha = (c, a) => { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; };

  /* ---------- Tema ---------- */
  const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'night' : 'day');
  const themeFns = new Set();
  new MutationObserver(() => { const t = theme(); themeFns.forEach((fn) => fn(t)); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- Depolama ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* depolama kapalı olabilir */ } }
  };

  /* ---------- Döngü ---------- */
  function loop(fn) {
    let raf = 0, last = 0, running = false;
    let failed = false;
    const tick = (t) => {
      if (!running) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      raf = requestAnimationFrame(tick);
      try { fn(dt, t); } catch (e) { if (!failed) { failed = true; console.error(e && e.stack ? e.stack : e); } }
    };
    return {
      start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(tick); },
      stop() { running = false; cancelAnimationFrame(raf); },
      get running() { return running; }
    };
  }
  // Promise tabanlı ara geçiş (sahne animasyonları için)
  function tween(ms, fn, ease = easeInOut) {
    return new Promise((res) => {
      const dur = reduced ? 1 : ms, t0 = performance.now();
      const step = (t) => {
        const u = Math.min(1, (t - t0) / dur);
        fn(ease(u), u);
        if (u < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

  /* ---------- Tuval sahnesi ----------
     Her ders bir Stage kullanır: yüksek çözünürlüklü tuval + üstünde HTML arayüz katmanı
     (HUD etiketleri, bildirimler, başlangıç/sonuç kartları, dokunulabilir noktalar). */
  class Stage {
    constructor(host, opts = {}) {
      this.host = host;
      this.opts = opts;
      this.canvas = host.querySelector('canvas.sim-cv');
      if (!this.canvas) { this.canvas = document.createElement('canvas'); this.canvas.className = 'sim-cv'; host.prepend(this.canvas); }
      this.ctx = this.canvas.getContext('2d');
      this.ui = document.createElement('div');
      this.ui.className = 'sim-ui';
      this.ui.innerHTML = '<div class="sim-hud sim-hud-l"></div><div class="sim-hud sim-hud-r"></div><div class="sim-spots"></div><div class="sim-toast" aria-hidden="true"></div><div class="sim-card" hidden></div>';
      host.appendChild(this.ui);
      this.hudL = this.ui.querySelector('.sim-hud-l');
      this.hudR = this.ui.querySelector('.sim-hud-r');
      this.spots = this.ui.querySelector('.sim-spots');
      this.toastEl = this.ui.querySelector('.sim-toast');
      this.cardEl = this.ui.querySelector('.sim-card');
      this.w = 0; this.h = 0; this.dpr = 1;
      this.resizeFns = []; this.themeFns = [];
      this.theme = theme();
      themeFns.add((t) => { this.theme = t; this.themeFns.forEach((f) => f(t)); });
      if ('ResizeObserver' in window) new ResizeObserver(() => this.resize()).observe(host);
      else addEventListener('resize', () => this.resize());
      this.resize();
    }
    get night() { return this.theme === 'night'; }
    get narrow() { return this.w > 0 && this.w < 560; }
    resize() {
      const w = Math.round(this.host.clientWidth);
      if (!w) return false;
      const h = Math.round(this.opts.height ? this.opts.height(w) : w * 0.5625);
      const dpr = Math.min(window.devicePixelRatio || 1, this.opts.dprMax || 2, this.dprCap || 9);
      if (w === this.w && h === this.h && dpr === this.dpr) return false;
      this.w = w; this.h = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.height = h + 'px';
      this.host.classList.toggle('is-narrow', this.narrow);
      this.resizeFns.forEach((f) => f(w, h));
      return true;
    }
    // Uyarlanabilir kalite: kareler uzun sürerse (yavaş cihaz) çözünürlüğü kademeli düşür
    tick(dt) {
      if (!dt) return;
      this._ema = this._ema == null ? dt : this._ema * 0.94 + dt * 0.06;
      this._n = (this._n || 0) + 1;
      if (this._n > 90 && this._ema > 0.024 && this.dpr > 1) {
        this.dprCap = Math.max(1, Math.round((this.dpr - 0.25) * 4) / 4);
        this._n = 0; this._ema = 0.017;
        this.resize();
      }
    }
    onResize(f) { this.resizeFns.push(f); }
    onTheme(f) { this.themeFns.push(f); }
    begin() { const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; return c; }
    local(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    /* HUD etiketi: { set(değer, renk), dot(renk), label(metin) } */
    chip(side, key, label, extra = '') {
      const box = side === 'r' ? this.hudR : this.hudL;
      let el = box.querySelector(`[data-chip="${key}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'hud-chip';
        el.dataset.chip = key;
        el.innerHTML = `<span class="hc-l"></span><span class="hc-v"></span>${extra}`;
        box.appendChild(el);
      }
      const l = el.querySelector('.hc-l'), v = el.querySelector('.hc-v');
      l.textContent = label;
      return {
        el,
        set(text, color) { if (v.textContent !== text) v.textContent = text; v.style.color = color || ''; return this; },
        html(h) { v.innerHTML = h; return this; },
        label(t) { l.textContent = t; return this; },
        show(on) { el.hidden = !on; return this; }
      };
    }
    // Sahnenin üstünde kısa süreli bildirim
    toast(text, kind = '', ms = 1500) {
      const t = this.toastEl;
      t.className = 'sim-toast show ' + kind;
      t.innerHTML = text;
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => { t.className = 'sim-toast ' + kind; }, ms);
    }
    // Başlangıç/sonuç kartı: { icon, title, text, keys:[['Boşluk','Fren']], buttons:[{label, cls, onClick}] }
    card(o) {
      const c = this.cardEl;
      if (!o) { c.hidden = true; c.innerHTML = ''; this.host.classList.remove('has-card'); return; }
      const stars = o.stars != null ? `<div class="sc-stars" aria-label="${o.stars} yıldız">${[1, 2, 3].map((i) => `<svg class="${i <= o.stars ? 'on' : ''}" viewBox="0 0 24 24" style="--i:${i}"><path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"/></svg>`).join('')}</div>` : '';
      const keys = o.keys ? `<ul class="sc-keys">${o.keys.map(([k, t]) => `<li><kbd>${k}</kbd><span>${t}</span></li>`).join('')}</ul>` : '';
      c.innerHTML = `<div class="sc-in">${o.icon ? `<span class="sc-ic">${o.icon}</span>` : ''}${stars}<b class="sc-t">${o.title}</b>${o.text ? `<p class="sc-p">${o.text}</p>` : ''}${keys}<div class="sc-btns"></div></div>`;
      const btns = c.querySelector('.sc-btns');
      (o.buttons || []).forEach((b, i) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'btn ' + (b.cls || (i ? 'btn-ghost' : 'btn-red'));
        el.innerHTML = b.label;
        el.addEventListener('click', (e) => { e.stopPropagation(); b.onClick && b.onClick(); });
        btns.appendChild(el);
      });
      c.hidden = false;
      this.host.classList.add('has-card');
      const first = btns.querySelector('button');
      if (first && o.focus !== false && this.host.getBoundingClientRect().top < innerHeight) first.focus({ preventScroll: true });
    }
    get hasCard() { return !this.cardEl.hidden; }
    // Tuval üzerinde erişilebilir dokunma noktası (görünmez düğme)
    spot(key, label, onClick) {
      let b = this.spots.querySelector(`[data-spot="${key}"]`);
      if (!b) {
        b = document.createElement('button');
        b.type = 'button';
        b.className = 'sim-spot';
        b.dataset.spot = key;
        b.addEventListener('click', (e) => { e.stopPropagation(); b._fn && b._fn(); });
        this.spots.appendChild(b);
      }
      b.setAttribute('aria-label', label);
      b._fn = onClick;
      return b;
    }
    placeSpot(b, x, y, w, h) {
      b.style.left = (x - w / 2).toFixed(1) + 'px';
      b.style.top = (y - h / 2).toFixed(1) + 'px';
      b.style.width = w.toFixed(1) + 'px';
      b.style.height = h.toFixed(1) + 'px';
    }
    clearSpots() { this.spots.innerHTML = ''; }
  }

  /* ---------- Parçacıklar ---------- */
  class Particles {
    constructor() { this.list = []; }
    emit(n, f) { for (let i = 0; i < n; i++) this.list.push(Object.assign({ t: 0, life: 1, vx: 0, vy: 0, g: 0, drag: 0, size: 3, color: '#fff', shape: 'circle', rot: 0, vr: 0, fade: true }, f(i))); }
    update(dt) {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.t += dt;
        if (p.t >= p.life) { L.splice(i, 1); continue; }
        p.vy += p.g * dt;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
    }
    draw(ctx, map) {
      for (const p of this.list) {
        const u = p.t / p.life;
        const a = p.fade ? (u < 0.15 ? u / 0.15 : 1 - Math.max(0, (u - 0.5) / 0.5)) : 1;
        const pt = map ? map(p) : p;
        if (!pt) continue;
        const sz = (pt.scale || 1) * p.size * (p.grow ? 1 + u * p.grow : 1);
        ctx.globalAlpha = clamp(a * (p.alpha == null ? 1 : p.alpha), 0, 1);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(p.rot);
          ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7 * Math.abs(Math.cos(p.t * 9 + p.rot)) + 0.5);
          ctx.restore();
        } else if (p.shape === 'ring') {
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, sz * 0.18);
          ctx.beginPath(); ctx.arc(pt.x, pt.y, sz, 0, TAU); ctx.stroke();
        } else if (p.shape === 'streak') {
          ctx.strokeStyle = p.color; ctx.lineWidth = p.width || 1.2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - p.vx * 0.03, pt.y - p.vy * 0.03); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.3, sz), 0, TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    clear() { this.list.length = 0; }
  }
  // Ekranda başarı patlaması (sahne koordinatlarında)
  function burst(parts, x, y, colors = ['#1fbf6a', '#ffc83d', '#ffffff', '#3b8cff'], n = 26) {
    if (reduced) return;
    parts.emit(n, (i) => {
      const a = (i / n) * TAU + rand(-0.2, 0.2), sp = rand(90, 260);
      return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 380, drag: 1.6, life: rand(0.7, 1.1), size: rand(3, 6), color: colors[i % colors.length], shape: i % 3 ? 'rect' : 'circle', rot: rand(0, 6), vr: rand(-8, 8) };
    });
  }

  /* ---------- Ses efektleri (Web Audio ile üretilir, dosya indirmez) ---------- */
  const Sfx = (() => {
    let ac = null, master = null, on = store.get('yildiz-ses', true);
    const fns = new Set();
    function ctx() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ac = new AC(); } catch (e) { return null; }
        master = ac.createGain();
        master.gain.value = 0.55;
        master.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(f, dur, type = 'sine', vol = 0.2, when = 0, f2) {
      const a = ac, t = a.currentTime + when;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    }
    let nbuf = null;
    function noise(dur, vol, freq, type = 'highpass', when = 0, q = 1) {
      const a = ac, t = a.currentTime + when;
      if (!nbuf) { nbuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
      s.buffer = nbuf; fl.type = type; fl.frequency.value = freq; fl.Q.value = q;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(master);
      s.start(t); s.stop(t + dur + 0.05);
    }
    const S = {
      ok() { tone(784, 0.13, 'sine', 0.16); tone(1175, 0.2, 'sine', 0.14, 0.08); },
      bad() { tone(196, 0.22, 'triangle', 0.18); tone(147, 0.28, 'triangle', 0.16, 0.1); },
      tick() { tone(1400, 0.03, 'sine', 0.06); },
      beat() { tone(1046, 0.05, 'sine', 0.11); },
      tap() { tone(520, 0.06, 'sine', 0.1, 0, 380); },
      horn() { tone(392, 0.42, 'sawtooth', 0.045); tone(494, 0.42, 'sawtooth', 0.04); },
      flash() { noise(0.09, 0.22, 2500); tone(2400, 0.06, 'sine', 0.05); },
      screech() { noise(0.55, 0.1, 2200, 'bandpass', 0, 6); },
      chime() { tone(1319, 0.3, 'sine', 0.1); tone(1760, 0.45, 'sine', 0.07, 0.12); },
      win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.26, 'triangle', 0.13, i * 0.09)); },
      blink() { tone(1900, 0.012, 'square', 0.025); },
      pop() { tone(620, 0.08, 'sine', 0.1, 0, 930); },
      whoosh() { noise(0.35, 0.05, 900, 'bandpass', 0, 0.8); },
      splash() { noise(0.4, 0.12, 1200, 'lowpass'); },
      thud() { tone(90, 0.18, 'sine', 0.25, 0, 50); }
    };
    return {
      play(n) { if (!on || !S[n]) return; if (!ctx()) return; try { S[n](); } catch (e) { /* ses kapalı olabilir */ } },
      get on() { return on; },
      set(v) { on = !!v; store.set('yildiz-ses', on); fns.forEach((f) => f(on)); if (on && ctx()) S.pop(); },
      onChange(f) { fns.add(f); }
    };
  })();

  /* ---------- Basılı tutma düğmesi (fare, dokunma, kalem) ---------- */
  function hold(el, down, up) {
    let active = false;
    const start = (e) => {
      if (e.button != null && e.button > 0) return;
      e.preventDefault();
      if (active) return;
      active = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
      el.classList.add('is-held');
      down(e);
    };
    const end = () => { if (!active) return; active = false; el.classList.remove('is-held'); up && up(); };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('click', (e) => { if (e.detail === 0) { down(e); setTimeout(() => up && up(), 160); } }); // klavyeyle Enter
    return { get active() { return active; } };
  }

  /* ---------- Tuval yardımcıları ---------- */
  function rr(ctx, x, y, w, h, r) {
    const q = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + q, y);
    ctx.arcTo(x + w, y, x + w, y + h, q);
    ctx.arcTo(x + w, y + h, x, y + h, q);
    ctx.arcTo(x, y + h, x, y, q);
    ctx.arcTo(x, y, x + w, y, q);
    ctx.closePath();
  }
  function glow(ctx, x, y, r, color, a = 1) {
    if (!(r > 0.5) || !isFinite(r) || !isFinite(x) || !isFinite(y)) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, alpha(color, 0.9 * a));
    g.addColorStop(0.25, alpha(color, 0.45 * a));
    g.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // SVG dizesini tuvale çizilebilir resme çevirir (levha ve gösterge ışıkları kitten gelir)
  const _img = new Map();
  function svgImage(svg, size = 256) {
    const key = size + svg;
    let im = _img.get(key);
    if (im) return im;
    im = new Image();
    im.width = size; im.height = size;
    im.decoding = 'async';
    const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
    _img.set(key, im);
    return im;
  }
  const ready = (im) => im && im.complete && im.naturalWidth > 0;
  // Doku: küçük gürültü deseni (asfalt, toprak)
  const _pat = new Map();
  function noisePattern(ctx, base, amt = 0.06, size = 96, seed = 7) {
    const key = base + amt + size + seed;
    let p = _pat.get(key);
    if (p) return p;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, size, size);
    const r = rng(seed);
    for (let i = 0; i < size * size * 0.18; i++) {
      const v = r();
      x.fillStyle = v > 0.5 ? `rgba(255,255,255,${amt * r()})` : `rgba(0,0,0,${amt * 1.3 * r()})`;
      const s = r() < 0.9 ? 1 : 2;
      x.fillRect(Math.floor(r() * size), Math.floor(r() * size), s, s);
    }
    p = ctx.createPattern(c, 'repeat');
    _pat.set(key, p);
    return p;
  }

  window.YildizGfx = {
    TAU, clamp, lerp, inv, smooth, easeOut, easeIn, easeInOut, rand, pick, shuffle, rng, reduced,
    rgb, mix, shade, alpha, theme, onTheme: (f) => themeFns.add(f), store, loop, tween, wait,
    Stage, Particles, burst, Sfx, hold, rr, glow, svgImage, ready, noisePattern
  };
})();
