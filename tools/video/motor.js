/* Ürgüp Yıldız Sürücü Kursu — animasyonlu soru sahne motoru (yalnızca çevrimdışı video üretimi için).
   render.mjs bu modülü başsız Chrome'da açar; her kare `R.frame(t)` ile belirli bir zamanda çizilir, böylece
   videolar her çalıştırmada aynı çıkar.
   Varlıklar (hepsi CC0): araçlar, yayalar ve küçük parçalar Kenney kitlerinden; gökyüzü HDRI'ları ve zemin/cephe
   dokuları Poly Haven'dan; ağaçlar Poly Haven modellerinden pişirilmiş kartlar (tools/video/agac). Binalar yordamsal.
   Levhalar ve gösterge lambaları sitedeki kit.js çizimleridir.
   Dünya: X doğu, Y yukarı, Z güney (metre). Yön açısı θ: 0 = kuzey (−Z), saat yönünde (derece). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const KIT = {
  car: '/kenney/kenney_car-kit/Models/GLB format/',
  road: '/kenney/kenney_city-kit-roads/Models/GLB format/',
  chr: '/kenney/kenney_mini-characters/Models/GLB format/'
};
const PH = '/ph/';                       // Poly Haven indirmeleri (tex/<ad>/{diff,nor,rough,ao}.jpg, hdri/*.hdr)
const TREES = '/tools/video/agac/';      // pişirilmiş ağaç kartları
const SKY = { day: 'kloofendal_48d_partly_cloudy_puresky_2k.hdr', night: 'qwantani_night_puresky_1k.hdr' };
// Doku setleri ve bir dokunun kapladığı metre
const TEXSETS = {
  asphalt: ['asphalt_02', 4], pavers: ['concrete_pavers', 1.8], concrete: ['brushed_concrete', 2.5],
  grass: ['aerial_grass_rock', 14], lawn: ['leafy_grass', 4], stucco: ['white_stucco', 3], yplaster: ['yellow_plaster', 3],
  beige: ['beige_wall_001', 3], plaster: ['painted_plaster_wall', 3], stone: ['white_sandstone_bricks', 2.4], roof: ['clay_roof_tiles', 2.2]
};
// Gerçek boylar (m): modeller orantısı korunarak bu uzunluğa ölçeklenir
const CAR_LEN = { sedan: 4.5, 'sedan-sports': 4.5, 'hatchback-sports': 4.0, suv: 4.7, 'suv-luxury': 4.8, taxi: 4.5, van: 5.0, police: 4.7,
  ambulance: 5.6, delivery: 6.2, 'delivery-flat': 6.2, truck: 8.6, 'truck-flat': 8.6, firetruck: 9.0, 'garbage-truck': 8.2, tractor: 3.8 };
// Yayalar: Quaternius'un CC0 insan modelleri (poly.pizza), tools/video/insan. Senaryolardaki 'character-female-x' kadın,
// diğerleri erkek modeli; harf, erkekte kıyafet ve ten rengini seçer
const PEOPLE = { man: '/tools/video/insan/man.glb', woman: '/tools/video/insan/woman.glb' };
const OUTFIT = { a: ['#2f4f6f', '#1f2328', '#9a6a45'], b: ['#7a2e2e', '#3b4a63', '#c18a63'], c: ['#3f6b3f', '#2a2a2e', '#6e4a2f'],
  d: ['#d8d2c4', '#3b4a63', '#b07a52'], e: ['#5a4a7a', '#24272c', '#8a5a3a'], f: ['#c98a2e', '#2f3a4a', '#c99a72'] };
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
const TEX = {};
const texLoader = new THREE.TextureLoader();
async function loadSet(key) {
  const [name] = TEXSETS[key];
  const get = async (m, srgb) => {
    const t = await texLoader.loadAsync(`${PH}tex/${name}/${m}.jpg`).catch(() => null);
    if (!t) return null;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const [map, nor, rough, ao] = await Promise.all([get('diff', true), get('nor'), get('rough'), get('ao')]);
  TEX[key] = { map, nor, rough, ao };
}
function makeGlow() {
  TEX.glow = canvasTex(128, 128, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  }, false);
  // araç altı temas gölgesi
  TEX.blob = canvasTex(128, 128, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.6, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
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

/* ---------- Gökyüzü: HDRI'daki güneşin yönü ---------- */
function sunDirection(tex) {
  const { data, width: w, height: h } = tex.image;
  const half = data instanceof Uint16Array, f = half ? THREE.DataUtils.fromHalfFloat : (x) => x;
  const ch = data.length / (w * h);
  let best = -1, bi = 0;
  for (let i = 0; i < w * h; i += 1) {
    const l = f(data[i * ch]) * 0.3 + f(data[i * ch + 1]) * 0.59 + f(data[i * ch + 2]) * 0.11;
    if (l > best) { best = l; bi = i; }
  }
  const r = Math.floor(bi / w), c = bi % w;
  // satır 0 görüntünün üstü (flipY ile v = 1); three.js equirectUv: u = atan(z, x) / 2π + 0.5, v = asin(y) / π + 0.5
  const v = tex.flipY ? 1 - (r + 0.5) / h : (r + 0.5) / h, u = (c + 0.5) / w;
  const lat = (v - 0.5) * Math.PI, phi = (u - 0.5) * 2 * Math.PI;
  return new THREE.Vector3(Math.cos(lat) * Math.cos(phi), Math.sin(lat), Math.cos(lat) * Math.sin(phi)).normalize();
}

/* =========================================================
   Sahne
   ========================================================= */
export async function createEngine(W = 960, H = 540, opts = {}) {
  makeGlow();
  const gl = document.createElement('canvas');
  gl.width = W; gl.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  document.body.appendChild(out);
  const BLUR = opts.blur || 1; // hareket bulanıklığı alt kare sayısı

  // Ön yükleme: araçlar, yayalar, dokular, gökyüzü, ağaç kartları
  await Promise.all([
    ...Object.keys(CAR_LEN).map((n) => loadGLB('car', n)),
    ...Object.entries(PEOPLE).map(([k, u]) => loader.loadAsync(u).then((g) => { g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); LIB['people/' + k] = g; })),
    loadGLB('road', 'construction-cone'),
    ...Object.keys(TEXSETS).map(loadSet)
  ]);
  const hdr = new HDRLoader();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const SKIES = {};
  for (const [k, f] of Object.entries(SKY)) {
    const t = await hdr.loadAsync(PH + 'hdri/' + f);
    t.mapping = THREE.EquirectangularReflectionMapping;
    SKIES[k] = { bg: t, env: pmrem.fromEquirectangular(t).texture, sun: sunDirection(t) };
  }
  const TREE = await fetch(TREES + 'agaclar.json').then((r) => r.json());
  for (const [sp, m] of Object.entries(TREE)) {
    m.tex = {};
    for (const e of m.elev) m.tex[e] = await Promise.all([...Array(m.n).keys()].map((i) => texLoader.loadAsync(`${TREES}${sp}_e${e}_${String(i).padStart(2, '0')}.webp`).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })));
  }
  // Sürücü koltuğu: fotogerçekçi araç içi (Codex ile üretildi, ön cam şeffaf); gösterge ekranı 960×540'ta bu dikdörtgende
  const COCKPIT = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = '/tools/video/kokpit.webp'; });
  const SCREEN = [250, 312, 262, 98];
  const LAMP_IMG = {};
  if (window.YildizKit) for (const id of Object.keys(window.YildizKit.LAMPS)) LAMP_IMG[id] = await svgImage(fixSvg(window.YildizKit.lamp(id, true), 128));

  /* ---------- Paylaşılan malzemeler ---------- */
  const MAT = {};
  function pbr(key, tint = '#ffffff', extra = {}) {
    const k = key + tint + JSON.stringify(extra);
    if (MAT[k]) return MAT[k];
    const T = TEX[key];
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(tint), map: T.map, normalMap: T.nor, roughnessMap: T.rough, aoMap: T.ao, roughness: 1, metalness: 0 }, extra));
    if (T.nor) m.normalScale.set(0.8, 0.8);
    return (MAT[k] = m);
  }
  const std = (c, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(c), roughness: 0.6, metalness: 0 }, extra));
  const M = {
    asphalt: () => pbr('asphalt', '#9a9a9a'), walk: () => pbr('pavers', '#e6e2da'), curb: () => pbr('concrete', '#e2ddd3'),
    grass: () => pbr('grass', '#d2d0b8'), lawn: () => pbr('lawn', '#c4c8a8'),
    line: std('#d9d9d3', { roughness: 0.75 }), yellow: std('#e9bd2f', { roughness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1b222b, roughness: 0.06, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 }),
    winGlass: new THREE.MeshPhysicalMaterial({ color: 0x2a3644, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.4 }),
    frame: std('#f2f2ef', { roughness: 0.45 }), metal: std('#3a3f45', { roughness: 0.45, metalness: 0.6 }),
    steel: std('#aab0b6', { roughness: 0.35, metalness: 0.85 }), dark: std('#26282b', { roughness: 0.8 }),
    rubber: std('#1b1c1e', { roughness: 0.92 }), trim: std('#4a4d55', { roughness: 0.55 }),
    head: std('#ffffff', { emissive: 0xfff4e0, emissiveIntensity: 0.25, roughness: 0.2 }),
    tailL: std('#c81e16', { emissive: 0x9b120c, emissiveIntensity: 0.35, roughness: 0.25 }),
    ind: std('#f2a51f', { emissive: 0x9c5a00, emissiveIntensity: 0.25, roughness: 0.3 })
  };

  let scene, camera, sun, hemi, actors, hooks, camSpec, dur, cockpit, NIGHT = false, SKYK = 'day';
  const WALKS = [];
  const groundY = (x, z) => { for (const [x0, z0, x1, z1, h] of WALKS) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return h; return 0; };
  let composer, bloom;

  /* ---------- Kurulum yardımcıları (senaryolar kullanır) ---------- */
  function api() {
    let layer = 0;
    WALKS.length = 0;
    // Yere paralel dikdörtgen: UV dünya ölçüsünde
    function quad(x0, z0, x1, z1, y, mat, tile = 6) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0], 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([x0 / tile, z0 / tile, x0 / tile, z1 / tile, x1 / tile, z1 / tile, x1 / tile, z0 / tile], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
    }
    // Kutu: her yüzün UV'si metre/tile ölçeğinde
    function boxUV(w, h, d, tile) {
      const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv.array;
      const fw = [d, d, w, w, w, w], fh = [h, h, d, d, h, h];
      for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = (f * 4 + v) * 2; uv[i] *= fw[f] / tile; uv[i + 1] *= fh[f] / tile; }
      return g;
    }
    const A = {
      THREE, scene, rng, track, lerp, clamp, smooth, DEG,
      ground(kind = 'grass', size = 900) { quad(-size, -size, size, size, -0.08, kind === 'grass' ? M.grass() : M.lawn(), TEXSETS.grass[1]); },
      asphalt(x0, z0, x1, z1) { layer += 0.012; return quad(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), layer, M.asphalt(), TEXSETS.asphalt[1]); },
      grass(x0, z0, x1, z1) { return quad(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), -0.04, M.lawn(), TEXSETS.lawn[1]); },
      // Yükseltilmiş kaldırım: üstü parke taşı, yanları beton bordür
      walk(x0, z0, x1, z1, h = 0.15) {
        const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
        const g = boxUV(w, h, d, TEXSETS.pavers[1]);
        const b = new THREE.Mesh(g, [M.curb(), M.curb(), M.walk(), M.walk(), M.curb(), M.curb()]);
        b.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); b.receiveShadow = true; scene.add(b);
        WALKS.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), h]);
        return b;
      },
      // Çizgi: noktalar [[x,z]…], kesikli için dash = [dolu, boş]
      line(pts, o = {}) {
        const w = o.w || 0.15, mat = o.color === 'yellow' ? M.yellow : M.line, y = 0.06, list = [];
        let phase = o.offset || 0;
        for (let i = 1; i < pts.length; i++) {
          const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
          const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
          const parts = [];
          // uzun ince üçgenler yazılımsal çizicide bazı karelerde düşüyor: düz çizgiyi 20 m'lik parçalara böl
          if (!o.dash) for (let a = 0; a < L; a += 20) parts.push([a, Math.min(L, a + 20)]);
          else { const [on, off] = o.dash, P = on + off; let s = -((phase % P) + P) % P; for (; s < L; s += P) { const a = Math.max(0, s), b = Math.min(L, s + on); if (b > a) parts.push([a, b]); } phase += L; }
          for (const [a, b] of parts) {
            const g = new THREE.PlaneGeometry(w, b - a); g.rotateX(-Math.PI / 2);
            g.rotateY(Math.atan2(ux, uz)); g.translate(ax + ux * (a + b) / 2, y, az + uz * (a + b) / 2);
            list.push(g);
          }
        }
        if (list.length) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.receiveShadow = true; scene.add(m); }
      },
      // Yaya geçidi: merkez, yol yönü açısı (derece, yolun uzandığı yön), yol genişliği, geçit derinliği
      zebra(cx, cz, ang, width, depth = 3.2) {
        const a = ang * DEG, ax = Math.sin(a), az = -Math.cos(a), px = -az, pz = ax, list = [];
        for (let s = -width / 2 + 0.3; s < width / 2 - 0.2; s += 1.0) {
          const g = new THREE.PlaneGeometry(0.5, depth); g.rotateX(-Math.PI / 2); g.rotateY(Math.atan2(ax, az));
          g.translate(cx + px * (s + 0.25), 0.06, cz + pz * (s + 0.25)); list.push(g);
        }
        const m = new THREE.Mesh(mergeGeometries(list), M.line); m.receiveShadow = true; scene.add(m);
      },
      // Dönel kavşak: asfalt halka + ortada çimen ada
      roundabout(cx, cz, rIn, rOut) {
        const g = new THREE.RingGeometry(rIn, rOut, 96); g.rotateX(-Math.PI / 2);
        const uv = g.attributes.uv.array, p = g.attributes.position.array, T = TEXSETS.asphalt[1];
        for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = p[i * 3] / T; uv[i * 2 + 1] = p[i * 3 + 2] / T; }
        const m = new THREE.Mesh(g, M.asphalt()); m.position.set(cx, 0.05, cz); m.receiveShadow = true; scene.add(m);
        const isl = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn, 0.3, 64), [M.curb(), pbr('lawn', '#7fa35a'), M.curb()]);
        const iu = isl.geometry.attributes.uv.array; for (let i = 0; i < iu.length; i++) iu[i] *= rIn * 2 / TEXSETS.lawn[1];
        isl.position.set(cx, 0.15, cz); isl.receiveShadow = true; scene.add(isl);
        return isl;
      },
      // Yordamsal bina: Türk kasabası apartmanı / evi. Önü yerel +Z, ang yönüne bakar
      building(x, z, ang, width, pick = 0, kind = 'com') { return house(x, z, ang, width, pick, kind); },
      // Ağaç: pişirilmiş kart, kameraya döner; gölgesi güneşe dönük ayrı kart
      tree(x, z, h = 7, small = false) { return makeTree(x, z, h, small); },
      lamp(x, z, ang) { return streetLamp(x, z, ang); },
      cone(x, z) { const g = LIB['road/construction-cone'].scene.clone(true); g.scale.setScalar(0.7 / bbox(g).getSize(new THREE.Vector3()).y); g.position.set(x, 0, z); scene.add(g); return g; },
      // Levha: kit.js kimliği, konum, yüzün baktığı yön (sürücüye doğru), alt kenar yüksekliği
      async sign(id, x, z, face, o = {}) {
        const { tex } = await svgTex(window.YildizKit.sign(id));
        const size = o.size || 0.9, h = o.h || 2.1;
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h + size / 2, 10), M.steel);
        pole.position.y = (h + size / 2) / 2; pole.castShadow = true; g.add(pole);
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.05, roughness: 0.4, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: NIGHT ? 0.12 : 0.05 }));
        plate.position.set(0, h + size / 2, 0.05); plate.castShadow = true; g.add(plate);
        const back = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.9, size * 0.9), std('#8d9297', { side: THREE.BackSide, metalness: 0.5, roughness: 0.4 }));
        back.position.copy(plate.position); back.position.z = 0.04; g.add(back);
        g.position.set(x, 0, z); g.rotation.y = yawOf(face);
        scene.add(g); return g;
      },
      // Trafik ışığı: fazlar [[t, 'r'|'ry'|'g'|'y'|'off'], …]; face = ışığın baktığı yön (gelen trafiğe)
      signal(x, z, face, phases, o = {}) {
        const g = new THREE.Group(), h = o.h || 3.2;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, h, 12), M.metal); pole.position.y = h / 2; pole.castShadow = true; g.add(pole);
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.12, 0.3), M.dark); box.position.set(0, h + 0.5, 0); box.castShadow = true; g.add(box);
        const cols = { r: 0xff2a1f, y: 0xffae1f, g: 0x2fe07a }, lamps = {};
        ['r', 'y', 'g'].forEach((k, i) => {
          const mat = new THREE.MeshStandardMaterial({ color: 0x202020, emissive: cols[k], emissiveIntensity: 0, roughness: 0.3 });
          const disc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), mat); disc.position.set(0, h + 0.86 - i * 0.36, 0.152); g.add(disc);
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: cols[k], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
          glow.scale.setScalar(o.glow || 0.9); glow.position.set(0, h + 0.86 - i * 0.36, 0.2); glow.visible = false; g.add(glow);
          lamps[k] = { mat, glow };
        });
        g.position.set(x, 0, z); g.rotation.y = yawOf(face);
        scene.add(g);
        hooks.push((t) => {
          let st = phases[0][1];
          for (const [pt, s] of phases) if (t >= pt) st = s;
          for (const k of ['r', 'y', 'g']) { const on = st.includes(k); lamps[k].mat.emissiveIntensity = on ? 3 : 0; lamps[k].glow.visible = on; }
        });
        return g;
      },
      // Gece: gece gökyüzü, ay ışığı, gölgesiz; araç farları spot ışığıyla aydınlatır
      night() {
        SKYK = 'night'; NIGHT = true;
        scene.background = SKIES.night.bg; scene.environment = SKIES.night.env;
        scene.backgroundIntensity = 0.06; scene.environmentIntensity = 0.05;
        scene.fog = new THREE.Fog(0x0b0e16, 40, 300);
        hemi.intensity = 0.15; sun.color.set(0x9fb2ff); sun.intensity = 0.12; sun.castShadow = false;
        renderer.toneMappingExposure = 1.0;
      },
      // Demiryolu: doğu-batı doğrultusunda, merkez z
      rails(z, x0 = -200, x1 = 200) {
        const bed = new THREE.Mesh(boxUV(x1 - x0, 0.18, 3.6, 2.5), pbr('concrete', '#8a8173')); bed.position.set((x0 + x1) / 2, 0.0, z); bed.receiveShadow = true; scene.add(bed);
        for (const dz of [-0.72, 0.72]) { const r = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.14, 0.08), M.steel); r.position.set((x0 + x1) / 2, 0.16, z + dz); r.castShadow = true; scene.add(r); }
        const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.1, 2.5), std('#4c3d30', { roughness: 0.9 }), Math.ceil((x1 - x0) / 0.65));
        const mm = new THREE.Matrix4(); let i = 0;
        for (let x = x0; x < x1; x += 0.65) { mm.makeTranslation(x, 0.1, z); sl.setMatrixAt(i++, mm); }
        sl.count = i; sl.receiveShadow = true; scene.add(sl);
      },
      // Andreas haçı (hemzemin geçit işareti): kırmızı-beyaz çapraz levha
      crossbuck(x, z, face) {
        const g = new THREE.Group(), tex = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#d42a24'; c.fillRect(i * w / 8, 0, w / 8, h); } }, false);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 10), M.steel); pole.position.y = 1.45; pole.castShadow = true; g.add(pole);
        for (const r of [0.6, -0.6]) { const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.03), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })); b2.position.set(0, 2.65, 0.06); b2.rotation.z = r; b2.castShadow = true; g.add(b2); }
        g.position.set(x, 0, z); g.rotation.y = yawOf(face); scene.add(g); return g;
      },
      // Yanıp sönen iki kırmızı lamba (hemzemin geçit); ranges içinde dönüşümlü yanar
      blinker(x, z, face, ranges, h = 2.1) {
        const g = new THREE.Group();
        const plate = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.42, 0.06), M.dark); plate.position.set(0, h, 0); g.add(plate);
        const L = [-0.28, 0.28].map((dx) => {
          const mat = new THREE.MeshStandardMaterial({ color: 0x3a1010, emissive: 0xff2a1f, emissiveIntensity: 0, roughness: 0.3 });
          const d = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), mat); d.position.set(dx, h, 0.035); g.add(d);
          const gl2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff2a1f, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
          gl2.scale.setScalar(1.2); gl2.position.set(dx, h, 0.1); gl2.visible = false; g.add(gl2); return { mat, gl2 };
        });
        g.position.set(x, 0, z); g.rotation.y = yawOf(face); scene.add(g);
        hooks.push((t) => { const on = inRanges(ranges, t), ph = Math.floor(t * 2.4) % 2; L.forEach((l, i) => { const lit = on && ph === i; l.mat.emissiveIntensity = lit ? 4 : 0; l.gl2.visible = lit; }); });
        return g;
      },
      // Bariyer kolu: direk (x,z), kolun uzandığı yön (derece), uzunluk, açı anahtarları [[t, derece]] (90 = açık, 0 = kapalı)
      barrier(x, z, dir, len, keys) {
        const g = new THREE.Group(), tex = canvasTex(512, 32, (c, w, h) => { for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#d42a24'; c.fillRect(i * w / 10, 0, w / 10, h); } }, false);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), std('#e8e8e8', { roughness: 0.4 })); post.position.y = 0.55; post.castShadow = true; g.add(post);
        const piv = new THREE.Group(); piv.position.set(0, 1.0, 0); g.add(piv);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })); arm.position.z = len / 2; arm.castShadow = true; piv.add(arm);
        g.position.set(x, 0, z); g.rotation.y = yawOf(dir); scene.add(g);
        hooks.push((t) => { piv.rotation.x = -track(keys, t) * DEG; });
        return g;
      },
      // Tren: yol boyunca giden vagonlar
      train(o) {
        const parts = [], cols = o.colors || ['#c8352e', '#d9dde2', '#d9dde2', '#d9dde2', '#d9dde2'];
        const n = o.cars || 4, len = 19, gap = 1.2;
        for (let i = 0; i < n; i++) {
          const w = new THREE.Group();
          const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.4, len), std(cols[i % cols.length], { roughness: 0.35, metalness: 0.3 })); body.position.y = 2.3; body.castShadow = true; body.receiveShadow = true; w.add(body);
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.35, len - 0.2), std(i === 0 ? '#f2f2f2' : '#2f5fb3', { roughness: 0.4 })); stripe.position.y = 1.6; w.add(stripe);
          // pencere sırası: koyu camlar arasında gövde rengi dikmeler
          const nw = Math.floor((len - 3) / 1.6);
          for (let j = 0; j < nw; j++) { const pane = new THREE.Mesh(new THREE.BoxGeometry(3.06, 0.85, 1.2), M.glass); pane.position.set(0, 3.0, -len / 2 + 2 + j * 1.6); w.add(pane); }
          for (const dz of [-len / 2 + 1.2, len / 2 - 1.2]) { const door = new THREE.Mesh(new THREE.BoxGeometry(3.05, 2.2, 0.9), std('#5c6670', { roughness: 0.4, metalness: 0.4 })); door.position.set(0, 2.0, dz); w.add(door); }
          const under = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, len - 3), M.dark); under.position.y = 0.5; w.add(under);
          if (i === 0) { const nose = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.6, 1.2), std('#f2f2f2', { roughness: 0.4 })); nose.position.set(0, 3.2, len / 2 - 0.4); w.add(nose); }
          scene.add(w); parts.push(w);
        }
        const mo = motion(Object.assign({}, o));
        const a = { o, root: parts[0], update(t) { parts.forEach((w, i) => { const ps = pose(mo, t, -i * (len + gap)); w.position.copy(ps.p); w.rotation.y = ps.yaw; }); } };
        actors.push(a); return a;
      },
      // Çarpışma parçaları: t0 anında (x, z) noktasından saçılan küçük plastik parçalar
      debris(x, z, t0, n = 12, seed = 3) {
        const r = rng(seed), mats = [M.dark, M.trim, M.tailL], bits = [];
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
            b.m.position.set(x + b.vx * k, Math.max(0.08, 0.6 + b.vy * k - 4.9 * k * k), z + b.vz * k);
            b.m.rotation.set(b.rs * k, b.rs * k * 0.7, 0);
          }
        });
      },
      car(o) { const a = makeCar(o); actors.push(a); return a; },
      ped(o) { const a = makePed(o); actors.push(a); return a; },
      // Poz verilmiş kişi (ilk yardım sahneleri): temel animasyon karesi + gövde yerleşimi + kemik düzeltmeleri + kol IK
      person(o) { const a = makePerson(o); actors.push(a); return a; },
      // Bir kişinin kemiğinin o anki dünya konumu (IK hedefi için; hedef kişi daha önce eklenmiş olmalı)
      boneAt(id, bone, off = [0, 0, 0]) { const a = actors.find((x) => x.o.id === id); return a.bonePos(bone).add(new THREE.Vector3(...off)); },
      // Reflektör (uyarı üçgeni): taşıyan kişinin elinde gelir, t anında yere konur
      reflector(o) { const a = makeReflector(o); actors.push(a); return a; },
      // Battaniye: (cx, cz) merkezli, z boyunca uzanan bir gövdenin üstüne serilip yanlardan yere sarkar
      blanket(cx, cz, len, wid, color, top = 0.27) {
        const g = new THREE.PlaneGeometry(wid, len, 18, 22); g.rotateX(-Math.PI / 2);
        const p = g.attributes.position, half = 0.23;
        for (let i = 0; i < p.count; i++) {
          const dx = Math.abs(p.getX(i)), dz = p.getZ(i), endK = 1 - Math.pow(Math.min(1, Math.abs(dz) / (len / 2)), 6);
          let y = dx < half ? top * Math.sqrt(1 - 0.55 * (dx / half) ** 2) : Math.max(0.04, top * 0.67 - (dx - half) * 1.9);
          y = 0.04 + (y - 0.04) * endK + 0.012 * Math.sin(dz * 9 + dx * 5);
          p.setY(i, y);
        }
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, std(color, { roughness: 0.95, side: THREE.DoubleSide }));
        m.position.set(cx, 0, cz); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
      },
      // Basit nesne: kutu (battaniye, çanta …)
      prop(kind, x, y, z, w, h, d, color, ang = 0) {
        const mat = kind === 'cloth' ? std(color, { roughness: 0.95 }) : std(color, { roughness: 0.7 });
        if (kind === 'roll') { const c = new THREE.Mesh(new THREE.CylinderGeometry(h / 2, h / 2, w, 24), mat); c.rotation.z = Math.PI / 2; c.position.set(x, y + h / 2, z); c.castShadow = true; c.receiveShadow = true; scene.add(c); return c; }
        const m = new THREE.Mesh(kind === 'cloth' ? new THREE.BoxGeometry(w, h, d, 6, 1, 6) : new THREE.BoxGeometry(w, h, d), mat);
        if (kind === 'cloth') { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i); if (p.getY(i) > 0) p.setY(i, p.getY(i) + 0.05 * Math.cos(px / w * Math.PI) * Math.cos(pz / d * Math.PI)); else p.setY(i, p.getY(i) - Math.max(0, Math.abs(px) - w * 0.3) * 0.6); } m.geometry.computeVertexNormals(); }
        m.position.set(x, y + h / 2, z); m.rotation.y = yawOf(ang); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
      },
      ball(o) { const a = makeBall(o); actors.push(a); return a; },
      camera(spec) { camSpec = spec; },
      each(fn) { hooks.push(fn); },
      sky() { /* gökyüzü HDRI'dan gelir; eski senaryolarla uyum için */ }
    };
    return A;
  }

  /* ---------- Yordamsal binalar ---------- */
  const WALLS = [['stucco', '#f3efe6'], ['beige', '#efe2c8'], ['yplaster', '#f1dcae'], ['plaster', '#e9d7c9'], ['stucco', '#e7ecef'], ['stone', '#efe6d6'], ['beige', '#f4ead9'], ['plaster', '#f0e4d0']];
  const SHOPS = ['MARKET', 'FIRIN', 'BERBER', 'KIRTASİYE', 'MANAV', 'KAFE', 'TERZİ', 'BÜFE', 'EMLAK', 'HALI'];
  const SHOP_COL = ['#b8322a', '#1f6f8b', '#2f7d4f', '#8a5a2b', '#5a3f8c', '#c06a1d'];
  const shopTex = {};
  function signTex(text, col) {
    const k = text + col;
    return shopTex[k] || (shopTex[k] = canvasTex(512, 96, (x, w, h) => {
      x.fillStyle = col; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, 0, w, 6);
      x.fillStyle = '#ffffff'; x.font = '800 58px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2, w - 40);
    }, false));
  }
  function house(x, z, ang, width, pick, kind) {
    const r = rng(1 + pick * 7919 + Math.round(Math.abs(x) * 13 + Math.abs(z) * 7));
    const city = kind !== 'sub';
    const w = width, d = 9 + r() * 3, floors = city ? 4 + Math.floor(r() * 3) : 2 + Math.floor(r() * 2), fh = 2.9, base = 0.6;
    const Hb = base + floors * fh;
    const [wk, tint] = WALLS[Math.floor(r() * WALLS.length)];
    const geo = { wall: [], base: [], trim: [], frame: [], glass: [], metal: [], roof: [], dark: [], awning: [], sign: [] };
    const box = (key, gw, gh, gd, px, py, pz, tile = 3) => { const g = tile ? boxUV(gw, gh, gd, tile) : new THREE.BoxGeometry(gw, gh, gd); g.translate(px, py, pz); geo[key].push(g); return g; };
    function boxUV(gw, gh, gd, tile) { const g = new THREE.BoxGeometry(gw, gh, gd), uv = g.attributes.uv.array; const fw = [gd, gd, gw, gw, gw, gw], fhh = [gh, gh, gd, gd, gh, gh]; for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = (f * 4 + v) * 2; uv[i] *= fw[f] / tile; uv[i + 1] *= fhh[f] / tile; } return g; }
    box('wall', w, Hb - base, d, 0, base + (Hb - base) / 2, 0, TEXSETS[wk][1]);
    box('base', w + 0.06, base, d + 0.06, 0, base / 2, 0, 2.4);
    // kat silmeleri
    for (let f = 1; f <= floors; f++) box('trim', w + 0.16, 0.14, d + 0.16, 0, base + f * fh - 0.07, 0, 2.5);
    // pencereler, balkonlar, dükkânlar (ön ve arka yüz)
    const bays = Math.max(2, Math.round(w / 3.1)), bw = w / bays;
    const shop = city && r() < 0.75;
    for (const side of [1, -1]) {
      const fz = side * d / 2;
      for (let f = 0; f < floors; f++) {
        const y0 = base + f * fh;
        for (let b = 0; b < bays; b++) {
          const cx = -w / 2 + bw * (b + 0.5);
          if (f === 0 && shop && side === 1) {
            // dükkân camı + tente + tabela
            box('frame', bw - 0.3, 2.35, 0.1, cx, y0 + 1.25, fz + side * 0.05, 0);
            box('glass', bw - 0.5, 2.15, 0.06, cx, y0 + 1.22, fz + side * 0.09, 0);
            continue;
          }
          if (f === 0 && b === Math.floor(bays / 2) && side === 1) { box('frame', 1.3, 2.3, 0.12, cx, y0 + 1.15, fz + side * 0.05, 0); box('dark', 1.05, 2.1, 0.08, cx, y0 + 1.05, fz + side * 0.09, 0); continue; }
          const balcony = side === 1 && f > 0 && (b % 2 === (pick % 2)) && r() < 0.8;
          const ww = balcony ? 1.6 : 1.25, wh = balcony ? 2.15 : 1.4, wy = balcony ? y0 + 1.1 : y0 + 1.55;
          box('frame', ww + 0.14, wh + 0.14, 0.1, cx, wy, fz + side * 0.04, 0);
          box('glass', ww - 0.06, wh - 0.06, 0.06, cx, wy, fz + side * 0.075, 0);
          if (!balcony) box('trim', ww + 0.34, 0.07, 0.24, cx, wy - wh / 2 - 0.1, fz + side * 0.1, 0); // denizlik
          if (balcony) {
            box('trim', bw - 0.25, 0.16, 1.15, cx, y0 + 0.02, fz + side * 0.62, 0);
            box('metal', bw - 0.25, 0.05, 0.05, cx, y0 + 1.02, fz + side * 1.17, 0);
            for (let k = -2; k <= 2; k++) box('metal', 0.03, 0.95, 0.03, cx + k * (bw - 0.4) / 4, y0 + 0.55, fz + side * 1.17, 0);
            box('metal', 0.04, 0.95, 1.1, cx - (bw - 0.3) / 2, y0 + 0.55, fz + side * 0.62, 0);
            box('metal', 0.04, 0.95, 1.1, cx + (bw - 0.3) / 2, y0 + 0.55, fz + side * 0.62, 0);
          }
        }
      }
    }
    // yan yüzlerde birkaç pencere
    for (const sx of [1, -1]) for (let f = 0; f < floors; f++) for (let k = -1; k <= 1; k += 2) {
      if (f === 0 && shop) continue;
      const y = base + f * fh + 1.55, pz = k * d / 4;
      box('frame', 0.14, 1.36, 1.0, sx * (w / 2 + 0.04), y, pz, 0); box('glass', 0.08, 1.2, 0.86, sx * (w / 2 + 0.075), y, pz, 0);
    }
    // çatı
    if (city || r() < 0.4) {
      for (const [gw, gd, px, pz] of [[w + 0.1, 0.25, 0, d / 2 - 0.1], [w + 0.1, 0.25, 0, -d / 2 + 0.1], [0.25, d, w / 2 - 0.1, 0], [0.25, d, -w / 2 + 0.1, 0]]) box('trim', gw, 0.6, gd, px, Hb + 0.3, pz, 2.5);
      // güneş enerjili su ısıtıcıları
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const px = -w / 2 + 1.5 + i * 2.2, pz = -d / 4;
        const pan = new THREE.BoxGeometry(1.8, 0.06, 1.1); pan.rotateX(-0.6); pan.translate(px, Hb + 0.75, pz); geo.dark.push(pan);
        const tank = new THREE.CylinderGeometry(0.28, 0.28, 1.8, 14); tank.rotateZ(Math.PI / 2); tank.translate(px, Hb + 1.25, pz - 0.55); geo.metal.push(tank);
      }
      box('dark', 1.6, 0.9, 1.6, w / 4, Hb + 0.45, d / 6, 0);
    } else {
      // dört yana eğimli kiremit çatı
      const ov = 0.45, rw = w / 2 + ov, rd = d / 2 + ov, rh = Math.min(rw, rd) * 0.55;
      const pts = [[-rw, -rd], [rw, -rd], [rw, rd], [-rw, rd]], ridge = Math.max(0, rw - rd);
      const top = [[-ridge, 0], [ridge, 0]];
      const pos = [], uv = [], T = TEXSETS.roof[1];
      const tri = (a, b, c) => { for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); uv.push((p[0] + p[2] * 0.3) / T, (p[1] * 1.6 + Math.hypot(p[0], p[2]) * 0.2) / T); } };
      const Y = Hb + 0.05;
      const A0 = [pts[0][0], Y, pts[0][1]], A1 = [pts[1][0], Y, pts[1][1]], A2 = [pts[2][0], Y, pts[2][1]], A3 = [pts[3][0], Y, pts[3][1]];
      const T0 = [top[0][0], Y + rh, 0], T1 = [top[1][0], Y + rh, 0];
      tri(A0, T1, A1); tri(A0, T0, T1); tri(A1, T1, A2); tri(A2, T1, T0); tri(A2, T0, A3); tri(A3, T0, A0);
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.computeVertexNormals();
      geo.roof.push(rg);
      box('trim', w + ov * 2, 0.12, d + ov * 2, 0, Hb, 0, 2.5);
    }
    const g = new THREE.Group();
    const add = (key, mat) => { if (!geo[key].length) return; const m = new THREE.Mesh(mergeGeometries(geo[key].map((x) => (x.index ? x.toNonIndexed() : x))), mat); m.castShadow = true; m.receiveShadow = true; g.add(m); };
    add('wall', pbr(wk, tint)); add('base', pbr('stone', '#d9cdb8')); add('trim', pbr('concrete', '#f1ede4'));
    add('frame', M.frame); add('glass', M.winGlass); add('metal', M.metal); add('roof', pbr('roof', '#d9a089')); add('dark', M.dark);
    if (shop) {
      const label = SHOPS[Math.floor(r() * SHOPS.length)], col = SHOP_COL[Math.floor(r() * SHOP_COL.length)];
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 0.62), new THREE.MeshStandardMaterial({ map: signTex(label, col), roughness: 0.5, emissive: 0xffffff, emissiveMap: signTex(label, col), emissiveIntensity: NIGHT ? 0.6 : 0.08 }));
      sg.position.set(0, base + 2.75, d / 2 + 0.08); g.add(sg);
      const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.06, 1.1), std(col, { roughness: 0.8 })); aw.rotation.x = 0.28; aw.position.set(0, base + 2.45, d / 2 + 0.55); aw.castShadow = true; g.add(aw);
    }
    g.position.set(x, 0, z); g.rotation.y = yawOf(ang);
    scene.add(g);
    return g;
  }

  /* ---------- Ağaç kartları ---------- */
  const trees = [];
  function makeTree(x, z, h, small) {
    const sp = small || (Math.abs(Math.round(x * 3 + z * 5)) % 5 === 0) ? 'island_tree_02' : 'jacaranda_tree';
    const m = TREE[sp], k = h / m.height;
    const qw = 2 * m.halfH * (m.w / m.h) * k, qh = 2 * m.halfH * k, cy = (m.cy - m.baseY) * k;
    const geom = new THREE.PlaneGeometry(qw, qh); geom.translate(0, cy, 0);
    const mat = new THREE.MeshBasicMaterial({ map: m.tex[m.elev[0]][0], alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(NIGHT ? 0x1a1d24 : 0xffffff) });
    const card = new THREE.Mesh(geom, mat); card.position.set(x, 0, z); scene.add(card);
    // gölge kartı: yalnız gölge geçişinde görünür (katman 1), güneşe dönük
    const smat = new THREE.MeshBasicMaterial({ map: m.tex[m.elev[0]][0], alphaTest: 0.5, side: THREE.DoubleSide });
    const shadow = new THREE.Mesh(geom, smat); shadow.position.set(x, 0, z); shadow.castShadow = true; shadow.layers.set(1);
    shadow.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: smat.map, alphaTest: 0.5, side: THREE.DoubleSide });
    scene.add(shadow);
    const rot = (Math.abs(x * 17 + z * 31) % 360) * DEG;
    const tr = { card, shadow, m, rot, x, z };
    trees.push(tr);
    return card;
  }
  function updateTrees() {
    const elevPick = camSpec.mode === 'driver' ? 0 : 1;
    const sd = SKIES[SKYK].sun, sunAz = Math.atan2(sd.x, sd.z);
    for (const t of trees) {
      const e = t.m.elev[Math.min(elevPick, t.m.elev.length - 1)], set = t.m.tex[e], n = t.m.n;
      const a = Math.atan2(camera.position.x - t.x, camera.position.z - t.z);
      const i = ((Math.round(((a - t.rot) / (2 * Math.PI)) * n) % n) + n) % n;
      t.card.rotation.y = a; t.card.material.map = set[i];
      const j = ((Math.round(((sunAz - t.rot) / (2 * Math.PI)) * n) % n) + n) % n;
      t.shadow.rotation.y = sunAz; t.shadow.material.map = set[j]; t.shadow.customDepthMaterial.map = set[j];
    }
  }

  /* ---------- Sokak lambası ---------- */
  function streetLamp(x, z, ang) {
    const g = new THREE.Group(), H = 7;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, H, 12), M.metal); pole.position.y = H / 2; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), M.metal); arm.position.set(0, H - 0.05, 0.75); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x9aa1ab, emissive: 0xffe0a8, emissiveIntensity: NIGHT ? 2.5 : 0, roughness: 0.4 }));
    head.position.set(0, H - 0.12, 1.45); g.add(head);
    g.position.set(x, 0, z); g.rotation.y = yawOf(ang); scene.add(g); return g;
  }

  /* ---------- Hareket: yol + hız profili ---------- */
  function motion(o) {
    const pts = o.path.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
    const L = curve.getLength();
    const dt = 0.01, n = Math.ceil((dur + 1) / dt), S = new Float32Array(n + 1), V = new Float32Array(n + 1);
    const unit = o.unit === 'ms' ? 1 : 1 / 3.6;
    let s = o.s0 || 0;
    for (let i = 0; i <= n; i++) { const v = track(o.v || [[0, 0]], i * dt) * unit; V[i] = v; S[i] = s; s += v * dt; }
    const at = (t) => { const i = clamp(Math.floor(t / dt), 0, n - 1), k = clamp(t / dt - i, 0, 1); return [lerp(S[i], S[i + 1], k), lerp(V[i], V[i + 1], k)]; };
    const acc = (t) => (at(t + 0.15)[1] - at(Math.max(0, t - 0.15))[1]) / 0.3;
    return { curve, L, at, acc };
  }
  function pose(mo, t, ds = 0) {
    const s = mo.at(t)[0] + ds, u = clamp(s / mo.L, 0, 1);
    const p = mo.curve.getPointAt(u), d = mo.curve.getTangentAt(u);
    if (s > mo.L) p.addScaledVector(d, s - mo.L);
    if (s < 0) p.addScaledVector(d, s);
    return { p, yaw: Math.atan2(d.x, d.z), s };
  }

  /* ---------- Araç ---------- */
  const paintCache = {};
  const paintMat = (c) => paintCache[c] || (paintCache[c] = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c).multiplyScalar(0.88), metalness: 0.4, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.0 }));
  function makeCar(o) {
    const src = LIB['car/' + o.model].scene, m = src.clone(true);
    const b = bbox(m), sz = b.getSize(new THREE.Vector3()), k = CAR_LEN[o.model] / sz.z, c = b.getCenter(new THREE.Vector3());
    const root = new THREE.Group(), body = new THREE.Group();
    m.scale.setScalar(k); m.position.set(-c.x * k, -b.min.y * k, -c.z * k);
    body.add(m); root.add(body);
    const Lc = sz.z * k, Wc = sz.x * k, Hc = sz.y * k;
    // Malzemeler palet hücresine göre: kaporta (2. satırın en çok kullanılan hücresi) cilalı boya, koyu gri cam/plastik,
    // jant metal, lastik kauçuk, beyaz/sarı/kırmızı hücreler far, sinyal ve stop lambası
    m.traverse((ob) => {
      if (!ob.isMesh) return;
      const wheel = /wheel/.test(ob.name);
      const g = ob.geometry.clone(), uv = g.attributes.uv, idx = g.index.array, area = {};
      const cell = (i) => { const u = (uv.getX(idx[i]) + uv.getX(idx[i + 1]) + uv.getX(idx[i + 2])) / 3, v = (uv.getY(idx[i]) + uv.getY(idx[i + 1]) + uv.getY(idx[i + 2])) / 3; return Math.floor(v * 4) + ',' + Math.floor(u * 8); };
      for (let i = 0; i < idx.length; i += 3) { const ce = cell(i); area[ce] = (area[ce] || 0) + 1; }
      const pc = Object.entries(area).filter(([ce]) => ce.startsWith('1,')).sort((a2, b2) => b2[1] - a2[1])[0]?.[0];
      const base = new THREE.MeshStandardMaterial({ map: ob.material.map, roughness: 0.55, metalness: 0.05 });
      const pick = (ce) => {
        if (wheel) return ce === '2,2' ? M.rubber : ce === '2,5' || ce === '2,6' ? M.steel : base;
        if (ce === pc) return o.color ? paintMat(o.color) : new THREE.MeshPhysicalMaterial({ map: ob.material.map, metalness: 0.4, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
        if (ce === '2,2') return M.glass;
        if (ce === '2,3') return M.trim;
        if (ce === '3,0') return M.head;
        if (ce === '3,1') return M.ind;
        if (ce === '3,2') return M.tailL;
        return base;
      };
      const groups = new Map();
      for (let i = 0; i < idx.length; i += 3) { const mt = pick(cell(i)); if (!groups.has(mt)) groups.set(mt, []); groups.get(mt).push(idx[i], idx[i + 1], idx[i + 2]); }
      const mats = [...groups.keys()], all = [];
      g.clearGroups();
      mats.forEach((mt, gi) => { const a = groups.get(mt); g.addGroup(all.length, a.length, gi); all.push(...a); });
      g.setIndex(all);
      ob.geometry = g; ob.material = mats;
    });
    // temas gölgesi
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(Wc * 1.25, Lc * 1.12), new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false, color: 0xffffff }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.07; blob.renderOrder = 1; root.add(blob);
    const wheels = [];
    m.traverse((ob) => { if (/^wheel/.test(ob.name)) wheels.push({ ob, front: /front/.test(ob.name), base: ob.quaternion.clone() }); });
    const glow = (color, x, y, z, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.position.set(x, y, z); sp.scale.setScalar(s); sp.visible = false; root.add(sp); return sp; };
    const ly = Math.min(0.85, Hc * 0.42), rz = -Lc / 2 - 0.04, fz = Lc / 2 + 0.04, lx = Wc / 2 - 0.22;
    const brake = [glow(0xff2a1f, -lx, ly, rz, 0.85), glow(0xff2a1f, lx, ly, rz, 0.85)];
    const tail = [glow(0xff3b2f, -lx, ly, rz, 0.45), glow(0xff3b2f, lx, ly, rz, 0.45)];
    const sigL = [glow(0xffa21f, lx + 0.08, ly, rz, 0.75), glow(0xffa21f, lx + 0.08, ly, fz, 0.75)];
    const sigR = [glow(0xffa21f, -lx - 0.08, ly, rz, 0.75), glow(0xffa21f, -lx - 0.08, ly, fz, 0.75)];
    const head = [glow(0xfff4d6, -lx + 0.05, ly - 0.05, fz, 1.0), glow(0xfff4d6, lx - 0.05, ly - 0.05, fz, 1.0)];
    const beacon = o.beacon ? [glow(0x2f6bff, -0.35, Hc + 0.05, 0.25 * Lc / 2, 1.4), glow(0xff2a1f, 0.35, Hc + 0.05, 0.25 * Lc / 2, 1.4), glow(0x2f6bff, 0, Hc * 0.55, fz + 0.02, 0.9)] : [];
    let beam = null;
    if (NIGHT && o.beam) {
      const high = o.beam === 'high';
      beam = new THREE.SpotLight(0xfff1d6, high ? 3200 : 1100, high ? 220 : 70, high ? 0.42 : 0.62, 0.85, 1.4);
      beam.position.set(0, 0.75, Lc / 2 + 0.1);
      beam.target.position.set(0, high ? 1.2 : -1.2, Lc / 2 + (high ? 90 : 20));
      root.add(beam, beam.target);
      head.forEach((g2) => g2.scale.setScalar(high ? 3.0 : 1.6));
    }
    scene.add(root);
    const mo = motion(o), wr = 0.33 * (Lc / 4.5);
    return {
      o, root, body, L: Lc, W: Wc, H: Hc, mo, own: false,
      update(t) {
        const ps = pose(mo, t), [, v] = mo.at(t);
        root.position.copy(ps.p);
        root.rotation.y = ps.yaw + (o.yaw ? track(o.yaw, t) * DEG : 0);
        if (o.lift) root.position.y = track(o.lift, t);
        body.rotation.x = o.pitch ? track(o.pitch, t) * DEG : clamp(-mo.acc(t) * 0.004, -0.02, 0.03);
        const spin = ps.s / wr;
        const ahead = pose(mo, t + 0.6), steer = clamp(Math.atan2(Math.sin(ahead.yaw - ps.yaw), Math.cos(ahead.yaw - ps.yaw)) * 2.2, -0.5, 0.5);
        for (const w of wheels) { w.ob.quaternion.copy(w.base); if (w.front) w.ob.rotateY(steer); w.ob.rotateX(spin); }
        const braking = (mo.acc(t) < -1.2 && v > 0.3) || inRanges(o.brake, t) || (!!o.holdBrake && v < 0.05);
        brake.forEach((g2) => { g2.visible = braking; });
        tail.forEach((g2) => { g2.visible = !!o.lights || NIGHT; });
        const flashOn = inRanges(o.flash, t) && Math.floor(t * 6) % 2 === 0;
        head.forEach((g2) => { g2.visible = !!o.lights || !!beam || flashOn; });
        if (beam) head.forEach((g2) => g2.scale.setScalar(flashOn ? 4.0 : o.beam === 'high' ? 3.0 : 1.6));
        else head.forEach((g2) => g2.scale.setScalar(flashOn ? 1.5 : 1.0));
        const blink = Math.floor(t * 3) % 2 === 0, hz = inRanges(o.hazard, t);
        sigL.forEach((g2) => { g2.visible = blink && (hz || inRanges(o.left, t)); });
        sigR.forEach((g2) => { g2.visible = blink && (hz || inRanges(o.right, t)); });
        beacon.forEach((g2, i) => { g2.visible = Math.floor(t * 5 + i) % 2 === 0; });
        if (this.own) [...brake, ...tail, ...sigL, ...sigR, ...head, ...beacon].forEach((g2) => { g2.visible = false; });
      },
      speed(t) { return mo.at(t)[1] * 3.6; }
    };
  }

  /* ---------- Yaya ---------- */
  function makePed(o) {
    const female = /female/.test(o.model || ''), g = LIB['people/' + (female ? 'woman' : 'man')];
    const m = SkeletonUtils.clone(g.scene), letter = (o.model || 'x-a').slice(-1), fit = OUTFIT[letter] || OUTFIT.a;
    m.traverse((ob) => {
      if (!ob.isMesh) return;
      const src = ob.material, nm = src.name;
      const col = nm === 'Shirt' ? fit[0] : nm === 'Pants' ? fit[1] : nm === 'Skin' ? fit[2] : null;
      ob.material = new THREE.MeshStandardMaterial({ map: src.map, color: col ? new THREE.Color(col) : src.color.clone(), roughness: 0.8 });
    });
    const b = bbox(m), sz = b.getSize(new THREE.Vector3()), k = (o.height || (female ? 1.66 : 1.76)) / sz.y;
    const root = new THREE.Group(); m.scale.setScalar(k); m.position.y = -b.min.y * k; root.add(m); scene.add(root);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; root.add(blob);
    const mixer = new THREE.AnimationMixer(m), clips = {};
    const find = (re) => g.animations.find((c) => re.test(c.name));
    clips.walk = mixer.clipAction(find(/walk/i)); clips.idle = mixer.clipAction(find(/idle/i)); clips.sprint = mixer.clipAction(find(/run/i));
    let cur = null;
    const mo = motion(Object.assign({ unit: 'ms' }, o));
    return {
      o, root,
      update(t) {
        const ps = pose(mo, t), [, v] = mo.at(t);
        root.position.copy(ps.p); root.rotation.y = ps.yaw + (o.yaw ? track(o.yaw, t) * DEG : 0);
        root.position.y = groundY(ps.p.x, ps.p.z);
        const name = (o.anim && o.anim(t, v)) || (v > 2.2 ? 'sprint' : v > 0.15 ? 'walk' : 'idle');
        const act = clips[name] || clips.walk;
        if (cur !== act) { if (cur) cur.stop(); cur = act; cur.play(); }
        const d = cur.getClip().duration, rate = name === 'walk' ? v / 1.25 : name === 'sprint' ? v / 3.4 : 1;
        cur.time = ((t * rate) % d + d) % d; mixer.update(0);
      }
    };
  }

  /* ---------- Poz verilmiş kişi ---------- */
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const wpos = (o3) => o3.getWorldPosition(new THREE.Vector3());
  const vec = (v) => (v && v.isVector3 ? v.clone() : new THREE.Vector3(...v));
  // Kemiği, çocuğunun dünyadaki konumu hedefe gelecek biçimde döndür (kemik eksenine bağlı olmayan nişan alma)
  function aim(bone, childPos, target) {
    const bp = wpos(bone);
    const cur = _v1.copy(childPos).sub(bp).normalize(), des = _v2.copy(target).sub(bp).normalize();
    const dq = _q1.setFromUnitVectors(cur, des);
    const bw = bone.getWorldQuaternion(new THREE.Quaternion()), pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(pw.invert().multiply(dq.multiply(bw)));
    bone.updateMatrixWorld(true);
  }
  // İki kemikli IK: omuz → dirsek → bilek; dirsek pole noktasına doğru bükülür
  function ik2(upper, lower, end, target, pole) {
    const S = wpos(upper), E0 = wpos(lower), W0 = wpos(end);
    const a = S.distanceTo(E0), b = E0.distanceTo(W0);
    const T = new THREE.Vector3().copy(target), dvec = T.clone().sub(S);
    const d = clamp(dvec.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3), u = dvec.normalize();
    const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    const pv = new THREE.Vector3().copy(pole).sub(S); const w = pv.sub(u.clone().multiplyScalar(pv.dot(u))).normalize();
    const E = S.clone().add(u.clone().multiplyScalar(x)).add(w.multiplyScalar(h));
    aim(upper, E0, E);
    aim(lower, wpos(end), S.clone().add(u.multiplyScalar(d)));
  }
  // Kemiği dünya ekseni etrafında döndür
  function rotW(bone, axis, deg) {
    const q = _q2.setFromAxisAngle(new THREE.Vector3(...axis).normalize(), deg * DEG);
    const bw = bone.getWorldQuaternion(new THREE.Quaternion()), pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(pw.invert().multiply(q.multiply(bw)));
    bone.updateMatrixWorld(true);
  }
  // İki modelin iskeleti ortak adlarla: erkek Quaternius (adlardaki nokta three.js'te silinir), kadın Mixamo
  const RIG = {
    man: { hips: 'Hips', spine: 'Abdomen', chest: 'Torso', neck: 'Neck', head: 'Head', upperArmL: 'UpperArmL', lowerArmL: 'LowerArmL', handL: 'PalmL', upperArmR: 'UpperArmR', lowerArmR: 'LowerArmR', handR: 'PalmR', upperLegL: 'UpperLegL', lowerLegL: 'LowerLegL', footL: 'FootL', upperLegR: 'UpperLegR', lowerLegR: 'LowerLegR', footR: 'FootR' },
    woman: { hips: 'Hips', spine: 'Spine', chest: 'Spine2', neck: 'Neck', head: 'Head', upperArmL: 'LeftArm', lowerArmL: 'LeftForeArm', handL: 'LeftHand', upperArmR: 'RightArm', lowerArmR: 'RightForeArm', handR: 'RightHand', upperLegL: 'LeftUpLeg', lowerLegL: 'LeftLeg', footL: 'LeftFoot', upperLegR: 'RightUpLeg', lowerLegR: 'RightLeg', footR: 'RightFoot' }
  };
  function makePerson(o) {
    const female = /woman|female/.test(o.model || ''), g = LIB['people/' + (female ? 'woman' : 'man')];
    const m = SkeletonUtils.clone(g.scene), letter = (o.model || 'x-a').slice(-1), fit = OUTFIT[letter] || OUTFIT.a;
    m.traverse((ob) => {
      if (!ob.isMesh) return;
      const src = ob.material, nm = src.name;
      const col = nm === 'Shirt' ? fit[0] : nm === 'Pants' ? fit[1] : nm === 'Skin' ? fit[2] : null;
      ob.material = new THREE.MeshStandardMaterial({ map: src.map, color: col ? new THREE.Color(col) : src.color.clone(), roughness: 0.8 });
      ob.frustumCulled = false;
    });
    m.updateMatrixWorld(true);
    const b0 = bbox(m), k = (o.height || (female ? 1.66 : 1.76)) / b0.getSize(new THREE.Vector3()).y;
    m.scale.setScalar(k); m.position.y = -b0.min.y * k;
    const body = new THREE.Group(); body.add(m);
    const root = new THREE.Group(); root.add(body); scene.add(root);
    const raw = {}; m.traverse((x) => { if (x.isBone) raw[x.name] = x; });
    // her güncellemede kemikleri dinlenme pozuna döndür: klibin dokunmadığı kemiklerde IK döndürmeleri birikmesin
    const rest = []; m.traverse((x) => { if (x.isBone) rest.push([x, x.position.clone(), x.quaternion.clone(), x.scale.clone()]); });
    const bones = {}; for (const [k2, v2] of Object.entries(RIG[female ? 'woman' : 'man'])) bones[k2] = raw[v2];
    const mixer = new THREE.AnimationMixer(m);
    const clip = g.animations.find((c) => (o.clip || /idle/i).test(c.name)) || g.animations[0];
    const act = mixer.clipAction(clip); act.play();
    // ayaklar iskelet köküne bağlı: bacak bükülünce ayak, alt bacağa göre bağıl konumunu korusun
    const feetOff = {};
    const saveFeet = () => { for (const s2 of ['L', 'R']) { const ll = bones['lowerLeg' + s2], ft = bones['foot' + s2]; if (ll && ft && ft.parent !== ll) feetOff[s2] = new THREE.Matrix4().copy(ll.matrixWorld).invert().multiply(ft.matrixWorld); } };
    const placeFeet = () => { for (const s2 of ['L', 'R']) { const ll = bones['lowerLeg' + s2], ft = bones['foot' + s2]; if (!ll || !ft || !feetOff[s2]) continue; const wm = new THREE.Matrix4().copy(ll.matrixWorld).multiply(feetOff[s2]); const lm = new THREE.Matrix4().copy(ft.parent.matrixWorld).invert().multiply(wm); lm.decompose(ft.position, ft.quaternion, ft.scale); ft.updateMatrixWorld(true); } };
    const P = {
      THREE, bones, rot: (n, axis, deg) => bones[n] && rotW(bones[n], axis, deg),
      arm: (side, target, pole) => ik2(bones['upperArm' + side], bones['lowerArm' + side], bones['hand' + side], vec(target), vec(pole)),
      leg: (side, target, pole) => ik2(bones['upperLeg' + side], bones['lowerLeg' + side], bones['foot' + side], vec(target), vec(pole)),
      // Diz çökme: kalçayı diz yüksekliğine indir, dizler yerde, ayaklar geride; lean: belden öne eğilme (derece)
      kneel: (opt = {}) => {
        const yaw = root.rotation.y, f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), r = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const thigh = wpos(bones.upperLegL).distanceTo(wpos(bones.lowerLegL)), shin = wpos(bones.lowerLegL).distanceTo(wpos(bones.footL));
        const hipY = wpos(bones.upperLegL).y, want = thigh * 0.96 + 0.07 - (opt.drop || 0);
        root.position.y += want - hipY; root.updateMatrixWorld(true);
        // öne eğilme kalça ekleminden: önce kalça döner, bacaklar ardından yeniden çözülür
        if (opt.lean) rotW(bones.hips, [r.x, r.y, r.z], opt.lean * 0.75);
        for (const s2 of ['L', 'R']) {
          const hp = wpos(bones['upperLeg' + s2]);
          const foot = hp.clone().addScaledVector(f, -shin * 0.95).setY(0.07).addScaledVector(r, (s2 === 'L' ? 1 : -1) * (opt.spread || 0.06));
          const pole = hp.clone().addScaledVector(f, 1).setY(-0.5);
          ik2(bones['upperLeg' + s2], bones['lowerLeg' + s2], bones['foot' + s2], foot, pole);
        }
        if (opt.lean) rotW(bones.chest, [r.x, r.y, r.z], opt.lean * 0.25);
        return { f, r };
      },
      look: (n, target) => { const bn = bones[n]; if (!bn) return; const ch = bn.children.find((c) => c.isBone) || bn; const tip = wpos(ch).sub(wpos(bn)).length() > 1e-3 ? wpos(ch) : wpos(bn).add(new THREE.Vector3(0, 0.1, 0)); aim(bn, tip, new THREE.Vector3(...target)); },
      pos: (n) => wpos(bones[n])
    };
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; scene.add(blob);
    const mo = o.path ? motion(Object.assign({ unit: 'ms' }, o)) : null;
    const self = {
      o, root, bones,
      poseAt: (t) => (mo ? pose(mo, t) : { p: new THREE.Vector3(o.x || 0, 0, o.z || 0), yaw: yawOf(o.ang || 0) }),
      bonePos: (n) => { root.updateMatrixWorld(true); return wpos(bones[n]); },
      update(t) {
        let x = o.x || 0, z = o.z || 0, yaw = yawOf(o.ang || 0), v = 0;
        if (mo) { const ps = pose(mo, t); x = ps.p.x; z = ps.p.z; yaw = ps.yaw; v = mo.at(t)[1]; }
        root.position.set(x, o.y ? (typeof o.y === 'function' ? o.y(t) : o.y) : groundY(x, z), z);
        root.rotation.set(0, yaw, 0);
        // gövde yerleşimi: lie = 'back' (sırtüstü), 'side' (yan), 'front' (yüzüstü)
        // sırtüstü: X ekseninde −90° (baş yerel −Z'ye); yan: aynı doğrultuda uzun ekseni etrafında roll derece
        body.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), o.lie === 'back' || o.lie === 'side' ? -Math.PI / 2 : o.lie === 'front' ? Math.PI / 2 : 0);
        if (o.lie === 'side') body.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (o.roll != null ? o.roll : 90) * DEG));
        body.position.set(0, o.lift || 0, 0);
        for (const [bn, p0, q0, s0] of rest) { bn.position.copy(p0); bn.quaternion.copy(q0); bn.scale.copy(s0); }
        const ct = typeof o.at === 'function' ? o.at(t) : o.at != null ? o.at * clip.duration : (mo && v > 0.15 ? (t * v / 1.25) % clip.duration : 0);
        act.time = clamp(ct, 0, clip.duration - 1e-3); mixer.update(0);
        root.updateMatrixWorld(true);
        if (!Object.keys(feetOff).length) saveFeet();
        else saveFeet();
        if (o.lie) { const cy = wpos(bones.chest).y, want = groundY(x, z) + (o.restY || 0.13); body.position.y += want - cy; root.updateMatrixWorld(true); saveFeet(); }
        if (o.pose) o.pose(P, t, self);
        placeFeet();
        const bp = wpos(bones.hips); blob.position.set(bp.x, 0.02 + groundY(bp.x, bp.z), bp.z); blob.scale.setScalar(o.lie ? 1.9 : 0.8);
      }
    };
    return self;
  }
  /* ---------- Reflektör ---------- */
  function makeReflector(o) {
    const g = new THREE.Group();
    const tri = (r, th) => { const sh = new THREE.Shape(); for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + i * 2 * Math.PI / 3; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); };
    const outer = new THREE.Mesh(tri(0.3, 0.02), new THREE.MeshStandardMaterial({ color: 0xd8261c, emissive: 0x7a0c06, emissiveIntensity: 0.6, roughness: 0.35 }));
    const inner = new THREE.Mesh(tri(0.17, 0.03), std('#f2f2f2', { roughness: 0.5 })); inner.position.z = 0.0;
    const holeless = new THREE.Group(); holeless.add(outer, inner); holeless.position.y = 0.17; g.add(holeless);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.32), M.metal); leg.position.set(0, 0.01, -0.12); g.add(leg);
    g.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    scene.add(g);
    return {
      o, root: g,
      update(t) {
        if (o.carrier && t < o.place) {
          const c = actors.find((x) => x.o.id === o.carrier);
          const hp = c.bonePos ? c.bonePos('handR') : wpos(c.root);
          g.position.set(hp.x, hp.y - 0.36, hp.z); g.rotation.set(0, c.root.rotation.y + Math.PI / 2, 0);
        } else if (o.at) { g.position.set(o.at[0], groundY(o.at[0], o.at[1]), o.at[1]); g.rotation.set(0, yawOf(o.ang || 0), 0); }
        else { const c = actors.find((x) => x.o.id === o.carrier), ps = c.poseAt(o.place); g.position.set(ps.p.x + Math.sin(ps.yaw) * 0.75, 0, ps.p.z + Math.cos(ps.yaw) * 0.75); g.rotation.set(0, ps.yaw + Math.PI, 0); }
      }
    };
  }

  /* ---------- Top ---------- */
  function makeBall(o) {
    const tex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, w, h); x.fillStyle = '#d6282b'; for (let i = 0; i < 4; i++) x.fillRect(i * 64, 0, 32, h); }, false);
    const r = o.r || 0.11;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
    m.castShadow = true; scene.add(m);
    const mo = motion(Object.assign({ unit: 'ms' }, o));
    return { o, root: m, update(t) { const ps = pose(mo, t); m.position.set(ps.p.x, r + (o.bounce ? Math.abs(Math.sin(t * o.bounce)) * 0.25 : 0), ps.p.z); m.rotation.set(ps.s / r, ps.yaw, 0); } };
  }

  /* ---------- Sürücü koltuğu görünümü (2B kaplama) ---------- */
  function drawCockpit(t, a, spec) {
    const x = ctx, k = W / 960;
    if (COCKPIT) {
      x.save(); if (NIGHT) x.filter = 'brightness(0.22) saturate(0.7)';
      x.drawImage(COCKPIT, 0, 0, W, H); x.restore();
    }
    // dijital gösterge: hız, devir çubuğu, vites ve yanan ikaz lambaları
    const [sx, sy, sw, sh] = SCREEN.map((v) => v * k), v = a ? a.speed(t) : 0;
    x.save();
    x.beginPath(); x.roundRect(sx + 4, sy + 4, sw - 8, sh - 8, 10 * k); x.clip();
    const bg = x.createLinearGradient(0, sy, 0, sy + sh); bg.addColorStop(0, '#0b1018'); bg.addColorStop(1, '#05070b');
    x.fillStyle = bg; x.fillRect(sx, sy, sw, sh);
    const cx = sx + sw / 2, cy = sy + sh * 0.6;
    x.fillStyle = '#f2f6fb'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = `700 ${Math.round(34 * k)}px Inter, Arial, sans-serif`; x.fillText(String(Math.round(v)), cx, cy + 6 * k);
    x.fillStyle = '#8fa3b8'; x.font = `600 ${Math.round(10 * k)}px Inter, Arial, sans-serif`; x.fillText('km/s', cx, cy + 20 * k);
    // devir yayı
    const rpm = spec.rpm ? track(spec.rpm, t) : 800 + v * 24, rr = 44 * k;
    x.lineWidth = 4 * k; x.strokeStyle = 'rgba(120,150,180,.25)'; x.beginPath(); x.arc(cx, cy, rr, Math.PI * 0.85, Math.PI * 2.15); x.stroke();
    x.strokeStyle = '#3ea0ff'; x.beginPath(); x.arc(cx, cy, rr, Math.PI * 0.85, Math.PI * 0.85 + Math.PI * 1.3 * clamp(rpm / 7000, 0, 1)); x.stroke();
    x.fillStyle = '#8fa3b8'; x.font = `600 ${Math.round(11 * k)}px Inter, Arial`; x.fillText('D', sx + sw - 22 * k, cy + 6 * k);
    x.fillText(`${Math.round(rpm / 100) / 10}`, sx + 24 * k, cy + 6 * k);
    const lamps = spec.lamps ? spec.lamps.filter(([, a0, b0]) => t >= a0 && t < b0).map(([id]) => id) : [];
    const ls = 30 * k;
    lamps.forEach((id, i) => { const im = LAMP_IMG[id]; if (im) x.drawImage(im, cx - ls / 2 + (i - (lamps.length - 1) / 2) * (ls + 6 * k), sy + 8 * k, ls, ls); });
    x.restore();
    // ekran camı yansıması
    const gl2 = x.createLinearGradient(sx, sy, sx + sw, sy + sh); gl2.addColorStop(0, 'rgba(255,255,255,.06)'); gl2.addColorStop(0.5, 'rgba(255,255,255,0)');
    x.fillStyle = gl2; x.fillRect(sx + 4, sy + 4, sw - 8, sh - 8);
  }

  /* ---------- Kamera ---------- */
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
        const pitch = (s.pitch != null ? s.pitch : 13) * DEG; // ufuk ön camın üst üçte birinde kalsın
        camera.lookAt(r.position.x + fx * 30 + lx * side, up - 30 * Math.tan(pitch), r.position.z + fz * 30 + lz * side);
      } else if (s.reverse) {
        const front = s.back || 14, up = s.up || 5, behind = s.ahead || 10, off = s.side || 0;
        camera.position.set(r.position.x + fx * front + lx * off, up, r.position.z + fz * front + lz * off);
        camera.lookAt(r.position.x - fx * behind, s.lookY || 0.8, r.position.z - fz * behind);
      } else {
        const back = s.back || 9, up = s.up || 3.6, ahead = s.ahead || 10, off = s.side || 0;
        camera.position.set(r.position.x - fx * back + lx * off, up, r.position.z - fz * back + lz * off);
        camera.lookAt(r.position.x + fx * ahead, s.lookY || 0.8, r.position.z + fz * ahead);
      }
    }
    camera.updateProjectionMatrix();
  }

  function renderAt(t) {
    for (const a of actors) a.update(t);
    for (const h of hooks) h(t);
    placeCamera(t);
    updateTrees();
    const c = camSpec.sunAt || [camera.position.x, camera.position.z];
    const sd = SKIES[SKYK].sun;
    sun.position.set(c[0] + sd.x * 120, sd.y * 120, c[1] + sd.z * 120); sun.target.position.set(c[0], 0, c[1]);
    composer.render();
  }

  /* ---------- Dış arayüz ---------- */
  return {
    async load(scn) {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, W / H, 0.3, 1200);
      SKYK = 'day'; NIGHT = false; trees.length = 0;
      scene.background = SKIES.day.bg; scene.environment = SKIES.day.env;
      scene.backgroundIntensity = 1.0; scene.environmentIntensity = 0.9;
      scene.fog = new THREE.Fog(0xc9d6e3, 160, 820);
      hemi = new THREE.HemisphereLight(0xdfeaff, 0x6b5a45, 0.25);
      sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
      sun.castShadow = true;
      sun.shadow.mapSize.set(4096, 4096);
      const sc = sun.shadow.camera; sc.left = sc.bottom = -75; sc.right = sc.top = 75; sc.near = 1; sc.far = 400;
      sc.layers.enable(1); // ağaç gölge kartları
      sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.05; sun.shadow.radius = 2;
      scene.add(hemi, sun, sun.target);
      actors = []; hooks = []; camSpec = { mode: 'fixed', pos: [0, 30, 30], look: [0, 0, 0] }; dur = scn.dur || 10;
      renderer.toneMappingExposure = 1.0;
      cockpit = null;
      const A = api();
      await scn.build(A);
      if (camSpec.mode === 'driver') {
        const me = actors.find((x) => x.o.id === camSpec.target);
        if (me) { me.body.visible = false; me.own = true; me.root.children.forEach((ch) => { if (ch.isMesh && ch.material.map === TEX.blob) ch.visible = false; }); }
        if (camSpec.cockpit !== false) cockpit = camSpec;
      }
      // son işleme: MSAA'lı yarı float hedef → parlama → ton eşleme
      const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
      composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), NIGHT ? 0.55 : 0.3, 0.45, NIGHT ? 1.0 : 2.2);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      return { dur };
    },
    frame(t) {
      const n = BLUR, shutter = 0.5 / 25;
      for (let k = 0; k < n; k++) {
        const tk = n > 1 ? t + shutter * (k / (n - 1) - 0.5) : t;
        renderAt(Math.max(0, tk));
        ctx.globalAlpha = 1 / (k + 1); ctx.drawImage(gl, 0, 0);
      }
      ctx.globalAlpha = 1;
      if (cockpit) drawCockpit(t, actors.find((x) => x.o.id === cockpit.target), cockpit);
      return out;
    },
    canvas: out,
    get scene() { return scene; }, renderer,
    people() { return actors.filter((a) => a.bones).map((a) => { a.root.updateMatrixWorld(true); const r = { id: a.o.id }; for (const k of ['hips', 'chest', 'head', 'upperArmL', 'upperArmR', 'handL', 'handR', 'upperLegL', 'footL']) { const b = a.bones[k]; if (b) r[k] = b.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)); } return r; }); },
    glows() { const r = []; scene.traverse((o) => { if (o.isSprite) { let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (v) { const w = o.getWorldPosition(new THREE.Vector3()); r.push([o.material.color.getHexString(), +w.x.toFixed(1), +w.y.toFixed(1), +w.z.toFixed(1)]); } } }); return r; }
  };
}
