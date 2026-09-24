/* Ürgüp Yıldız Sürücü Kursu — Trafik Akademisi 3B yol görünümü
   Perspektif izdüşümlü düz yol: gökyüzü + Kapadokya silueti, yol yüzeyi ve çizgileri,
   binalar, ağaçlar, peri bacaları, trafik ışıkları, levhalar, araçlar, yayalar, gece ışıkları ve hava durumu.
   Koordinatlar metre: x sağa, y yukarı, z ileri (yolun yönü). */
(() => {
  'use strict';
  const G = window.YildizGfx;
  if (!G) return;
  const { TAU, clamp, lerp, mix, shade, alpha, rng, rr, svgImage, ready } = G;

  /* ---------- Paletler (gündüz = aydınlık tema, gece = karanlık tema) ---------- */
  const BASE = {
    day: {
      night: false,
      sky: ['#5fa6df', '#a7d0ee', '#eadfca'], haze: '#e6dcc7', sun: '#fff6de',
      mount: '#9fb0c6', snow: '#f5f7fb', ridge: '#dcc19a', ridge2: '#cfb088', ridgeShade: '#b99670',
      ground: '#d6c297', groundFar: '#e2d5b8', field: ['#cdbb86', '#c6b27b'], patch: ['#a9b264', '#b9a978', '#98a95b', '#c9a877'],
      road: '#4b4f58', road2: '#4f535c', wear: '#454952', shoulder: '#bcae90', line: '#f2efe7', lineY: '#f0c419',
      curb: '#dcd5c7', curbTop: '#efe9dd', walk: '#d0c4ad', walk2: '#c9bca4', lot: '#c8b894', garden: '#a8b56e',
      trunk: '#6b4d33', leaf: ['#557232', '#6f8f3f', '#8dad55'], poplar: ['#4c6b2c', '#658a3b', '#86a854'],
      rock: ['#efd8b3', '#dcbd93', '#c49f74'], cap: '#7a695c',
      bld: ['#ecdcbf', '#e6cea9', '#dcbc93', '#f1e8d8', '#dec7a5', '#d2b08a', '#e9d6b6'], win: '#34424f', winFrame: '#f6efe1', winLit: '#ffd88a', door: '#6b4a33',
      pole: '#7a8089', poleDark: '#50555d', metal: '#9aa1ab', shadow: 'rgba(40,28,15,', cloud: '#ffffff'
    },
    night: {
      night: true,
      sky: ['#050816', '#0e1630', '#27304c'], haze: '#1d2540', sun: '#fdf3d8',
      mount: '#18203a', snow: '#465370', ridge: '#232a40', ridge2: '#1f2539', ridgeShade: '#1a1f31',
      ground: '#151a26', groundFar: '#1c2336', field: ['#171d2a', '#1a2030'], patch: ['#18241f', '#1d2130', '#172319', '#221f28'],
      road: '#23272f', road2: '#262a33', wear: '#1f2229', shoulder: '#2a2d36', line: '#c9ccd3', lineY: '#b8961c',
      curb: '#3a3f4b', curbTop: '#474d5b', walk: '#2a2f3b', walk2: '#272c37', lot: '#22262f', garden: '#1b2620',
      trunk: '#2b2320', leaf: ['#16221a', '#1d2c20', '#283a2a'], poplar: ['#142019', '#1b2a1f', '#253727'],
      rock: ['#3b3a48', '#2f2f3c', '#262633'], cap: '#1c1b22',
      bld: ['#2e3342', '#33384a', '#2a3040', '#363c4e', '#30364a', '#2b2f3e', '#343a4c'], win: '#1a1f2b', winFrame: '#3c4252', winLit: '#ffcf73', door: '#241d1a',
      pole: '#3c414b', poleDark: '#2a2e36', metal: '#4a505b', shadow: 'rgba(0,0,0,', cloud: '#2b3450'
    }
  };
  const WEATHER = {
    rain: { day: { sky: ['#8792a0', '#a9b2bd', '#c3c6c8'], haze: '#b9bdc0', road: '#3a3e45', road2: '#3d4148', ground: '#b3a78c', field: ['#aa9f84', '#a4997d'] },
      night: { sky: ['#07090f', '#10141e', '#1d2230'], haze: '#1a1e29', road: '#1b1e25', road2: '#1d2027' } },
    snow: { day: { sky: ['#b9c4d1', '#d7dde4', '#eceef0'], haze: '#e4e7ea', ground: '#eef1f4', groundFar: '#e9ecef', field: ['#f2f4f7', '#e9edf1'], patch: ['#e4e9ee', '#dfe5ea', '#e9edf2', '#e1e6eb'], shoulder: '#e8ecf0', road: '#8a8f97', road2: '#8d929a', wear: '#4d525a', walk: '#e9edf1', walk2: '#e3e8ed', lot: '#e5e9ee', garden: '#e7ebef', curb: '#f4f6f8', curbTop: '#ffffff' },
      night: { ground: '#2c3446', groundFar: '#2a3142', field: ['#2d3547', '#2a3244'], patch: ['#2b3345', '#293143', '#2e3648', '#283042'], shoulder: '#2d3447', road: '#3a404d', road2: '#3c4250', wear: '#20242c', walk: '#2e3547', walk2: '#2b3244', garden: '#2b3345' } },
    ice: { day: { sky: ['#7fb2e0', '#bcd9ef', '#e6eef4'], haze: '#dde6ee', road: '#5a6572', road2: '#5d6876', wear: '#4f5966', ground: '#dfe4e8', field: ['#e3e8ec', '#dbe1e6'], shoulder: '#d9dfe5', walk: '#dfe5ea', walk2: '#d9dfe5', garden: '#d5dfe2', lot: '#dde3e7' },
      night: { road: '#26303c', road2: '#29333f', ground: '#1f2733', field: ['#212a36', '#1f2833'] } }
  };
  function palette(night, weather) {
    const P = Object.assign({}, BASE[night ? 'night' : 'day']);
    const w = weather && WEATHER[weather];
    if (w) Object.assign(P, w[night ? 'night' : 'day'] || {});
    P.weather = weather || 'dry';
    return P;
  }

  /* ---------- Kamera ve izdüşüm ---------- */
  function clipNear(pts, n) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ia = a[2] >= n, ib = b[2] >= n;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (n - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, n]); }
    }
    return out;
  }
  class View3D {
    constructor() {
      this.cam = { x: 0, y: 2.2, z: 0, yaw: 0 };
      this.hfov = 62; this.near = 0.4; this.far = 440; this.mirror = false;
      this.vx = 0; this.vy = 0; this.vw = 100; this.vh = 100; this.cx = 50; this.cy = 30; this.f = 100;
      this.fogColor = '#e6dcc7'; this.fogStart = 55; this.fogEnd = 440;
      this.c = 1; this.s = 0; this.t = 0;
      this._fc = new Map();
    }
    viewport(x, y, w, h, horizon = 0.34, fMin = 0.95) {
      this.vx = x; this.vy = y; this.vw = w; this.vh = h;
      this.cx = x + w / 2; this.cy = y + h * horizon;
      this.f = Math.max((w / 2) / Math.tan((this.hfov * Math.PI) / 360), h * fMin);
    }
    look() { this.c = Math.cos(this.cam.yaw); this.s = Math.sin(this.cam.yaw); this.fwd = this.c >= 0; }
    tc(x, y, z) { const dx = x - this.cam.x, dz = z - this.cam.z; return [dx * this.c - dz * this.s, y - this.cam.y, dx * this.s + dz * this.c]; }
    P(x, y, z) {
      const dx = x - this.cam.x, dz = z - this.cam.z;
      const a = dx * this.c - dz * this.s, d = dx * this.s + dz * this.c;
      if (d < this.near) return null;
      const s = this.f / d;
      return { X: this.cx + (this.mirror ? -a : a) * s, Y: this.cy - (y - this.cam.y) * s, s, d };
    }
    fog(d) { return clamp((d - this.fogStart) / (this.fogEnd - this.fogStart), 0, 1); }
    fc(col, d) {
      const t = Math.round(this.fog(d) * 20);
      if (!t) return col;
      const k = col + t;
      let v = this._fc.get(k);
      if (!v) { v = mix(col, this.fogColor, (t / 20) * 0.93); if (this._fc.size > 4000) this._fc.clear(); this._fc.set(k, v); }
      return v;
    }
    setFog(col) { if (col !== this.fogColor) { this.fogColor = col; this._fc.clear(); } }
    // Dünya uzayındaki çokgeni yakın düzleme göre kırpıp çizer
    path(ctx, pts) {
      let cs = pts.map((p) => this.tc(p[0], p[1], p[2]));
      let behind = false;
      for (const p of cs) if (p[2] < this.near) { behind = true; break; }
      if (behind) cs = clipNear(cs, this.near);
      if (cs.length < 3) return false;
      let far = true;
      for (const p of cs) if (p[2] < this.far) { far = false; break; }
      if (far) return false;
      ctx.beginPath();
      for (let i = 0; i < cs.length; i++) {
        const p = cs[i], s = this.f / p[2];
        const X = this.cx + (this.mirror ? -p[0] : p[0]) * s, Y = this.cy - p[1] * s;
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      ctx.closePath();
      return true;
    }
    poly(ctx, pts, fill) { if (!this.path(ctx, pts)) return false; ctx.fillStyle = fill; ctx.fill(); return true; }
    // Yere paralel dörtgen: dört köşe de kameranın önündeyse dizi oluşturmadan doğrudan çiz
    quad(ctx, x0, x1, z0, z1, fill, y = 0) {
      const c = this.c, s = this.s, ax0 = x0 - this.cam.x, ax1 = x1 - this.cam.x, az0 = z0 - this.cam.z, az1 = z1 - this.cam.z;
      const d00 = ax0 * s + az0 * c, d10 = ax1 * s + az0 * c, d11 = ax1 * s + az1 * c, d01 = ax0 * s + az1 * c, n = this.near;
      if (d00 < n || d10 < n || d11 < n || d01 < n) return this.poly(ctx, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill);
      const F = this.far;
      if (d00 > F && d10 > F && d11 > F && d01 > F) return false;
      const f = this.f, m = this.mirror ? -f : f, X = this.cx, Y = this.cy, yf = (y - this.cam.y) * f;
      const X00 = X + (ax0 * c - az0 * s) * m / d00, X10 = X + (ax1 * c - az0 * s) * m / d10, X11 = X + (ax1 * c - az1 * s) * m / d11, X01 = X + (ax0 * c - az1 * s) * m / d01;
      const L = this.vx - 2, R = this.vx + this.vw + 2;
      if ((X00 < L && X10 < L && X11 < L && X01 < L) || (X00 > R && X10 > R && X11 > R && X01 > R)) return false;
      ctx.beginPath();
      ctx.moveTo(X00, Y - yf / d00); ctx.lineTo(X10, Y - yf / d10); ctx.lineTo(X11, Y - yf / d11); ctx.lineTo(X01, Y - yf / d01);
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      return true;
    }
    depth(z) { return (z - this.cam.z) * this.c + 0 * this.s; }
  }

  /* ---------- Gökyüzü ve uzak manzara ---------- */
  const SKY = { stars: null, ridge: null, clouds: null, balloons: null };
  function ensureSky() {
    if (SKY.stars) return;
    const r = rng(11);
    SKY.stars = Array.from({ length: 150 }, () => [r(), r() * r(), 0.4 + r() * 1.3, r() * 6]);
    // Kapadokya sırtı: düz tepeli kayalıklar ve peri bacaları (0..1 genişlik, 0..1 yükseklik)
    const rr2 = rng(23), pts = [];
    let x = -0.05;
    while (x < 1.35) {
      const kind = rr2();
      if (kind < 0.45) { const w = 0.05 + rr2() * 0.1, h = 0.25 + rr2() * 0.35; pts.push({ k: 'mesa', x, w, h }); x += w * 0.8; }
      else if (kind < 0.85) { const n = 1 + Math.floor(rr2() * 3); for (let i = 0; i < n; i++) { const w = 0.012 + rr2() * 0.016, h = 0.35 + rr2() * 0.55; pts.push({ k: 'cone', x: x + i * w * 1.3, w, h }); } x += n * 0.028 + 0.01; }
      else x += 0.03 + rr2() * 0.05;
    }
    SKY.ridge = pts;
    SKY.clouds = Array.from({ length: 5 }, (_, i) => ({ x: r() * 1.4 - 0.2, y: 0.08 + r() * 0.5, s: 0.6 + r() * 0.8, sp: 0.004 + r() * 0.006, n: 4 + Math.floor(r() * 3), seed: i * 17 + 3 }));
    const cols = [['#e8412f', '#ffd24a', '#1f5fd1'], ['#1aa39a', '#f4f1e8', '#e8412f'], ['#ff8a3d', '#7b3fa0', '#ffd24a'], ['#3d7bff', '#ffffff', '#ff8a3d'], ['#2e7d4f', '#ffd24a', '#e8412f']];
    SKY.balloons = Array.from({ length: 5 }, (_, i) => ({ x: 0.08 + r() * 0.95, y: 0.12 + r() * 0.55, s: 0.45 + r() * 0.8, sp: (r() - 0.5) * 0.01, bob: r() * 6, c: cols[i % cols.length] }));
  }
  function drawBalloon(ctx, x, y, s, c) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = 'rgba(80,60,40,.6)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-5, 11); ctx.lineTo(-2.4, 19); ctx.moveTo(5, 11); ctx.lineTo(2.4, 19); ctx.stroke();
    ctx.fillStyle = '#7a5433'; rr(ctx, -2.8, 18.5, 5.6, 4.2, 1); ctx.fill();
    const env = () => { ctx.beginPath(); ctx.moveTo(0, -13); ctx.bezierCurveTo(10, -13, 12.5, -3, 8.5, 4); ctx.quadraticCurveTo(6, 9, 4.2, 11.5); ctx.lineTo(-4.2, 11.5); ctx.quadraticCurveTo(-6, 9, -8.5, 4); ctx.bezierCurveTo(-12.5, -3, -10, -13, 0, -13); ctx.closePath(); };
    env(); ctx.fillStyle = c[0]; ctx.fill();
    ctx.save(); env(); ctx.clip();
    ctx.fillStyle = c[1];
    for (let i = -2; i <= 2; i += 2) { ctx.beginPath(); ctx.ellipse(i * 3.1, 0, 1.6, 14, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = c[2]; ctx.fillRect(-13, 3.5, 26, 3);
    const g = ctx.createLinearGradient(-10, 0, 10, 0); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = g; ctx.fillRect(-13, -14, 26, 27);
    ctx.restore();
    ctx.restore();
  }
  // Gökyüzü: durağan katman (gradyan, yıldızlar, ay/güneş, dağ, sırt, ufuk pusu) önbellekte tutulur;
  // bulutlar ve balonlar her karede üstüne çizilir.
  function skyStatic(ctx, v, P, opts) {
    const { vx, vy, vw, cy } = v, top = vy;
    const H = Math.max(10, cy - top);
    const g = ctx.createLinearGradient(0, top, 0, cy + 2);
    g.addColorStop(0, P.sky[0]); g.addColorStop(0.62, P.sky[1]); g.addColorStop(1, P.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(vx, top, vw, H + 3);
    const px = skyX(v);
    if (P.night) {
      ctx.fillStyle = '#ffffff';
      for (const [sx, sy, sz, ph] of SKY.stars) { ctx.globalAlpha = 0.3 + 0.4 * ((Math.sin(ph * 7) + 1) / 2); ctx.fillRect(px(sx), top + sy * H * 0.9, sz, sz); }
      ctx.globalAlpha = 1;
      if (P.weather === 'dry' || P.weather === 'ice') {
        const mx = px(0.78), my = top + H * 0.28, mr = Math.max(9, vw * 0.018);
        G.glow(ctx, mx, my, mr * 5, '#c9d6ff', 0.35);
        ctx.fillStyle = '#f6f1dc'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
        ctx.fillStyle = P.sky[1]; ctx.beginPath(); ctx.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.86, 0, TAU); ctx.fill();
      }
    } else if (P.weather === 'dry' || P.weather === 'ice') {
      const sx = px(0.82), sy = top + H * 0.22, sr = Math.max(14, vw * 0.03);
      G.glow(ctx, sx, sy, sr * 7, '#fff1c8', 0.55);
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    }
    // Uzak dağ (Erciyes) ve Kapadokya sırtı
    const mx = px(0.66), mw = vw * 0.55, mh = H * 0.34;
    ctx.fillStyle = P.mount;
    ctx.beginPath(); ctx.moveTo(mx - mw / 2, cy + 1); ctx.quadraticCurveTo(mx - mw * 0.2, cy - mh * 0.55, mx - mw * 0.05, cy - mh); ctx.lineTo(mx + mw * 0.04, cy - mh * 0.97); ctx.quadraticCurveTo(mx + mw * 0.22, cy - mh * 0.5, mx + mw / 2, cy + 1); ctx.fill();
    ctx.fillStyle = P.snow;
    ctx.beginPath(); ctx.moveTo(mx - mw * 0.05, cy - mh); ctx.lineTo(mx + mw * 0.04, cy - mh * 0.97); ctx.lineTo(mx + mw * 0.09, cy - mh * 0.78); ctx.lineTo(mx + mw * 0.05, cy - mh * 0.82); ctx.lineTo(mx + mw * 0.02, cy - mh * 0.74); ctx.lineTo(mx - mw * 0.03, cy - mh * 0.8); ctx.lineTo(mx - mw * 0.08, cy - mh * 0.76); ctx.lineTo(mx - mw * 0.1, cy - mh * 0.84); ctx.closePath(); ctx.fill();
    if (!opts.noRidge) {
      const rh = H * 0.2;
      const drawRidge = (off, col, sc) => {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(vx, cy + 2);
        for (const p of SKY.ridge) {
          const x0 = px(p.x * 0.74 + off);
          const w = p.w * vw * 0.74, h = p.h * rh * sc;
          if (p.k === 'mesa') { ctx.lineTo(x0, cy + 2); ctx.quadraticCurveTo(x0 + w * 0.1, cy - h, x0 + w * 0.25, cy - h); ctx.lineTo(x0 + w * 0.75, cy - h * 1.03); ctx.quadraticCurveTo(x0 + w * 0.92, cy - h, x0 + w, cy + 2); }
          else { ctx.lineTo(x0, cy + 2); ctx.quadraticCurveTo(x0 + w * 0.35, cy - h * 0.7, x0 + w * 0.42, cy - h); ctx.lineTo(x0 + w * 0.58, cy - h); ctx.quadraticCurveTo(x0 + w * 0.65, cy - h * 0.7, x0 + w, cy + 2); }
        }
        ctx.lineTo(vx + vw, cy + 2); ctx.closePath(); ctx.fill();
      };
      drawRidge(0.37, mix(P.ridge2, P.haze, 0.45), 1.15);
      drawRidge(0, mix(P.ridge, P.haze, 0.25), 0.8);
    }
    const hz = ctx.createLinearGradient(0, cy - H * 0.3, 0, cy + 1);
    hz.addColorStop(0, alpha(P.haze, 0)); hz.addColorStop(1, alpha(P.haze, P.night ? 0.55 : 0.75));
    ctx.fillStyle = hz; ctx.fillRect(vx, cy - H * 0.3, vw, H * 0.3 + 1);
  }
  const skyX = (v) => { const { vx, vw } = v, yawShift = (v.cam.yaw || 0) * v.f * 0.6; return (u) => vx + ((((u * vw - yawShift) % (vw * 1.35)) + vw * 1.35) % (vw * 1.35)) - vw * 0.15; };
  function drawSky(ctx, v, P, t, opts = {}) {
    ensureSky();
    const { vx, vy, vw, cy } = v, top = vy, H = Math.max(10, cy - top);
    const m = ctx.getTransform(), dpr = m.a || 1;
    const key = [Math.round(vw), Math.round(H), dpr, P.night ? 1 : 0, P.weather, Math.round((v.cam.yaw || 0) * v.f * 0.6), opts.noRidge ? 1 : 0].join('|');
    let c = v._sky;
    if (!c || c._key !== key) {
      c = v._sky || document.createElement('canvas');
      c.width = Math.max(1, Math.round(vw * dpr)); c.height = Math.max(1, Math.round((H + 4) * dpr));
      const x = c.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, -vx * dpr, -top * dpr);
      skyStatic(x, v, P, opts);
      c._key = key; v._sky = c;
    }
    ctx.drawImage(c, vx, top, vw, H + 4);
    const px = skyX(v);
    // Bulutlar
    if (!P.night || P.weather === 'rain') {
      const cc = P.weather === 'rain' ? (P.night ? '#141824' : '#9aa3ae') : P.weather === 'snow' ? '#f4f6f8' : P.cloud;
      ctx.fillStyle = cc;
      ctx.globalAlpha = P.weather === 'rain' ? 0.9 : 0.85;
      for (const cl of SKY.clouds) {
        const cx = px(cl.x + t * cl.sp), cyy = top + cl.y * H * 0.8, s = cl.s * Math.max(0.7, vw / 900);
        const r = rng(cl.seed);
        for (let i = 0; i < cl.n; i++) { ctx.beginPath(); ctx.ellipse(cx + (i - cl.n / 2) * 22 * s, cyy + (r() - 0.5) * 8 * s, (22 + r() * 18) * s, (11 + r() * 8) * s, 0, 0, TAU); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    // Balonlar (gündüz, kuru havada)
    if (!P.night && P.weather === 'dry' && opts.balloons !== false) {
      for (const b of SKY.balloons) {
        const bx = px(b.x + t * b.sp), by = top + b.y * H + Math.sin(t * 0.6 + b.bob) * 3;
        drawBalloon(ctx, bx, by, b.s * Math.max(0.75, vw / 820), b.c);
      }
    }
  }
  function drawGroundBase(ctx, v, P) {
    const g = ctx.createLinearGradient(0, v.cy, 0, v.vy + v.vh);
    g.addColorStop(0, P.groundFar); g.addColorStop(0.35, P.ground); g.addColorStop(1, shade(P.ground, P.night ? -0.1 : -0.06));
    ctx.fillStyle = g;
    ctx.fillRect(v.vx, v.cy - 1, v.vw, v.vy + v.vh - v.cy + 1);
  }

  /* ---------- Dünya: düz yol + parça parça üretilen çevre ---------- */
  class World {
    // o: { kind: 'town'|'rural'|'suburb', seed, spacing, first, center(z), extras(world,z0,z1) }
    constructor(o = {}) {
      this.o = o;
      this.kind = o.kind || 'rural';
      this.half = 3.5;
      this.objs = [];
      this.patches = [];
      this.inters = [];
      this.genZ = o.startZ != null ? o.startZ : -120;
      this.r = rng(o.seed || 5);
      this.center = o.center || ((z) => this.defaultCenter(z));
      this.spacing = o.spacing || 0;
      this.first = o.first || 140;
      if (this.kind === 'town' && this.spacing) for (let k = 0; k < 400; k++) this.inters.push({ id: k, z: this.first + k * this.spacing });
    }
    // Kavşaklar eşit aralıklı: aramalar dizin hesabıyla sabit zamanda
    interIdx(z) { return this.spacing ? Math.floor((z - this.first) / this.spacing) : -1; }
    interNear(z, pad = 0) {
      if (!this.inters.length) return null;
      const k = Math.round((z - this.first) / this.spacing), it = this.inters[k];
      return it && z > it.z - 6.9 - pad && z < it.z + 6.9 + pad ? it : null;
    }
    nextInter(z) { if (!this.inters.length) return null; const k = Math.max(0, this.interIdx(z) + 1); return this.inters[k] || null; }
    prevInter(z) { if (!this.inters.length) return null; const k = this.interIdx(z - 1e-6); return k >= 0 ? this.inters[k] || null : null; }
    intersIn(zA, zB) { if (!this.inters.length) return []; const a = Math.max(0, this.interIdx(zA)), b = Math.min(this.inters.length - 1, this.interIdx(zB) + 1); return this.inters.slice(a, b + 1); }
    defaultCenter(z) {
      if (this.kind === 'town') {
        const it = this.nextInter(z - 7);
        if (it && z > it.z - 7) return 'none';
        if (it && z > it.z - 40) return 'duz';
        return 'kesik';
      }
      return 'kesik';
    }
    ensure(zmax) { while (this.genZ < zmax) { const z0 = this.genZ, z1 = z0 + 30; this.gen(z0, z1); if (this.o.extras) this.o.extras(this, z0, z1); this.genZ = z1; } }
    prune(zmin) {
      this.objs = this.objs.filter((o) => (o.z1 != null ? o.z1 : o.z) > zmin);
      this.patches = this.patches.filter((p) => p.z1 > zmin);
    }
    add(o) { this.objs.push(o); return o; }
    gen(z0, z1) {
      const r = this.r;
      if (this.kind === 'town') this.genTown(z0, z1, r);
      else if (this.kind === 'suburb') this.genSuburb(z0, z1, r);
      else if (this.kind === 'highway') this.genHighway(z0, z1, r);
      else this.genRural(z0, z1, r);
    }
    building(side, xi, z0, z1, r, opts = {}) {
      const floors = opts.floors || (2 + Math.floor(r() * 3));
      const shop = opts.shop != null ? opts.shop : r() < 0.55;
      const b = { type: 'bld', side, xi, depth: opts.depth || 11, z0, z1, floors, h: floors * 3.1 + 0.7, ci: Math.floor(r() * 7), shop, awn: Math.floor(r() * 4), seed: Math.floor(r() * 1e6), sign: opts.sign || null };
      const lr = rng(b.seed);
      b.lit = Array.from({ length: 40 }, () => lr() < 0.55);
      return this.add(b);
    }
    genTown(z0, z1, r) {
      const SIGNS = ['FIRIN', 'ECZANE', 'HALI', 'BAKKAL', 'KAFE', 'ŞARAP EVİ', 'KIRTASİYE', 'LOKANTA', 'TERZİ', 'ÇİÇEKÇİ'];
      for (const side of [1, -1]) {
        const key = side > 0 ? 'bR' : 'bL';
        let z = this[key] != null ? this[key] : z0;
        while (z < z1) {
          const it = this.interNear(z, 0.2) || this.interNear(z + 8);
          if (it) { z = it.z + 7.3; continue; }
          const next = this.nextInter(z);
          let len = 9 + r() * 10;
          if (next && z + len > next.z - 7.2) len = next.z - 7.2 - z;
          if (len > 5) {
            const b = this.building(side, 7, z, z + len, r);
            if (b.shop && r() < 0.6) { b.sign = SIGNS[Math.floor(r() * SIGNS.length)]; }
            if (!this.brand && side > 0 && z > 60 && b.shop) { b.sign = 'YILDIZ SÜRÜCÜ KURSU'; b.brand = true; this.brand = true; }
          }
          z += len + (r() < 0.25 ? 1.5 + r() * 2 : 0.2);
        }
        this[key] = z;
      }
      // Kaldırım ağaçları ve sokak lambaları
      for (let z = Math.ceil(z0 / 16) * 16; z < z1; z += 16) {
        for (const side of [1, -1]) if (!this.interNear(z, 5) && r() < 0.8) this.add({ type: 'tree', x: side * (5.7 + r() * 0.3), z: z + (side > 0 ? 0 : 8), r: 1.25 + r() * 0.45, h: 2.1 + r() * 0.5, seed: Math.floor(r() * 1e6) });
      }
      for (let z = Math.ceil(z0 / 36) * 36; z < z1; z += 36) {
        const side = (Math.round(z / 36) % 2) ? 1 : -1;
        if (!this.interNear(z, 3)) this.add({ type: 'lamp', x: side * 4.15, z: z + 4, side });
      }
    }
    genSuburb(z0, z1, r) {
      for (const side of [1, -1]) {
        const key = side > 0 ? 'bR' : 'bL';
        let z = this[key] != null ? this[key] : z0;
        while (z < z1) {
          const len = 10 + r() * 6;
          if (r() < 0.85) this.building(side, side > 0 ? 12.5 : 10, z, z + len, r, { floors: 1 + Math.floor(r() * 2), shop: false, depth: 9 });
          z += len + 2 + r() * 5;
        }
        this[key] = z;
      }
      for (let z = Math.ceil(z0 / 11) * 11; z < z1; z += 11) {
        if (r() < 0.75) this.add({ type: 'tree', x: 9.6 + r() * 1.2, z: z + r() * 4, r: 1.5 + r() * 0.6, h: 2.2 + r() * 0.6, seed: Math.floor(r() * 1e6) });
        if (r() < 0.65) this.add({ type: 'tree', x: -(7.4 + r() * 1.2), z: z + 5 + r() * 4, r: 1.4 + r() * 0.6, h: 2.1 + r() * 0.6, seed: Math.floor(r() * 1e6) });
      }
      for (let z = Math.ceil(z0 / 40) * 40; z < z1; z += 40) this.add({ type: 'lamp', x: 6.4, z, side: 1 });
    }
    genHighway(z0, z1, r) {
      for (let z = Math.ceil(z0 / 9) * 9; z < z1; z += 9) {
        if (r() < 0.55) this.add({ type: 'poplar', x: 13 + r() * 3, z, h: 9 + r() * 4, seed: Math.floor(r() * 1e6) });
        if (r() < 0.55) this.add({ type: 'poplar', x: -(13 + r() * 3), z: z + 4.5, h: 9 + r() * 4, seed: Math.floor(r() * 1e6) });
      }
      if (r() < 0.35) { const side = r() < 0.5 ? 1 : -1; this.add({ type: 'tree', x: side * (22 + r() * 30), z: z0 + r() * 30, r: 2 + r(), h: 2.2, seed: Math.floor(r() * 1e6) }); }
      if (r() < 0.3) { const side = r() < 0.5 ? 1 : -1, n = 1 + Math.floor(r() * 3); this.add({ type: 'rock', x: side * (45 + r() * 80), z: z0 + r() * 30, cones: Array.from({ length: n }, (_, i) => ({ dx: (i - (n - 1) / 2) * 7, h: 10 + r() * 14, w: 5 + r() * 4, cap: r() < 0.7 })), mesa: null }); }
    }
    genRural(z0, z1, r) {
      // Kavak sıraları
      if (this.popR == null) { this.popR = r() < 0.5; this.popL = r() < 0.5; this.popZ = z0 + 60 + r() * 140; }
      if (z0 > this.popZ) { this.popR = r() < 0.6; this.popL = r() < 0.5; this.popZ = z0 + 50 + r() * 160; }
      for (let z = Math.ceil(z0 / 7) * 7; z < z1; z += 7) {
        if (this.popR) this.add({ type: 'poplar', x: 9.5 + r() * 0.6, z, h: 9 + r() * 4, seed: Math.floor(r() * 1e6) });
        if (this.popL) this.add({ type: 'poplar', x: -(9.5 + r() * 0.6), z: z + 3.5, h: 9 + r() * 4, seed: Math.floor(r() * 1e6) });
      }
      // Tarla parçaları
      for (const side of [1, -1]) if (r() < 0.8) {
        const a = 5.5 + r() * 8, b = a + 20 + r() * 60;
        this.patches.push({ x0: side > 0 ? a : -b, x1: side > 0 ? b : -a, z0: z0 + r() * 10, z1: z1 + r() * 25, c: Math.floor(r() * 4), rows: r() < 0.45 });
      }
      // Dağınık ağaçlar
      if (r() < 0.7) { const side = r() < 0.5 ? 1 : -1; this.add({ type: 'tree', x: side * (14 + r() * 40), z: z0 + r() * 30, r: 1.8 + r() * 1.2, h: 2 + r() * 0.8, seed: Math.floor(r() * 1e6) }); }
      // Peri bacaları
      if (r() < 0.5) {
        const side = r() < 0.5 ? 1 : -1, x = side * (30 + r() * 90), n = 1 + Math.floor(r() * 4);
        const cones = Array.from({ length: n }, (_, i) => ({ dx: (i - (n - 1) / 2) * (6 + r() * 5), h: 9 + r() * 17, w: 5 + r() * 4, cap: r() < 0.75 }));
        this.add({ type: 'rock', x, z: z0 + r() * 30, cones, mesa: r() < 0.35 ? { w: 30 + r() * 30, h: 8 + r() * 8 } : null });
      }
      // Tek tük taş evler
      if (r() < 0.12) { const side = r() < 0.5 ? 1 : -1; this.building(side, 16 + r() * 16, z0 + 4, z0 + 14 + r() * 5, r, { floors: 1 + Math.floor(r() * 2), shop: false, depth: 8 }); }
    }
  }

  /* ---------- Zemin: yol, kaldırım, tarla ---------- */
  function bandsFor(W, zA, zB) {
    // Kavşak bölgelerini ayrı bantlar olarak ayır
    const out = [];
    let z = zA;
    for (const it of W.intersIn(zA - 7, zB + 7)) {
      if (it.z + 6.9 < zA) continue;
      if (it.z - 6.9 > zB) break;
      const a = it.z - 6.9, b = it.z - 3.6, c = it.z + 3.6, d = it.z + 6.9;
      if (z < a) out.push([z, a, 'st']);
      out.push([Math.max(z, a), b, 'cw', it]);
      out.push([b, c, 'cr', it]);
      out.push([c, d, 'cw', it]);
      z = d;
    }
    if (z < zB) out.push([z, zB, 'st']);
    return out.filter((b) => b[1] > b[0]);
  }
  function drawGround(ctx, v, W, P, lod = 0) {
    const fwd = v.fwd;
    const zA = fwd ? v.cam.z - 6 : v.cam.z - v.far, zB = fwd ? v.cam.z + v.far : v.cam.z + 6;
    const SEG = lod ? 12 : 6;
    const NEAR = lod ? 60 : 110; // bu mesafeden sonra zemin büyük parçalarla ve tek renkle çizilir
    const d = (z) => Math.abs(z - v.cam.z);
    const Q = (x0, x1, z0, z1, col) => v.quad(ctx, x0, x1, z0, z1, v.fc(col, d(fwd ? z0 : z1)));
    // Yakın bölge: SEG adımlı alternatif renkler; uzak bölge: 30 m parçalar
    const nearA = fwd ? zA : Math.max(zA, v.cam.z - NEAR), nearB = fwd ? Math.min(zB, v.cam.z + NEAR) : zB;
    const farRanges = fwd ? [[nearB, zB]] : [[zA, nearA]];
    const each = (fnNear, fnFar) => {
      for (let k = Math.floor(nearA / SEG), k1 = Math.ceil(nearB / SEG); k < k1; k++) fnNear(k * SEG, k * SEG + SEG, k);
      for (const [a, b] of farRanges) for (let z = a; z < b; z += 30) fnFar(z, Math.min(b, z + 30));
    };
    const road = (z0, z1, k) => (k == null ? P.road2 : k % 2 ? P.road : P.road2);
    if (W.kind === 'rural') {
      each((z0, z1, k) => { if (k % 2 === 0) { const fc = P.field[((Math.floor(k / 2) % 2) + 2) % 2]; Q(-420, -4.5, z0, z0 + SEG * 2, fc); Q(4.5, 420, z0, z0 + SEG * 2, fc); } },
        (z0, z1) => { Q(-420, -4.5, z0, z1, P.field[0]); Q(4.5, 420, z0, z1, P.field[0]); });
      for (const p of W.patches) {
        if (p.z1 < zA || p.z0 > zB) continue;
        const col = P.patch[p.c];
        const z0 = Math.max(p.z0, zA), z1 = Math.min(p.z1, zB);
        for (let z = z0; z < z1; z += 24) Q(p.x0, p.x1, z, Math.min(z1, z + 24), col);
        if (p.rows && !lod && !P.night && P.weather === 'dry' && d(fwd ? z0 : z1) < 140) {
          const rc = shade(col, -0.12);
          for (let x = p.x0 + 1; x < p.x1; x += 2.4) Q(x, x + 0.6, z0, z1, rc);
        }
      }
      each((z0, z1, k) => { const sc = k % 2 ? P.shoulder : shade(P.shoulder, -0.04); Q(-4.6, -3.5, z0, z1, sc); Q(3.5, 4.6, z0, z1, sc); Q(-3.5, 3.5, z0, z1, road(z0, z1, k)); },
        (z0, z1) => { Q(-4.6, 4.6, z0, z1, P.shoulder); Q(-3.5, 3.5, z0, z1, P.road2); });
    } else if (W.kind === 'highway') {
      each((z0, z1, k) => { if (k % 2 === 0) { const fc = P.field[((Math.floor(k / 2) % 2) + 2) % 2]; Q(-420, -7.4, z0, z0 + SEG * 2, fc); Q(7.4, 420, z0, z0 + SEG * 2, fc); } },
        (z0, z1) => { Q(-420, -7.4, z0, z1, P.field[0]); Q(7.4, 420, z0, z1, P.field[0]); });
      const rail = (z0, z1, col) => { for (const sx of [-1, 1]) v.poly(ctx, [[sx * 7.5, 0.35, z0], [sx * 7.5, 0.78, z0], [sx * 7.5, 0.78, z1], [sx * 7.5, 0.35, z1]], v.fc(col, d(fwd ? z0 : z1))); };
      each((z0, z1, k) => { const sh = k % 2 ? shade(P.road, 0.12) : shade(P.road2, 0.12); Q(-7.4, -5.4, z0, z1, sh); Q(5.4, 7.4, z0, z1, sh); Q(-5.4, 5.4, z0, z1, road(z0, z1, k)); rail(z0, z1, k % 2 ? '#b9bfc7' : '#aab0b8'); },
        (z0, z1) => { Q(-7.4, 7.4, z0, z1, shade(P.road2, 0.12)); Q(-5.4, 5.4, z0, z1, P.road2); rail(z0, z1, '#b1b7bf'); });
    } else if (W.kind === 'suburb') {
      each((z0, z1, k) => { const w = k % 2 ? P.walk : P.walk2; Q(-60, -8.6, z0, z1, P.garden); Q(-8.6, -3.7, z0, z1, w); Q(-3.7, -3.5, z0, z1, P.curb); Q(-3.5, 5.9, z0, z1, road(z0, z1, k)); Q(5.9, 6.1, z0, z1, P.curb); Q(6.1, 8.6, z0, z1, w); Q(8.6, 60, z0, z1, P.garden); },
        (z0, z1) => { Q(-60, 60, z0, z1, P.garden); Q(-8.6, 8.6, z0, z1, P.walk); Q(-3.5, 5.9, z0, z1, P.road2); });
    } else {
      // Kasaba: kaldırım + kavşaklar
      for (const [a, b, t] of bandsFor(W, zA, zB)) {
        if (t === 'st') {
          const far = d(fwd ? a : b) > NEAR;
          const step = far ? 30 : SEG;
          for (let z = Math.floor(a / step) * step; z < b; z += step) {
            const z0 = Math.max(a, z), z1 = Math.min(b, z + step);
            if (z1 <= z0) continue;
            const kk = Math.round(z / SEG);
            const w = far ? P.walk : kk % 2 ? P.walk : P.walk2;
            Q(-60, -6.9, z0, z1, P.lot); Q(6.9, 60, z0, z1, P.lot);
            Q(-6.9, -3.7, z0, z1, w); Q(3.7, 6.9, z0, z1, w);
            Q(-3.7, -3.5, z0, z1, P.curb); Q(3.5, 3.7, z0, z1, P.curb);
            Q(-3.5, 3.5, z0, z1, far ? P.road2 : kk % 2 ? P.road : P.road2);
          }
        } else if (t === 'cw') {
          Q(-90, -3.7, a, b, P.walk); Q(3.7, 90, a, b, P.walk);
          Q(-3.7, -3.5, a, b, P.curb); Q(3.5, 3.7, a, b, P.curb);
          Q(-3.5, 3.5, a, b, P.road);
        } else {
          Q(-90, 90, a, b, P.road2);
        }
      }
    }
    // Tekerlek izleri (yakın bölgede, şerit ortalarının iki yanında)
    if (!lod) {
      const wear = P.wear, lanes = W.kind === 'highway' ? [-3.6, 0, 3.6] : [-1.75, 1.75];
      for (let k = Math.floor(nearA / SEG); k < Math.ceil(nearB / SEG); k += 2) {
        const z0 = k * SEG, z1 = z0 + SEG * 2;
        if (W.inters.length && W.interNear((z0 + z1) / 2, -2)) continue;
        for (const lc of lanes) { Q(lc - 1.05, lc - 0.55, z0, z1, wear); Q(lc + 0.55, lc + 1.05, z0, z1, wear); }
      }
    }
  }
  // Çizgiler: orta çizgi türleri, kenar çizgileri, durma çizgisi, yaya geçitleri
  function drawMarks(ctx, v, W, P) {
    const fwd = v.fwd;
    const zA = fwd ? v.cam.z - 6 : v.cam.z - v.far, zB = fwd ? v.cam.z + Math.min(v.far, 320) : v.cam.z + 6;
    const d = (z) => Math.abs(z - v.cam.z);
    const col = (z) => v.fc(P.line, d(z));
    const L = (x0, x1, z0, z1) => v.quad(ctx, x0, x1, z0, z1, col(fwd ? z0 : z1));
    const DASH = 4, GAP = 6, PER = DASH + GAP;
    const solid = (x, z0, z1) => { for (let z = z0; z < z1; z += 20) L(x - 0.07, x + 0.07, z, Math.min(z1, z + 20)); };
    const dashed = (x, z0, z1) => { for (let z = Math.floor(z0 / PER) * PER; z < z1; z += PER) { const a = Math.max(z0, z), b = Math.min(z1, z + DASH); if (b > a) L(x - 0.07, x + 0.07, a, b); } };
    // Orta çizgi: 1 m'lik adımlarla türünü sorgula, aynı türden aralıkları birleştir
    let segStart = Math.floor(zA), cur = W.center(segStart);
    const flush = (a, b, t) => {
      if (t === 'none' || b <= a) return;
      if (t === 'kesik') dashed(0, a, b);
      else if (t === 'duz') solid(0, a, b);
      else if (t === 'cift') { solid(-0.14, a, b); solid(0.14, a, b); }
      else if (t === 'kesikduz') { solid(-0.14, a, b); dashed(0.14, a, b); }
      else if (t === 'duzkesik') { dashed(-0.14, a, b); solid(0.14, a, b); }
    };
    for (let z = segStart + 2; z <= zB; z += Math.abs(z - v.cam.z) < 120 ? 2 : 6) {
      const t = W.center(z);
      if (t !== cur) { flush(segStart, z, cur); segStart = z; cur = t; }
    }
    flush(segStart, zB, cur);
    if (W.kind === 'rural') { solid(-3.3, zA, zB); solid(3.3, zA, zB); }
    if (W.kind === 'highway') { dashed(-1.8, zA, zB); dashed(1.8, zA, zB); solid(-5.25, zA, zB); solid(5.25, zA, zB); }
    if (W.kind === 'suburb') {
      solid(3.55, zA, zB);
      for (let z = Math.ceil(zA / 6.5) * 6.5; z < zB; z += 6.5) L(3.55, 5.9, z, z + 0.12);
    }
    // Kavşak çizgileri
    for (const it of W.intersIn(zA - 12, zB + 12)) {
      if (it.z + 12 < zA) continue;
      if (it.z - 12 > zB) break;
      const zi = it.z;
      const zebra = (z0, z1) => { for (let x = -3.1; x < 3.2; x += 1.0) L(x, x + 0.5, z0, z1); };
      zebra(zi - 8.4, zi - 4.3); zebra(zi + 4.3, zi + 8.4);
      L(0.12, 3.45, zi - 9.75, zi - 9.25);
      L(-3.45, -0.12, zi + 9.25, zi + 9.75);
      // Yan yolun yaya geçitleri ve orta çizgisi
      for (const sx of [1, -1]) {
        for (let z = zi - 3.2; z < zi + 3.3; z += 1.0) v.quad(ctx, sx * 4.3, sx * 8.4, z, z + 0.5, col(zi));
        for (let x = 10; x < 80; x += 7) v.quad(ctx, sx * x, sx * (x + 3.5), zi - 0.07, zi + 0.07, col(zi));
      }
    }
  }

  /* ---------- Gece ışıkları (toplamalı karışım) ---------- */
  function groundGlow(ctx, v, x, z, r, color, a) {
    const c = v.P(x, 0, z);
    if (!c || c.d > 260) return;
    const px = v.P(x + r, 0, z), pz = v.P(x, 0, z + r * (v.fwd ? 1 : -1)), pn = v.P(x, 0, z - r * (v.fwd ? 1 : -1));
    const rx = px ? Math.abs(px.X - c.X) : r * c.s;
    const ryA = pz ? Math.abs(c.Y - pz.Y) : r * c.s * 0.3, ryB = pn ? Math.abs(pn.Y - c.Y) : ryA;
    const ry = (ryA + ryB) / 2, cyy = c.Y + (ryB - ryA) / 2;
    if (rx < 1) return;
    ctx.save();
    ctx.translate(c.X, cyy); ctx.scale(1, Math.max(0.05, ry / rx));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, alpha(color, a)); g.addColorStop(0.5, alpha(color, a * 0.45)); g.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // Farların yola düşen ışığı: x,z noktasından dir (+1 ileri / -1 geri) yönüne
  function beam(ctx, v, x, z, dir, len = 42, a = 0.5, high = false) {
    const w0 = 0.75, w1 = high ? 7.5 : dir > 0 ? 4.6 : 3.2;
    const zf = z + dir * len;
    const pts = [[x - w0, 0, z], [x + w0, 0, z], [x + w1, 0, zf], [x - w1, 0, zf]];
    if (!v.path(ctx, pts)) return;
    const p0 = v.P(x, 0, z + dir * 1.5) || v.P(x, 0, z + dir * 4), p1 = v.P(x, 0, zf);
    if (!p0 || !p1) { ctx.fillStyle = `rgba(255,240,200,${a * 0.3})`; ctx.fill(); return; }
    const g = ctx.createLinearGradient(p0.X, p0.Y, p1.X, p1.Y);
    g.addColorStop(0, `rgba(255,244,210,${a})`); g.addColorStop(0.45, `rgba(255,240,200,${a * 0.45})`); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.fill();
  }

  /* ---------- Nesne çizimleri ---------- */
  const Draw = {};
  // Ölçekli çizim bağlamı: (0,0) nesnenin zemin noktası, birim metre, y yukarı negatif
  function begin(ctx, p) { ctx.save(); ctx.translate(p.X, p.Y); ctx.scale(p.s, p.s); }
  function shadowEllipse(ctx, v, p, rx, ry, a = 0.3) {
    const k = (1 - v.fog(p.d)) * a;
    if (k < 0.02) return;
    ctx.fillStyle = `rgba(0,0,0,${k.toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
  }
  // Işık halesi: ekranda en az minPx yarıçapında
  function lamp(ctx, x, y, s, rM, color, a = 1, minPx = 5) {
    const r = Math.max(rM, minPx / s);
    ctx.globalCompositeOperation = 'lighter';
    G.glow(ctx, x, y, r, color, a);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* Bina (kutu): yola bakan yüz + kameraya bakan ön yüz, pencereler, dükkan tenteleri, tabelalar */
  Draw.bld = (ctx, v, b, P) => {
    const sx = b.side, xi = sx * b.xi, xo = sx * (b.xi + b.depth), h = b.h;
    const base = P.bld[b.ci];
    const cam = v.cam;
    const dNear = Math.abs((v.fwd ? b.z0 : b.z1) - cam.z);
    const F = (c) => v.fc(c, dNear);
    const Fz = (c, z) => v.fc(c, Math.abs(z - cam.z));
    const sideCol = shade(base, sx > 0 ? -0.06 : -0.16);
    // Yola bakan yüz
    const facing = (sx > 0 && cam.x < xi) || (sx < 0 && cam.x > xi);
    if (facing) {
      for (let z = b.z0; z < b.z1; z += 6) {
        const z1 = Math.min(b.z1, z + 6);
        v.poly(ctx, [[xi, 0, z], [xi, h, z], [xi, h, z1], [xi, 0, z1]], Fz(sideCol, z));
      }
      // Korniş ve zemin kat bandı
      v.poly(ctx, [[xi, h - 0.45, b.z0], [xi, h, b.z0], [xi, h, b.z1], [xi, h - 0.45, b.z1]], F(shade(sideCol, P.night ? 0.06 : -0.1)));
      v.poly(ctx, [[xi, 0, b.z0], [xi, 0.35, b.z0], [xi, 0.35, b.z1], [xi, 0, b.z1]], F(shade(sideCol, -0.18)));
      const pw = Math.abs(v.P(xi, 1.5, (b.z0 + b.z1) / 2) ? v.P(xi, 1.5, (b.z0 + b.z1) / 2).s : 0);
      if (pw > 2.4) {
        // Üst kat pencereleri
        let wi = 0;
        for (let f = 1; f < b.floors; f++) {
          const y0 = f * 3.1 + 0.8, y1 = y0 + 1.5;
          for (let z = b.z0 + 1.3; z + 1.2 < b.z1 - 0.8; z += 3.1) {
            const lit = P.night && b.lit[wi++ % 40];
            v.poly(ctx, [[xi, y0 - 0.12, z - 0.12], [xi, y1 + 0.12, z - 0.12], [xi, y1 + 0.12, z + 1.32], [xi, y0 - 0.12, z + 1.32]], Fz(P.winFrame, z));
            v.poly(ctx, [[xi, y0, z], [xi, y1, z], [xi, y1, z + 1.2], [xi, y0, z + 1.2]], Fz(lit ? P.winLit : P.win, z));
            if (!P.night && pw > 3) v.poly(ctx, [[xi, y0 + 0.9, z], [xi, y1, z], [xi, y1, z + 0.45]], 'rgba(255,255,255,.12)');
          }
        }
        // Zemin kat: dükkan vitrini ya da pencereler + kapı
        if (b.shop) {
          const za = b.z0 + 0.8, zb = b.z1 - 0.8;
          v.poly(ctx, [[xi, 0.35, za], [xi, 2.6, za], [xi, 2.6, zb], [xi, 0.35, zb]], F(P.night ? '#ffd9a0' : '#2c3844'));
          if (!P.night) v.poly(ctx, [[xi, 1.7, za], [xi, 2.6, za], [xi, 2.6, za + 1.6]], 'rgba(255,255,255,.14)');
          for (let z = za + 2.2; z < zb - 0.5; z += 2.2) v.poly(ctx, [[xi, 0.35, z], [xi, 2.6, z], [xi, 2.6, z + 0.12], [xi, 0.35, z + 0.12]], F(shade(sideCol, -0.25)));
          // Tente
          const awn = [['#c8423a', '#f4efe6'], ['#2f6e4a', '#f4efe6'], ['#2f5d9a', '#f4efe6'], ['#b8860b', '#f7f0de']][b.awn];
          const ax = xi - sx * 1.2;
          if (pw > 4) {
            let i = 0;
            for (let z = za; z < zb; z += 0.6, i++) {
              const z2 = Math.min(zb, z + 0.6);
              v.poly(ctx, [[xi, 3.05, z], [xi, 3.05, z2], [ax, 2.55, z2], [ax, 2.55, z]], Fz(i % 2 ? awn[1] : awn[0], z));
            }
          } else v.poly(ctx, [[xi, 3.05, za], [xi, 3.05, zb], [ax, 2.55, zb], [ax, 2.55, za]], F(mix(awn[0], awn[1], 0.4)));
          v.poly(ctx, [[ax, 2.55, za], [ax, 2.55, zb], [ax, 2.3, zb], [ax, 2.3, za]], F(shade(awn[0], -0.2)));
          // Tabela
          if (b.sign && pw > 3) {
            const zs0 = za + 0.4, zs1 = Math.min(zb - 0.4, za + 0.4 + Math.max(3.2, b.sign.length * 0.55));
            const brand = b.brand;
            v.poly(ctx, [[xi, 3.3, zs0], [xi, 4.1, zs0], [xi, 4.1, zs1], [xi, 3.3, zs1]], F(brand ? '#1f5fd1' : P.night ? '#f3e7cf' : '#fbf6ec'));
            const zA = sx > 0 ? zs1 : zs0, zB = sx > 0 ? zs0 : zs1;
            const a = v.P(xi, 3.3, zA), bb = v.P(xi, 3.3, zB), c = v.P(xi, 4.1, zA);
            if (a && bb && c && Math.abs(bb.X - a.X) > 14) {
              ctx.save();
              ctx.transform((bb.X - a.X) / 100, (bb.Y - a.Y) / 100, (c.X - a.X) / 20, (c.Y - a.Y) / 20, a.X, a.Y);
              ctx.fillStyle = brand ? '#ffffff' : v.fc('#7a2a1f', dNear);
              ctx.font = `900 ${brand ? 11 : 13}px Archivo, Arial, sans-serif`;
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(b.sign, 50, 10);
              ctx.restore();
            }
          }
        } else {
          for (let z = b.z0 + 1.3; z + 1.2 < b.z1 - 0.8; z += 3.1) {
            const lit = P.night && b.lit[(wi++) % 40];
            v.poly(ctx, [[xi, 0.9, z - 0.12], [xi, 2.52, z - 0.12], [xi, 2.52, z + 1.32], [xi, 0.9, z + 1.32]], Fz(P.winFrame, z));
            v.poly(ctx, [[xi, 1.02, z], [xi, 2.4, z], [xi, 2.4, z + 1.2], [xi, 1.02, z + 1.2]], Fz(lit ? P.winLit : P.win, z));
          }
        }
      }
    }
    // Ön yüz (z0) — kameraya bakar
    const zf = v.fwd ? b.z0 : b.z1;
    if ((v.fwd && cam.z < b.z0) || (!v.fwd && cam.z > b.z1)) {
      v.poly(ctx, [[xi, 0, zf], [xo, 0, zf], [xo, h, zf], [xi, h, zf]], F(base));
      v.poly(ctx, [[xi, h - 0.45, zf], [xo, h - 0.45, zf], [xo, h, zf], [xi, h, zf]], F(shade(base, P.night ? 0.05 : -0.08)));
      const pf = v.P((xi + xo) / 2, 1, zf);
      if (pf && pf.s > 1.5) {
        let wi = 3;
        for (let f = b.shop ? 1 : 0; f < b.floors; f++) {
          const y0 = f * 3.1 + (f ? 0.8 : 1.0), y1 = y0 + (f ? 1.5 : 1.4);
          for (let k = 0; k < 3; k++) {
            const xa = sx * (b.xi + 1.4 + k * 3.2), xb = xa + sx * 1.2;
            if (Math.abs(xb) > b.xi + b.depth - 0.8) continue;
            const lit = P.night && b.lit[(wi++) % 40];
            v.poly(ctx, [[xa, y0, zf], [xb, y0, zf], [xb, y1, zf], [xa, y1, zf]], F(lit ? P.winLit : P.win));
          }
        }
      }
    }
  };

  /* Yuvarlak ağaç */
  const _blobs = new Map();
  function blobs(seed, n = 7) {
    let b = _blobs.get(seed);
    if (b) return b;
    const r = rng(seed);
    b = Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU + r(); const rad = i === 0 ? 0 : 0.45 + r() * 0.35; return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.8, r: 0.5 + r() * 0.35 }; });
    _blobs.set(seed, b);
    if (_blobs.size > 800) _blobs.clear();
    return b;
  }
  Draw.tree = (ctx, v, o, P, p) => {
    const R = o.r, H = o.h;
    begin(ctx, p);
    shadowEllipse(ctx, v, p, R * 0.9, R * 0.22, 0.28);
    ctx.fillStyle = v.fc(P.trunk, p.d);
    ctx.fillRect(-0.12, -H - 0.2, 0.24, H + 0.2);
    const cy = -H - R * 0.7;
    const bl = blobs(o.seed);
    const [dk, md, lt] = P.leaf;
    ctx.fillStyle = v.fc(dk, p.d);
    for (const b of bl) { ctx.beginPath(); ctx.arc(b.x * R, cy + b.y * R + R * 0.08, b.r * R, 0, TAU); ctx.fill(); }
    ctx.fillStyle = v.fc(md, p.d);
    for (const b of bl) { ctx.beginPath(); ctx.arc(b.x * R - R * 0.07, cy + b.y * R - R * 0.02, b.r * R * 0.86, 0, TAU); ctx.fill(); }
    if (p.s * R > 6) {
      ctx.fillStyle = v.fc(lt, p.d);
      for (let i = 0; i < 4; i++) { const b = bl[i + 1]; ctx.beginPath(); ctx.arc(b.x * R - R * 0.2, cy + b.y * R - R * 0.2, b.r * R * 0.45, 0, TAU); ctx.fill(); }
    }
    if (P.weather === 'snow') { ctx.fillStyle = v.fc('#ffffff', p.d); for (let i = 0; i < 4; i++) { const b = bl[i]; ctx.beginPath(); ctx.ellipse(b.x * R, cy + b.y * R - b.r * R * 0.62, b.r * R * 0.6, b.r * R * 0.28, 0, 0, TAU); ctx.fill(); } }
    ctx.restore();
  };
  /* Kavak */
  Draw.poplar = (ctx, v, o, P, p) => {
    const H = o.h;
    begin(ctx, p);
    shadowEllipse(ctx, v, p, 0.9, 0.2, 0.25);
    ctx.fillStyle = v.fc(P.trunk, p.d);
    ctx.fillRect(-0.09, -1.6, 0.18, 1.6);
    const [dk, md, lt] = P.poplar;
    const cy = -1.2 - H / 2, ry = H / 2, rx = 0.95 + (o.seed % 7) * 0.05;
    ctx.fillStyle = v.fc(dk, p.d);
    ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = v.fc(md, p.d);
    ctx.beginPath(); ctx.ellipse(-rx * 0.18, cy - ry * 0.04, rx * 0.72, ry * 0.94, 0, 0, TAU); ctx.fill();
    if (p.s > 3) {
      ctx.fillStyle = v.fc(lt, p.d);
      ctx.beginPath(); ctx.ellipse(-rx * 0.42, cy - ry * 0.15, rx * 0.28, ry * 0.62, 0, 0, TAU); ctx.fill();
    }
    if (P.weather === 'snow') { ctx.fillStyle = v.fc('#f4f7fa', p.d); ctx.beginPath(); ctx.ellipse(-rx * 0.1, cy - ry * 0.55, rx * 0.5, ry * 0.3, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  };
  /* Peri bacası kümesi */
  Draw.rock = (ctx, v, o, P, p) => {
    begin(ctx, p);
    const [lit, mid, dark] = P.rock;
    const F = (c) => v.fc(c, p.d);
    if (o.mesa) {
      const w = o.mesa.w, h = o.mesa.h;
      ctx.fillStyle = F(mid);
      ctx.beginPath(); ctx.moveTo(-w / 2 - 6, 0); ctx.quadraticCurveTo(-w / 2, -h * 0.9, -w / 2 + 4, -h); ctx.lineTo(w / 2 - 5, -h * 1.02); ctx.quadraticCurveTo(w / 2 + 2, -h * 0.8, w / 2 + 7, 0); ctx.fill();
      ctx.fillStyle = F(dark);
      ctx.beginPath(); ctx.moveTo(w / 2 - 5, -h * 1.02); ctx.quadraticCurveTo(w / 2 + 2, -h * 0.8, w / 2 + 7, 0); ctx.lineTo(w / 2 - 6, 0); ctx.quadraticCurveTo(w / 2 - 4, -h * 0.6, w / 2 - 5, -h * 1.02); ctx.fill();
    }
    for (const c of o.cones) {
      const w = c.w, h = c.h, x = c.dx;
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, F(lit)); g.addColorStop(0.55, F(mid)); g.addColorStop(1, F(dark));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - w / 2, 0);
      ctx.bezierCurveTo(x - w * 0.34, -h * 0.35, x - w * 0.16, -h * 0.7, x - w * 0.13, -h * 0.9);
      ctx.lineTo(x + w * 0.13, -h * 0.9);
      ctx.bezierCurveTo(x + w * 0.16, -h * 0.7, x + w * 0.34, -h * 0.35, x + w / 2, 0);
      ctx.closePath(); ctx.fill();
      if (p.s * w > 8) {
        ctx.strokeStyle = F(shade(mid, -0.1)); ctx.lineWidth = Math.max(0.12, 1 / p.s);
        for (let k = 1; k < 4; k++) { const yy = -h * (0.2 + k * 0.17), ww = w * (0.5 - k * 0.08); ctx.beginPath(); ctx.moveTo(x - ww * 0.8, yy); ctx.quadraticCurveTo(x, yy + 0.3, x + ww * 0.8, yy); ctx.stroke(); }
      }
      if (c.cap) {
        ctx.fillStyle = F(P.cap);
        ctx.beginPath(); ctx.ellipse(x, -h * 0.92, w * 0.26, w * 0.1, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - w * 0.2, -h * 0.94); ctx.quadraticCurveTo(x, -h - w * 0.3, x + w * 0.2, -h * 0.94); ctx.fill();
      }
      if (P.weather === 'snow') { ctx.fillStyle = F('#f7f9fb'); ctx.beginPath(); ctx.ellipse(x, -h * 0.95, w * 0.22, w * 0.08, 0, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  };
  /* Sokak lambası */
  Draw.lamp = (ctx, v, o, P, p) => {
    const side = o.side || 1, H = 7.4, arm = 1.7;
    begin(ctx, p);
    ctx.fillStyle = v.fc(P.poleDark, p.d);
    ctx.fillRect(-0.09, -H, 0.18, H);
    ctx.fillRect(-0.16, -0.5, 0.32, 0.5);
    ctx.strokeStyle = v.fc(P.poleDark, p.d); ctx.lineWidth = 0.12;
    const ax = -side * arm;
    ctx.beginPath(); ctx.moveTo(0, -H + 0.05); ctx.quadraticCurveTo(0, -H - 0.5, ax * 0.6, -H - 0.45); ctx.lineTo(ax, -H - 0.4); ctx.stroke();
    ctx.fillStyle = v.fc('#3a3f47', p.d);
    ctx.beginPath(); ctx.ellipse(ax, -H - 0.36, 0.42, 0.13, 0, 0, TAU); ctx.fill();
    if (P.night) { ctx.fillStyle = '#fff1cf'; ctx.beginPath(); ctx.ellipse(ax, -H - 0.3, 0.32, 0.07, 0, 0, TAU); ctx.fill(); lamp(ctx, ax, -H - 0.25, p.s, 1.6, '#ffd79a', 0.9, 7); }
    ctx.restore();
  };
  /* Trafik ışığı: direk tipi ya da yolun üstüne uzanan kollu tip. state: 'green'|'amber'|'red'|'redamber'|'off' */
  const LAMP_ON = { r: '#ff3b30', y: '#ffb300', g: '#27d35f' }, LAMP_OFF = { r: '#4a1714', y: '#4a3510', g: '#113520' };
  function signalHead(ctx, v, p, x, y, k, state, back) {
    const w = 0.36 * k, h = 1.02 * k;
    ctx.fillStyle = v.fc('#15161a', p.d);
    rr(ctx, x - w / 2 - 0.07 * k, y - h - 0.07 * k, w + 0.14 * k, h + 0.14 * k, 0.06 * k); ctx.fill();
    if (!back) {
      ctx.strokeStyle = v.fc('#e9e6df', p.d); ctx.lineWidth = 0.035 * k; ctx.stroke();
      const on = { r: state === 'red' || state === 'redamber', y: state === 'amber' || state === 'redamber', g: state === 'green' };
      ['r', 'y', 'g'].forEach((c, i) => {
        const ly = y - h + (0.18 + i * 0.33) * k;
        ctx.fillStyle = on[c] ? LAMP_ON[c] : v.fc(LAMP_OFF[c], p.d);
        ctx.beginPath(); ctx.arc(x, ly, 0.12 * k, 0, TAU); ctx.fill();
        if (on[c]) {
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(x - 0.03 * k, ly - 0.03 * k, 0.05 * k, 0, TAU); ctx.fill();
          lamp(ctx, x, ly, p.s, 0.55 * k, LAMP_ON[c], P_NIGHT ? 1 : 0.8, 9);
        }
        ctx.fillStyle = v.fc('#0c0d10', p.d);
        ctx.beginPath(); ctx.moveTo(x - 0.16 * k, ly - 0.11 * k); ctx.quadraticCurveTo(x, ly - 0.22 * k, x + 0.16 * k, ly - 0.11 * k); ctx.lineTo(x + 0.16 * k, ly - 0.14 * k); ctx.quadraticCurveTo(x, ly - 0.26 * k, x - 0.16 * k, ly - 0.14 * k); ctx.fill();
      });
    }
  }
  let P_NIGHT = false;
  Draw.signal = (ctx, v, o, P, p) => {
    const k = o.k || 1.4, state = typeof o.state === 'function' ? o.state() : o.state;
    begin(ctx, p);
    shadowEllipse(ctx, v, p, 0.4, 0.1, 0.25);
    ctx.fillStyle = v.fc(P.pole, p.d);
    if (o.mast) {
      const H = 6.1, ax = o.armX != null ? o.armX : -(Math.abs(o.x) - 1.9) * Math.sign(o.x);
      ctx.fillRect(-0.11, -H, 0.22, H);
      ctx.fillStyle = v.fc(P.poleDark, p.d);
      ctx.fillRect(Math.min(0, ax) - 0.3, -H + 0.05, Math.abs(ax) + 0.3, 0.16);
      ctx.fillRect(ax - 0.03, -H + 0.2, 0.06, 0.3);
      signalHead(ctx, v, p, ax, -H + 0.5 + 1.02 * k + 0.1, k, state);
    } else {
      ctx.fillRect(-0.08, -3.3 * (k / 1.4), 0.16, 3.3 * (k / 1.4));
      signalHead(ctx, v, p, 0, -2.05 * (k / 1.4) + 0.02, k, state, o.back);
    }
    ctx.restore();
  };
  /* Trafik levhası (kitteki SVG) */
  Draw.sign = (ctx, v, o, P, p) => {
    const k = o.k || 1.35, size = 0.9 * k, top = o.h || 2.4;
    begin(ctx, p);
    shadowEllipse(ctx, v, p, 0.3, 0.08, 0.22);
    ctx.fillStyle = v.fc(P.metal, p.d);
    ctx.fillRect(-0.045, -top, 0.09, top);
    const im = o.img;
    if (ready(im)) {
      const fog = v.fog(p.d);
      ctx.drawImage(im, -size / 2, -top - size * 0.75, size, size);
      if (fog > 0.05) { ctx.globalAlpha = fog * 0.85; ctx.fillStyle = v.fogColor; ctx.beginPath(); ctx.arc(0, -top - size * 0.25, size * 0.47, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      if (o.halo) {
        ctx.strokeStyle = o.halo; ctx.lineWidth = Math.max(0.07, 3 / p.s);
        ctx.beginPath(); ctx.arc(0, -top - size * 0.25, size * 0.62, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  };
  /* Top */
  Draw.ball = (ctx, v, o, P, p) => {
    const R = o.r || 0.2;
    begin(ctx, p);
    shadowEllipse(ctx, v, p, R * 1.1, R * 0.3, 0.35);
    ctx.save(); ctx.translate(0, -R - (o.hop || 0)); ctx.rotate(o.rot || 0);
    ctx.fillStyle = '#fbfbf8'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1c1d22';
    ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(a) * R * 0.34, Math.sin(a) * R * 0.34); } ctx.fill();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, R * 0.24, 0, TAU); ctx.fill(); }
    const g = ctx.createRadialGradient(-R * 0.35, -R * 0.35, 0, 0, 0, R); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  };
  /* Yaya (yandan görünüm, yürüme döngüsü) */
  Draw.ped = (ctx, v, o, P, p) => {
    const dir = o.dir || 1, ph = o.phase || 0, walking = o.walk !== false;
    const sw = walking ? Math.sin(ph) : 0;
    const F = (c) => v.fc(c, p.d);
    begin(ctx, p);
    shadowEllipse(ctx, v, p, 0.38, 0.09, 0.3);
    ctx.scale(dir, 1);
    const hip = -0.92, sh = -1.42;
    ctx.lineCap = 'round';
    const leg = (a, col) => { ctx.strokeStyle = F(col); ctx.lineWidth = 0.15; ctx.beginPath(); ctx.moveTo(0, hip); const kx = Math.sin(a) * 0.3, ky = hip + 0.44; ctx.lineTo(kx, ky); ctx.lineTo(kx + Math.sin(a - Math.max(0, -a) * 0.8) * 0.36 - 0.02, -0.06); ctx.stroke(); ctx.fillStyle = F('#22252b'); ctx.fillRect(kx + Math.sin(a) * 0.36 - 0.06, -0.08, 0.2, 0.08); };
    leg(-sw * 0.5, shade(o.pants || '#3a4a6b', -0.2));
    const arm = (a, col) => { ctx.strokeStyle = F(col); ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(0, sh + 0.05); ctx.lineTo(Math.sin(a) * 0.32, sh + 0.52); ctx.stroke(); };
    arm(sw * 0.55, shade(o.shirt || '#e07a3a', -0.25));
    ctx.fillStyle = F(o.shirt || '#e07a3a');
    rr(ctx, -0.17, sh - 0.02, 0.34, 0.6, 0.12); ctx.fill();
    leg(sw * 0.5, o.pants || '#3a4a6b');
    arm(-sw * 0.55, o.shirt || '#e07a3a');
    ctx.fillStyle = F(o.skin || '#e9b98f');
    ctx.beginPath(); ctx.arc(0.02, sh - 0.17, 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = F(o.hair || '#3b2a1f');
    ctx.beginPath(); ctx.arc(-0.01, sh - 0.2, 0.125, Math.PI * 0.95, Math.PI * 2.1); ctx.fill();
    if (o.umbrella) { ctx.fillStyle = F(o.umbrella); ctx.beginPath(); ctx.arc(0.05, sh - 0.62, 0.55, Math.PI, 0); ctx.fill(); ctx.strokeStyle = F('#333'); ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0.05, sh - 0.62); ctx.lineTo(0.12, sh + 0.2); ctx.stroke(); }
    ctx.restore();
  };

  /* Araçlar ---------------------------------------------------------- */
  const CAR_COLORS = ['#e9ecef', '#b9c0c9', '#2b2f36', '#2f63c8', '#25406b', '#3f7d55', '#8c2f2b', '#d9c7a2', '#e68a2e', '#6b7380'];
  const BRAND = { body: '#f3f5f8', red: '#de2f29', blue: '#1f5fd1' };
  // Arkadan ya da önden görünüm. o: { view:'rear'|'front', color, kind:'sedan'|'taxi'|'minibus'|'player', brake, blinkL, blinkR, head (farlar), high }
  Draw.car = (ctx, v, o, P, p) => {
    if (o.view === 'side') return Draw.carSide(ctx, v, o, P, p);
    const night = P.night, front = o.view === 'front';
    const kind = o.kind || 'sedan', player = kind === 'player';
    const bus = kind === 'minibus';
    const body = player ? BRAND.body : o.color || '#b9c0c9';
    const F = (c) => v.fc(c, p.d);
    const hw = bus ? 1.0 : 0.91, H = bus ? 2.25 : 1.44, belt = bus ? 1.15 : 0.86;
    const tiny = p.s * hw * 2 < 14;
    begin(ctx, p);
    if (o.roll) ctx.rotate(o.roll);
    shadowEllipse(ctx, v, p, hw * 1.22, 0.16, 0.38);
    // Tekerlekler
    ctx.fillStyle = F('#141518');
    rr(ctx, -hw + 0.04, -0.42, 0.3, 0.42, 0.07); ctx.fill();
    rr(ctx, hw - 0.34, -0.42, 0.3, 0.42, 0.07); ctx.fill();
    // Alt gövde
    const g = ctx.createLinearGradient(0, -belt - 0.05, 0, -0.18);
    g.addColorStop(0, F(shade(body, 0.2))); g.addColorStop(0.35, F(body)); g.addColorStop(1, F(shade(body, -0.3)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-hw + 0.02, -0.24); ctx.lineTo(-hw - 0.01, -belt * 0.7); ctx.quadraticCurveTo(-hw, -belt, -hw + 0.14, -belt - 0.02);
    ctx.lineTo(hw - 0.14, -belt - 0.02); ctx.quadraticCurveTo(hw, -belt, hw + 0.01, -belt * 0.7); ctx.lineTo(hw - 0.02, -0.24);
    ctx.quadraticCurveTo(hw - 0.03, -0.16, hw - 0.12, -0.16); ctx.lineTo(-hw + 0.12, -0.16); ctx.quadraticCurveTo(-hw + 0.03, -0.16, -hw + 0.02, -0.24);
    ctx.fill();
    // Kabin
    const cb = bus ? hw - 0.02 : hw - 0.13, ct = bus ? hw - 0.1 : hw - 0.33;
    ctx.fillStyle = F(shade(body, 0.08));
    ctx.beginPath(); ctx.moveTo(-cb, -belt); ctx.lineTo(-ct, -H + 0.06); ctx.quadraticCurveTo(-ct + 0.02, -H, -ct + 0.14, -H); ctx.lineTo(ct - 0.14, -H); ctx.quadraticCurveTo(ct - 0.02, -H, ct, -H + 0.06); ctx.lineTo(cb, -belt); ctx.closePath(); ctx.fill();
    if (!tiny) {
      // Cam
      const gb = cb - 0.1, gt = ct - 0.08, gy0 = -belt - 0.07, gy1 = -H + 0.1;
      const gg = ctx.createLinearGradient(0, gy1, 0, gy0);
      if (front) { gg.addColorStop(0, F(night ? '#1b2233' : '#8fb0cf')); gg.addColorStop(0.45, F(night ? '#0f141d' : '#3b4c61')); gg.addColorStop(1, F('#18202b')); }
      else { gg.addColorStop(0, F(night ? '#0e121a' : '#2f3c4c')); gg.addColorStop(1, F(night ? '#141a24' : '#1b232e')); }
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.moveTo(-gb, gy0); ctx.lineTo(-gt, gy1); ctx.lineTo(gt, gy1); ctx.lineTo(gb, gy0); ctx.closePath(); ctx.fill();
      if (!night) { ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.moveTo(-gb * 0.55, gy0); ctx.lineTo(-gt * 0.25, gy1); ctx.lineTo(-gt * 0.02, gy1); ctx.lineTo(-gb * 0.25, gy0); ctx.fill(); }
      if (bus && !front) { ctx.fillStyle = F(shade(body, -0.1)); ctx.fillRect(-0.03, gy1, 0.06, gy0 - gy1); }
      // Aynalar
      ctx.fillStyle = F(shade(body, -0.05));
      rr(ctx, -hw - 0.13, -belt - 0.2, 0.17, 0.12, 0.04); ctx.fill(); rr(ctx, hw - 0.04, -belt - 0.2, 0.17, 0.12, 0.04); ctx.fill();
      // Tampon
      ctx.fillStyle = F(bus ? '#2d3036' : '#24272d');
      rr(ctx, -hw + 0.02, -0.36, hw * 2 - 0.04, 0.17, 0.06); ctx.fill();
      // Plaka
      const py = front ? -0.5 : -0.52;
      ctx.fillStyle = F('#f7f7f2'); rr(ctx, -0.27, py, 0.54, 0.13, 0.02); ctx.fill();
      ctx.fillStyle = F('#1f4fbf'); ctx.fillRect(-0.27, py, 0.06, 0.13);
      if (p.s > 70) { ctx.fillStyle = '#16171b'; ctx.font = '700 0.085px Archivo, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.plate || '50 YS 035', 0.03, py + 0.068); }
      if (player) {
        // Kurs aracı: kırmızı-mavi şerit
        ctx.fillStyle = F(BRAND.red); ctx.fillRect(-hw + 0.01, -belt * 0.62, hw * 2 - 0.02, 0.07);
        ctx.fillStyle = F(BRAND.blue); ctx.fillRect(-hw + 0.01, -belt * 0.62 + 0.085, hw * 2 - 0.02, 0.025);
      }
      if (front) {
        // Izgara + farlar
        ctx.fillStyle = F('#1f2227'); rr(ctx, -0.42, -0.72, 0.84, 0.17, 0.05); ctx.fill();
        const hc = o.head || night ? '#fffbe8' : F('#e8eef4');
        ctx.fillStyle = hc;
        ctx.beginPath(); ctx.moveTo(-hw + 0.08, -0.62); ctx.lineTo(-0.5, -0.64); ctx.lineTo(-0.52, -0.75); ctx.lineTo(-hw + 0.1, -0.76); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hw - 0.08, -0.62); ctx.lineTo(0.5, -0.64); ctx.lineTo(0.52, -0.75); ctx.lineTo(hw - 0.1, -0.76); ctx.closePath(); ctx.fill();
        if (o.head || night) { const a = o.high ? 1 : 0.75; lamp(ctx, -0.68, -0.69, p.s, o.high ? 1.8 : 1.1, '#fff4d0', a, 8); lamp(ctx, 0.68, -0.69, p.s, o.high ? 1.8 : 1.1, '#fff4d0', a, 8); }
      } else {
        // Stop lambaları (ince ışık çubuğuyla birleşen modern tasarım)
        const on = o.brake, tail = night || o.brake;
        const lc = on ? '#ff2b22' : tail ? '#d11e1e' : F('#8e1a1d');
        const ly = bus ? -1.0 : -0.66;
        ctx.fillStyle = lc;
        ctx.beginPath(); ctx.moveTo(-hw + 0.03, ly); ctx.lineTo(-hw + 0.02, ly - 0.14); ctx.lineTo(-hw + 0.5, ly - 0.12); ctx.lineTo(-hw + 0.46, ly); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hw - 0.03, ly); ctx.lineTo(hw - 0.02, ly - 0.14); ctx.lineTo(hw - 0.5, ly - 0.12); ctx.lineTo(hw - 0.46, ly); ctx.closePath(); ctx.fill();
        if (!bus) { ctx.fillRect(-hw + 0.45, ly - 0.075, hw * 2 - 0.9, 0.03); }
        if (on) {
          ctx.fillRect(-0.22, -H + 0.13, 0.44, 0.04);
          lamp(ctx, -hw + 0.26, ly - 0.07, p.s, 0.36, '#ff2a1f', 0.8, 5); lamp(ctx, hw - 0.26, ly - 0.07, p.s, 0.36, '#ff2a1f', 0.8, 5);
        } else if (tail) { lamp(ctx, -hw + 0.26, ly - 0.07, p.s, 0.26, '#ff2a1f', 0.5, 3); lamp(ctx, hw - 0.26, ly - 0.07, p.s, 0.26, '#ff2a1f', 0.5, 3); }
      }
      // Sinyaller
      const blinkOn = (Math.floor(performance.now() / 380) % 2) === 0;
      const sy = front ? -0.7 : bus ? -1.07 : -0.74;
      for (const [on, sx] of [[o.blinkL, -1], [o.blinkR, 1]]) {
        if (!on) continue;
        const xs = front ? sx : sx;
        ctx.fillStyle = blinkOn ? '#ffb000' : F('#7a5200');
        rr(ctx, xs * hw - (xs > 0 ? 0.16 : 0), sy - 0.03, 0.16, 0.07, 0.02); ctx.fill();
        if (blinkOn) lamp(ctx, xs * (hw - 0.08), sy, p.s, 0.55, '#ffb000', 0.9, 6);
      }
      if (kind === 'taxi') {
        ctx.fillStyle = F('#1c1d22'); rr(ctx, -0.26, -H - 0.2, 0.52, 0.2, 0.04); ctx.fill();
        ctx.fillStyle = F('#ffd12e'); rr(ctx, -0.23, -H - 0.18, 0.46, 0.16, 0.03); ctx.fill();
        if (p.s > 60) { ctx.fillStyle = '#1c1d22'; ctx.font = '900 0.1px Archivo, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TAKSİ', 0, -H - 0.1); }
      }
      if (player) {
        // Çatı levhası: SÜRÜCÜ ADAYI
        ctx.fillStyle = F('#8f98a3'); ctx.fillRect(-0.2, -H - 0.08, 0.04, 0.08); ctx.fillRect(0.16, -H - 0.08, 0.04, 0.08);
        ctx.fillStyle = F(BRAND.blue); rr(ctx, -0.5, -H - 0.3, 1.0, 0.23, 0.05); ctx.fill();
        if (p.s > 40) { ctx.fillStyle = '#ffffff'; ctx.font = '800 0.1px Archivo, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SÜRÜCÜ ADAYI', 0, -H - 0.185); }
      }
    } else {
      ctx.fillStyle = front ? (night ? '#fff6d8' : F('#dfe6ee')) : (night || o.brake ? '#ff3024' : F('#8e1a1d'));
      ctx.fillRect(-hw + 0.05, -0.75, 0.3, 0.12); ctx.fillRect(hw - 0.35, -0.75, 0.3, 0.12);
      if (front && night) { lamp(ctx, -0.7, -0.7, p.s, 1, '#fff4d0', 0.8, 5); lamp(ctx, 0.7, -0.7, p.s, 1, '#fff4d0', 0.8, 5); }
      if (!front && (night || o.brake)) { lamp(ctx, -0.7, -0.7, p.s, 0.5, '#ff2a1f', 0.7, 3); lamp(ctx, 0.7, -0.7, p.s, 0.5, '#ff2a1f', 0.7, 3); }
    }
    ctx.restore();
  };
  // Yandan görünüm (kavşaktan geçen araçlar). dir: +1 sağa, -1 sola
  Draw.carSide = (ctx, v, o, P, p) => {
    const dir = o.dir || 1, body = o.color || '#2f63c8', night = P.night;
    const F = (c) => v.fc(c, p.d);
    begin(ctx, p);
    shadowEllipse(ctx, v, p, 2.35, 0.16, 0.35);
    ctx.scale(dir, 1);
    const g = ctx.createLinearGradient(0, -0.95, 0, -0.2);
    g.addColorStop(0, F(shade(body, 0.2))); g.addColorStop(0.4, F(body)); g.addColorStop(1, F(shade(body, -0.3)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-2.2, -0.34); ctx.lineTo(-2.22, -0.72); ctx.quadraticCurveTo(-2.2, -0.9, -1.95, -0.92);
    ctx.lineTo(-1.25, -0.95); ctx.lineTo(-0.9, -1.38); ctx.quadraticCurveTo(-0.8, -1.46, -0.6, -1.46); ctx.lineTo(0.45, -1.46); ctx.quadraticCurveTo(0.62, -1.45, 0.72, -1.36);
    ctx.lineTo(1.22, -0.98); ctx.lineTo(1.95, -0.88); ctx.quadraticCurveTo(2.22, -0.84, 2.24, -0.62); ctx.lineTo(2.22, -0.34);
    ctx.quadraticCurveTo(2.2, -0.24, 2.05, -0.24); ctx.lineTo(-2.05, -0.24); ctx.quadraticCurveTo(-2.2, -0.24, -2.2, -0.34); ctx.fill();
    ctx.fillStyle = F(night ? '#121821' : '#2a3746');
    ctx.beginPath(); ctx.moveTo(-1.1, -0.98); ctx.lineTo(-0.82, -1.34); ctx.lineTo(-0.2, -1.36); ctx.lineTo(-0.2, -0.98); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.08, -0.98); ctx.lineTo(-0.08, -1.36); ctx.lineTo(0.5, -1.36); ctx.lineTo(1.02, -0.98); ctx.closePath(); ctx.fill();
    if (!night) { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(0.1, -0.98); ctx.lineTo(0.35, -1.36); ctx.lineTo(0.55, -1.36); ctx.lineTo(0.3, -0.98); ctx.fill(); }
    ctx.strokeStyle = F(shade(body, -0.25)); ctx.lineWidth = 0.025;
    ctx.beginPath(); ctx.moveTo(-0.15, -0.95); ctx.lineTo(-0.15, -0.32); ctx.moveTo(-1.2, -0.95); ctx.lineTo(-1.2, -0.36); ctx.stroke();
    ctx.fillStyle = night ? '#fff6d8' : F('#f3f0e1'); rr(ctx, 1.98, -0.8, 0.22, 0.12, 0.04); ctx.fill();
    ctx.fillStyle = night || o.brake ? '#ff3024' : F('#a01d20'); rr(ctx, -2.22, -0.82, 0.12, 0.14, 0.03); ctx.fill();
    if (night) lamp(ctx, 2.15, -0.74, p.s, 1.1, '#fff4d0', 0.8, 6);
    if (night || o.brake) lamp(ctx, -2.18, -0.75, p.s, 0.5, '#ff2a1f', 0.7, 4);
    for (const wx of [-1.38, 1.36]) {
      ctx.fillStyle = F('#141518'); ctx.beginPath(); ctx.arc(wx, -0.33, 0.33, 0, TAU); ctx.fill();
      ctx.fillStyle = F('#9aa2ad'); ctx.beginPath(); ctx.arc(wx, -0.33, 0.17, 0, TAU); ctx.fill();
      ctx.fillStyle = F('#5d646e'); ctx.beginPath(); ctx.arc(wx, -0.33, 0.06, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };
  // Motosiklet (önden ya da arkadan)
  Draw.moto = (ctx, v, o, P, p) => {
    const F = (c) => v.fc(c, p.d), front = o.view !== 'rear', col = o.color || '#d63a2f';
    begin(ctx, p);
    shadowEllipse(ctx, v, p, 0.5, 0.12, 0.35);
    ctx.fillStyle = F('#16171a'); rr(ctx, -0.09, -0.62, 0.18, 0.62, 0.08); ctx.fill();
    ctx.fillStyle = F(col); rr(ctx, -0.3, -1.02, 0.6, 0.45, 0.14); ctx.fill();
    ctx.fillStyle = F('#2b2e34'); ctx.fillRect(-0.42, -1.12, 0.84, 0.06);
    ctx.fillStyle = F('#2f3b52'); rr(ctx, -0.22, -1.52, 0.44, 0.55, 0.14); ctx.fill();
    ctx.fillStyle = F(shade(col, 0.1)); ctx.beginPath(); ctx.arc(0, -1.66, 0.17, 0, TAU); ctx.fill();
    ctx.fillStyle = F(P.night ? '#0f141d' : '#27313d'); ctx.beginPath(); ctx.ellipse(0, -1.63, 0.12, 0.07, 0, 0, TAU); ctx.fill();
    if (front) { ctx.fillStyle = P.night || o.head ? '#fffbe8' : F('#e8eef4'); ctx.beginPath(); ctx.arc(0, -0.86, 0.08, 0, TAU); ctx.fill(); if (P.night || o.head) lamp(ctx, 0, -0.86, p.s, 0.9, '#fff4d0', 0.8, 6); }
    else { ctx.fillStyle = P.night ? '#ff3024' : F('#9a1c1f'); ctx.fillRect(-0.08, -0.82, 0.16, 0.07); }
    ctx.restore();
  };
  // Traktör (arkadan)
  Draw.tractor = (ctx, v, o, P, p) => {
    const F = (c) => v.fc(c, p.d), red = o.color || '#c8322b';
    begin(ctx, p);
    shadowEllipse(ctx, v, p, 1.35, 0.18, 0.38);
    // Kabin
    ctx.fillStyle = F('#2b2e33'); ctx.fillRect(-0.72, -2.62, 0.08, 1.5); ctx.fillRect(0.64, -2.62, 0.08, 1.5);
    ctx.fillStyle = F(red); rr(ctx, -0.82, -2.72, 1.64, 0.14, 0.05); ctx.fill();
    ctx.fillStyle = F(P.night ? 'rgba(40,50,70,.55)' : 'rgba(160,190,215,.35)'); ctx.fillRect(-0.64, -2.58, 1.28, 1.46);
    ctx.fillStyle = F('#3a3027'); ctx.beginPath(); ctx.arc(0.05, -1.98, 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = F('#b7472e'); rr(ctx, -0.13, -2.18, 0.34, 0.1, 0.04); ctx.fill();
    ctx.fillStyle = F('#4b5a6e'); rr(ctx, -0.25, -1.82, 0.6, 0.55, 0.12); ctx.fill();
    // Egzoz
    ctx.fillStyle = F('#3b3d42'); ctx.fillRect(0.38, -3.05, 0.07, 0.5);
    // Gövde
    ctx.fillStyle = F(red); rr(ctx, -0.55, -1.3, 1.1, 0.8, 0.08); ctx.fill();
    ctx.fillStyle = F('#26282c'); ctx.fillRect(-0.18, -0.62, 0.36, 0.34);
    // Arka tekerlekler
    for (const sx of [-1, 1]) {
      ctx.fillStyle = F('#16171a'); rr(ctx, sx > 0 ? 0.6 : -1.12, -1.45, 0.52, 1.45, 0.2); ctx.fill();
      ctx.strokeStyle = F('#2a2c30'); ctx.lineWidth = 0.05;
      for (let y = -1.3; y < -0.1; y += 0.18) { ctx.beginPath(); ctx.moveTo(sx > 0 ? 0.64 : -1.08, y); ctx.lineTo(sx > 0 ? 1.08 : -0.64, y + 0.06); ctx.stroke(); }
      ctx.fillStyle = F(red); ctx.beginPath(); ctx.moveTo(sx * 0.55, -1.25); ctx.quadraticCurveTo(sx * 0.86, -1.72, sx * 1.18, -1.28); ctx.lineTo(sx * 1.18, -1.18); ctx.lineTo(sx * 0.55, -1.15); ctx.fill();
      ctx.fillStyle = P.night || o.brake ? '#ff3024' : F('#9a1c1f'); rr(ctx, sx > 0 ? 0.95 : -1.1, -1.42, 0.15, 0.1, 0.03); ctx.fill();
      if (P.night) lamp(ctx, sx * 1.02, -1.37, p.s, 0.45, '#ff2a1f', 0.6, 4);
    }
    // Yavaş araç üçgeni
    ctx.fillStyle = F('#ff7a1a'); ctx.beginPath(); ctx.moveTo(0, -1.28); ctx.lineTo(0.24, -0.86); ctx.lineTo(-0.24, -0.86); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = F('#d7261e'); ctx.lineWidth = 0.05; ctx.stroke();
    ctx.restore();
  };

  /* ---------- Hava durumu (ekran uzayında) ---------- */
  class Weather {
    constructor() { this.kind = 'dry'; this.parts = []; }
    set(kind) { if (kind === this.kind) return; this.kind = kind; this.parts = []; }
    update(dt, v, speed) {
      const k = this.kind;
      if (k !== 'rain' && k !== 'snow') { this.parts.length = 0; return; }
      const W = v.vw, H = v.vh, target = k === 'rain' ? Math.round(W * H / 3200) : Math.round(W * H / 3600);
      while (this.parts.length < target) this.parts.push({ x: Math.random() * W, y: Math.random() * H, z: 0.4 + Math.random() * 0.8, ph: Math.random() * 6 });
      const sp = speed || 0;
      for (const p of this.parts) {
        if (k === 'rain') { p.y += (620 + sp * 14) * p.z * dt; p.x += (-60 - sp * 2) * p.z * dt; }
        else { p.y += (40 + sp * 2.2) * p.z * dt; p.x += (Math.sin(p.ph + p.y * 0.02) * 18 - sp * 0.6 * (p.x - W / 2) / W * 6) * dt; }
        if (sp > 1 && k === 'snow') { const dx = p.x - W / 2, dy = p.y - v.cy + v.vy; p.x += dx * sp * 0.012 * dt; p.y += Math.max(0, dy) * sp * 0.012 * dt; }
        if (p.y > H + 10 || p.x < -20 || p.x > W + 20) { p.y = -10 - Math.random() * 40; p.x = Math.random() * (W + 80) - 20; }
      }
    }
    draw(ctx, v, night) {
      const k = this.kind;
      if (k === 'rain') {
        ctx.strokeStyle = night ? 'rgba(170,190,220,.35)' : 'rgba(235,242,250,.55)'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
        ctx.beginPath();
        for (const p of this.parts) { const L = 12 * p.z + 6; ctx.moveTo(v.vx + p.x, v.vy + p.y); ctx.lineTo(v.vx + p.x + L * 0.12, v.vy + p.y - L); }
        ctx.stroke();
        const g = ctx.createLinearGradient(0, v.vy, 0, v.vy + v.vh);
        g.addColorStop(0, night ? 'rgba(20,24,34,.1)' : 'rgba(120,130,145,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(v.vx, v.vy, v.vw, v.vh);
      } else if (k === 'snow') {
        ctx.fillStyle = night ? 'rgba(220,228,245,.8)' : 'rgba(255,255,255,.92)';
        for (const p of this.parts) { ctx.beginPath(); ctx.arc(v.vx + p.x, v.vy + p.y, 1.1 + p.z * 1.9, 0, TAU); ctx.fill(); }
      }
    }
  }

  /* ---------- Sahne çizimi ---------- */
  // dyn: dinamik nesneler [{type, x, z, ...}], lights: gece ışık kaynakları
  function render(ctx, v, W, P, dyn = [], opts = {}) {
    P_NIGHT = P.night;
    v.look();
    v.setFog(P.haze);
    ctx.save();
    ctx.beginPath(); ctx.rect(v.vx, v.vy, v.vw, v.vh); ctx.clip();
    drawSky(ctx, v, P, opts.time || 0, opts);
    drawGroundBase(ctx, v, P);
    drawGround(ctx, v, W, P, opts.lod || 0);
    drawMarks(ctx, v, W, P);
    if (opts.decals) opts.decals(ctx, v);
    if (P.night) {
      ctx.globalCompositeOperation = 'lighter';
      for (const o of W.objs) if (o.type === 'lamp') { const lx = o.x - (o.side || 1) * 1.7; groundGlow(ctx, v, lx, o.z, 7.5, '#ffcf87', 0.32); }
      for (const L of opts.lights || []) {
        if (L.kind === 'beam') beam(ctx, v, L.x, L.z, L.dir, L.len, L.a, L.high);
        else groundGlow(ctx, v, L.x, L.z, L.r || 3, L.color || '#ffcf87', L.a || 0.3);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (opts.wet) wetSheen(ctx, v, P);
    // Nesneleri derinliğe göre sırala (uzaktan yakına)
    const list = [];
    const maxX = v.vw * 0.8;
    for (const o of W.objs) {
      if (o.type === 'bld') {
        const zFar = v.fwd ? o.z1 : o.z0, zNear = v.fwd ? o.z0 : o.z1;
        const dF = (zFar - v.cam.z) * (v.fwd ? 1 : -1), dN = (zNear - v.cam.z) * (v.fwd ? 1 : -1);
        if (dF < v.near || dN > v.far) continue;
        list.push({ d: dF, o });
        continue;
      }
      const p = v.P(o.x, 0, o.z);
      if (!p || p.d > (opts.lod ? Math.min(v.far, 140) : v.far)) continue;
      if ((o.parked && p.d < 8.5) || (o.type === 'lamp' && p.d < 6)) continue;
      if (Math.abs(p.X - v.cx) > maxX + 40 * p.s) continue;
      list.push({ d: p.d, o, p });
    }
    for (const o of dyn) {
      const p = v.P(o.x, o.y || 0, o.z);
      if (!p || p.d > v.far) continue;
      if (Math.abs(p.X - v.cx) > maxX + 8 * p.s) continue;
      list.push({ d: p.d + (o.bias || 0), o, p });
    }
    list.sort((a, b) => b.d - a.d);
    for (const it of list) {
      const fn = Draw[it.o.type];
      if (!fn) continue;
      if (it.o.type === 'bld') fn(ctx, v, it.o, P);
      else fn(ctx, v, it.o, P, it.p);
    }
    ctx.restore();
  }
  function wetSheen(ctx, v, P) {
    const g = ctx.createLinearGradient(0, v.cy, 0, v.vy + v.vh);
    g.addColorStop(0, P.night ? 'rgba(120,140,190,.10)' : 'rgba(210,222,235,.22)');
    g.addColorStop(0.4, P.night ? 'rgba(90,110,160,.05)' : 'rgba(210,222,235,.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    if (v.path(ctx, [[-3.5, 0, v.cam.z + 1], [3.5, 0, v.cam.z + 1], [3.5, 0, v.cam.z + 300], [-3.5, 0, v.cam.z + 300]])) { ctx.fillStyle = g; ctx.fill(); }
  }

  window.YildizRoad = { palette, View3D, World, Draw, render, Weather, beam, groundGlow, CAR_COLORS, BRAND, drawSky };
})();
