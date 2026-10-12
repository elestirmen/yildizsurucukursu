/* Kursumuzca hazırlanan animasyonlu sorular: her sahne + soru.
   build(A): motor.js'deki kurulum yardımcılarıyla dünyayı ve aktörleri kurar. Konumlar metre; X doğu, Z güney.
   Yön açıları derece: 0 kuzey, 90 doğu, 180 güney, 270 batı. Türkiye'de trafik sağdan akar:
   kuzeye giden aracın şeridi yolun doğu (x > 0), doğuya gidenin güney (z > 0), batıya gidenin kuzey (z < 0) yarısıdır.
   Araç hızları km/s, yaya ve top hızları m/sn: v: [[zaman, hız], …] parça parça doğrusal.
   soru: { d ders, k konu, q soru (satırlar \n), o şıklar, a doğru şık (0 tabanlı), e açıklama } */

const LW = 3.5; // şerit genişliği

/* ---------- Ortak parçalar ---------- */
// Kuzey-güney ve doğu-batı yollarının (0,0)'da kesiştiği dört kollu kavşak. o.ns / o.ew: her yönde şerit sayısı
function crossroads(A, o = {}) {
  const ns = o.ns || 1, ew = o.ew || 1, R = o.R || 160, sw = o.walk || 3.2;
  const hx = ns * LW, hz = ew * LW;
  A.ground(o.ground || 'grass');
  A.asphalt(-hx, -R, hx, R);
  A.asphalt(-R, -hz, R, hz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = sx * hx, z0 = sz * hz, x1 = sx * R, z1 = sz * R;
    A.walk(x0, z0, x0 + sx * sw, z1);
    A.walk(x0 + sx * sw, z0, x1, z0 + sz * sw);
  }
  const gap = Math.max(hx, hz) + (o.zebra ? 5 : 1.5);
  const dash = [3, 5];
  const centerNS = (z0, z1) => (ns === 1 ? A.line([[0, z0], [0, z1]], { dash }) : A.line([[0, z0], [0, z1]], { w: 0.15 }));
  const centerEW = (x0, x1) => (ew === 1 ? A.line([[x0, 0], [x1, 0]], { dash }) : A.line([[x0, 0], [x1, 0]], { w: 0.15 }));
  centerNS(gap, R); centerNS(-gap, -R); centerEW(gap, R); centerEW(-gap, -R);
  for (let i = 1; i < ns; i++) for (const s of [-1, 1]) { A.line([[s * i * LW, gap], [s * i * LW, R]], { dash }); A.line([[s * i * LW, -gap], [s * i * LW, -R]], { dash }); }
  for (let i = 1; i < ew; i++) for (const s of [-1, 1]) { A.line([[gap, s * i * LW], [R, s * i * LW]], { dash }); A.line([[-gap, s * i * LW], [-R, s * i * LW]], { dash }); }
  if (o.zebra) { A.zebra(0, hz + 2.4, 90, hx * 2); A.zebra(0, -hz - 2.4, 90, hx * 2); A.zebra(hx + 2.4, 0, 0, hz * 2); A.zebra(-hx - 2.4, 0, 0, hz * 2); }
  if (o.buildings !== false) cityBlocks(A, hx + sw, hz + sw, R, o.seed || 1, o.town !== false);
  return { hx, hz };
}
// Köşe adalarına binalar (kavşak köşeleri açık kalır), kaldırımlara ağaç
function cityBlocks(A, ex, ez, R, seed, town) {
  const r = A.rng(seed), kind = town ? 'sub' : 'com';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let d = ez + 16; d < Math.min(R, 130); d += 14 + r() * 4) A.building(sx * (ex + 7.5), sz * d, sx > 0 ? 270 : 90, 9 + r() * 2, Math.floor(r() * 21), kind);
    for (let d = ex + 16; d < Math.min(R, 130); d += 14 + r() * 4) A.building(sx * d, sz * (ez + 7.5), sz > 0 ? 0 : 180, 9 + r() * 2, Math.floor(r() * 21), kind);
  }
  for (const sx of [-1, 1]) for (let d = ez + 9; d < 120; d += 16) { A.tree(sx * (ex - 1.1), d, 6); A.tree(sx * (ex - 1.1), -d, 6); }
  for (const sz of [-1, 1]) for (let d = ex + 9; d < 120; d += 16) { A.tree(d, sz * (ez - 1.1), 6); A.tree(-d, sz * (ez - 1.1), 6); }
}
// Kuzey-güney doğrultusunda düz yol (x = 0 ekseni). o.n: her yönde şerit; o.center: 'dash' | 'solid'
// o.rural: kaldırım yerine kenar çizgisi; o.median: orta refüj genişliği; o.parkRight: sağda park şeridi genişliği
function straightRoad(A, o = {}) {
  const n = o.n || 1, R = o.R || 400, med = o.median || 0, pr = o.parkRight || 0, sw = o.walk || 3.2;
  const hx = n * LW + med / 2;
  A.ground(o.ground || 'grass');
  A.asphalt(-hx - (o.rural ? 1 : 0), -R, hx + pr + (o.rural ? 1 : 0), R);
  if (med) A.walk(-med / 2, -R, med / 2, R, 0.2);
  else if (o.center === 'solid') A.line([[0, R], [0, -R]], { w: 0.15 });
  else A.line([[0, R], [0, -R]], { dash: [3, 5] });
  for (let i = 1; i < n; i++) for (const s of [-1, 1]) A.line([[s * (med / 2 + i * LW), R], [s * (med / 2 + i * LW), -R]], { dash: [3, 5] });
  if (o.rural) for (const s of [-1, 1]) A.line([[s * (hx + 0.2), R], [s * (hx + 0.2), -R]], { w: 0.15 });
  else { A.walk(-hx - sw, -R, -hx, R); A.walk(hx + pr, -R, hx + pr + sw, R); }
  return { hx, right: hx + pr };
}
// Düz yolun iki yanına bina ve ağaç dizisi
function roadside(A, left, right, z0, z1, o = {}) {
  const r = A.rng(o.seed || 7), kind = o.town === false ? 'com' : 'sub';
  for (let z = z0; z < z1; z += 14 + r() * 5) {
    if (!o.skip || !o.skip(z)) { A.building(-left - 7.5, z, 90, 9 + r() * 2, Math.floor(r() * 21), kind); A.building(right + 7.5, z + 6, 270, 9 + r() * 2, Math.floor(r() * 21), kind); }
  }
  if (o.trees !== false) for (let z = z0 + 4; z < z1; z += 15) { A.tree(-left + 1.1, z, 6); A.tree(right - 1.1, z + 7, 6); }
}
// Kırsal yol kenarı ağaçları
function fields(A, hx, z0, z1, seed = 5) {
  const r = A.rng(seed);
  for (let z = z0; z < z1; z += 14 + r() * 16) { A.tree(-hx - 9 - r() * 25, z, 6 + r() * 4); A.tree(hx + 9 + r() * 25, z + 7, 6 + r() * 4); }
}
// Daire yayı üzerinde noktalar (dönel kavşak). Açı derece, harita üzerinde saat yönünün tersine artar: 0 doğu, 90 kuzey
const arc = (r, a0, a1, step = 12) => { const p = []; const s = a1 > a0 ? step : -step; for (let a = a0; s > 0 ? a <= a1 : a >= a1; a += s) p.push([r * Math.cos(a * Math.PI / 180), -r * Math.sin(a * Math.PI / 180)]); return p; };

// İlk yardım sahnesi: kırsal yol, yol kenarında çimenlik; kazalı araç ve geçen trafik. Yaralı (x, z) noktasında
function firstAidSite(A, o = {}) {
  const { hx } = straightRoad(A, { n: 1, rural: true, R: 500 });
  fields(A, hx, -400, 300, o.seed || 41);
  A.car({ id: 'kaza', model: o.carModel || 'sedan', color: o.carColor || '#8c2f2b', path: [[hx + 1.6, 9], [hx + 1.6, 8]], v: [[0, 0]], hazard: [[0, 99]], yaw: [[0, o.carYaw != null ? o.carYaw : -24]] });
  if (o.traffic !== false) {
    A.car({ id: 't1', model: 'suv', color: '#5d6670', path: [[-1.75, -260], [-1.75, 200]], v: [[0, 60]] });
    A.car({ id: 't2', model: 'van', color: '#e9ecef', path: [[1.75, 160], [1.75, -300]], v: [[0, 45]] });
  }
  return { hx };
}

// İlk yardımcının diz çöküp ellerini iki hedefe koyması (kollar dışa/geriye bükülür)
function kneelHands(A, P, lean, tR, tL, o = {}) {
  const { f, r } = P.kneel({ lean, drop: o.drop || 0 });
  const back = P.pos('hips').addScaledVector(f, -0.4).setY(1.0);
  P.arm('R', tR, back.clone().addScaledVector(r, -0.6));
  P.arm('L', tL, back.clone().addScaledVector(r, 0.6));
  if (o.look) P.look('head', o.look);
  return { f, r };
}

/* =========================================================
   Sahneler
   ========================================================= */
export default [
  /* ---------- 12. Koruma: reflektör ---------- */
  {
    id: 'y12', dur: 11, poster: 6,
    soru: {
      d: 'iy', k: 'iy-temel',
      q: 'Videodaki sürücü ilk yardımın temel uygulamalarından hangisini yapmaktadır?',
      o: ['Kurtarma', 'Bildirme', 'Tedavi etme', 'Koruma'],
      a: 3,
      e: 'Sürücü, kaza yerinde yeni bir kaza olmasını önlemek için aracının dörtlü ikaz lambalarını yakmış ve kazalı aracın gerisine, yaklaşan sürücülerin görebileceği bir mesafeye reflektör (yansıtıcı uyarı üçgeni) koymaktadır. Olay yerini güvenli hâle getirmek ilk yardımın temel uygulamalarından Korumadır. Ardından 112 aranır (Bildirme) ve yaralılara müdahale edilir (Kurtarma).'
    },
    async build(A) {
      const { hx } = straightRoad(A, { n: 1, rural: true, R: 500 });
      fields(A, hx, -400, 300, 52);
      A.car({ id: 'kaza', model: 'hatchback-sports', color: '#2f5fb3', path: [[hx + 1.4, -2], [hx + 1.4, -3]], v: [[0, 0]], hazard: [[0, 99]], yaw: [[0, 28]] });
      A.car({ id: 'sofor', model: 'sedan', color: '#f2f3f5', path: [[hx + 0.9, 14], [hx + 0.9, 13]], v: [[0, 0]], hazard: [[0, 99]] });
      A.person({ id: 'surucu', model: 'man-d', path: [[hx + 1.9, 18], [hx + 1.0, 24], [hx + 0.5, 31], [hx + 0.4, 34], [hx + 1.4, 33], [hx + 2.6, 29]], v: [[0, 1.0], [0.6, 1.75], [7.6, 1.75], [8.0, 0], [9.4, 0], [9.9, 1.4], [11, 1.4]], clip: /walk/i,
        pose: (P, t) => { const k = t > 8.1 && t < 9.3 ? Math.sin((t - 8.1) / 1.2 * Math.PI) : 0; if (k > 0.05) P.kneel({ lean: 30 * k, drop: -0.35 * (1 - k) }); } });
      A.reflector({ id: 'ucgen', carrier: 'surucu', place: 8.6 });
      A.car({ id: 't1', model: 'suv', color: '#5d6670', path: [[1.75, 260], [1.75, -300]], v: [[0, 70], [6, 70], [9, 45], [11, 40]] });
      A.camera({ mode: 'keys', fov: 46, keys: [[0, [hx + 9, 8, -12], [hx + 1, 0.4, 8]], [2.6, [hx + 9.5, 7.5, -6], [hx + 1, 0.5, 14]], [5.5, [hx + 7, 5, 14], [hx, 0.7, 27]], [11, [hx + 5.5, 4.2, 23], [hx - 0.5, 0.5, 34]]] });
    }
  },

  /* ---------- 13. Bilinç kontrolü ---------- */
  {
    id: 'y13', dur: 8, poster: 3,
    soru: {
      d: 'iy', k: 'iy-degerlendirme',
      q: 'Videoda ilk yardımcı kazazedeye ne yapmaktadır?',
      o: ['Bilincini kontrol etmektedir', 'Kalp masajı yapmaktadır', 'Kanamasını durdurmaktadır', 'Kırık bölgeyi tespit etmektedir'],
      a: 0,
      e: 'İlk yardımcı kazazedenin yanına çömelmiş, omuzlarından hafifçe sarsarak ona seslenmektedir ("İyi misiniz?"). Bu, bilinç kontrolüdür. Kazazede tepki vermiyorsa yardım çağrılır (112), hava yolu açılır ve solunum değerlendirilir.'
    },
    async build(A) {
      const { hx } = firstAidSite(A, { carYaw: -20, carColor: '#3f7d55' });
      const X = hx + 4.2, Z = 2;
      A.person({ id: 'yarali', model: 'man-c', x: X, z: Z, ang: 180, lie: 'back', clip: /idle/i, at: 0.1 });
      A.person({ id: 'ilkyardimci', model: 'woman', x: X - 0.46, z: Z - 1.08, ang: 90, clip: /idle/i, at: 0.1,
        pose: (P, t) => {
          const sh = Math.sin(t * 2 * Math.PI * 1.7) * 0.065 * Math.min(1, t);
          const sR = A.boneAt('yarali', 'upperArmR', [sh, 0.06, 0]), sL = A.boneAt('yarali', 'upperArmL', [sh, 0.06, 0]);
          kneelHands(A, P, 52, sL, sR, { drop: 0.08, look: A.boneAt('yarali', 'head', [0, 0.2, 0]) });
        } });
      A.camera({ mode: 'keys', fov: 42, keys: [[0, [X + 2.4, 1.8, Z + 0.4], [X - 0.2, 0.35, Z - 1.3]], [8, [X + 1.6, 1.7, Z - 3.8], [X - 0.2, 0.35, Z - 1.3]]] });
    }
  },

  /* ---------- 14. Bak-dinle-hisset ---------- */
  {
    id: 'y14', dur: 9, poster: 4.5,
    soru: {
      d: 'iy', k: 'iy-tyd',
      q: 'Videoda ilk yardımcının yaptığı uygulamayla ilgili hangisi doğrudur?',
      o: ['Kazazedenin nabzını saymaktadır', 'Kurtarıcı solunum (ağızdan ağıza) uygulamaktadır', 'Ağzındaki yabancı cismi çıkarmaktadır', 'Baş geri-çene yukarı pozisyonu verip bak-dinle-hisset yöntemiyle solunumu değerlendirmektedir'],
      a: 3,
      e: 'İlk yardımcı bir elini kazazedenin alnına, diğer elinin parmaklarını çenesinin altına koyarak başı geriye itmiş ve hava yolunu açmıştır. Yanağını kazazedenin ağzına yaklaştırıp göğsüne bakarak en fazla 10 saniye boyunca bak-dinle-hisset yöntemiyle solunumu değerlendirmektedir.'
    },
    async build(A) {
      const { hx } = firstAidSite(A, { carYaw: -14, carColor: '#8c949e' });
      const X = hx + 4.2, Z = 2;
      A.person({ id: 'yarali', model: 'man-a', x: X, z: Z, ang: 180, lie: 'back', clip: /idle/i, at: 0.1,
        pose: (P, t) => { const k = Math.min(1, Math.max(0, (t - 0.8) / 1.2)); P.rot('head', [1, 0, 0], -28 * k); } });
      A.person({ id: 'ilkyardimci', model: 'woman', x: X - 0.42, z: Z - 1.5, ang: 90, clip: /idle/i, at: 0.1,
        pose: (P, t) => {
          const k = Math.min(1, Math.max(0, (t - 0.8) / 1.2)), d = Math.min(1, Math.max(0, (t - 2.2) / 1.0));
          const head = A.boneAt('yarali', 'head');
          const fore = head.clone().add(new P.THREE.Vector3(0, 0.12, 0.02)), chin = head.clone().add(new P.THREE.Vector3(0.02, 0.05, -0.12));
          kneelHands(A, P, 58 + 20 * d, fore, chin, { drop: 0.1, look: A.boneAt('yarali', 'chest', [0, 0, 0.25]) });
        } });
      A.camera({ mode: 'keys', fov: 40, keys: [[0, [X + 2.3, 1.6, Z - 0.4], [X - 0.2, 0.3, Z - 1.6]], [9, [X + 1.4, 1.3, Z - 3.9], [X - 0.2, 0.3, Z - 1.6]]] });
    }
  },
  /* ---------- 15. Kalp masajı (göğüs basısı) ---------- */
  {
    id: 'y15', dur: 8, poster: 3,
    soru: {
      d: 'iy', k: 'iy-tyd',
      q: 'Videoda yetişkin kazazedeye uygulanan göğüs basısıyla ilgili hangisi doğrudur?',
      o: ['Bası karın bölgesine uygulanır', 'Göğüs kemiğinin ortasına, kollar dirsekten bükülmeden bası uygulanır', 'Bası tek elin parmak uçlarıyla yapılır', 'Dakikada 30 bası yapılır'],
      a: 1,
      e: 'Yetişkinde göğüs basısı göğüs kemiğinin ortasına (alt yarısına), iki el üst üste konup kollar dirsekten bükülmeden, omuzlar ellerin hizasında olacak şekilde yapılır. Göğüs yaklaşık 5 cm çöktürülür, dakikada 100–120 bası hızıyla 30 göğüs basısına 2 kurtarıcı solunum uygulanır.'
    },
    async build(A) {
      const { hx } = firstAidSite(A, { carYaw: -18 });
      const X = hx + 4.2, Z = 2, rate = 1.85;
      const push = (t) => Math.max(0, Math.sin(t * rate * 2 * Math.PI)) ** 1.5; // 0..1 bası
      A.person({ id: 'yarali', model: 'man-b', x: X, z: Z, ang: 180, lie: 'back', clip: /idle/i, at: 0.1 });
      A.person({ id: 'ilkyardimci', model: 'woman', x: X - 0.5, z: Z - 1.12, ang: 90, clip: /idle/i, at: 0.1,
        pose: (P, t) => {
          const k = push(t);
          const { f, r } = P.kneel({ lean: 64 + 6 * k, drop: 0.14 + 0.03 * k });
          const c = A.boneAt('yarali', 'chest', [0, -0.02 - 0.045 * k, 0.03]);
          const back = P.pos('hips').addScaledVector(f, -0.4).setY(1.0);
          P.arm('R', c.clone().setY(c.y + 0.03), back.clone().addScaledVector(r, -0.6));
          P.arm('L', c.clone().setY(c.y + 0.075), back.clone().addScaledVector(r, 0.6));
        } });
      A.camera({ mode: 'keys', fov: 42, keys: [[0, [X + 2.6, 1.9, Z + 1.2], [X - 0.2, 0.35, Z - 1.1]], [8, [X + 2.2, 2.0, Z - 3.6], [X - 0.2, 0.35, Z - 1.1]]] });
    }
  },

  /* ---------- 16. Koma (derlenme) pozisyonu ---------- */
  {
    id: 'y16', dur: 8, poster: 3,
    soru: {
      d: 'iy', k: 'iy-tasima',
      q: 'Videoda kazazedeye verilen pozisyon hangi durumdaki kişiye uygulanır?',
      o: ['Kalbi ve solunumu durmuş kişiye', 'Şok belirtileri gösteren kişiye', 'Bilinci kapalı, solunumu olan kişiye', 'Bacağında açık kırık olan kişiye'],
      a: 2,
      e: 'Kazazede yan yatırılmış, üstteki bacağı dizden bükülüp öne alınmış, üstteki elinin sırtı yanağının altına konmuştur. Bu, koma (derlenme) pozisyonudur: bilinci kapalı ama solunumu olan kişiye verilir; dilin geriye kaçmasını ve kusmukla boğulmayı önler. Kişinin solunumu düzenli aralıklarla kontrol edilir.'
    },
    async build(A) {
      const { hx } = firstAidSite(A, { carYaw: -22, carColor: '#e68a2e' });
      const X = hx + 4.4, Z = 2;
      A.person({ id: 'yarali', model: 'woman', x: X, z: Z, ang: 180, lie: 'side', restY: 0.2, clip: /idle/i, at: 0.1,
        pose: (P) => {
          const V = P.THREE.Vector3;
          const hip = P.pos('hips'), head = P.pos('head'), chest = P.pos('chest');
          const sL = P.pos('upperArmL'), sR = P.pos('upperArmR');
          const up = head.clone().sub(hip).normalize(), front = new V().crossVectors(sL.clone().sub(sR), up).normalize();
          const feet = up.clone().negate();
          const topL = P.pos('upperLegL').y > P.pos('upperLegR').y; // üstte kalan taraf
          const T = topL ? 'L' : 'R', B = topL ? 'R' : 'L';
          // üstteki bacak: kalçadan öne ~90°, diz bükük, dizi yerde
          const thip = P.pos('upperLeg' + T);
          P.leg(T, thip.clone().addScaledVector(front, 0.42).addScaledVector(feet, 0.42).setY(0.1), thip.clone().addScaledVector(front, 1.2).addScaledVector(feet, -0.1));
          // alttaki bacak düz, hafif geride
          const bhip = P.pos('upperLeg' + B);
          P.leg(B, bhip.clone().addScaledVector(feet, 0.85).addScaledVector(front, -0.05).setY(0.08), bhip.clone().addScaledVector(front, 0.6).addScaledVector(feet, 0.4));
          // üstteki el yanağın altında, alttaki kol öne uzanmış
          P.arm(T, head.clone().addScaledVector(front, 0.1).setY(0.08), head.clone().addScaledVector(front, 0.45).addScaledVector(feet, 0.25).setY(0.35));
          P.arm(B, chest.clone().addScaledVector(front, 0.5).addScaledVector(up, 0.25).setY(0.06), chest.clone().addScaledVector(front, 0.3).setY(0.6));
          P.look('head', head.clone().addScaledVector(front, 0.6).addScaledVector(up, 0.3));
        } });
      A.person({ id: 'ilkyardimci', model: 'man-b', x: X + 0.62, z: Z - 1.25, ang: 270, clip: /idle/i, at: 0.1,
        pose: (P, t) => {
          const head = A.boneAt('yarali', 'head'), sh = A.boneAt('yarali', 'chest');
          kneelHands(A, P, 32, head.clone().add(new P.THREE.Vector3(0.14, 0.12, -0.05)), sh.clone().add(new P.THREE.Vector3(0.12, 0.14, 0.1)), { drop: 0.06, look: head });
        } });
      A.camera({ mode: 'keys', fov: 42, keys: [[0, [X - 2.4, 1.8, Z + 0.6], [X + 0.3, 0.25, Z - 1.0]], [8, [X - 1.8, 1.9, Z - 3.6], [X + 0.3, 0.25, Z - 1.0]]] });
    }
  },

  /* ---------- 17. Şok pozisyonu ---------- */
  {
    id: 'y17', dur: 8, poster: 3,
    soru: {
      d: 'iy', k: 'iy-kanama',
      q: 'Videoda kazazedeye verilen pozisyon hangi durumda uygulanır?',
      o: ['Şok durumunda', 'Göğüs yaralanmalarında', 'Kafa travmalarında', 'Bilinç kaybında, solunum varken'],
      a: 0,
      e: 'Kazazede sırtüstü yatırılmış, bacakları yaklaşık 30 cm yükseltilmiş ve vücut ısısını korumak için üstü örtülmüştür. Bu, şok pozisyonudur: kanın beyin ve kalp gibi hayati organlara gitmesine yardımcı olur. Kafa, göğüs, karın yaralanmalarında ve bacak ya da omurga kırığı şüphesinde bacaklar yükseltilmez.'
    },
    async build(A) {
      const { hx } = firstAidSite(A, { carYaw: -16, carColor: '#25406b' });
      const X = hx + 4.2, Z = 2;
      A.prop('roll', X, 0, Z - 0.26, 0.62, 0.27, 0, '#8a4f3a');
      A.person({ id: 'yarali', model: 'man-e', x: X, z: Z, ang: 180, lie: 'back', clip: /idle/i, at: 0.1,
        pose: (P) => {
          // bacaklar düz, ~18° yukarıda; baldırlar ruloya dayanır
          const a = 18 * Math.PI / 180;
          for (const s2 of ['L', 'R']) {
            const hp = P.pos('upperLeg' + s2), L = 0.74;
            P.leg(s2, new P.THREE.Vector3(hp.x, hp.y + L * Math.sin(a), hp.z + L * Math.cos(a)), new P.THREE.Vector3(hp.x, hp.y + 1.5, hp.z + 0.4));
          }
        } });
      A.blanket(X, Z - 1.2, 0.95, 0.95, '#5f7347', 0.33);
      A.person({ id: 'ilkyardimci', model: 'woman', x: X - 0.62, z: Z - 1.75, ang: 90, clip: /idle/i, at: 0.1,
        pose: (P) => {
          const head = A.boneAt('yarali', 'head');
          kneelHands(A, P, 40, A.boneAt('yarali', 'upperArmR', [0, 0.08, 0.05]), A.boneAt('yarali', 'chest', [-0.05, 0.3, 0.05]), { drop: 0.06, look: head });
        } });
      A.camera({ mode: 'keys', fov: 42, keys: [[0, [X + 2.6, 1.7, Z + 0.8], [X - 0.1, 0.3, Z - 0.9]], [8, [X + 2.0, 1.9, Z - 3.4], [X - 0.1, 0.3, Z - 0.9]]] });
    }
  },
  /* ---------- 1. Eş kavşakta sağdan gelen ---------- */
  {
    id: 'y01', dur: 8, poster: 3.2,
    soru: {
      d: 'tc', k: 'tc-gecis',
      q: 'Işıksız ve trafik işareti bulunmayan kavşakta beyaz otomobil sürücüsü hangi kuralı ihlal etmiştir?',
      o: ['Öndeki aracı geçme kuralını', 'Takip mesafesi kuralını', 'Kavşakta sağdan gelen araca ilk geçiş hakkını verme kuralını', 'Duraklama ve park etme kuralını'],
      a: 2,
      e: 'Işıksız, trafik işareti ve görevlisi bulunmayan eş kavşakta ilk geçiş hakkı sağdan gelen aracındır. Beyaz otomobil, sağından gelen kırmızı otomobile yol vermeden kavşağa girmiş; kırmızı otomobil ancak sert fren yaparak çarpışmayı önleyebilmiştir.'
    },
    async build(A) {
      crossroads(A, { seed: 3 });
      A.car({ id: 'beyaz', model: 'sedan', color: '#f2f3f5', path: [[1.75, 42], [1.75, -90]], v: [[0, 36], [8, 36]] });
      A.car({ id: 'kirmizi', model: 'hatchback-sports', color: '#c62a24', path: [[46, -1.75], [-90, -1.75]], v: [[0, 40], [2.85, 40], [4.45, 0], [5.8, 0], [7.8, 26]], holdBrake: true });
      A.car({ id: 'p1', model: 'suv', color: '#5d6670', path: [[-4.6, -28], [-4.6, -29]], v: [[0, 0]] });
      A.ped({ id: 'y1', model: 'character-female-b', path: [[-5.2, 16], [-5.2, 40]], v: [[0, 1.2]] });
      A.camera({ mode: 'keys', fov: 50, keys: [[0, [6, 14, 40], [0, 0, 6]], [8, [7, 16, 28], [0, 0, -4]]] });
    }
  },

  /* ---------- 2. Ambulansa yol vermeyen araç ---------- */
  {
    id: 'y02', dur: 10, poster: 5.5,
    soru: {
      d: 'tc', k: 'tc-ozel',
      q: 'Videoya göre mavi otomobil sürücüsü nasıl davranmalıdır?',
      o: ['Hızını artırarak ambulansın önünde gitmeli', 'Sol şeritte aynı hızla yoluna devam etmeli', 'Sağ şeride geçip yavaşlayarak ambulansa yol vermeli', 'Ani fren yaparak sol şeritte durmalı'],
      a: 2,
      e: 'Işıklı ve sesli uyarı işaretlerini kullanarak gelen ambulans geçiş üstünlüğüne sahiptir. Sürücüler, geçiş üstünlüğüne sahip araçlara yol vermek için sağa yanaşmak, gerekiyorsa durmak zorundadır. Mavi otomobil sol şeritte aynı hızla ilerleyerek ambulansın yolunu kesmektedir; gri otomobil ise doğru davranarak sağa yanaşıp yavaşlamıştır.'
    },
    async build(A) {
      const { hx } = straightRoad(A, { n: 2 });
      roadside(A, hx + 3.2, hx + 3.2, -260, 140, { seed: 11 });
      A.car({ id: 'mavi', model: 'sedan', color: '#2f5fb3', path: [[1.75, 40], [1.75, -400]], v: [[0, 50], [10, 50]] });
      A.car({ id: 'gri', model: 'suv', color: '#8c949e', path: [[5.25, -28], [5.25, -60], [6.0, -75], [6.0, -400]], v: [[0, 46], [3, 46], [5, 30], [10, 30]], right: [[2.2, 7]] });
      A.car({ id: 'amb', model: 'ambulance', beacon: true, lights: true, path: [[1.75, 88], [1.75, -400]], v: [[0, 76], [4.6, 76], [5.6, 50], [10, 50]] });
      A.car({ id: 'k1', model: 'hatchback-sports', color: '#e9ecef', path: [[-5.25, -260], [-5.25, 200]], v: [[0, 50]] });
      A.car({ id: 'k2', model: 'van', color: '#d9c7a2', path: [[-1.75, -200], [-1.75, 200]], v: [[0, 45]] });
      A.camera({ mode: 'follow', target: 'amb', back: 11, up: 5.5, ahead: 22, side: -2.5, fov: 52 });
    }
  },

  /* ---------- 3. Geçme yasağı olan yerde sollama ---------- */
  {
    id: 'y03', dur: 8, poster: 3.4,
    soru: {
      d: 'tc', k: 'tc-sollama',
      q: 'Videoya göre kırmızı otomobil sürücüsü için hangisi kesinlikle söylenir?',
      o: ['Sinyal vererek güvenli biçimde geçtiği', 'Takip mesafesine uyarak kamyonetin arkasından gittiği', 'Kavşakta ilk geçiş hakkını vermediği', 'Geçme yasağı olan yerde öndeki aracı geçtiği'],
      a: 3,
      e: 'Yolda "Öndeki taşıtı geçmek yasaktır" levhası vardır ve yol ortası sürekli çizgiyle ayrılmıştır; bu kesimde öndeki aracı geçmek yasaktır. Kırmızı otomobil sinyal vermeden sürekli çizgiyi geçerek karşı şeride girmiş, karşıdan gelen araca rağmen kamyoneti sollamış ve kamyonetin önüne kırarak kendini ve başkalarını tehlikeye atmıştır.'
    },
    async build(A) {
      const { hx } = straightRoad(A, { n: 1, center: 'solid', rural: true, R: 600 });
      fields(A, hx, -560, 160, 8);
      for (const z of [-14, -80]) { await A.sign('sollamayasak', hx + 1.6, z, 180, { size: 1.3 }); await A.sign('sollamayasak', -hx - 1.6, z, 180, { size: 1.3 }); }
      A.car({ id: 'kamyon', model: 'truck', color: '#d9dde2', path: [[1.75, 0], [1.75, -600]], v: [[0, 60]] });
      A.car({ id: 'kirmizi', model: 'sedan-sports', color: '#c62a24', path: [[1.75, 14], [1.75, -6], [-1.75, -26], [-1.75, -89], [1.75, -108], [1.75, -600]], v: [[0, 60], [1.2, 60], [3, 92], [6.2, 92], [8, 80]] });
      A.car({ id: 'karsi', model: 'van', color: '#e9ecef', path: [[-1.75, -253], [-1.75, 200]], v: [[0, 80], [4.4, 80], [5.6, 55], [8, 55]], flash: [[4.0, 5.6]] });
      A.camera({ mode: 'follow', target: 'kamyon', back: 28, up: 10, ahead: 34, side: 1.5, fov: 52 });
    }
  },

  /* ---------- 4. Takip mesafesi: arkadan çarpma ---------- */
  {
    id: 'y04', dur: 9, poster: 2.4,
    soru: {
      d: 'tc', k: 'tc-hiz',
      q: 'Videodaki kazada kusurlu olan mavi otomobil sürücüsü hangi kurala uymamıştır?',
      o: ['Takip mesafesi kuralına', 'Kavşaklarda ilk geçiş hakkı kuralına', 'Öndeki aracı geçme kuralına', 'Duraklama ve park etme kuralına'],
      a: 0,
      e: 'Mavi otomobil, gri otomobili çok yakından izlemektedir. Yaya geçidinde duran araç nedeniyle gri otomobil fren yaptığında mavi otomobil zamanında duramamış ve arkadan çarpmıştır. Arkadan çarpmalı kazalarda kusur genellikle takip mesafesine uymayan arkadaki sürücüdedir; sürücü, öndeki araç aniden dursa bile güvenle durabileceği mesafeyi bırakmalıdır.'
    },
    async build(A) {
      const { hx } = straightRoad(A, { n: 1 });
      roadside(A, hx + 3.2, hx + 3.2, -200, 120, { seed: 4, skip: (z) => z > -44 && z < -24 });
      A.zebra(0, -33, 90, hx * 2);
      await A.sign('yayagecidi', hx + 1.4, -30, 180);
      A.car({ id: 'minibus', model: 'van', color: '#e9ecef', path: [[1.75, -28.5], [1.75, -29]], v: [[0, 0]], holdBrake: true });
      A.ped({ id: 'y1', model: 'character-male-c', path: [[-6, -33.4], [8, -33.4]], v: [[0, 0], [0.6, 1.1], [10, 1.1]] });
      A.ped({ id: 'y2', model: 'character-female-d', path: [[-5.4, -32.4], [8, -32.4]], v: [[0, 0], [1.1, 1.05], [10, 1.05]] });
      A.car({ id: 'gri', model: 'suv', color: '#8c949e', path: [[1.75, 40], [1.75, -60]], v: [[0, 50], [3, 50], [5, 14], [5.02, 22], [5.6, 0], [9, 0]], holdBrake: true, hazard: [[6.6, 9]], pitch: [[4.95, 1.5], [5.03, -4.5], [5.25, 1.5], [5.6, 0]], yaw: [[5.0, 0], [5.12, 3.5], [5.6, 2.5]] });
      A.debris(1.75, -17.1, 5.0, 14);
      A.car({ id: 'mavi', model: 'sedan', color: '#2f5fb3', path: [[1.75, 50.6], [1.75, -60]], v: [[0, 50], [3.8, 50], [5.0, 25], [5.15, 6], [5.5, 0], [9, 0]], holdBrake: true, hazard: [[6.8, 9]], pitch: [[3.9, 0], [4.2, 2.2], [4.98, 2.4], [5.06, 6], [5.3, -2], [5.7, 0]], yaw: [[5.0, 0], [5.15, -2.5], [5.6, -2]] });
      A.car({ id: 'k1', model: 'hatchback-sports', color: '#e68a2e', path: [[-1.75, -120], [-1.75, -38], [-1.75, -37.9]], v: [[0, 45], [5.5, 45], [7.6, 0], [9, 0]] });
      A.camera({ mode: 'keys', fov: 48, keys: [[0, [-2, 10, 68], [1.75, 0, 38]], [4.4, [-2.2, 7, -3], [1.75, 0, -17]], [9, [-2.2, 6.5, -5], [1.75, 0, -19]]] });
    }
  },

  /* ---------- 5. Hemzemin geçit ---------- */
  {
    id: 'y05', dur: 12, poster: 7.6,
    soru: {
      d: 'tc', k: 'tc-ozel',
      q: 'Videoya göre hemzemin geçide yaklaşan sürücü nasıl davranmalıdır?',
      o: ['Bariyer tamamen inmeden hızlanarak geçidi geçmeli', 'Korna çalarak hemzemin geçide girmeli', 'Durmalı; tren geçip bariyer açıldıktan sonra yoluna devam etmeli', 'Bariyerin yanından dolaşarak geçmeli'],
      a: 2,
      e: 'Hemzemin geçitte kırmızı ışıklar yanıp sönmeye ve bariyer inmeye başladığında tren yaklaşmaktadır. Sürücü geçide girmeden durmalı, tren geçip bariyer tamamen açılana ve ışıklar sönene kadar beklemelidir. Bariyer inerken hızlanmak ya da bariyerin yanından dolaşmak ölümcül kazalara yol açar.'
    },
    async build(A) {
      const { hx } = straightRoad(A, { n: 1, rural: true, R: 500 });
      fields(A, hx, -300, 200, 12);
      const Z = -62;
      A.rails(Z, -300, 300);
      A.crossbuck(hx + 1.6, Z + 6, 180); A.crossbuck(-hx - 1.6, Z - 6, 0);
      A.blinker(hx + 1.6, Z + 5.4, 180, [[2.2, 12]]); A.blinker(-hx - 1.6, Z - 5.4, 0, [[2.2, 12]]);
      A.barrier(hx + 0.9, Z + 4.4, 270, hx + 0.6, [[0, 90], [3.6, 90], [6.6, 0], [12, 0]]);
      A.barrier(-hx - 0.9, Z - 4.4, 90, hx + 0.6, [[0, 90], [3.6, 90], [6.6, 0], [12, 0]]);
      A.train({ id: 'tren', path: [[168, Z], [-400, Z]], v: [[0, 85]], cars: 5 });
      A.car({ id: 'ben', model: 'sedan', color: '#f2f3f5', path: [[1.75, 40], [1.75, -300]], v: [[0, 52], [4.2, 52], [8.2, 0], [12, 0]], holdBrake: true });
      A.car({ id: 'karsi', model: 'suv', color: '#3f7d55', path: [[-1.75, -150], [-1.75, -70.5], [-1.75, -70.4]], v: [[0, 50], [3.5, 50], [6.2, 0], [12, 0]], holdBrake: true });
      A.camera({ mode: 'driver', target: 'ben', fov: 60 });
    }
  },

  /* ---------- 6. Dönel kavşak ---------- */
  {
    id: 'y06', dur: 9, poster: 3.2,
    soru: {
      d: 'tc', k: 'tc-gecis',
      q: 'Videoya göre mavi otomobil sürücüsü hangi kuralı ihlal etmiştir?',
      o: ['Takip mesafesi kuralını', 'Dönel kavşak içindeki araçlara ilk geçiş hakkını verme kuralını', 'Öndeki aracı geçme kuralını', 'Duraklama ve park etme kuralını'],
      a: 1,
      e: 'Dönel kavşaklarda ilk geçiş hakkı kavşağın içinde dönmekte olan araçlarındır; kavşağa girecek sürücü "Yol ver" işaretine uyarak içerideki araçların geçmesini beklemelidir. Mavi otomobil kavşak içindeki beyaz otomobile yol vermeden kavşağa girmiş, beyaz otomobil sert fren yapmak zorunda kalmıştır.'
    },
    async build(A) {
      A.ground('grass');
      const rIn = 9, rOut = 16, rc = 12.6, R = 160;
      A.asphalt(-LW, rOut - 2, LW, R); A.asphalt(-LW, -R, LW, -rOut + 2); A.asphalt(rOut - 2, -LW, R, LW); A.asphalt(-R, -LW, -rOut + 2, LW);
      A.roundabout(0, 0, rIn, rOut);
      for (const [x0, z0, x1, z1] of [[LW, rOut, LW + 3, R], [-LW - 3, rOut, -LW, R], [LW, -R, LW + 3, -rOut], [-LW - 3, -R, -LW, -rOut], [rOut, LW, R, LW + 3], [rOut, -LW - 3, R, -LW], [-R, LW, -rOut, LW + 3], [-R, -LW - 3, -rOut, -LW]]) A.walk(x0, z0, x1, z1);
      for (const s of [1, -1]) { A.line([[0, s * (rOut + 4)], [0, s * R]], { dash: [3, 5] }); A.line([[s * (rOut + 4), 0], [s * R, 0]], { dash: [3, 5] }); }
      A.line([[0.2, rOut + 0.5], [LW, rOut + 0.5]], { dash: [0.6, 0.4], w: 0.3 });
      await A.sign('yolver', LW + 1.6, rOut + 2, 180, { size: 1.25 }); await A.sign('ada', LW + 1.6, rOut + 2.2, 180, { h: 0.9, size: 0.9 });
      await A.sign('yolver', -rOut - 2, LW + 1.6, 270); await A.sign('yolver', -LW - 1.6, -rOut - 2, 0); await A.sign('yolver', rOut + 2, -LW - 1.6, 90);
      cityBlocks(A, LW + 3, LW + 3, R, 9, true);
      // beyaz: kavşağın içinde dönüyor (kuzeybatıdan güneye, doğuya), sonra kuzey çıkışı
      const wp = [...arc(rc, 141, 450, 10), [1.75, -rOut - 2], [1.75, -100]];
      A.car({ id: 'beyaz', model: 'sedan', color: '#f2f3f5', path: wp, v: [[0, 30], [2.6, 30], [3.4, 0], [4.6, 0], [6.4, 26], [9, 30]], holdBrake: true });
      // mavi: güneyden gelir, yol vermeden girer, doğu çıkışından çıkar
      const bp = [[1.75, 50], [1.75, rOut + 2], ...arc(rc, 285, 355, 10), [rOut + 2, -1.75], [100, -1.75]];
      A.car({ id: 'mavi', model: 'hatchback-sports', color: '#2f5fb3', path: bp, v: [[0, 34], [9, 34]] });
      A.car({ id: 'k1', model: 'suv', color: '#8c2f2b', path: [[-1.75, -90], [-1.75, -rOut - 2], ...arc(rc, 110, 175, 10), [-rOut - 2, 1.75], [-100, 1.75]], v: [[0, 30]] });
      A.camera({ mode: 'keys', fov: 48, keys: [[0, [-14, 26, 46], [0, 0, 4]], [9, [-6, 30, 40], [2, 0, 0]]] });
    }
  },

  /* ---------- 7. Yağ basıncı ikaz lambası ---------- */
  {
    id: 'y07', dur: 10, poster: 6,
    soru: {
      d: 'at', k: 'at-gosterge',
      q: 'Sürüş sırasında gösterge panelinde videodaki ikaz lambası yanan sürücü nasıl davranmalıdır?',
      o: ['Hızını artırarak en yakın servise gitmeli', 'Lambayı dikkate almadan yoluna devam etmeli', 'Dörtlü ikaz lambalarını yakıp aynı hızla yoluna devam etmeli', 'Güvenli bir yerde durup motoru hemen durdurmalı'],
      a: 3,
      e: 'Yanan kırmızı lamba motor yağ basıncı ikaz lambasıdır: motorda yağ basıncı düşmüştür ve yağlama yetersizdir. Bu hâlde çalışmaya devam eden motor kısa sürede ağır hasar görür. Sürücü trafik kurallarına uygun biçimde güvenli bir yerde durmalı, motoru hemen durdurmalı ve yağ seviyesini kontrol etmeli ya da yardım çağırmalıdır.'
    },
    async build(A) {
      const { hx } = straightRoad(A, { n: 2, median: 2, rural: true });
      fields(A, hx, -380, 200, 5);
      A.car({ id: 'ben', model: 'sedan', color: '#f2f3f5', path: [[5.25, 150], [5.25, -380]], v: [[0, 88], [10, 88]] });
      A.car({ id: 'on', model: 'suv', color: '#2f5fb3', path: [[1.75, 120], [1.75, -380]], v: [[0, 92], [10, 92]] });
      A.car({ id: 'k1', model: 'truck', color: '#c9ccd1', path: [[5.25, 40], [5.25, -380]], v: [[0, 80], [10, 80]] });
      A.car({ id: 'ters', model: 'sedan-sports', color: '#8c2f2b', path: [[-5.25, -300], [-5.25, 200]], v: [[0, 95]] });
      A.camera({ mode: 'driver', target: 'ben', fov: 62, lamps: [['yag', 4.2, 99]] });
    }
  },

  /* ---------- 8. Yaya geçidinde yayaya yol vermeme ---------- */
  {
    id: 'y08', dur: 8, poster: 3.3,
    soru: {
      d: 'tc', k: 'tc-ozel',
      q: 'Videoya göre beyaz otomobil sürücüsü için hangisi kesinlikle söylenir?',
      o: ['Yaya geçidinde yayaya ilk geçiş hakkını vermediği', 'Kavşakta sağdan gelen araca yol vermediği', 'Geçme yasağı olan yerde sollama yaptığı', 'Park yasağı olan yerde park ettiği'],
      a: 0,
      e: 'Işıksız yaya geçidinde geçmekte olan ya da geçmek üzere olan yayalara ilk geçiş hakkı verilmelidir. Yaya karşıya geçmek için geçidin başına gelmişken beyaz otomobil yavaşlamadan geçmiş, yaya beklemek zorunda kalmıştır. Karşı yöndeki turuncu otomobil ise doğru davranarak geçidin önünde durmuştur.'
    },
    async build(A) {
      const { hx } = straightRoad(A, { n: 1 });
      roadside(A, hx + 3.2, hx + 3.2, -200, 150, { seed: 21, skip: (z) => z > -20 && z < 0 });
      const Z = -10;
      A.zebra(0, Z, 90, hx * 2);
      await A.sign('yayagecidi', hx + 1.4, Z + 3, 180); await A.sign('yayagecidi', -hx - 1.4, Z - 3, 0);
      A.ped({ id: 'yaya', model: 'character-female-a', path: [[7, Z], [-9, Z]], v: [[0, 0], [0.3, 1.3], [3.25, 1.3], [3.55, 0], [4.9, 0], [5.2, 1.3], [9, 1.3]] });
      A.car({ id: 'beyaz', model: 'sedan', color: '#f2f3f5', path: [[1.75, 44], [1.75, -120]], v: [[0, 46], [8, 46]] });
      A.car({ id: 'turuncu', model: 'hatchback-sports', color: '#e68a2e', path: [[-1.75, -60], [-1.75, Z - 3.4], [-1.75, Z - 3.3]], v: [[0, 40], [2.0, 40], [4.2, 0], [8, 0]], holdBrake: true });
      A.car({ id: 'p1', model: 'suv', color: '#6b7380', path: [[4.6, 30], [4.6, 29]], v: [[0, 0]] });
      A.camera({ mode: 'keys', fov: 50, keys: [[0, [-2.6, 6.5, 6], [1.5, 0.6, -10]], [8, [-2.6, 7, 2], [1.5, 0.6, -10]]] });
    }
  },

  /* ---------- 9. Yola yuvarlanan top ---------- */
  {
    id: 'y09', dur: 7, poster: 4.4,
    soru: {
      d: 'tc', k: 'tc-ozel',
      q: 'Videoya göre sürücü nasıl bir tehlikenin olabileceğini düşünmelidir?',
      o: ['Yolun ilerisinde trafik denetimi yapılabileceğini', 'Topun arkasından bir çocuğun yola çıkabileceğini', 'Rüzgâr nedeniyle direksiyon hâkimiyetini kaybedebileceğini', 'Arkadan gelen aracın kendisini sollayabileceğini'],
      a: 1,
      e: 'Park etmiş araçların arasından yola yuvarlanan top, arkasından onu almaya koşan bir çocuğun çıkabileceğinin işaretidir. Okul ve yerleşim bölgelerinde sürücü yavaşlamalı, durmaya hazır olmalı ve park etmiş araçların arasını dikkatle izlemelidir.'
    },
    async build(A) {
      const { hx, right } = straightRoad(A, { n: 1, parkRight: 2.6 });
      roadside(A, hx + 3.2, right + 3.2, -200, 120, { seed: 5 });
      await A.sign('okul', right + 1.2, 2, 180);
      const cols = ['#8c2f2b', '#e9ecef', '#2b2f36', '#3f7d55', '#b9c0c9', '#25406b', '#d9c7a2'];
      ['sedan', 'suv', 'hatchback-sports', 'van', 'sedan', 'suv-luxury', 'sedan-sports'].forEach((m, i) => {
        const z = -12 - i * 6.3 - (i > 3 ? 2.6 : 0);
        A.car({ id: 'p' + i, model: m, color: cols[i], path: [[hx + 1.3, z], [hx + 1.3, z - 1]], v: [[0, 0]] });
      });
      A.ball({ id: 'top', r: 0.25, path: [[right + 1.5, -35.3], [right - 0.5, -35.3], [-8, -35.1]], v: [[0, 0], [2.2, 0], [2.3, 3.4], [7, 2.6]], bounce: 9 });
      A.car({ id: 'ben', model: 'sedan', color: '#f2f3f5', path: [[1.75, 20], [1.75, -200]], v: [[0, 40], [3.5, 40], [4.7, 0], [7, 0]], holdBrake: true });
      A.car({ id: 'karsi', model: 'van', color: '#e9ecef', path: [[-1.75, -160], [-1.75, 100]], v: [[0, 35]] });
      A.camera({ mode: 'driver', target: 'ben', fov: 60 });
    }
  },

  /* ---------- 10. Saldırgan sürücü ---------- */
  {
    id: 'y10', dur: 10, poster: 2.2,
    soru: {
      d: 'ta', k: 'ta-surucu',
      q: 'Videoya göre siyah otomobil sürücüsü için hangisi söylenebilir?',
      o: ['Sakin ve hoşgörülü olduğu', 'Sabırsız ve saldırgan olduğu', 'Trafik kurallarına saygılı olduğu', 'Yorgun ve uykusuz olduğu'],
      a: 1,
      e: 'Siyah otomobil sürücüsü öndeki aracı çok yakından izleyip selektör yaparak sıkıştırmış, ardından sağdan geçip aniden önüne kırarak gri otomobili fren yapmak zorunda bırakmıştır. Bu davranışlar sabırsızlığın ve saldırganlığın göstergesidir. Trafikte sabırlı ve hoşgörülü olmak, başkalarının hakkına saygı göstermek gerekir.'
    },
    async build(A) {
      const { hx } = straightRoad(A, { n: 2, median: 2 });
      roadside(A, hx + 3.2, hx + 3.2, -500, 140, { seed: 17, town: false, trees: false });
      A.car({ id: 'gri', model: 'sedan', color: '#9aa3ad', path: [[2.75, 20], [2.75, -500]], v: [[0, 68], [6.0, 68], [6.8, 50], [8.5, 58], [10, 62]] });
      A.car({ id: 'siyah', model: 'sedan-sports', color: '#22252a', path: [[2.75, 26.5], [2.75, -36], [6.25, -54], [6.25, -96], [2.75, -112], [2.75, -500]], v: [[0, 68], [3.4, 68], [5.2, 98], [7.5, 98], [10, 90]], flash: [[0.6, 3.2]] });
      A.car({ id: 'k1', model: 'van', color: '#e9ecef', path: [[6.25, -190], [6.25, -500]], v: [[0, 58]] });
      A.car({ id: 'ters', model: 'suv', color: '#3f7d55', path: [[-4.25, -300], [-4.25, 200]], v: [[0, 70]] });
      A.camera({ mode: 'follow', target: 'gri', reverse: true, back: 15, up: 6, ahead: 12, side: -4, fov: 54 });
    }
  },

  /* ---------- 11. Gece: karşıdan araç gelirken uzun far ---------- */
  {
    id: 'y11', dur: 9, poster: 4.5,
    soru: {
      d: 'tc', k: 'tc-isik',
      q: 'Gece, karşıdan araç gelirken videodaki sürücü farlarını nasıl kullanmalıdır?',
      o: ['Uzun hüzmeli farları yakmaya devam etmeli', 'Farlarını tamamen söndürmeli', 'Kısa hüzmeli farlara geçmeli', 'Sis lambalarını yakmalı'],
      a: 2,
      e: 'Gösterge panelindeki mavi lamba uzun hüzmeli farların (uzağı gösteren) yandığını gösterir. Karşıdan gelen aracın sürücüsü gözü kamaştığı için selektör yaparak uyarmaktadır. Gece karşılaşmalarda, karşıdan gelen sürücünün gözünü almamak için uzun hüzmeli farlar söndürülüp kısa hüzmeli (yakını gösteren) farlar yakılmalıdır.'
    },
    async build(A) {
      A.night();
      const { hx } = straightRoad(A, { n: 1, rural: true, R: 600 });
      fields(A, hx, -500, 200, 31);
      A.car({ id: 'ben', model: 'sedan', color: '#f2f3f5', path: [[1.75, 60], [1.75, -500]], v: [[0, 75]], beam: 'high' });
      A.car({ id: 'karsi', model: 'suv', color: '#8c949e', path: [[-1.75, -175], [-1.75, 200]], v: [[0, 75]], beam: 'low', flash: [[2.3, 3.9]] });
      A.camera({ mode: 'driver', target: 'ben', fov: 60, lamps: [['uzun', 0, 99]] });
    }
  }
];
