// Kapadokya hero katmanlarını üretir (yatayda kesintisiz döşenebilir SVG'ler).
// Kullanım: node tools/generate-layers.mjs [çıktı klasörü]   (varsayılan: assets/)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const W = 1600;
const TAU = Math.PI * 2;

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;

// Tam sayı frekanslı sinüsler => x=0 ve x=W'de aynı yükseklik (kesintisiz döşeme)
function ridge(base, waves) {
  return (x) => waves.reduce((y, [a, k, p]) => y + a * Math.sin((TAU * k * x) / W + p), base);
}
function groundPath(yOf, H, step = 16) {
  let d = `M0 ${H} L0 ${f(yOf(0))}`;
  for (let x = step; x <= W; x += step) d += ` L${x} ${f(yOf(x))}`;
  return d + ` L${W} ${H} Z`;
}

// Peri bacası: gövde + gölge + (isteğe bağlı) bazalt şapka + oyma pencereler
function chimney(x, baseY, h, w, o) {
  const top = baseY - h;
  const capH = o.cap ? Math.max(10, w * 0.34) : 0;
  const neckY = top + capH * 0.55;
  const nw = o.cap ? w * 0.2 : w * 0.16;
  const body =
    `M${f(x - w / 2)} ${f(baseY + 4)}` +
    ` C${f(x - w / 2)} ${f(baseY - h * 0.38)} ${f(x - w * 0.3)} ${f(baseY - h * 0.74)} ${f(x - nw)} ${f(neckY + (o.cap ? 0 : 6))}` +
    (o.cap
      ? ` L${f(x + nw)} ${f(neckY)}`
      : ` Q${f(x)} ${f(top - 4)} ${f(x + nw)} ${f(neckY + 6)}`) +
    ` C${f(x + w * 0.3)} ${f(baseY - h * 0.74)} ${f(x + w / 2)} ${f(baseY - h * 0.38)} ${f(x + w / 2)} ${f(baseY + 4)} Z`;
  // Işık sağdan geliyor: sol yarıya gölge
  const shade =
    `M${f(x - w / 2)} ${f(baseY + 4)}` +
    ` C${f(x - w / 2)} ${f(baseY - h * 0.38)} ${f(x - w * 0.3)} ${f(baseY - h * 0.74)} ${f(x - nw)} ${f(neckY + (o.cap ? 0 : 6))}` +
    ` L${f(x - nw * 0.2)} ${f(neckY + 4)} C${f(x - w * 0.08)} ${f(baseY - h * 0.6)} ${f(x - w * 0.12)} ${f(baseY - h * 0.3)} ${f(x - w * 0.06)} ${f(baseY + 4)} Z`;
  let s = `<path d="${body}" fill="${o.body}"/><path d="${shade}" fill="${o.shade}"/>`;
  if (o.cap) {
    const cw = w * (0.62 + (o.capScale || 0));
    const cy = top + capH * 0.55;
    s +=
      `<path d="M${f(x - cw / 2)} ${f(cy)} C${f(x - cw / 2)} ${f(top - capH * 0.45)} ${f(x + cw / 2)} ${f(top - capH * 0.45)} ${f(x + cw / 2)} ${f(cy)}` +
      ` C${f(x + cw * 0.22)} ${f(cy + capH * 0.42)} ${f(x - cw * 0.22)} ${f(cy + capH * 0.42)} ${f(x - cw / 2)} ${f(cy)} Z" fill="${o.cap}"/>` +
      `<path d="M${f(x + cw * 0.05)} ${f(top - capH * 0.12)} C${f(x + cw * 0.3)} ${f(top - capH * 0.1)} ${f(x + cw * 0.44)} ${f(cy - capH * 0.2)} ${f(x + cw * 0.46)} ${f(cy - 1)}" stroke="${o.capHi}" stroke-width="${f(Math.max(1.5, capH * 0.14))}" fill="none" stroke-linecap="round" opacity=".7"/>`;
  }
  if (o.windows) {
    for (const [dx, dy, ww, wh] of o.windows) {
      s += `<rect x="${f(x + dx * w - ww / 2)}" y="${f(baseY - dy * h)}" width="${f(ww)}" height="${f(wh)}" rx="${f(ww / 2)}" fill="${o.win}"/>`;
    }
  }
  return s;
}

function poplar(x, baseY, h, w, c) {
  return (
    `<path d="M${f(x)} ${f(baseY + 2)} L${f(x)} ${f(baseY - h * 0.25)}" stroke="${c.trunk}" stroke-width="${f(w * 0.14)}"/>` +
    `<ellipse cx="${f(x)}" cy="${f(baseY - h * 0.56)}" rx="${f(w / 2)}" ry="${f(h * 0.46)}" fill="${c.leaf}"/>` +
    `<path d="M${f(x + 1)} ${f(baseY - h * 1.0)} C${f(x + w * 0.62)} ${f(baseY - h * 0.8)} ${f(x + w * 0.55)} ${f(baseY - h * 0.3)} ${f(x + 1)} ${f(baseY - h * 0.12)} Z" fill="${c.hi}"/>`
  );
}

function svg(H, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMax meet">${body}</svg>\n`;
}

// ---------- UZAK KATMAN: Erciyes silueti + tepeler ----------
{
  const H = 320;
  const r = rng(11);
  const hill = ridge(236, [[14, 1, 0.3], [9, 3, 1.9], [5, 7, 0.4]]);
  let b = '';
  // Volkan (Erciyes)
  b += `<path d="M640 ${H} C800 262 930 130 1010 70 C1032 54 1052 44 1068 45 C1086 46 1106 58 1128 76 C1214 142 1344 250 1500 ${H} Z" fill="#b893b3"/>`;
  b += `<path d="M1068 45 C1086 46 1106 58 1128 76 C1214 142 1344 250 1500 ${H} L1240 ${H} C1180 220 1120 130 1068 45 Z" fill="#a9829f" opacity=".75"/>`;
  b += `<path d="M990 88 C1020 62 1046 44 1068 45 C1090 46 1112 62 1142 88 C1128 96 1118 86 1106 100 C1096 88 1084 102 1072 92 C1060 104 1048 90 1036 102 C1026 90 1012 100 990 88 Z" fill="#f7e8f0"/>`;
  b += `<path d="M1068 45 C1090 46 1112 62 1142 88 C1128 96 1118 86 1106 100 C1098 90 1090 96 1084 92 C1082 74 1076 58 1068 45 Z" fill="#e6cfe0"/>`;
  b += `<path d="${groundPath(hill, H)}" fill="#9a6c8d"/>`;
  // Uzak küçük peri bacaları
  for (let i = 0; i < 22; i++) {
    const x = 40 + r() * (W - 80);
    const h = 10 + r() * 30;
    const w = 8 + r() * 12;
    const y = hill(x) + 3;
    b += `<path d="M${f(x - w / 2)} ${f(y)} Q${f(x)} ${f(y - h * 2)} ${f(x + w / 2)} ${f(y)} Z" fill="#8a5d7f"/>`;
  }
  writeFileSync(join(OUT, 'layer-far.svg'), svg(H, b));
}

// ---------- ORTA KATMAN: peri bacası kümeleri (Üç Güzeller dahil) ----------
{
  const H = 280;
  const r = rng(29);
  const g = ridge(226, [[10, 2, 1.0], [6, 5, 2.1], [3, 11, 0.2]]);
  const pal = { body: '#d8946f', shade: '#b97252', cap: '#6f4234', capHi: '#9a624e', win: '#6a3a2b' };
  let b = `<path d="${groundPath(g, H)}" fill="#c9825f"/>`;
  const items = [];
  // Üç Güzeller: şapkalı üçlü
  items.push([380, 170, 54, true], [436, 132, 46, true], [482, 104, 40, true]);
  const clusters = [120, 640, 820, 1010, 1210, 1400, 1520];
  for (const cx of clusters) {
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const x = cx + (i - n / 2) * (30 + r() * 26) + r() * 10;
      const h = 60 + r() * 110;
      const w = 34 + r() * 34;
      items.push([x, h, w, r() > 0.55]);
    }
  }
  items.sort((a, b2) => b2[1] - a[1]); // uzunlar arkada
  for (const [x, h, w, cap] of items) {
    if (x < w || x > W - w) continue;
    const win = h > 110 && r() > 0.3
      ? [[0.08, 0.5, 5, 8], [-0.12, 0.34, 4, 7], [0.14, 0.28, 4, 6]].slice(0, 1 + Math.floor(r() * 3))
      : null;
    b += chimney(x, g(x), h, w, { ...pal, cap: cap ? pal.cap : null, windows: win });
  }
  writeFileSync(join(OUT, 'layer-mid.svg'), svg(H, b));
}

// ---------- YAKIN KATMAN: büyük bacalar, kavaklar, tabelalar ----------
{
  const H = 260;
  const r = rng(47);
  const g = ridge(192, [[12, 1, 0.5], [7, 3, 1.7], [3, 8, 0.9]]);
  const pal = { body: '#c07853', shade: '#9c5a3e', cap: '#4f2d22', capHi: '#7a4a38', win: '#5a2f22' };
  const tree = { leaf: '#4a6838', hi: '#5f8248', trunk: '#3b2a20' };
  let b = `<path d="${groundPath(g, H)}" fill="#9a5a40"/>`;
  b += `<path d="${groundPath((x) => g(x) + 22, H)}" fill="#8a4f38"/>`;
  const big = [[90, 140, 78, true], [300, 170, 96, false], [372, 126, 70, true], [760, 158, 88, true], [1120, 172, 100, false], [1190, 132, 72, true], [1460, 150, 84, true]];
  const trees = [[520, 6], [930, 4], [1300, 5]];
  for (const [tx, n] of trees) {
    for (let i = 0; i < n; i++) {
      const x = tx + i * (18 + r() * 10);
      const h = 96 + r() * 70;
      b += poplar(x, g(x) + 4, h, 18 + r() * 8, tree);
    }
  }
  for (const [x, h, w, cap] of big) {
    const win = [[0.06, 0.52, 7, 11], [-0.14, 0.36, 6, 9], [0.16, 0.3, 5, 8]].slice(0, 1 + Math.floor(r() * 3));
    b += chimney(x, g(x) + 6, h, w, { ...pal, cap: cap ? pal.cap : null, windows: win });
  }
  // Çalılar
  for (let i = 0; i < 26; i++) {
    const x = 20 + r() * (W - 40);
    const s = 5 + r() * 9;
    b += `<ellipse cx="${f(x)}" cy="${f(g(x) + 8)}" rx="${f(s * 1.6)}" ry="${f(s)}" fill="${r() > 0.5 ? '#6b7c3f' : '#5a6b35'}"/>`;
  }
  // Yol tabelaları: mavi yön tabelası + kahverengi turistik tabela
  const sign = (x, w, fill, text, fs) => {
    const y = g(x) + 10;
    return `<g><rect x="${f(x - 2)}" y="${f(y - 78)}" width="4" height="78" fill="#6f7479"/>` +
      `<rect x="${f(x - w / 2)}" y="${f(y - 104)}" width="${w}" height="30" rx="4" fill="#fff"/>` +
      `<rect x="${f(x - w / 2 + 3)}" y="${f(y - 101)}" width="${w - 6}" height="24" rx="3" fill="${fill}"/>` +
      `<text x="${f(x)}" y="${f(y - 84)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fs}" fill="#fff" text-anchor="middle">${text}</text></g>`;
  };
  b += sign(640, 92, '#1f5fb8', 'ÜRGÜP', 14);
  b += sign(1560 - 560, 118, '#7b4a2a', 'ÜÇ GÜZELLER', 12);
  writeFileSync(join(OUT, 'layer-near.svg'), svg(H, b));
}
console.log('ok');
