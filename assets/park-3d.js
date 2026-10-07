/* Ürgüp Yıldız Sürücü Kursu — park simülatörünün 3B görünümü (WebGL, three.js)
   park-sim.js ilk 3B kullanımda bu modülü yükler. Araç modelleri Kenney Car Kit'ten (CC0, www.kenney.nl):
   assets/park/arabalar.bin + renkler.png (tools/park/pack_cars.py). Kaporta rengi, renk paletindeki hücre değiştirilerek boyanır.
   Dünya eşlemesi: X = x (doğu), Y = yükseklik, Z = y (güney). Araç yönü θ (0 = kuzey, saat yönünde) → rotation.y = π − θ;
   modellerde ön +z, sol +x. */
import * as THREE from './vendor/three-park.js';

const BIN = new URL('park/arabalar.bin?v=1', import.meta.url).href;
const TEX = new URL('park/renkler.png?v=1', import.meta.url).href;

// Model seçimi ve gerçek ölçüler (çarpışma kutularıyla aynı uzunluk/genişlik)
const KIND = { sedan: [4.4, 1.84], player: [4.4, 1.84], taxi: [4.4, 1.84], hatch: [3.9, 1.78], suv: [4.6, 1.95], minibus: [5.3, 2.0] };
const MODELS = {
  sedan: { sy: 1.12, wr: 0.33 }, 'sedan-sports': { sy: 1.2, wr: 0.33 }, 'hatchback-sports': { sy: 1.3, wr: 0.32 },
  suv: { sy: 1.35, wr: 0.37 }, 'suv-luxury': { sy: 1.35, wr: 0.37 }, taxi: { sy: 1.12, wr: 0.33 }, van: { sy: 1.55, wr: 0.36 }
};
const PICK = { sedan: ['sedan', 'sedan', 'sedan-sports'], player: ['sedan'], taxi: ['taxi'], hatch: ['hatchback-sports'], suv: ['suv', 'suv-luxury'], minibus: ['van'] };
// Sahnedeki araç renkleri → paletteki boya hücresi [satır, sütun]
const CELL = { '#e9ecef': [2, 6], '#b9c0c9': [2, 5], '#2b2f36': [2, 2], '#2f63c8': [1, 7], '#25406b': [3, 3], '#3f7d55': [1, 3], '#8c2f2b': [3, 2], '#d9c7a2': [2, 0], '#e68a2e': [1, 5], '#6b7380': [2, 4] };
const WHITE = [2, 6];

/* ---------- Yardımcılar ---------- */
const col = (c) => new THREE.Color(c);
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function noise(x, n, amt, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n * n * 0.35; i++) {
    const v = r();
    x.fillStyle = v > 0.5 ? `rgba(255,255,255,${(amt * r()).toFixed(3)})` : `rgba(0,0,0,${(amt * 1.3 * r()).toFixed(3)})`;
    x.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1 + (r() < 0.1 ? 1 : 0), 1);
  }
}
// Yere paralel dörtgen: UV dünya ölçüsünde (tile metre)
function flat(x0, z0, x1, z1, y, tile = 4) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([x0 / tile, z0 / tile, x0 / tile, z1 / tile, x1 / tile, z1 / tile, x1 / tile, z0 / tile], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
// Geometriye tek renk köşe rengi ekler (birleştirilecek parçalar için)
function tint(g, c) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = col(c);
  for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
function merged(list) { const g = THREE.mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x))); list.forEach((x) => x.dispose()); return g; }

/* ---------- Model dosyası ---------- */
async function loadModels() {
  const [buf, img] = await Promise.all([
    fetch(BIN).then((r) => { if (!r.ok) throw new Error('model ' + r.status); return r.arrayBuffer(); }),
    new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = TEX; })
  ]);
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x314b5059) throw new Error('model biçimi');
  const jl = dv.getUint32(4, true), J = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl))), base = 8 + jl;
  const geo = (g) => {
    const p16 = new Int16Array(buf, base + g.p, g.n * 3), n8 = new Int8Array(buf, base + g.nr, g.n * 4), u16 = new Uint16Array(buf, base + g.uv, g.n * 2);
    const pos = new Float32Array(g.n * 3), nor = new Float32Array(g.n * 3), uv = new Float32Array(g.n * 2);
    for (let i = 0; i < g.n; i++) {
      pos[i * 3] = p16[i * 3] * g.s; pos[i * 3 + 1] = p16[i * 3 + 1] * g.s; pos[i * 3 + 2] = p16[i * 3 + 2] * g.s;
      nor[i * 3] = n8[i * 4] / 127; nor[i * 3 + 1] = n8[i * 4 + 1] / 127; nor[i * 3 + 2] = n8[i * 4 + 2] / 127;
      uv[i * 2] = u16[i * 2] / 65535; uv[i * 2 + 1] = u16[i * 2 + 1] / 65535;
    }
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    b.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    b.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    b.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, base + g.i, g.ni).slice(), 1));
    return b;
  };
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const M = {};
  for (const name in J.models) {
    const m = J.models[name], g = geo(m.g);
    // Boya köşeleri: ağırlık merkezi boya hücresindeki üçgenlerin köşeleri
    const uv = g.attributes.uv.array, idx = g.index.array, paint = new Uint8Array(g.attributes.uv.count);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const u = (uv[a * 2] + uv[b * 2] + uv[c * 2]) / 3, v = (uv[a * 2 + 1] + uv[b * 2 + 1] + uv[c * 2 + 1]) / 3;
      if (Math.floor(v * 4) === m.paint[0] && Math.floor(u * 8) === m.paint[1]) paint[a] = paint[b] = paint[c] = 1;
    }
    M[name] = { g, paint, cell: m.paint, wheels: m.wheels, box: m.box };
  }
  return { M, wheel: geo(J.wheel), tex };
}

/* =========================================================
   Görünüm
   ========================================================= */
export async function create() {
  const canvas = document.createElement('canvas');
  canvas.className = 'ps-gl';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const lib = await loadModels();
  const carMat = new THREE.MeshLambertMaterial({ map: lib.tex });
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe6dcc7, 70, 240);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.2, 500);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8f7a5c, 1.6);
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.castShadow = true;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -24;
  sun.shadow.camera.right = sun.shadow.camera.top = 24;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(hemi, sun, sun.target);
  const SUN = new THREE.Vector3(-18, 30, -16);   // güneş: batı-kuzeybatıdan (2B gölgeleriyle aynı yöne düşer)

  // Doku kütüphanesi
  const T = {
    asphalt: canvasTex(256, (x, n) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, n, n); noise(x, n, 0.12, 7); }),
    grass: canvasTex(256, (x, n) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, n, n); noise(x, n, 0.2, 9); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,40,0,${0.04 + Math.random() * 0.06})`; x.fillRect(Math.random() * n, Math.random() * n, 2, 3); } }),
    tiles: canvasTex(128, (x, n) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, n, n); noise(x, n, 0.08, 3); x.fillStyle = 'rgba(0,0,0,.13)'; x.fillRect(0, 0, n, 3); x.fillRect(0, 0, 3, n); }),
    glow: canvasTex(128, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); }, false)
  };
  // Cephe dokusu: 4 bölme × 4 kat; gece için rastgele yanan pencereler
  const facade = (litMode) => canvasTex(512, (x, n) => {
    const bw = n / 4, fh = n / 4;
    x.fillStyle = litMode ? '#000000' : '#ffffff'; x.fillRect(0, 0, n, n);
    let s = 13;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let f = 0; f < 4; f++) for (let b = 0; b < 4; b++) {
      const wx = b * bw + bw * 0.27, wy = f * fh + fh * (1 - 2.3 / 3.1), ww = bw * 0.46, wh = fh * (1.4 / 3.1);
      if (litMode) { if (r() < 0.45) { x.fillStyle = '#ffcf73'; x.fillRect(wx, wy, ww, wh); } continue; }
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(wx - 4, wy - 4, ww + 8, wh + 10);
      x.fillStyle = '#f4efe6'; x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#5a7088'); g.addColorStop(1, '#2c3a49');
      x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
      x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(wx + 3, wy + 3, ww * 0.35, wh - 6);
      x.fillStyle = '#e9e2d4'; x.fillRect(wx, wy + wh / 2 - 1.5, ww, 3); x.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(wx - 6, wy + wh + 3, ww + 12, 5);
    }
    noise(x, n, litMode ? 0 : 0.05, 21);
  });
  T.facade = facade(false); T.facadeLit = facade(true);

  /* ---------- Araç geometrileri (önbellekli) ---------- */
  const cache = new Map();
  function bodyGeo(name, kind, cell) {
    const key = name + '|' + kind + '|' + (cell ? cell.join(',') : '-');
    let g = cache.get(key);
    if (g) return g;
    const m = lib.M[name], [L, W] = KIND[kind] || KIND.sedan, S = MODELS[name];
    const [x0, x1, , , z0, z1] = m.box, sx = W / (x1 - x0), sz = L / (z1 - z0), zc = (z0 + z1) / 2;
    g = m.g.clone();
    if (cell) {
      const uv = g.attributes.uv.array, du = (cell[1] - m.cell[1]) / 8, dv = (cell[0] - m.cell[0]) / 4;
      for (let i = 0; i < m.paint.length; i++) if (m.paint[i]) { uv[i * 2] += du; uv[i * 2 + 1] += dv; }
    }
    g.translate(0, 0, -zc);
    g.scale(sx, S.sy, sz);
    g.userData = { sx, sz, zc, L, W, H: m.box[3] * S.sy, wr: S.wr, wheels: m.wheels.map(([wx, , wz]) => [Math.sign(wx), (wz - zc) * sz]) };
    cache.set(key, g);
    return g;
  }
  // Teker konumu: dış yüzü gövde kenarının 6 cm içinde
  const wheelX = (side, W, wr) => side * (W / 2 - 0.06 - 0.3 * (wr / 0.3));
  function staticCar(c) {
    const names = PICK[c.kind] || PICK.sedan, name = names[c.pick % names.length];
    const cell = c.kind === 'taxi' ? null : CELL[c.color] || WHITE;
    const key = 'static|' + name + '|' + c.kind + '|' + (cell ? cell.join(',') : '-');
    let g = cache.get(key);
    if (!g) {
      const b = bodyGeo(name, c.kind, cell), d = b.userData, parts = [b.clone()];
      for (const [side, wz] of d.wheels) {
        const w = lib.wheel.clone(), k = d.wr / 0.3;
        if (side < 0) { w.scale(-1, 1, 1); flipIndex(w); }
        w.scale(k, k, k);
        w.translate(wheelX(side, d.W, d.wr) + side * 0.0, d.wr, wz);
        parts.push(w);
      }
      g = THREE.mergeGeometries(parts.map((p) => p.toNonIndexed()));
      g.userData = d;
      cache.set(key, g);
    }
    const mesh = new THREE.Mesh(g, carMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(c.x, 0, c.y);
    mesh.rotation.y = Math.PI - c.ang;
    return mesh;
  }
  // Aynalanan geometride üçgen yönünü düzelt (normalleri scale() zaten çevirir)
  function flipIndex(g) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  }

  /* ---------- Oyuncu aracı: beyaz kurs aracı, kırmızı-mavi yan şerit, tavanda eğitim levhası ---------- */
  const player = new THREE.Group();
  const pBody = bodyGeo('sedan', 'player', WHITE), pd = pBody.userData;
  const pMesh = new THREE.Mesh(pBody, carMat);
  pMesh.castShadow = true; pMesh.receiveShadow = true;
  player.add(pMesh);
  const wheels = [];
  for (const [side, wz] of pd.wheels) {
    const pivot = new THREE.Group(), g = lib.wheel.clone(), k = pd.wr / 0.3;
    if (side < 0) { g.scale(-1, 1, 1); flipIndex(g); }
    g.scale(k, k, k);
    const m = new THREE.Mesh(g, carMat);
    m.castShadow = true;
    pivot.position.set(wheelX(side, pd.W, pd.wr), pd.wr, wz);
    pivot.add(m);
    player.add(pivot);
    wheels.push({ pivot, mesh: m, front: wz > 0 });
  }
  const signTex = canvasTex(256, (x, n) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, n, n);
    x.fillStyle = '#1f5fd1'; x.fillRect(0, 0, n, 10); x.fillRect(0, n - 10, n, 10);
    x.fillStyle = '#de2f29'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '900 52px Inter, Arial, sans-serif'; x.fillText('DİREKSİYON', n / 2, n * 0.36, n - 20);
    x.font = '900 64px Inter, Arial, sans-serif'; x.fillText('EĞİTİM', n / 2, n * 0.68, n - 30);
  }, false);
  const signSide = new THREE.MeshLambertMaterial({ color: 0x1f5fd1 }), signFace = new THREE.MeshLambertMaterial({ map: signTex });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.3, 0.22), [signSide, signSide, signSide, signSide, signFace, signFace]);
  sign.position.set(0, pd.H + 0.15, -0.25);
  sign.castShadow = true;
  player.add(sign);
  const stripeRed = new THREE.MeshLambertMaterial({ color: 0xde2f29 }), stripeBlue = new THREE.MeshLambertMaterial({ color: 0x1f5fd1 });
  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.075, pd.L * 0.62), stripeRed);
    r.position.set(side * (pd.W / 2 + 0.002), 0.62, -0.05);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, pd.L * 0.62), stripeBlue);
    b.position.set(side * (pd.W / 2 + 0.002), 0.55, -0.05);
    player.add(r, b);
  }
  // Işıklar: toplamalı haleler (fren, geri vites, far) + gece farı spot ışığı
  const glowMat = (c) => new THREE.SpriteMaterial({ map: T.glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const halo = (c, x, y, z, s) => { const sp = new THREE.Sprite(glowMat(c)); sp.position.set(x, y, z); sp.scale.set(s, s, s); sp.visible = false; player.add(sp); return sp; };
  const tailY = 0.72, rearZ = -pd.L / 2 - 0.05, frontZ = pd.L / 2 + 0.05;
  const brakeL = [halo(0xff2a1f, -0.62, tailY, rearZ, 0.9), halo(0xff2a1f, 0.62, tailY, rearZ, 0.9)];
  const revL = [halo(0xffffff, -0.42, tailY - 0.04, rearZ, 0.7), halo(0xffffff, 0.42, tailY - 0.04, rearZ, 0.7)];
  const headL = [halo(0xfff0c8, -0.6, 0.68, frontZ, 1.1), halo(0xfff0c8, 0.6, 0.68, frontZ, 1.1)];
  const spot = new THREE.SpotLight(0xfff1d0, 0, 32, 0.62, 0.55, 1.2);
  spot.position.set(0, 0.75, pd.L / 2);
  spot.target.position.set(0, 0, pd.L / 2 + 12);
  player.add(spot, spot.target);
  scene.add(player);

  /* ---------- Hedef, yörünge çizgileri, işaret ---------- */
  const tgtFill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const tgtLine = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffc83d, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  tgtFill.renderOrder = 1; tgtLine.renderOrder = 2;
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 4), new THREE.MeshBasicMaterial({ color: 0xffc83d, fog: false }));
  marker.rotation.x = Math.PI;
  const NG = 21, guideGeo = new THREE.BufferGeometry();
  const gPos = new Float32Array((NG * 2 * 2 + 3 * 4) * 3), gCol = new Float32Array(gPos.length);
  guideGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  guideGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
  {
    const ix = [];
    for (let l = 0; l < 2; l++) for (let i = 0; i < NG - 1; i++) { const a = (l * NG + i) * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const t0 = NG * 2 * 2;
    for (let k = 0; k < 3; k++) { const a = t0 + k * 4; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    guideGeo.setIndex(ix);
    const yel = col('#ffd65a'), tick = ['#ff5a4f', '#ffc83d', '#7df0a8'].map(col);
    for (let i = 0; i < NG * 4; i++) { gCol[i * 3] = yel.r; gCol[i * 3 + 1] = yel.g; gCol[i * 3 + 2] = yel.b; }
    for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) { const i = NG * 4 + k * 4 + j; gCol[i * 3] = tick[k].r; gCol[i * 3 + 1] = tick[k].g; gCol[i * 3 + 2] = tick[k].b; }
  }
  const guides = new THREE.Mesh(guideGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false }));
  guides.renderOrder = 3;
  guides.frustumCulled = false;
  scene.add(tgtFill, tgtLine, marker, guides);

  /* ---------- Sahne kurulumu ---------- */
  let world = null, curId = '', top = 0;
  function setScene(sc, P) {
    if (world) {
      scene.remove(world);
      world.traverse((o) => { if (o.userData.own) { o.geometry.dispose(); [].concat(o.material).forEach((m) => m.dispose()); } });
    }
    world = new THREE.Group();
    curId = sc.id + (P.night ? 'n' : 'd');
    const night = P.night;
    scene.fog.color.set(P.haze);
    hemi.color.set(night ? 0x6b7aa8 : 0xffffff); hemi.groundColor.set(night ? 0x1b1f2a : 0x8f7a5c); hemi.intensity = night ? 0.55 : 1.05;
    sun.color.set(night ? 0x9fb4ff : 0xfff4e0); sun.intensity = night ? 0.35 : 3.4;
    const own = (m) => { m.userData.own = true; return m; };
    const lam = (c, map, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: col(c), map: map || null }, extra));
    const AC = { earth: [P.ground, T.grass, 6], grass: [P.garden, T.grass, 4], plant: [P.garden, T.grass, 4], asphalt: [P.road, T.asphalt, 5], walk: [P.walk, T.tiles, 1] };
    const mats = {};
    for (const k in AC) mats[k] = lam(AC[k][0], AC[k][1]);
    let lift = 0;
    top = 0;
    for (const a of sc.areas) {
      const [, , tile] = AC[a.t];
      if (a.h) {
        // Yükseltilmiş kaldırım: üst yüz + bordür yüzleri kutu olarak
        const b = new THREE.Mesh(new THREE.BoxGeometry(a.x1 - a.x0, a.h, a.y1 - a.y0), [lam(P.curb), lam(P.curb), mats[a.t], mats[a.t], lam(P.curb), lam(P.curb)]);
        const uv = b.geometry.attributes.uv.array;
        for (let i = 16; i < 24; i++) uv[i] = i % 2 ? uv[i] * (a.y1 - a.y0) / tile : uv[i] * (a.x1 - a.x0) / tile;
        b.position.set((a.x0 + a.x1) / 2, a.h / 2, (a.y0 + a.y1) / 2);
        b.receiveShadow = true;
        world.add(own(b));
      } else {
        lift += 0.01;
        const m = new THREE.Mesh(flat(a.x0, a.y0, a.x1, a.y1, lift, tile), mats[a.t]);
        m.receiveShadow = true;
        world.add(own(m));
      }
    }
    // Bordür üst kenarı (açık renkli şerit)
    const curbParts = [];
    for (const c of sc.curbs) {
      const horiz = Math.abs(c.y1 - c.y0) < 0.01, len = horiz ? Math.abs(c.x1 - c.x0) : Math.abs(c.y1 - c.y0);
      const g = new THREE.BoxGeometry(horiz ? len : 0.22, 0.02, horiz ? 0.22 : len);
      g.translate((c.x0 + c.x1) / 2 - c.nx * 0.11, 0.155, (c.y0 + c.y1) / 2 - c.ny * 0.11);
      curbParts.push(tint(g, P.curbTop));
    }
    if (curbParts.length) world.add(own(new THREE.Mesh(merged(curbParts), new THREE.MeshLambertMaterial({ vertexColors: true }))));
    // Çizgiler
    const pts = [], idx = [];
    for (const p of sc.paint) {
      const o = pts.length / 3;
      for (const [x, y] of p.pts) pts.push(x, lift + 0.004, y);
      top = lift;
      for (let i = 1; i < p.pts.length - 1; i++) {
        const [ax, ay] = p.pts[0], [bx, by] = p.pts[i], [cx, cy] = p.pts[i + 1];
        // XZ düzleminde yukarı (+Y) bakan sıra: (b−a)×(c−a) işaretine göre
        if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) idx.push(o, o + i, o + i + 1); else idx.push(o, o + i + 1, o + i);
      }
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    pg.setAttribute('normal', new THREE.Float32BufferAttribute(pts.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    pg.setIndex(idx);
    const paint = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ color: col(P.line), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    paint.receiveShadow = true;
    world.add(own(paint));
    // Park etmiş araçlar
    sc.cars.forEach((c, i) => world.add(staticCar(Object.assign({ pick: (i * 7 + 3) % 5 }, c))));
    // Ağaçlar (birleştirilmiş, düz gölgelendirme)
    const tp = [];
    sc.trees.forEach((t, i) => {
      const tr = new THREE.CylinderGeometry(0.11, 0.17, 2.4, 6); tr.translate(t.x, 1.2, t.y); tp.push(tint(tr, P.trunk));
      const blobs = [[0, 2.9, 0, 1], [0.55, 2.55, 0.3, 0.72], [-0.45, 2.6, -0.35, 0.7], [0.1, 3.45, -0.1, 0.62]];
      blobs.forEach(([bx, by, bz, k], j) => { const ic = new THREE.IcosahedronGeometry(t.r * k, 1); ic.translate(t.x + bx * t.r, by * (t.r / 1.4), t.y + bz * t.r); tp.push(tint(ic, P.leaf[(i + j) % 3])); });
    });
    if (tp.length) { const tm = new THREE.Mesh(merged(tp), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); tm.castShadow = true; tm.receiveShadow = true; world.add(own(tm)); }
    // Sokak lambaları
    const lp = [], heads = [];
    for (const l of sc.lamps) {
      const ax = Math.sin(l.ang), ay = -Math.cos(l.ang), H = 5.6;
      const pole = new THREE.CylinderGeometry(0.06, 0.09, H, 8); pole.translate(l.x, H / 2, l.y); lp.push(tint(pole, P.pole));
      const arm = new THREE.BoxGeometry(Math.abs(ax) * 1.5 + 0.08, 0.08, Math.abs(ay) * 1.5 + 0.08); arm.translate(l.x + ax * 0.75, H - 0.05, l.y + ay * 0.75); lp.push(tint(arm, P.poleDark));
      const hd = new THREE.BoxGeometry(0.46, 0.14, 0.46); hd.translate(l.x + ax * 1.5, H - 0.12, l.y + ay * 1.5); heads.push(tint(hd, night ? '#fff1cf' : '#9aa1ab'));
      if (night) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: T.glow, color: 0xffc98a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
        d.rotation.x = -Math.PI / 2; d.position.set(l.x + ax * 1.5, 0.03, l.y + ay * 1.5);
        world.add(own(d));
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffd79a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        sp.position.set(l.x + ax * 1.5, H - 0.3, l.y + ay * 1.5); sp.scale.set(2.6, 2.6, 2.6);
        world.add(own(sp));
      }
    }
    if (lp.length) { const lm = new THREE.Mesh(merged(lp), new THREE.MeshLambertMaterial({ vertexColors: true })); lm.castShadow = true; world.add(own(lm)); }
    if (heads.length) world.add(own(new THREE.Mesh(merged(heads), night ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true }))));
    // Binalar: cephe dokusu (4 bölme × 4 kat), gece pencereler yanar
    for (const b of sc.blds) {
      const w = b.x1 - b.x0, d = b.y1 - b.y0, h = b.h;
      const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv.array;
      const faceW = [d, d, w, w, w, w];
      for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = (f * 4 + v) * 2; uv[i] *= faceW[f] / (2.6 * 4); uv[i + 1] *= h / (3.1 * 4); }
      const wall = new THREE.MeshLambertMaterial({ color: col(P.bld[b.ci % P.bld.length]), map: T.facade, emissive: night ? 0xffffff : 0x000000, emissiveMap: night ? T.facadeLit : null, emissiveIntensity: night ? 0.9 : 0 });
      const roof = lam(new THREE.Color(P.bld[b.ci % P.bld.length]).multiplyScalar(0.82).getStyle());
      const m = new THREE.Mesh(g, [wall, wall, roof, roof, wall, wall]);
      m.position.set((b.x0 + b.x1) / 2, h / 2, (b.y0 + b.y1) / 2);
      m.castShadow = true; m.receiveShadow = true;
      world.add(own(m));
    }
    scene.add(world);
    // Hedef çerçevesi
    const tp2 = sc.targetPoly;
    const fg = tgtFill.geometry;
    fg.setAttribute('position', new THREE.Float32BufferAttribute(tp2.flatMap(([x, y]) => [x, top + 0.007, y]), 3));
    fg.setIndex([0, 2, 1, 0, 3, 2]);
    const lpos = [], lidx = [];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = tp2[i], [bx, by] = tp2[(i + 1) % 4], l = Math.hypot(bx - ax, by - ay), nx = (-(by - ay) / l) * 0.075, ny = ((bx - ax) / l) * 0.075, o = lpos.length / 3;
      const yy = top + 0.009;
      lpos.push(ax + nx, yy, ay + ny, bx + nx, yy, by + ny, bx - nx, yy, by - ny, ax - nx, yy, ay - ny);
      lidx.push(o, o + 2, o + 1, o, o + 3, o + 2);
    }
    tgtLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
    tgtLine.geometry.setIndex(lidx);
    tgtFill.material.side = tgtLine.material.side = THREE.DoubleSide;
    const tc = sc.targetCenter;
    marker.position.set(tc[0], 2.6, tc[1]);
    for (const h of headL) h.visible = night;
    spot.intensity = night ? 60 : 0;
    renderer.shadowMap.needsUpdate = true;
  }

  /* ---------- Kare ---------- */
  let spin = 0, lastX = 0, lastY = 0;
  function frame(st, w, h) {
    if (!world || st.sceneKey !== curId) setScene(st.scene, st.pal);
    const c = st.car;
    player.position.set(c.x, 0, c.y);
    player.rotation.y = Math.PI - c.ang;
    // Teker dönüşü: yol kadar
    const dd = Math.hypot(c.x - lastX, c.y - lastY);
    if (dd < 2) spin += (c.v >= 0 ? 1 : -1) * dd / pd.wr;
    lastX = c.x; lastY = c.y;
    for (const wh of wheels) { wh.pivot.rotation.y = wh.front ? -st.steer : 0; wh.mesh.rotation.x = spin; }
    for (const b of brakeL) b.visible = st.brake || st.night;
    for (const b of brakeL) b.material.opacity = st.brake ? 1 : 0.45;
    for (const r of revL) r.visible = st.rev;
    // Hedef rengi ve işaret
    const tcol = st.ready ? 0x1fbf6a : 0xffc83d;
    tgtFill.material.color.setHex(tcol); tgtLine.material.color.setHex(tcol); marker.material.color.setHex(tcol);
    tgtFill.material.opacity = 0.16 + 0.12 * st.pulse;
    marker.visible = !st.busy;
    marker.position.y = 2.6 + st.bob;
    marker.rotation.y = st.time * 1.5;
    // Yörünge çizgileri
    guides.visible = !!st.guides;
    if (st.guides) {
      const [Lp, Rp] = st.guides;
      let k = 0;
      const gy = top + 0.012, put = (x, y) => { gPos[k++] = x; gPos[k++] = gy; gPos[k++] = y; };
      for (const line of [Lp, Rp]) for (let i = 0; i < NG; i++) {
        const p = line[i], q = line[Math.min(NG - 1, i + 1)], o = line[Math.max(0, i - 1)];
        let dx = q[0] - o[0], dy = q[1] - o[1];
        const l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * 0.05, ny = (dx / l) * 0.05;
        put(p[0] + nx, p[1] + ny); put(p[0] - nx, p[1] - ny);
      }
      for (const i of [4, 8, 12]) {
        const a = Lp[i], b = Rp[i], q = Lp[i + 1];
        const fx = q[0] - a[0], fy = q[1] - a[1], l = Math.hypot(fx, fy) || 1, ox = (fx / l) * 0.05, oy = (fy / l) * 0.05;
        put(a[0] - ox, a[1] - oy); put(a[0] + ox, a[1] + oy); put(b[0] - ox, b[1] - oy); put(b[0] + ox, b[1] + oy);
      }
      guideGeo.attributes.position.needsUpdate = true;
    }
    // Kamera: aracın arkasından (geri viteste önünden) bakış; ufuk yüksekliği gökyüzü çizimiyle eşlenir
    const yaw = st.cam.yaw, fx = Math.sin(yaw), fy = -Math.cos(yaw);
    const camX = c.x - fx * st.cam.dist + st.cam.jx, camY = c.y - fy * st.cam.dist, camH = st.cam.h + st.cam.jy;
    const ahead = 12;
    camera.position.set(camX, camH, camY);
    camera.lookAt(c.x + fx * ahead, 0, c.y + fy * ahead);
    const f = Math.max((w / 2) / Math.tan((33 * Math.PI) / 180), h * (w < 560 ? 0.85 : 0.78));
    camera.fov = (2 * Math.atan(h / 2 / f) * 180) / Math.PI;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Güneş gölgesi araçla birlikte kayar
    sun.position.set(c.x + SUN.x, SUN.y, c.y + SUN.z);
    sun.target.position.set(c.x, 0, c.y);
    renderer.render(scene, camera);
    const pitch = Math.atan2(camH, st.cam.dist + ahead);
    return { horizon: h / 2 - f * Math.tan(pitch), f };
  }
  function resize(w, h, dpr) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }
  // Gölge çözünürlüğü; 0 = gölge yok (yavaş cihazlar)
  function shadows(size) {
    renderer.shadowMap.enabled = size > 0;
    if (size > 0) sun.shadow.mapSize.set(size, size);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  shadows(1536);
  return { canvas, frame, resize, shadows, renderer, sun, hemi, scene };
}
