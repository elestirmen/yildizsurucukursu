/* Ürgüp Yıldız Sürücü Kursu — animasyonlu soru sahne motoru (yalnızca çevrimdışı video üretimi için).
   render.mjs bu modülü başsız Chrome'da açar; her kare `R.frame(t)` ile belirli bir zamanda çizilir, böylece
   videolar her çalıştırmada aynı çıkar. Modeller Kenney (CC0) kitlerinden: Car Kit, City Kit Roads/Commercial/Suburban,
   Mini Characters. Levhalar ve gösterge lambaları sitedeki kit.js çizimleridir.
   Dünya: X doğu, Y yukarı, Z güney (metre). Yön açısı θ: 0 = kuzey (−Z), saat yönünde (derece). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const KIT = {
  car: '/kenney/kenney_car-kit/Models/GLB format/',
  road: '/kenney/kenney_city-kit-roads/Models/GLB format/',
  chr: '/kenney/kenney_mini-characters/Models/GLB format/',
  com: '/kenney/kenney_city-kit-commercial_2.1/Models/GLB format/',
  sub: '/kenney/kenney_city-kit-suburban_20/Models/GLB format/'
};
// Gerçek boylar (m): modeller orantısı korunarak bu uzunluğa ölçeklenir
const CAR_LEN = { sedan: 4.5, 'sedan-sports': 4.5, 'hatchback-sports': 4.0, suv: 4.7, 'suv-luxury': 4.8, taxi: 4.5, van: 5.0, police: 4.7,
  ambulance: 5.6, delivery: 6.2, 'delivery-flat': 6.2, truck: 8.6, 'truck-flat': 8.6, firetruck: 9.0, 'garbage-truck': 8.2, tractor: 3.8 };
const CHARS = ['character-male-a', 'character-male-b', 'character-male-c', 'character-male-d', 'character-male-e', 'character-male-f',
  'character-female-a', 'character-female-b', 'character-female-c', 'character-female-d', 'character-female-e', 'character-female-f'];
const BLD_COM = 'abcdefghijklmn'.split('').map((c) => 'building-' + c);
const BLD_SUB = 'abcdefghijklmnopqrstu'.split('').map((c) => 'building-type-' + c);
const DEG = Math.PI / 180;
const yawOf = (deg) => Math.PI - deg * DEG;          // θ → rotation.y (model önü +Z)
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (k) => k * k * (3 - 2 * k);
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
// [[t, değer], …] parça parça doğrusal
function track(keys, t) {
  if (!keys || !keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return t1 === t0 ? v1 : lerp(v0, v1, (t - t0) / (t1 - t0)); }
  }
  return keys[keys.length - 1][1];
}
const inRanges = (rs, t) => !!rs && rs.some(([a, b]) => t >= a && t < b);

/* ---------- Dokular ---------- */
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function speckle(x, w, h, amt, seed, n = 0.3) {
  const r = rng(seed);
  for (let i = 0; i < w * h * n; i++) {
    const v = r();
    x.fillStyle = v > 0.5 ? `rgba(255,255,255,${(amt * r()).toFixed(3)})` : `rgba(0,0,0,${(amt * 1.3 * r()).toFixed(3)})`;
    x.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + (r() < 0.1 ? 1 : 0), 1);
  }
}
const TEX = {};
function makeTextures() {
  TEX.asphalt = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#5b5e63'; x.fillRect(0, 0, w, h); speckle(x, w, h, 0.16, 7, 0.45);
    const r = rng(3); for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`; x.beginPath(); x.ellipse(r() * w, r() * h, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); x.fill(); }
  });
  TEX.walk = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#c9c3b8'; x.fillRect(0, 0, w, h); speckle(x, w, h, 0.08, 5);
    x.fillStyle = 'rgba(0,0,0,.16)'; for (let i = 0; i < 4; i++) { x.fillRect(0, i * 64, w, 2); x.fillRect(i * 64 + (i % 2) * 0, 0, 2, h); }
  });
  TEX.grass = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#6f9a4c'; x.fillRect(0, 0, w, h); speckle(x, w, h, 0.22, 9, 0.5);
    const r = rng(11); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(20,60,10,${0.05 + r() * 0.08})`; x.fillRect(r() * w, r() * h, 2, 4); }
  });
  TEX.earth = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#9c8a6a'; x.fillRect(0, 0, w, h); speckle(x, w, h, 0.18, 13, 0.5); });
  TEX.glow = canvasTex(128, 128, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  }, false);
}

/* ---------- Model yükleme ---------- */
const loader = new GLTFLoader();
const LIB = {};
async function loadGLB(kit, name) {
  const key = kit + '/' + name;
  if (LIB[key]) return LIB[key];
  const g = await loader.loadAsync(KIT[kit] + name + '.glb');
  g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  LIB[key] = g;
  return g;
}
function bbox(o) { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); }

/* ---------- Kit.js çizimlerinden doku ---------- */
// kit.js SVG'lerine boyut ver (yalnız viewBox'lı SVG tuvale yanlış ölçekle çizilir)
function fixSvg(svg, size = 512) {
  let m = svg.includes('xmlns') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  if (!/<svg[^>]*\swidth=/.test(m)) m = m.replace('<svg', `<svg width="${size}" height="${size}"`);
  return m;
}
function svgImage(svg) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = rej;
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
async function svgTex(svg, size = 512) {
  const im = await svgImage(fixSvg(svg, size));
  const t = canvasTex(size, size, (x) => x.drawImage(im, 0, 0, size, size), false);
  t.premultiplyAlpha = false;
  return { tex: t, img: im };
}

/* =========================================================
   Sahne
   ========================================================= */
export async function createEngine(W = 960, H = 540) {
  makeTextures();
  const gl = document.createElement('canvas');
  gl.width = W; gl.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  document.body.appendChild(out);

  // Ön yükleme: sahnelerde kullanılan tüm modeller
  const carNames = Object.keys(CAR_LEN);
  await Promise.all([
    ...carNames.map((n) => loadGLB('car', n)),
    ...CHARS.map((n) => loadGLB('chr', n)),
    ...BLD_COM.map((n) => loadGLB('com', n)), ...['building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c'].map((n) => loadGLB('com', n)),
    ...BLD_SUB.map((n) => loadGLB('sub', n)), loadGLB('sub', 'tree-large'), loadGLB('sub', 'tree-small'), loadGLB('sub', 'fence-1x4'),
    loadGLB('road', 'light-curved'), loadGLB('road', 'construction-cone'), loadGLB('road', 'construction-barrier')
  ]);
  const LAMP_IMG = {};
  if (window.YildizKit) {
    for (const id of Object.keys(window.YildizKit.LAMPS)) LAMP_IMG[id] = await svgImage(fixSvg(window.YildizKit.lamp(id, true), 128));
  }

  let scene, camera, sun, hemi, actors, hooks, camSpec, dur, cockpit, lastT, NIGHT = false;

  /* ---------- Kurulum yardımcıları (senaryolar kullanır) ---------- */
  function api(opts) {
    const lam = (c, map, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(c), map: map || null }, extra));
    const M = {
      asphalt: lam('#ffffff', TEX.asphalt), walk: lam('#ffffff', TEX.walk), grass: lam('#ffffff', TEX.grass), earth: lam('#ffffff', TEX.earth),
      curb: lam('#d9d4ca'), line: lam('#f2f2ee', null, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      yellow: lam('#f2c230', null, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    };
    let layer = 0;
    // Yere paralel dikdörtgen: UV dünya ölçüsünde
    function quad(x0, z0, x1, z1, y, mat, tile = 6) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0], 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([x0 / tile, z0 / tile, x0 / tile, z1 / tile, x1 / tile, z1 / tile, x1 / tile, z0 / tile], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
    }
    const A = {
      THREE, scene, rng, track, lerp, clamp, smooth, DEG,
      ground(kind = 'grass', size = 800) { quad(-size, -size, size, size, -0.06, M[kind], kind === 'grass' ? 5 : 8); },
      asphalt(x0, z0, x1, z1) { layer += 0.002; return quad(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), layer, M.asphalt, 8); },
      grass(x0, z0, x1, z1) { return quad(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), -0.03, M.grass, 5); },
      // Yükseltilmiş kaldırım (bordürlü)
      walk(x0, z0, x1, z1, h = 0.15) {
        const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
        const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv.array;
        for (let i = 16; i < 24; i++) uv[i] = i % 2 ? uv[i] * d / 3 : uv[i] * w / 3;
        const b = new THREE.Mesh(g, [M.curb, M.curb, M.walk, M.walk, M.curb, M.curb]);
        b.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); b.receiveShadow = true; b.castShadow = false; scene.add(b); return b;
      },
      // Çizgi: noktalar [[x,z]…], kesikli için dash = [dolu, boş]
      line(pts, o = {}) {
        const w = o.w || 0.15, mat = o.color === 'yellow' ? M.yellow : M.line, y = 0.04;
        const segs = [];
        for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
        let phase = o.offset || 0;
        for (const [[ax, az], [bx, bz]] of segs) {
          const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
          const parts = [];
          // uzun ince üçgenler yazılımsal çizicide bazı karelerde düşüyor: düz çizgiyi 20 m'lik parçalara böl
          if (!o.dash) for (let a = 0; a < L; a += 20) parts.push([a, Math.min(L, a + 20)]);
          else { const [on, off] = o.dash, P = on + off; let s = -((phase % P) + P) % P; for (; s < L; s += P) { const a = Math.max(0, s), b = Math.min(L, s + on); if (b > a) parts.push([a, b]); } phase += L; }
          for (const [a, b] of parts) {
            const g = new THREE.PlaneGeometry(w, b - a);
            g.rotateX(-Math.PI / 2);
            const m = new THREE.Mesh(g, mat);
            m.position.set(ax + ux * (a + b) / 2, y, az + uz * (a + b) / 2);
            m.rotation.y = Math.atan2(ux, uz);
            m.receiveShadow = true; scene.add(m);
          }
        }
      },
      // Yaya geçidi: merkez, yol yönü açısı (derece, yolun uzandığı yön), yol genişliği, geçit derinliği
      zebra(cx, cz, ang, width, depth = 3.2) {
        const a = ang * DEG, ax = Math.sin(a), az = -Math.cos(a), px = -az, pz = ax;
        for (let s = -width / 2 + 0.3; s < width / 2 - 0.2; s += 1.0) {
          const g = new THREE.PlaneGeometry(0.5, depth); g.rotateX(-Math.PI / 2);
          const m = new THREE.Mesh(g, M.line);
          m.position.set(cx + px * (s + 0.25), 0.04, cz + pz * (s + 0.25)); m.rotation.y = Math.atan2(ax, az);
          m.receiveShadow = true; scene.add(m);
        }
      },
      // Dönel kavşak: asfalt halka + ortada çimen ada
      roundabout(cx, cz, rIn, rOut) {
        const g = new THREE.RingGeometry(rIn, rOut, 72); g.rotateX(-Math.PI / 2);
        const uv = g.attributes.uv.array, p = g.attributes.position.array;
        for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = p[i * 3] / 8; uv[i * 2 + 1] = p[i * 3 + 2] / 8; }
        const m = new THREE.Mesh(g, M.asphalt); m.position.set(cx, 0.012, cz); m.receiveShadow = true; scene.add(m);
        const isl = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn, 0.3, 48), [M.grass, M.grass, M.curb]);
        isl.position.set(cx, 0.15, cz); isl.receiveShadow = true; scene.add(isl);
        const curb = new THREE.Mesh(new THREE.TorusGeometry(rIn, 0.12, 6, 64), M.curb); curb.rotation.x = Math.PI / 2; curb.position.set(cx, 0.16, cz); scene.add(curb);
        return isl;
      },
      // GLB modeli: tür ve ad, konum, açı, hedef ölçü
      model(kit, name, x, z, ang = 0, o = {}) {
        const src = LIB[kit + '/' + name].scene, m = src.clone(true);
        const b = bbox(m), sz = b.getSize(new THREE.Vector3());
        let k = 1;
        if (o.width) k = o.width / Math.max(sz.x, sz.z);
        else if (o.height) k = o.height / sz.y;
        else if (o.scale) k = o.scale;
        const g = new THREE.Group(); m.scale.setScalar(k);
        const c = b.getCenter(new THREE.Vector3());
        m.position.set(-c.x * k, -b.min.y * k, -c.z * k);
        g.add(m); g.position.set(x, o.y || 0, z); g.rotation.y = yawOf(ang);
        scene.add(g); return g;
      },
      building(x, z, ang, width, pick = 0, kind = 'com') {
        const list = kind === 'com' ? BLD_COM : kind === 'sky' ? ['building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c'] : BLD_SUB;
        return A.model(kind === 'sub' ? 'sub' : 'com', list[pick % list.length], x, z, ang, { width });
      },
      tree(x, z, h = 7, small = false) { return A.model('sub', small ? 'tree-small' : 'tree-large', x, z, (x * 37 + z * 11) % 360, { height: h }); },
      lamp(x, z, ang) { return A.model('road', 'light-curved', x, z, ang, { height: 7 }); },
      cone(x, z) { return A.model('road', 'construction-cone', x, z, 0, { height: 0.7 }); },
      // Levha: kit.js kimliği, konum, yüzün baktığı yön (sürücüye doğru), alt kenar yüksekliği
      async sign(id, x, z, face, o = {}) {
        const { tex } = await svgTex(window.YildizKit.sign(id));
        const size = o.size || 0.9, h = o.h || 2.1;
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h + size / 2, 8), lam('#9aa0a6'));
        pole.position.y = (h + size / 2) / 2; pole.castShadow = true; g.add(pole);
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.FrontSide }));
        plate.position.set(0, h + size / 2, 0.05); g.add(plate);
        const back = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.9, size * 0.9), lam('#8d9297', null, { side: THREE.BackSide }));
        back.position.copy(plate.position); back.position.z = 0.04; g.add(back);
        g.position.set(x, 0, z); g.rotation.y = yawOf(face); // plaka yerel +Z'ye, yani face yönüne bakar
        scene.add(g); return g;
      },
      // Trafik ışığı: fazlar [[t, 'r'|'ry'|'g'|'y'|'off'], …]; face = ışığın baktığı yön (gelen trafiğe)
      signal(x, z, face, phases, o = {}) {
        const g = new THREE.Group(), h = o.h || 3.2;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, h, 10), lam('#3d4248')); pole.position.y = h / 2; pole.castShadow = true; g.add(pole);
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.12, 0.3), lam('#23272c')); box.position.set(0, h + 0.5, 0); box.castShadow = true; g.add(box);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.32, 0.04), lam('#f2f2f2')); plate.position.set(0, h + 0.5, -0.16); g.add(plate);
        const cols = { r: 0xff2a1f, y: 0xffae1f, g: 0x2fe07a }, lamps = {};
        ['r', 'y', 'g'].forEach((k, i) => {
          const mat = new THREE.MeshBasicMaterial({ color: 0x202020 });
          const disc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), mat); disc.position.set(0, h + 0.86 - i * 0.36, 0.152); g.add(disc);
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: cols[k], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
          glow.scale.setScalar(o.glow || 1.1); glow.position.set(0, h + 0.86 - i * 0.36, 0.2); glow.visible = false; g.add(glow);
          lamps[k] = { mat, glow, on: cols[k] };
        });
        g.position.set(x, 0, z); g.rotation.y = yawOf(face);
        scene.add(g);
        hooks.push((t) => {
          let st = phases[0][1];
          for (const [pt, s] of phases) if (t >= pt) st = s;
          for (const k of ['r', 'y', 'g']) {
            const on = st.includes(k);
            lamps[k].mat.color.setHex(on ? lamps[k].on : 0x202020); lamps[k].glow.visible = on;
          }
        });
        return g;
      },
      // Gece: koyu gökyüzü, ay ışığı, gölgesiz; araç farları spot ışığıyla aydınlatır
      night() {
        A.sky('#05070d', '#141a26', [40, 260]);
        hemi.color.set(0x7f8fb8); hemi.groundColor.set(0x14161c); hemi.intensity = 0.55;
        sun.color.set(0x9fb2ff); sun.intensity = 0.18; sun.castShadow = false;
        renderer.toneMappingExposure = 1.25; NIGHT = true;
      },
      // Demiryolu: doğu-batı doğrultusunda, merkez z
      rails(z, x0 = -200, x1 = 200) {
        const steel = lam('#8b9097'), wood = lam('#5a4636'), bed = lam('#8f8578', TEX.earth);
        const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.12, 3.4), bed); g.position.set((x0 + x1) / 2, 0.0, z); g.receiveShadow = true; scene.add(g);
        for (const dz of [-0.72, 0.72]) { const r = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.14, 0.08), steel); r.position.set((x0 + x1) / 2, 0.14, z + dz); r.castShadow = true; scene.add(r); }
        const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.1, 2.5), wood, Math.ceil((x1 - x0) / 0.65));
        const mm = new THREE.Matrix4(); let i = 0;
        for (let x = x0; x < x1; x += 0.65) { mm.makeTranslation(x, 0.08, z); sl.setMatrixAt(i++, mm); }
        sl.count = i; sl.receiveShadow = true; scene.add(sl);
      },
      // Andreas haçı (hemzemin geçit işareti): kırmızı-beyaz çapraz levha
      crossbuck(x, z, face) {
        const g = new THREE.Group(), tex = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#d42a24'; c.fillRect(i * w / 8, 0, w / 8, h); } }, false);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8), lam('#9aa0a6')); pole.position.y = 1.45; g.add(pole);
        for (const r of [0.6, -0.6]) { const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.03), new THREE.MeshLambertMaterial({ map: tex })); b2.position.set(0, 2.65, 0.06); b2.rotation.z = r; g.add(b2); }
        g.position.set(x, 0, z); g.rotation.y = yawOf(face); scene.add(g); return g;
      },
      // Yanıp sönen iki kırmızı lamba (hemzemin geçit); ranges içinde dönüşümlü yanar
      blinker(x, z, face, ranges, h = 2.1) {
        const g = new THREE.Group();
        const plate = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.42, 0.06), lam('#16181b')); plate.position.set(0, h, 0); g.add(plate);
        const L = [-0.28, 0.28].map((dx) => {
          const mat = new THREE.MeshBasicMaterial({ color: 0x3a1010 });
          const d = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), mat); d.position.set(dx, h, 0.035); g.add(d);
          const gl2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff2a1f, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
          gl2.scale.setScalar(1.3); gl2.position.set(dx, h, 0.1); gl2.visible = false; g.add(gl2); return { mat, gl2 };
        });
        g.position.set(x, 0, z); g.rotation.y = yawOf(face); scene.add(g);
        hooks.push((t) => { const on = inRanges(ranges, t), ph = Math.floor(t * 2.4) % 2; L.forEach((l, i) => { const lit = on && ph === i; l.mat.color.setHex(lit ? 0xff2a1f : 0x3a1010); l.gl2.visible = lit; }); });
        return g;
      },
      // Bariyer kolu: direk (x,z), kolun uzandığı yön (derece), uzunluk, açı anahtarları [[t, derece]] (90 = açık, 0 = kapalı)
      barrier(x, z, dir, len, keys) {
        const g = new THREE.Group(), tex = canvasTex(512, 32, (c, w, h) => { for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#d42a24'; c.fillRect(i * w / 10, 0, w / 10, h); } }, false);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), lam('#e8e8e8')); post.position.y = 0.55; post.castShadow = true; g.add(post);
        const piv = new THREE.Group(); piv.position.set(0, 1.0, 0); g.add(piv);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, len), new THREE.MeshLambertMaterial({ map: tex })); arm.position.z = len / 2; arm.castShadow = true; piv.add(arm);
        g.position.set(x, 0, z); g.rotation.y = yawOf(dir); scene.add(g);
        hooks.push((t) => { piv.rotation.x = -track(keys, t) * DEG; });
        return g;
      },
      // Tren: yol boyunca giden kutu vagonlar
      train(o) {
        const parts = [], cols = o.colors || ['#c8352e', '#d9dde2', '#d9dde2', '#d9dde2', '#d9dde2'];
        const n = o.cars || 4, len = 19, gap = 1.2;
        for (let i = 0; i < n; i++) {
          const w = new THREE.Group();
          const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.4, len), lam(cols[i % cols.length])); body.position.y = 2.3; body.castShadow = true; w.add(body);
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.35, len - 0.2), lam(i === 0 ? '#f2f2f2' : '#2f5fb3')); stripe.position.y = 1.6; w.add(stripe);
          const win = new THREE.Mesh(new THREE.BoxGeometry(3.06, 0.8, len - 2), lam('#27313d')); win.position.y = 3.0; w.add(win);
          const under = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, len - 3), lam('#2a2c30')); under.position.y = 0.5; w.add(under);
          if (i === 0) { const nose = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.6, 1.2), lam('#f2f2f2')); nose.position.set(0, 3.2, len / 2 - 0.4); w.add(nose); }
          scene.add(w); parts.push(w);
        }
        const mo = motion(Object.assign({}, o));
        const a = { o, root: parts[0], update(t) { parts.forEach((w, i) => { const ps = pose(mo, t, -i * (len + gap)); w.position.copy(ps.p); w.rotation.y = ps.yaw; }); } };
        actors.push(a); return a;
      },
      // Çarpışma parçaları: t0 anında (x, z) noktasından saçılan küçük plastik parçalar
      debris(x, z, t0, n = 12, seed = 3) {
        const r = rng(seed), mats = [lam('#1c1e22'), lam('#9aa0a6'), lam('#d23a2e')], bits = [];
        for (let i = 0; i < n; i++) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.08 + r() * 0.16, 0.03 + r() * 0.04, 0.06 + r() * 0.14), mats[i % 3]);
          m.castShadow = true; m.visible = false; scene.add(m);
          const an = r() * Math.PI * 2, sp = 1.5 + r() * 3;
          bits.push({ m, vx: Math.cos(an) * sp, vz: Math.sin(an) * sp, vy: 1.5 + r() * 2.5, rs: (r() - 0.5) * 20 });
        }
        hooks.push((t) => {
          for (const b of bits) {
            const dt = t - t0; b.m.visible = dt >= 0; if (dt < 0) continue;
            const tf = (b.vy + Math.sqrt(b.vy * b.vy + 2 * 9.8 * 0.6)) / 9.8, k = Math.min(dt, tf);
            b.m.position.set(x + b.vx * k, Math.max(0.05, 0.6 + b.vy * k - 4.9 * k * k), z + b.vz * k);
            b.m.rotation.set(b.rs * k, b.rs * k * 0.7, 0);
          }
        });
      },
      car(o) { const a = makeCar(o); actors.push(a); return a; },
      ped(o) { const a = makePed(o); actors.push(a); return a; },
      ball(o) { const a = makeBall(o); actors.push(a); return a; },
      camera(spec) { camSpec = spec; },
      each(fn) { hooks.push(fn); },
      sky(top = '#7fb2e5', bottom = '#dfe9f2', fog = [80, 420]) {
        scene.background = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(0.62, bottom); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, w, h); }, false);
        scene.fog = new THREE.Fog(new THREE.Color(bottom), fog[0], fog[1]);
      }
    };
    return A;
  }

  /* ---------- Hareket: yol + hız profili ---------- */
  function motion(o) {
    const pts = o.path.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
    const L = curve.getLength();
    // Hız (km/s) anahtarlarından yol tablosu
    const dt = 0.01, n = Math.ceil((dur + 1) / dt), S = new Float32Array(n + 1), V = new Float32Array(n + 1);
    const unit = o.unit === 'ms' ? 1 : 1 / 3.6;
    let s = o.s0 || 0;
    for (let i = 0; i <= n; i++) { const v = track(o.v || [[0, 0]], i * dt) * unit; V[i] = v; S[i] = s; s += v * dt; }
    const at = (t) => { const i = clamp(Math.floor(t / dt), 0, n - 1), k = t / dt - i; return [lerp(S[i], S[i + 1], k), lerp(V[i], V[i + 1], k)]; };
    const acc = (t) => (at(t + 0.15)[1] - at(Math.max(0, t - 0.15))[1]) / 0.3;
    return { curve, L, at, acc };
  }
  function pose(mo, t, ds = 0) {
    const s = mo.at(t)[0] + ds, u = clamp(s / mo.L, 0, 1);
    const p = mo.curve.getPointAt(u), d = mo.curve.getTangentAt(u);
    // tanjant ötesine taşma: düz devam
    if (s > mo.L) p.addScaledVector(d, s - mo.L);
    if (s < 0) p.addScaledVector(d, s);
    return { p, yaw: Math.atan2(d.x, d.z), s };
  }

  /* ---------- Araç ---------- */
  function makeCar(o) {
    const src = LIB['car/' + o.model].scene, m = src.clone(true);
    const b = bbox(m), sz = b.getSize(new THREE.Vector3()), k = CAR_LEN[o.model] / sz.z, c = b.getCenter(new THREE.Vector3());
    const root = new THREE.Group(), body = new THREE.Group();
    m.scale.setScalar(k); m.position.set(-c.x * k, -b.min.y * k, -c.z * k);
    body.add(m); root.add(body);
    const Lc = sz.z * k, Wc = sz.x * k, Hc = sz.y * k;
    // Boyama: kaporta hücresindeki üçgenler ayrı malzemeye
    if (o.color) {
      const paint = new THREE.MeshLambertMaterial({ color: new THREE.Color(o.color) });
      m.traverse((ob) => {
        if (!ob.isMesh || /wheel/.test(ob.name)) return;
        const g = ob.geometry.clone(), uv = g.attributes.uv, idx = g.index.array, area = {};
        const cell = (i) => { const u = (uv.getX(idx[i]) + uv.getX(idx[i + 1]) + uv.getX(idx[i + 2])) / 3, v = (uv.getY(idx[i]) + uv.getY(idx[i + 1]) + uv.getY(idx[i + 2])) / 3; return Math.floor(v * 4) + ',' + Math.floor(u * 8); };
        for (let i = 0; i < idx.length; i += 3) { const ce = cell(i); area[ce] = (area[ce] || 0) + 1; }
        const pc = o.paintCell || Object.entries(area).filter(([ce]) => ce.startsWith('1,')).sort((a, b2) => b2[1] - a[1])[0]?.[0];
        if (!pc) return;
        const A = [], B = [];
        for (let i = 0; i < idx.length; i += 3) (cell(i) === pc ? B : A).push(idx[i], idx[i + 1], idx[i + 2]);
        g.setIndex([...A, ...B]); g.clearGroups(); g.addGroup(0, A.length, 0); g.addGroup(A.length, B.length, 1);
        ob.geometry = g; ob.material = [ob.material, paint];
      });
    }
    // Tekerler (dönme ve direksiyon)
    const wheels = [];
    m.traverse((ob) => { if (/^wheel/.test(ob.name)) wheels.push({ ob, front: /front/.test(ob.name), base: ob.quaternion.clone() }); });
    // Işık haleleri
    const glow = (color, x, y, z, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.position.set(x, y, z); sp.scale.setScalar(s); sp.visible = false; root.add(sp); return sp; };
    const ly = Math.min(0.85, Hc * 0.42), rz = -Lc / 2 - 0.04, fz = Lc / 2 + 0.04, lx = Wc / 2 - 0.22;
    const brake = [glow(0xff2a1f, -lx, ly, rz, 0.95), glow(0xff2a1f, lx, ly, rz, 0.95)];
    const tail = [glow(0xff3b2f, -lx, ly, rz, 0.5), glow(0xff3b2f, lx, ly, rz, 0.5)];
    const sigL = [glow(0xffa21f, lx + 0.08, ly, rz, 0.85), glow(0xffa21f, lx + 0.08, ly, fz, 0.85)];
    const sigR = [glow(0xffa21f, -lx - 0.08, ly, rz, 0.85), glow(0xffa21f, -lx - 0.08, ly, fz, 0.85)];
    const head = [glow(0xfff4d6, -lx + 0.05, ly - 0.05, fz, o.highBeam ? 2.4 : 1.1), glow(0xfff4d6, lx - 0.05, ly - 0.05, fz, o.highBeam ? 2.4 : 1.1)];
    const beacon = o.beacon ? [glow(0x2f6bff, -0.35, Hc + 0.05, 0.25 * Lc / 2, 1.5), glow(0xff2a1f, 0.35, Hc + 0.05, 0.25 * Lc / 2, 1.5), glow(0x2f6bff, 0, Hc * 0.55, fz + 0.02, 1.0)] : [];
    // Gece farı: kısa hüzme yere yakın ve geniş, uzun hüzme dar ve uzağa
    let beam = null;
    if (NIGHT && o.beam) {
      const high = o.beam === 'high';
      beam = new THREE.SpotLight(0xfff1d6, high ? 16000 : 5000, high ? 240 : 70, high ? 0.42 : 0.6, 0.85, 1.4);
      beam.position.set(0, 0.75, Lc / 2 + 0.1);
      beam.target.position.set(0, high ? 1.2 : -1.2, Lc / 2 + (high ? 90 : 20));
      root.add(beam, beam.target);
      head.forEach((g) => g.scale.setScalar(high ? 3.4 : 1.8));
    }
    scene.add(root);
    const mo = motion(o);
    let spin = 0, lastS = null;
    return {
      o, root, body, L: Lc, W: Wc, H: Hc, mo, own: false,
      update(t) {
        const ps = pose(mo, t), [, v] = mo.at(t);
        root.position.copy(ps.p);
        root.rotation.y = ps.yaw + (o.yaw ? track(o.yaw, t) * DEG : 0);
        if (o.lift) root.position.y = track(o.lift, t);
        body.rotation.x = o.pitch ? track(o.pitch, t) * DEG : clamp(-mo.acc(t) * 0.004, -0.02, 0.03);
        if (lastS != null) spin += (ps.s - lastS) / (0.33 * (Lc / 4.5));
        lastS = ps.s;
        const ahead = pose(mo, t + 0.6), steer = clamp(Math.atan2(Math.sin(ahead.yaw - ps.yaw), Math.cos(ahead.yaw - ps.yaw)) * 2.2, -0.5, 0.5);
        for (const w of wheels) { w.ob.quaternion.copy(w.base); if (w.front) w.ob.rotateY(steer); w.ob.rotateX(spin); }
        const braking = (mo.acc(t) < -1.2 && v > 0.3) || inRanges(o.brake, t) || (!!o.holdBrake && v < 0.05);
        brake.forEach((g) => { g.visible = braking; });
        tail.forEach((g) => { g.visible = !!o.lights; });
        const flashOn = inRanges(o.flash, t) && Math.floor(t * 6) % 2 === 0;
        head.forEach((g) => { g.visible = !!o.lights || !!o.highBeam || !!beam || flashOn; g.material.opacity = flashOn && beam ? 1 : beam ? 0.85 : 1; });
        if (beam && o.beamKeys) { const hi = track(o.beamKeys, t) > 0.5; beam.intensity = hi ? 11000 : 5000; beam.angle = hi ? 0.32 : 0.55; beam.target.position.set(0, hi ? 0.6 : -1.2, Lc / 2 + (hi ? 60 : 20)); head.forEach((g) => g.scale.setScalar(hi ? 3.4 : 1.8)); }
        if (beam && flashOn) head.forEach((g) => g.scale.setScalar(4.2));
        const blink = Math.floor(t * 3) % 2 === 0;
        const hz = inRanges(o.hazard, t);
        sigL.forEach((g) => { g.visible = blink && (hz || inRanges(o.left, t)); });
        sigR.forEach((g) => { g.visible = blink && (hz || inRanges(o.right, t)); });
        beacon.forEach((g, i) => { g.visible = Math.floor(t * 5 + i) % 2 === 0; });
        if (!beam && flashOn) head.forEach((g) => g.scale.setScalar(1.6)); else if (!beam) head.forEach((g) => g.scale.setScalar(1.1));
        // sürücü görünümünde kendi aracının haleleri görünmez (far ışığı yanmaya devam eder)
        if (this.own) [...brake, ...tail, ...sigL, ...sigR, ...head, ...beacon].forEach((g) => { g.visible = false; });
      },
      speed(t) { return mo.at(t)[1] * 3.6; }
    };
  }

  /* ---------- Yaya ---------- */
  function makePed(o) {
    const g = LIB['chr/' + (o.model || CHARS[0])];
    const m = SkeletonUtils.clone(g.scene);
    const b = bbox(m), sz = b.getSize(new THREE.Vector3()), k = (o.height || 1.72) / sz.y;
    const root = new THREE.Group(); m.scale.setScalar(k); m.position.y = -b.min.y * k; root.add(m); scene.add(root);
    const mixer = new THREE.AnimationMixer(m), clips = {};
    for (const c of g.animations) clips[c.name] = mixer.clipAction(c);
    let cur = null;
    const mo = motion(Object.assign({ unit: 'ms' }, o));
    return {
      o, root,
      update(t) {
        const ps = pose(mo, t), [, v] = mo.at(t);
        root.position.copy(ps.p); root.rotation.y = ps.yaw + (o.yaw ? track(o.yaw, t) * DEG : 0);
        const name = (o.anim && o.anim(t, v)) || (v > 2.2 ? 'sprint' : v > 0.15 ? 'walk' : 'idle');
        if (cur !== clips[name]) { if (cur) cur.stop(); cur = clips[name]; cur.play(); }
        const d = cur.getClip().duration, rate = name === 'walk' ? v / 1.3 : name === 'sprint' ? v / 3.2 : 1;
        cur.time = ((t * rate) % d + d) % d; mixer.update(0);
      }
    };
  }

  /* ---------- Top ---------- */
  function makeBall(o) {
    const tex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, w, h); x.fillStyle = '#d6282b'; for (let i = 0; i < 4; i++) x.fillRect(i * 64, 0, 32, h); }, false);
    const r = o.r || 0.11;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshLambertMaterial({ map: tex }));
    m.castShadow = true; scene.add(m);
    const mo = motion(Object.assign({ unit: 'ms' }, o));
    return { o, root: m, update(t) { const ps = pose(mo, t); m.position.set(ps.p.x, r + (o.bounce ? Math.abs(Math.sin(t * o.bounce)) * 0.25 : 0), ps.p.z); m.rotation.set(ps.s / r, ps.yaw, 0); } };
  }

  /* ---------- Sürücü koltuğu görünümü (2B kaplama) ---------- */
  function drawCockpit(t, a, spec) {
    const W2 = W, H2 = H, x = ctx;
    // A sütunları
    x.fillStyle = '#16181b';
    x.beginPath(); x.moveTo(0, 0); x.lineTo(W2 * 0.07, 0); x.lineTo(W2 * 0.035, H2 * 0.62); x.lineTo(0, H2 * 0.7); x.fill();
    x.beginPath(); x.moveTo(W2, 0); x.lineTo(W2 * 0.93, 0); x.lineTo(W2 * 0.965, H2 * 0.62); x.lineTo(W2, H2 * 0.7); x.fill();
    // tavan şeridi
    x.fillRect(0, 0, W2, H2 * 0.04);
    // dikiz aynası
    x.fillStyle = '#1d2024'; x.beginPath(); x.roundRect(W2 * 0.43, H2 * 0.045, W2 * 0.14, H2 * 0.07, 8); x.fill();
    // gösterge paneli
    const top = H2 * 0.74;
    const gr = x.createLinearGradient(0, top, 0, H2); gr.addColorStop(0, '#2a2d31'); gr.addColorStop(1, '#141517');
    x.fillStyle = gr;
    x.beginPath(); x.moveTo(0, top + 18); x.quadraticCurveTo(W2 * 0.5, top - 26, W2, top + 18); x.lineTo(W2, H2); x.lineTo(0, H2); x.fill();
    // gösterge kadranı (sürücünün önünde, solda)
    const cx = W2 * 0.33, cy = H2 * 0.9, R = H2 * 0.105;
    x.fillStyle = '#0b0c0e'; x.beginPath(); x.roundRect(cx - R * 2.6, cy - R * 1.25, R * 5.2, R * 2.2, 22); x.fill();
    const dial = (dx, val, max, label) => {
      const X = cx + dx;
      x.strokeStyle = '#3a3f46'; x.lineWidth = 3; x.beginPath(); x.arc(X, cy, R, Math.PI * 0.8, Math.PI * 2.2); x.stroke();
      x.strokeStyle = '#d7dde4'; x.lineWidth = 2;
      for (let i = 0; i <= 10; i++) { const an = Math.PI * 0.8 + (Math.PI * 1.4 * i) / 10; x.beginPath(); x.moveTo(X + Math.cos(an) * R * 0.82, cy + Math.sin(an) * R * 0.82); x.lineTo(X + Math.cos(an) * R * 0.97, cy + Math.sin(an) * R * 0.97); x.stroke(); }
      const an = Math.PI * 0.8 + Math.PI * 1.4 * clamp(val / max, 0, 1);
      x.strokeStyle = '#ff5a3c'; x.lineWidth = 3; x.beginPath(); x.moveTo(X, cy); x.lineTo(X + Math.cos(an) * R * 0.85, cy + Math.sin(an) * R * 0.85); x.stroke();
      x.fillStyle = '#d7dde4'; x.font = `600 ${Math.round(R * 0.28)}px Inter, Arial`; x.textAlign = 'center'; x.fillText(label, X, cy + R * 0.55);
    };
    const v = a ? a.speed(t) : 0;
    dial(-R * 1.3, v, 200, Math.round(v) + ' km/s');
    dial(R * 1.3, spec.rpm ? track(spec.rpm, t) : 800 + v * 25, 7000, 'x1000 d/dk');
    // ikaz lambaları
    const lamps = spec.lamps ? spec.lamps.filter(([, a0, b0]) => t >= a0 && t < b0).map(([id]) => id) : [];
    lamps.forEach((id, i) => { const im = LAMP_IMG[id]; if (im) x.drawImage(im, cx - R * 0.6 + (i - (lamps.length - 1) / 2) * R * 1.1, cy - R * 1.2, R * 1.2, R * 1.2); });
    // direksiyon simidi
    const sx = W2 * 0.33, sy = H2 * 1.08, SR = H2 * 0.36;
    x.strokeStyle = '#101113'; x.lineWidth = H2 * 0.05; x.beginPath(); x.arc(sx, sy, SR, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 3; x.beginPath(); x.arc(sx, sy, SR + H2 * 0.018, Math.PI * 1.12, Math.PI * 1.88); x.stroke();
  }

  /* ---------- Kamera ---------- */
  const tmpV = new THREE.Vector3();
  function placeCamera(t) {
    const s = camSpec;
    camera.fov = s.fov ? track(Array.isArray(s.fov) ? s.fov : [[0, s.fov]], t) : 50;
    if (s.mode === 'fixed' || s.mode === 'keys') {
      const keys = s.keys || [[0, s.pos, s.look]];
      let i = 0; while (i < keys.length - 1 && t > keys[i + 1][0]) i++;
      const [t0, p0, l0] = keys[i], [t1, p1, l1] = keys[Math.min(i + 1, keys.length - 1)];
      const k = t1 > t0 ? smooth(clamp((t - t0) / (t1 - t0), 0, 1)) : 0;
      camera.position.set(lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k), lerp(p0[2], p1[2], k));
      camera.lookAt(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k));
    } else {
      const a = actors.find((x) => x.o.id === s.target);
      const r = a.root, yaw = r.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
      if (s.mode === 'driver') {
        const side = 0.36, fwd = s.fwd != null ? s.fwd : 0.05, up = s.up || (a.H * 0.8);
        camera.position.set(r.position.x + fx * fwd + lx * side, up, r.position.z + fz * fwd + lz * side);
        camera.lookAt(r.position.x + fx * 30 + lx * side, up - 0.6 + (s.tilt || 0), r.position.z + fz * 30 + lz * side);
      } else if (s.reverse) { // önden, araca doğru geriye bakarak
        const front = s.back || 14, up = s.up || 5, behind = s.ahead || 10, off = s.side || 0;
        camera.position.set(r.position.x + fx * front + lx * off, up, r.position.z + fz * front + lz * off);
        camera.lookAt(r.position.x - fx * behind, s.lookY || 0.8, r.position.z - fz * behind);
      } else { // follow: arkadan ve yukarıdan
        const back = s.back || 9, up = s.up || 3.6, ahead = s.ahead || 10, off = s.side || 0;
        camera.position.set(r.position.x - fx * back + lx * off, up, r.position.z - fz * back + lz * off);
        camera.lookAt(r.position.x + fx * ahead, s.lookY || 0.8, r.position.z + fz * ahead);
      }
    }
    camera.updateProjectionMatrix();
  }

  /* ---------- Dış arayüz ---------- */
  return {
    async load(scn) {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, W / H, 0.3, 900);
      hemi = new THREE.HemisphereLight(0xdfeaff, 0x6b5a45, 1.15);
      sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.near = 1; sc.far = 260;
      sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
      scene.add(hemi, sun, sun.target);
      actors = []; hooks = []; camSpec = { mode: 'fixed', pos: [0, 30, 30], look: [0, 0, 0] }; dur = scn.dur || 10; lastT = -1;
      NIGHT = false; renderer.toneMappingExposure = 1.05;
      cockpit = null;
      const A = api();
      A.sky();
      await scn.build(A);
      if (camSpec.mode === 'driver') {
        // kendi aracının gövdesi kamerayı kapatmasın; farlar ve sinyaller görünmez kalır
        const me = actors.find((x) => x.o.id === camSpec.target);
        if (me) { me.body.visible = false; me.own = true; }
        if (camSpec.cockpit !== false) cockpit = camSpec;
      }
      return { dur };
    },
    frame(t) {
      for (const a of actors) a.update(t);
      for (const h of hooks) h(t);
      placeCamera(t);
      // Gölge kutusu kamera çevresinde
      const c = camSpec.sunAt || [camera.position.x, camera.position.z];
      const SUN = camSpec.sun || [-40, 70, -25];
      sun.position.set(c[0] + SUN[0], SUN[1], c[1] + SUN[2]); sun.target.position.set(c[0], 0, c[1]);
      renderer.render(scene, camera);
      ctx.drawImage(gl, 0, 0);
      if (cockpit) drawCockpit(t, actors.find((x) => x.o.id === cockpit.target), cockpit);
      lastT = t;
      return out;
    },
    canvas: out,
    get scene() { return scene; }, renderer,
    // hata ayıklama: görünür ışık haleleri
    glows() { const r = []; scene.traverse((o) => { if (o.isSprite) { let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (v) { const w = o.getWorldPosition(new THREE.Vector3()); r.push([o.material.color.getHexString(), +w.x.toFixed(1), +w.y.toFixed(1), +w.z.toFixed(1)]); } } }); return r; }
  };
}
