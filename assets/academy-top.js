/* Ürgüp Yıldız Sürücü Kursu — Trafik Akademisi kuşbakışı çizimler
   Birim metre, y aşağı doğru. Araçlar yukarı (−y) bakacak şekilde çizilir ve döndürülür.
   Statik zemin (yol, kaldırım, bina, ağaç) bir kez ekran dışı tuvale çizilir; araçlar her karede üstüne. */
(() => {
  'use strict';
  const G = window.YildizGfx;
  if (!G) return;
  const { TAU, clamp, lerp, mix, shade, alpha, rng, rr, glow, ready } = G;

  const PAL = {
    day: {
      night: false,
      ground: '#e6d8bd', dirt: '#dccaa6', grass: '#b9c47f', grass2: '#a7b66c', walk: '#ddd1bb', walkLine: '#cbbda3', curb: '#f3eee3', curbShadow: 'rgba(60,45,25,.22)',
      road: '#4a4e57', roadLine: '#f4f1e9', yellow: '#f2c200', plaza: '#e3d6bf',
      roofs: ['#e8d6b6', '#e3cba5', '#efe4d0', '#dcc39d', '#e9dcc4'], parapet: '#f6eee0', tile: ['#d0714f', '#c05f3f', '#b3553a', '#9e4a33'],
      leaf: ['#5f7d34', '#78973f', '#9aba5a'], trunk: '#7a5a3a', shadow: 'rgba(52,36,16,.3)', pole: '#6d737c',
      water: '#6fa6d9', light: '#fff4d6'
    },
    night: {
      night: true,
      ground: '#1b202c', dirt: '#1e222d', grass: '#1a2622', grass2: '#18221f', walk: '#282d3a', walkLine: '#232835', curb: '#3a404e', curbShadow: 'rgba(0,0,0,.35)',
      road: '#262a33', roadLine: '#c6c9d1', yellow: '#a88a1c', plaza: '#262b37',
      roofs: ['#2d3241', '#30364a', '#2a2f3e', '#343a4c', '#2f3445'], parapet: '#3a4052', tile: ['#4a2e2a', '#432925', '#3c2421', '#35201d'],
      leaf: ['#152019', '#1c2a20', '#26382a'], trunk: '#2a2320', shadow: 'rgba(0,0,0,.45)', pole: '#3d424c',
      water: '#243a55', light: '#ffd79a'
    }
  };
  const palette = (night) => PAL[night ? 'night' : 'day'];

  /* ---------- Görünüm ---------- */
  class View2D {
    constructor() { this.scale = 10; this.ox = 0; this.oy = 0; }
    fit(w, h, x0, y0, x1, y1, pad = 0) {
      const sx = (w - pad * 2) / (x1 - x0), sy = (h - pad * 2) / (y1 - y0);
      this.scale = Math.min(sx, sy);
      this.ox = w / 2 - ((x0 + x1) / 2) * this.scale;
      this.oy = h / 2 - ((y0 + y1) / 2) * this.scale;
    }
    X(x) { return this.ox + x * this.scale; }
    Y(y) { return this.oy + y * this.scale; }
    wx(X) { return (X - this.ox) / this.scale; }
    wy(Y) { return (Y - this.oy) / this.scale; }
    apply(ctx) { ctx.translate(this.ox, this.oy); ctx.scale(this.scale, this.scale); }
  }

  /* ---------- Dokular ---------- */
  const _pats = new Map();
  function pattern(ctx, key, size, draw) {
    let p = _pats.get(key);
    if (p) return p;
    const c = document.createElement('canvas');
    c.width = c.height = Math.max(4, Math.round(size));
    draw(c.getContext('2d'), c.width);
    p = ctx.createPattern(c, 'repeat');
    _pats.set(key, p);
    if (_pats.size > 60) { const first = _pats.keys().next().value; _pats.delete(first); }
    return p;
  }
  function speckle(ctx, base, amt, seed = 3) {
    return pattern(ctx, 'sp' + base + amt + seed, 128, (x, n) => {
      x.fillStyle = base; x.fillRect(0, 0, n, n);
      const r = rng(seed);
      for (let i = 0; i < n * n * 0.22; i++) {
        const v = r();
        x.fillStyle = v > 0.5 ? `rgba(255,255,255,${(amt * r()).toFixed(3)})` : `rgba(0,0,0,${(amt * 1.3 * r()).toFixed(3)})`;
        x.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1, 1);
      }
    });
  }
  function grassPat(ctx, P) {
    return pattern(ctx, 'gr' + P.grass, 96, (x, n) => {
      x.fillStyle = P.grass; x.fillRect(0, 0, n, n);
      const r = rng(9);
      for (let i = 0; i < 260; i++) { x.fillStyle = r() < 0.5 ? P.grass2 : shade(P.grass, 0.08); x.fillRect(Math.floor(r() * n), Math.floor(r() * n), 2, 1 + Math.floor(r() * 2)); }
    });
  }
  // Kaldırım taşı: ölçeğe göre 1 m karolar (desen dönüşümüyle hizalanır)
  function tilePat(ctx, P, scale) {
    const px = Math.max(6, Math.round(scale));
    return pattern(ctx, 'tl' + P.walk + px, px, (x, n) => {
      x.fillStyle = P.walk; x.fillRect(0, 0, n, n);
      x.fillStyle = P.walkLine; x.fillRect(0, 0, n, 1); x.fillRect(0, 0, 1, n);
      x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(1, 1, n - 2, Math.max(1, n / 3));
    });
  }

  /* ---------- Zemin çizimleri (dünya koordinatında, ctx zaten ölçekli) ---------- */
  const D = {};
  D.fill = (ctx, x, y, w, h, style) => { ctx.fillStyle = style; ctx.fillRect(x, y, w, h); };
  // Desenli dolgu: desen ekran pikselinde tanımlı, ölçeği geri alarak uygula
  D.patFill = (ctx, v, x, y, w, h, pat) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.scale(1 / v.scale, 1 / v.scale);
    ctx.fillStyle = pat;
    ctx.fillRect(x * v.scale - 2, y * v.scale - 2, w * v.scale + 4, h * v.scale + 4);
    ctx.restore();
  };
  D.asphalt = (ctx, v, P, x, y, w, h) => D.patFill(ctx, v, x, y, w, h, speckle(ctx, P.road, P.night ? 0.05 : 0.07, 5));
  D.grass = (ctx, v, P, x, y, w, h) => D.patFill(ctx, v, x, y, w, h, grassPat(ctx, P));
  D.earth = (ctx, v, P, x, y, w, h) => D.patFill(ctx, v, x, y, w, h, speckle(ctx, P.ground, 0.05, 8));
  D.walk = (ctx, v, P, x, y, w, h) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = tilePat(ctx, P, v.scale);
    ctx.scale(1 / v.scale, 1 / v.scale);
    ctx.fillRect(x * v.scale - 2, y * v.scale - 2, w * v.scale + 4, h * v.scale + 4);
    ctx.restore();
  };
  // Bordür: kaldırım kenarında açık renkli şerit + yola düşen ince gölge
  D.curb = (ctx, P, x0, y0, x1, y1) => {
    const horiz = Math.abs(y1 - y0) < Math.abs(x1 - x0);
    ctx.fillStyle = P.curbShadow;
    if (horiz) ctx.fillRect(Math.min(x0, x1), y0 + 0.05, Math.abs(x1 - x0), 0.28); else ctx.fillRect(x0 + 0.05, Math.min(y0, y1), 0.28, Math.abs(y1 - y0));
    ctx.fillStyle = P.curb;
    if (horiz) ctx.fillRect(Math.min(x0, x1), y0 - 0.12, Math.abs(x1 - x0), 0.2); else ctx.fillRect(x0 - 0.12, Math.min(y0, y1), 0.2, Math.abs(y1 - y0));
  };
  D.line = (ctx, P, x0, y0, x1, y1, o = {}) => {
    ctx.strokeStyle = o.color || P.roadLine;
    ctx.lineWidth = o.w || 0.14;
    ctx.lineCap = 'butt';
    ctx.setLineDash(o.dash || []);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
  };
  // Yaya geçidi: şeritler yolun yönüne paralel
  D.zebra = (ctx, P, x0, y0, x1, y1, vertical) => {
    ctx.fillStyle = P.roadLine;
    if (vertical) for (let x = x0 + 0.25; x + 0.5 <= x1; x += 1) ctx.fillRect(x, y0, 0.5, y1 - y0);
    else for (let y = y0 + 0.25; y + 0.5 <= y1; y += 1) ctx.fillRect(x0, y, x1 - x0, 0.5);
  };
  // Şerit oku (yukarı bakar): kind 's' düz, 'l' sol, 'r' sağ, 'sr', 'sl'
  D.arrow = (ctx, P, x, y, ang, kind = 's') => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = alpha(P.roadLine, 0.92);
    const stem = () => { ctx.fillRect(-0.12, -0.6, 0.24, 2.1); };
    const head = (hx, hy, a) => { ctx.save(); ctx.translate(hx, hy); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -0.6); ctx.lineTo(0.42, 0.05); ctx.lineTo(-0.42, 0.05); ctx.closePath(); ctx.fill(); ctx.restore(); };
    if (kind === 's' || kind === 'sr' || kind === 'sl') { stem(); head(0, -0.6, 0); }
    if (kind === 'l' || kind === 'sl') { if (kind === 'l') ctx.fillRect(-0.12, 0.1, 0.24, 1.4); ctx.beginPath(); ctx.moveTo(-0.12, 0.35); ctx.quadraticCurveTo(-0.12, -0.15, -0.55, -0.15); ctx.lineTo(-0.55, 0.12); ctx.quadraticCurveTo(0.12, 0.12, 0.12, 0.45); ctx.fill(); head(-0.6, -0.02, -Math.PI / 2); }
    if (kind === 'r' || kind === 'sr') { if (kind === 'r') ctx.fillRect(-0.12, 0.1, 0.24, 1.4); ctx.beginPath(); ctx.moveTo(0.12, 0.35); ctx.quadraticCurveTo(0.12, -0.15, 0.55, -0.15); ctx.lineTo(0.55, 0.12); ctx.quadraticCurveTo(-0.12, 0.12, -0.12, 0.45); ctx.fill(); head(0.6, -0.02, Math.PI / 2); }
    ctx.restore();
  };

  /* Bina: düz çatı (parapet + çatı ekipmanı) ya da kiremit kırma çatı. Gölge sağ-alta düşer. */
  D.building = (ctx, v, P, x, y, w, h, o = {}) => {
    const r = rng(o.seed || 1);
    const H = o.height || 6;
    // Gölge
    ctx.save();
    ctx.fillStyle = P.shadow;
    ctx.shadowColor = P.shadow; ctx.shadowBlur = 0.9 * v.scale;
    const sx = H * 0.16, sy = H * 0.22;
    ctx.beginPath(); ctx.moveTo(x + w, y + 0.2); ctx.lineTo(x + w + sx, y + sy); ctx.lineTo(x + w + sx, y + h + sy); ctx.lineTo(x + sx, y + h + sy); ctx.lineTo(x + 0.2, y + h); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (o.roof === 'tile') {
      const [c0, c1, c2, c3] = P.tile;
      const cx = x + w / 2, cy = y + h / 2, alongX = w >= h;
      const inset = Math.min(w, h) / 2;
      const rx0 = alongX ? x + inset : cx, rx1 = alongX ? x + w - inset : cx, ry0 = alongX ? cy : y + inset, ry1 = alongX ? cy : y + h - inset;
      const face = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); };
      face([[x, y], [x + w, y], [rx1, ry1], [rx0, ry0]], c0);
      face([[x, y], [rx0, ry0], [x, y + h]], c1);
      face([[x + w, y], [x + w, y + h], [rx1, ry1]], c2);
      face([[x, y + h], [rx0, ry0], [rx1, ry1], [x + w, y + h]], c3);
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 0.06;
      for (let k = 0.5; k < inset; k += 0.5) { ctx.strokeRect(x + k, y + k, w - 2 * k, h - 2 * k); }
      ctx.strokeStyle = shade(c0, 0.18); ctx.lineWidth = 0.14;
      ctx.beginPath(); ctx.moveTo(rx0, ry0); ctx.lineTo(rx1, ry1); ctx.stroke();
      if (o.chimney) { ctx.fillStyle = shade(P.roofs[0], -0.2); ctx.fillRect(x + w * 0.7, y + h * 0.25, 0.7, 0.7); }
      return;
    }
    const base = o.color || P.roofs[Math.floor(r() * P.roofs.length)];
    ctx.fillStyle = shade(base, P.night ? 0.06 : 0.06);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = speckle(ctx, base, 0.05, 12);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 0.35, y + 0.35, w - 0.7, h - 0.7); ctx.clip(); ctx.scale(1 / v.scale, 1 / v.scale); ctx.fillRect(x * v.scale, y * v.scale, w * v.scale, h * v.scale); ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.1)'; ctx.lineWidth = 0.08; ctx.strokeRect(x + 0.35, y + 0.35, w - 0.7, h - 0.7);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, y, w, 0.12); ctx.fillRect(x, y, 0.12, h);
    // Çatı ekipmanı: güneş enerjili su ısıtıcısı, klima, baca
    const n = Math.max(1, Math.round((w * h) / 45));
    for (let i = 0; i < n; i++) {
      const t = r();
      const ex = x + 1 + r() * Math.max(0.5, w - 3.6), ey = y + 1 + r() * Math.max(0.5, h - 3);
      if (t < 0.5) {
        ctx.fillStyle = P.night ? '#1d2a44' : '#2c4f7c'; ctx.fillRect(ex, ey, 1.9, 1.1);
        ctx.strokeStyle = P.night ? 'rgba(120,150,200,.25)' : 'rgba(190,215,240,.55)'; ctx.lineWidth = 0.05;
        for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(ex + k * 0.475, ey); ctx.lineTo(ex + k * 0.475, ey + 1.1); ctx.stroke(); }
        ctx.fillStyle = P.night ? '#4a505c' : '#e8e8e4'; rr(ctx, ex - 0.1, ey - 0.55, 2.1, 0.42, 0.2); ctx.fill();
      } else if (t < 0.8) {
        ctx.fillStyle = P.night ? '#3a404c' : '#d9dadb'; ctx.fillRect(ex, ey, 0.9, 0.7);
        ctx.fillStyle = P.night ? '#2c313b' : '#b9bcc1'; ctx.beginPath(); ctx.arc(ex + 0.45, ey + 0.35, 0.25, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = shade(base, -0.25); ctx.fillRect(ex, ey, 0.6, 0.6);
      }
    }
  };
  // Tente (dükkan önü): çizgili, sokağa doğru
  D.awning = (ctx, P, x, y, w, h, colors) => {
    const [a, b] = colors;
    const n = Math.max(2, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? b : a; ctx.fillRect(x + (i * w) / n, y, w / n + 0.01, h); }
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + h - 0.12, w, 0.12);
  };
  /* Ağaç (kuşbakışı) */
  D.tree = (ctx, v, P, x, y, R, seed = 1) => {
    const r = rng(seed);
    ctx.save();
    ctx.fillStyle = P.shadow; ctx.shadowColor = P.shadow; ctx.shadowBlur = 0.6 * v.scale;
    ctx.beginPath(); ctx.ellipse(x + R * 0.45, y + R * 0.55, R * 0.95, R * 0.85, 0, 0, TAU); ctx.fill();
    ctx.restore();
    const [dk, md, lt] = P.leaf;
    const bl = Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * TAU + r() * 0.6, d = i ? R * (0.42 + r() * 0.2) : 0; return [x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.5 + r() * 0.18)]; });
    ctx.fillStyle = dk; for (const [bx, by, br] of bl) { ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); }
    ctx.fillStyle = md; for (const [bx, by, br] of bl) { ctx.beginPath(); ctx.arc(bx - br * 0.12, by - br * 0.14, br * 0.8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = lt; for (let i = 0; i < 4; i++) { const [bx, by, br] = bl[i + 1]; ctx.beginPath(); ctx.arc(bx - br * 0.28, by - br * 0.3, br * 0.36, 0, TAU); ctx.fill(); }
  };
  // Saksı çalı / çiçeklik
  D.bush = (ctx, v, P, x, y, R, seed) => D.tree(ctx, v, P, x, y, R, seed);
  /* Sokak lambası (kuşbakışı): direk + kol + armatür; gece ışık havuzu ayrıca çizilir */
  D.lamp = (ctx, P, x, y, ang) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.strokeStyle = P.pole; ctx.lineWidth = 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -1.6); ctx.stroke();
    ctx.fillStyle = P.pole; ctx.beginPath(); ctx.arc(0, 0, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = P.night ? '#fff1cf' : '#8d939c'; rr(ctx, -0.22, -2.05, 0.44, 0.6, 0.18); ctx.fill();
    ctx.restore();
  };
  D.lampGlow = (ctx, P, x, y, ang, R = 5.5) => {
    const lx = x + Math.sin(ang) * 1.75, ly = y - Math.cos(ang) * 1.75;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R);
    g.addColorStop(0, 'rgba(255,214,150,.42)'); g.addColorStop(0.45, 'rgba(255,200,130,.16)'); g.addColorStop(1, 'rgba(255,200,130,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };
  /* Levha direği: resim dik durur (ekrana bakar) */
  D.sign = (ctx, P, x, y, img, size = 2.4) => {
    ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(x + 0.3, y + 0.15, 0.5, 0.18, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.pole; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - size * 0.55); ctx.stroke();
    if (ready(img)) {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
      ctx.drawImage(img, x - size / 2, y - size * 1.45, size, size);
      ctx.restore();
    }
  };
  /* Trafik ışığı (kuşbakışı): yön ang doğrultusundaki trafiğe bakar. state: green|amber|red|redamber|flash */
  D.signal = (ctx, P, x, y, ang, state, t = 0, k = 1.6) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
    ctx.fillStyle = P.shadow; rr(ctx, -0.2, -0.45, 0.62, 1.2, 0.2); ctx.fill();
    ctx.fillStyle = '#16171b'; rr(ctx, -0.3, -0.65, 0.6, 1.3, 0.16); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.05; ctx.stroke();
    const on = { r: state === 'red' || state === 'redamber', y: state === 'amber' || state === 'redamber' || (state === 'flash' && Math.floor(t * 2) % 2 === 0), g: state === 'green' };
    const cols = { r: ['#ff3b30', '#4a1714'], y: ['#ffb300', '#4a3510'], g: ['#27d35f', '#113520'] };
    ['r', 'y', 'g'].forEach((c, i) => {
      const ly = -0.4 + i * 0.4;
      ctx.fillStyle = on[c] ? cols[c][0] : cols[c][1];
      ctx.beginPath(); ctx.arc(0, ly, 0.14, 0, TAU); ctx.fill();
      if (on[c]) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, ly, 0.75, cols[c][0], 0.9); ctx.globalCompositeOperation = 'source-over'; }
    });
    ctx.restore();
  };

  /* ---------- Araçlar ---------- */
  const KINDS = {
    sedan: { L: 4.4, W: 1.84 }, player: { L: 4.4, W: 1.84 }, taxi: { L: 4.4, W: 1.84 }, hatch: { L: 3.9, W: 1.78 },
    suv: { L: 4.6, W: 1.95 }, minibus: { L: 5.3, W: 2.0 }, ambulance: { L: 5.4, W: 2.05 }, police: { L: 4.6, W: 1.86 },
    tractor: { L: 3.6, W: 2.1 }, moto: { L: 2.1, W: 0.8 }, truck: { L: 8.5, W: 2.45 }, bus: { L: 11, W: 2.5 }
  };
  const _spr = new Map();
  function bodyPath(ctx, hw, hl) {
    ctx.beginPath();
    ctx.moveTo(-hw + 0.12, -hl + 0.45); ctx.quadraticCurveTo(-hw + 0.06, -hl + 0.02, -hw + 0.5, -hl);
    ctx.lineTo(hw - 0.5, -hl); ctx.quadraticCurveTo(hw - 0.06, -hl + 0.02, hw - 0.12, -hl + 0.45);
    ctx.lineTo(hw, hl - 0.45); ctx.quadraticCurveTo(hw, hl, hw - 0.4, hl);
    ctx.lineTo(-hw + 0.4, hl); ctx.quadraticCurveTo(-hw, hl, -hw, hl - 0.45);
    ctx.closePath();
  }
  function drawVehicle(ctx, kind, color, night) {
    const K = KINDS[kind] || KINDS.sedan, hl = K.L / 2, hw = K.W / 2;
    const glass = night ? '#0f141d' : '#243140', glass2 = night ? '#1a2230' : '#3f5670';
    const body = kind === 'player' ? '#f3f5f8' : kind === 'ambulance' ? '#f6f7f9' : kind === 'police' ? '#f3f5f8' : color;
    const sideGrad = (c) => { const g = ctx.createLinearGradient(-hw, 0, hw, 0); g.addColorStop(0, shade(c, -0.25)); g.addColorStop(0.16, c); g.addColorStop(0.5, shade(c, 0.12)); g.addColorStop(0.84, c); g.addColorStop(1, shade(c, -0.25)); return g; };
    if (kind === 'moto') {
      ctx.fillStyle = '#23262c'; rr(ctx, -0.14, -hl, 0.28, K.L, 0.14); ctx.fill();
      ctx.fillStyle = color; rr(ctx, -0.3, -0.55, 0.6, 0.9, 0.25); ctx.fill();
      ctx.fillStyle = '#1b1d22'; ctx.fillRect(-0.42, -0.72, 0.84, 0.08);
      ctx.fillStyle = '#2d3036'; ctx.beginPath(); ctx.ellipse(0, 0.15, 0.3, 0.36, 0, 0, TAU); ctx.fill();
      const hg = ctx.createRadialGradient(-0.06, -0.02, 0, 0, 0.05, 0.24); hg.addColorStop(0, shade(color, 0.35)); hg.addColorStop(1, color);
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0.02, 0.23, 0, TAU); ctx.fill();
      return;
    }
    if (kind === 'tractor') {
      ctx.fillStyle = '#17181b';
      rr(ctx, -hw, 0.1, 0.5, 1.5, 0.18); ctx.fill(); rr(ctx, hw - 0.5, 0.1, 0.5, 1.5, 0.18); ctx.fill();
      rr(ctx, -hw + 0.25, -hl + 0.2, 0.34, 0.8, 0.12); ctx.fill(); rr(ctx, hw - 0.59, -hl + 0.2, 0.34, 0.8, 0.12); ctx.fill();
      ctx.fillStyle = sideGrad(color); rr(ctx, -0.5, -hl, 1.0, K.L - 0.4, 0.3); ctx.fill();
      ctx.fillStyle = shade(color, 0.15); rr(ctx, -0.85, -0.1, 1.7, 1.55, 0.25); ctx.fill();
      ctx.fillStyle = night ? '#2a3140' : '#dfe8ee'; rr(ctx, -0.62, 0.05, 1.24, 1.2, 0.18); ctx.fill();
      ctx.fillStyle = '#2b2d31'; ctx.beginPath(); ctx.arc(0.32, -hl + 0.55, 0.1, 0, TAU); ctx.fill();
      return;
    }
    // Gövde
    bodyPath(ctx, hw, hl);
    ctx.fillStyle = sideGrad(body); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 0.04; ctx.stroke();
    const big = kind === 'minibus' || kind === 'ambulance' || kind === 'truck' || kind === 'bus';
    if (big) {
      // Minibüs / ambulans / kamyon: kısa kaput, uzun kasa
      const cabF = -hl + 0.85;
      ctx.fillStyle = glass; ctx.beginPath(); ctx.moveTo(-hw + 0.2, cabF); ctx.lineTo(hw - 0.2, cabF); ctx.lineTo(hw - 0.12, cabF + 0.55); ctx.lineTo(-hw + 0.12, cabF + 0.55); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-hw + 0.5, cabF + 0.05, 0.25, 0.45);
      const g = ctx.createLinearGradient(-hw, 0, hw, 0); g.addColorStop(0, shade(body, -0.08)); g.addColorStop(0.5, shade(body, 0.08)); g.addColorStop(1, shade(body, -0.08));
      ctx.fillStyle = g; rr(ctx, -hw + 0.12, cabF + 0.62, K.W - 0.24, K.L - (cabF + hl) - 0.8, 0.16); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 0.04;
      for (let yy = cabF + 1.4; yy < hl - 0.4; yy += 0.9) { ctx.beginPath(); ctx.moveTo(-hw + 0.3, yy); ctx.lineTo(hw - 0.3, yy); ctx.stroke(); }
      if (kind === 'ambulance') {
        ctx.fillStyle = '#e02b25'; ctx.fillRect(-hw, 0.2, 0.14, 1.6); ctx.fillRect(hw - 0.14, 0.2, 0.14, 1.6);
        ctx.fillRect(-0.18, 0.55, 0.36, 1.1); ctx.fillRect(-0.55, 0.92, 1.1, 0.36);
        ctx.fillStyle = '#2a2d33'; rr(ctx, -0.72, cabF + 0.66, 1.44, 0.3, 0.08); ctx.fill();
      }
    } else {
      // Binek: kaput çizgisi, ön cam, tavan, arka cam
      const wsF = -hl + (kind === 'hatch' ? 1.0 : 1.18), wsR = wsF + 0.72, rwF = hl - (kind === 'hatch' ? 0.75 : 1.28), rwR = rwF + 0.48;
      ctx.strokeStyle = shade(body, -0.16); ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.moveTo(-0.45, -hl + 0.2); ctx.quadraticCurveTo(-0.52, wsF - 0.4, -0.62, wsF); ctx.moveTo(0.45, -hl + 0.2); ctx.quadraticCurveTo(0.52, wsF - 0.4, 0.62, wsF); ctx.stroke();
      const gl = ctx.createLinearGradient(0, wsF, 0, wsR); gl.addColorStop(0, glass2); gl.addColorStop(1, glass);
      ctx.fillStyle = gl; ctx.beginPath(); ctx.moveTo(-hw + 0.24, wsF); ctx.lineTo(hw - 0.24, wsF); ctx.lineTo(hw - 0.12, wsR); ctx.lineTo(-hw + 0.12, wsR); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.moveTo(-0.35, wsF + 0.04); ctx.lineTo(-0.05, wsF + 0.04); ctx.lineTo(-0.3, wsR - 0.04); ctx.lineTo(-0.6, wsR - 0.04); ctx.closePath(); ctx.fill();
      // Yan camlar
      ctx.fillStyle = glass; ctx.fillRect(-hw + 0.08, wsR, 0.1, rwF - wsR); ctx.fillRect(hw - 0.18, wsR, 0.1, rwF - wsR);
      // Tavan
      const rg = ctx.createLinearGradient(-hw, 0, hw, 0); rg.addColorStop(0, shade(body, -0.04)); rg.addColorStop(0.45, shade(body, 0.16)); rg.addColorStop(1, shade(body, -0.06));
      ctx.fillStyle = rg; rr(ctx, -hw + 0.2, wsR - 0.02, K.W - 0.4, rwF - wsR + 0.04, 0.22); ctx.fill();
      // Arka cam
      ctx.fillStyle = glass; ctx.beginPath(); ctx.moveTo(-hw + 0.14, rwF); ctx.lineTo(hw - 0.14, rwF); ctx.lineTo(hw - 0.3, rwR); ctx.lineTo(-hw + 0.3, rwR); ctx.closePath(); ctx.fill();
      // Aynalar
      ctx.fillStyle = shade(body, -0.12);
      ctx.beginPath(); ctx.ellipse(-hw - 0.08, wsF + 0.18, 0.13, 0.08, -0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hw + 0.08, wsF + 0.18, 0.13, 0.08, 0.3, 0, TAU); ctx.fill();
      if (kind === 'player') {
        ctx.fillStyle = '#de2f29'; ctx.fillRect(-hw + 0.02, wsR + 0.1, 0.07, rwF - wsR - 0.2); ctx.fillRect(hw - 0.09, wsR + 0.1, 0.07, rwF - wsR - 0.2);
        ctx.fillStyle = '#1f5fd1'; rr(ctx, -0.55, (wsR + rwF) / 2 - 0.16, 1.1, 0.32, 0.06); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(-0.4, (wsR + rwF) / 2 - 0.03, 0.8, 0.06);
      }
      if (kind === 'taxi') {
        ctx.fillStyle = '#1c1d22'; rr(ctx, -0.3, (wsR + rwF) / 2 - 0.14, 0.6, 0.28, 0.05); ctx.fill();
        ctx.fillStyle = '#ffe066'; rr(ctx, -0.25, (wsR + rwF) / 2 - 0.1, 0.5, 0.2, 0.04); ctx.fill();
      }
      if (kind === 'police') {
        ctx.fillStyle = '#1f4fbf'; ctx.fillRect(-hw + 0.02, -0.4, 0.1, 1.8); ctx.fillRect(hw - 0.12, -0.4, 0.1, 1.8);
        ctx.fillStyle = '#20232a'; rr(ctx, -0.6, (wsR + rwF) / 2 - 0.12, 1.2, 0.24, 0.06); ctx.fill();
      }
    }
    // Farlar ve stoplar (kapalı hâl)
    ctx.fillStyle = night ? '#e8e2c8' : '#fbf6e2';
    rr(ctx, -hw + 0.14, -hl + 0.05, 0.42, 0.15, 0.06); ctx.fill(); rr(ctx, hw - 0.56, -hl + 0.05, 0.42, 0.15, 0.06); ctx.fill();
    ctx.fillStyle = '#9a171b';
    rr(ctx, -hw + 0.12, hl - 0.17, 0.42, 0.13, 0.05); ctx.fill(); rr(ctx, hw - 0.54, hl - 0.17, 0.42, 0.13, 0.05); ctx.fill();
  }
  function sprite(kind, color, scale, night) {
    const K = KINDS[kind] || KINDS.sedan;
    const s = Math.max(2, Math.round(scale * 4) / 4);
    const key = kind + '|' + color + '|' + s + '|' + (night ? 1 : 0);
    let sp = _spr.get(key);
    if (sp) return sp;
    const pad = 1.1, dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.ceil((K.W + pad * 2) * s * dpr), H = Math.ceil((K.L + pad * 2) * s * dpr);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.scale(s * dpr, s * dpr);
    x.translate(K.W / 2 + pad, K.L / 2 + pad);
    // Yumuşak gölge
    x.save();
    x.shadowColor = night ? 'rgba(0,0,0,.6)' : 'rgba(40,28,12,.42)';
    x.shadowBlur = 0.55 * s * dpr; x.shadowOffsetX = 0.28 * s * dpr; x.shadowOffsetY = 0.42 * s * dpr;
    x.fillStyle = '#000';
    if (kind === 'moto') { rr(x, -0.32, -K.L / 2, 0.64, K.L, 0.3); x.fill(); }
    else { bodyPath(x, K.W / 2, K.L / 2); x.fill(); }
    x.restore();
    drawVehicle(x, kind, color, night);
    sp = { c, w: W / dpr / s, h: H / dpr / s, pad };
    _spr.set(key, sp);
    if (_spr.size > 160) _spr.delete(_spr.keys().next().value);
    return sp;
  }
  // o: { kind, color, brake, blinkL, blinkR, head, siren, night }
  function vehicle(ctx, v, x, y, ang, o) {
    const K = KINDS[o.kind] || KINDS.sedan, hl = K.L / 2, hw = K.W / 2;
    const sp = sprite(o.kind || 'sedan', o.color || '#2f63c8', v.scale, o.night);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
    const t = performance.now() / 1000;
    ctx.globalCompositeOperation = 'lighter';
    if (o.head || o.night) {
      ctx.fillStyle = 'rgba(255,248,220,.95)';
      rr(ctx, -hw + 0.14, -hl + 0.05, 0.42, 0.15, 0.06); ctx.fill(); rr(ctx, hw - 0.56, -hl + 0.05, 0.42, 0.15, 0.06); ctx.fill();
      if (o.night && o.beams !== false) {
        const L = o.high ? 26 : 14, Wd = o.high ? 6.5 : 4.6;
        const g = ctx.createLinearGradient(0, -hl, 0, -hl - L);
        g.addColorStop(0, 'rgba(255,240,200,.3)'); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-hw + 0.2, -hl); ctx.lineTo(hw - 0.2, -hl); ctx.lineTo(Wd, -hl - L); ctx.lineTo(-Wd, -hl - L); ctx.closePath(); ctx.fill();
      }
    }
    if (o.brake || o.night) {
      const a = o.brake ? 1 : 0.5;
      ctx.fillStyle = `rgba(255,50,40,${a})`;
      rr(ctx, -hw + 0.12, hl - 0.17, 0.42, 0.13, 0.05); ctx.fill(); rr(ctx, hw - 0.54, hl - 0.17, 0.42, 0.13, 0.05); ctx.fill();
      glow(ctx, -hw + 0.33, hl - 0.1, o.brake ? 0.9 : 0.55, '#ff2a1f', a * 0.8); glow(ctx, hw - 0.33, hl - 0.1, o.brake ? 0.9 : 0.55, '#ff2a1f', a * 0.8);
    }
    const on = Math.floor(t / 0.38) % 2 === 0;
    for (const [flag, sx] of [[o.blinkL, -1], [o.blinkR, 1]]) {
      if (!flag || !on) continue;
      ctx.fillStyle = '#ffb000';
      ctx.fillRect(sx * hw - (sx > 0 ? 0.22 : 0), -hl + 0.1, 0.22, 0.22); ctx.fillRect(sx * hw - (sx > 0 ? 0.22 : 0), hl - 0.32, 0.22, 0.22);
      glow(ctx, sx * (hw - 0.1), -hl + 0.2, 0.8, '#ffb000', 0.9); glow(ctx, sx * (hw - 0.1), hl - 0.2, 0.8, '#ffb000', 0.9);
    }
    if (o.siren) {
      const ph = Math.floor(t * 4) % 2;
      const by = o.kind === 'ambulance' ? -hl + 1.66 : -0.2;
      ctx.fillStyle = ph ? '#ff2a2a' : '#6a1010'; rr(ctx, -0.7, by, 0.68, 0.26, 0.08); ctx.fill();
      ctx.fillStyle = ph ? '#16305f' : '#2f7bff'; rr(ctx, 0.02, by, 0.68, 0.26, 0.08); ctx.fill();
      glow(ctx, ph ? -0.36 : 0.36, by + 0.13, 2.6, ph ? '#ff2a2a' : '#2f7bff', 0.75);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /* ---------- Yayalar ---------- */
  // o: { shirt, pants, hair, skin, phase, walk, umbrella, cane, elder, officer }
  function ped(ctx, v, x, y, ang, o = {}) {
    const ph = o.phase || 0, sw = o.walk === false ? 0 : Math.sin(ph), k = o.k || 1.8;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0.12, 0.16, 0.34, 0.26, 0, 0, TAU); ctx.fill();
    // Bacaklar
    ctx.fillStyle = shade(o.pants || '#34405a', -0.1);
    ctx.beginPath(); ctx.ellipse(-0.11, -sw * 0.2, 0.08, 0.16, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.11, sw * 0.2, 0.08, 0.16, 0, 0, TAU); ctx.fill();
    if (o.officer) {
      // Kollar yana açık (trafik görevlisi)
      ctx.strokeStyle = '#1f2f55'; ctx.lineWidth = 0.13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-0.2, 0); ctx.lineTo(-0.78, 0); ctx.moveTo(0.2, 0); ctx.lineTo(0.78, 0); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-0.82, 0, 0.08, 0, TAU); ctx.arc(0.82, 0, 0.08, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = o.shirt || '#e07a3a';
      ctx.beginPath(); ctx.ellipse(-0.27, sw * 0.14, 0.07, 0.13, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0.27, -sw * 0.14, 0.07, 0.13, 0, 0, TAU); ctx.fill();
    }
    // Gövde
    const sh = o.officer ? '#1f2f55' : o.shirt || '#e07a3a';
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0, 0, 0.26, 0.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(-0.05, -0.04, 0.16, 0.07, 0, 0, TAU); ctx.fill();
    if (o.officer) { ctx.fillStyle = '#d7f24a'; ctx.fillRect(-0.24, -0.05, 0.48, 0.07); }
    // Baş
    ctx.fillStyle = o.skin || '#e5b48a'; ctx.beginPath(); ctx.arc(0, -0.04, 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = o.officer ? '#f4f5f7' : o.elder ? '#d9dade' : o.hair || '#3b2a1f';
    ctx.beginPath(); ctx.arc(0, 0.0, 0.115, 0, TAU); ctx.fill();
    if (o.officer) { ctx.fillStyle = '#1f2f55'; ctx.fillRect(-0.12, -0.03, 0.24, 0.04); }
    if (o.cane) { ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0.3, 0); ctx.lineTo(0.36, -0.42 + sw * 0.05); ctx.stroke(); }
    if (o.umbrella) {
      const n = 8, R = 0.62;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? o.umbrella : shade(o.umbrella, -0.15); ctx.beginPath(); ctx.moveTo(0, -0.05); ctx.arc(0, -0.05, R, (i / n) * TAU, ((i + 1) / n) * TAU); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#2b2d33'; ctx.beginPath(); ctx.arc(0, -0.05, 0.05, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- Yardımcılar ---------- */
  // Statik katman: sahneyi tuval boyutunda ekran dışı tuvale çizer
  function bake(stage, draw) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(stage.w * stage.dpr)); c.height = Math.max(1, Math.round(stage.h * stage.dpr));
    const x = c.getContext('2d');
    x.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    draw(x);
    return c;
  }
  // Yol boyunca bir noktanın konumu ve yönü (düz çizgiler + yaylar içeren yollar için)
  function pathPts(pts, step = 0.25) {
    // pts: [[x,y],...] köşe noktaları; Catmull-Rom yerine basit yay yumuşatma
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) out.push([lerp(x0, x1, k / n), lerp(y0, y1, k / n)]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // Kuadratik/kübik eğriler dâhil yol tanımı: segs = [{p:[x,y]}, {q:[cx,cy], p:[x,y]}, {c:[c1x,c1y,c2x,c2y], p:[x,y]}]
  function route(segs, step = 0.2) {
    const pts = [];
    let [px, py] = segs[0].p;
    pts.push([px, py]);
    for (let i = 1; i < segs.length; i++) {
      const s = segs[i];
      const [x, y] = s.p || [0, 0];
      if (s.q) {
        const [cx, cy] = s.q, L = Math.hypot(cx - px, cy - py) + Math.hypot(x - cx, y - cy), n = Math.max(2, Math.ceil(L / step));
        for (let k = 1; k <= n; k++) { const t = k / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; pts.push([a * px + b * cx + c * x, a * py + b * cy + c * y]); }
      } else if (s.arc) {
        const [cx, cy, r, a0, a1] = s.arc, n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / step));
        for (let k = 1; k <= n; k++) { const a = lerp(a0, a1, k / n); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      } else {
        const L = Math.hypot(x - px, y - py), n = Math.max(1, Math.ceil(L / step));
        for (let k = 1; k <= n; k++) pts.push([lerp(px, x, k / n), lerp(py, y, k / n)]);
      }
      [px, py] = pts[pts.length - 1];
    }
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = acc[acc.length - 1];
    return {
      len,
      at(d) {
        d = clamp(d, 0, len);
        let lo = 0, hi = acc.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (acc[m] <= d) lo = m; else hi = m; }
        const t = acc[hi] > acc[lo] ? (d - acc[lo]) / (acc[hi] - acc[lo]) : 0;
        const [x0, y0] = pts[lo], [x1, y1] = pts[hi];
        return { x: lerp(x0, x1, t), y: lerp(y0, y1, t), ang: Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2 };
      },
      pts
    };
  }
  // Konuşma balonu (ekran koordinatı)
  function bubble(ctx, X, Y, text, color = '#16171b', bg = '#ffffff', fs = 13) {
    ctx.save();
    ctx.font = `800 ${fs}px Archivo, Arial, sans-serif`;
    const w = ctx.measureText(text).width + 20, h = fs + 14;
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    ctx.fillStyle = bg; rr(ctx, X - w / 2, Y - h - 8, w, h, h / 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(X - 6, Y - 9); ctx.lineTo(X, Y - 1); ctx.lineTo(X + 6, Y - 9); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = color; ctx.lineWidth = 2; rr(ctx, X - w / 2, Y - h - 8, w, h, h / 2); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, X, Y - h / 2 - 8 + 1);
    ctx.restore();
  }
  // Harf rozeti (A, B, C)
  function badge(ctx, X, Y, label, bg = '#16171b', r = 12) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(r * 1.05)}px Archivo, Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, X, Y + 0.5);
    ctx.restore();
  }

  window.YildizTop = { palette, View2D, D, vehicle, ped, bake, route, bubble, badge, KINDS, sprite, speckle };
})();
