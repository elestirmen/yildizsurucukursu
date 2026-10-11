// Poly Haven ağaç modelini kartlara pişirir (agac.html): 24 yön, iki görüş yüksekliği → PNG; ardından WebP'ye çevrilip agac/ dizinine konur.
// Kullanım: NODE_PATH=<puppeteer> node bake-agac.mjs --three <three paketi> --ph <Poly Haven dizini> --out <çıktı> <model adı> [n=24] [yükseklik=6]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const puppeteer = require('puppeteer');
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const THREE = arg('three'), PHD = arg('ph'), OUT = arg('out');
const rest = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').startsWith('--'));
const [name, n = '24', elev = '6'] = rest;
const T = { '.js': 'text/javascript', '.html': 'text/html', '.gltf': 'model/gltf+json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname); const f = u.startsWith('/three/') ? path.join(THREE, u.slice(7)) : u.startsWith('/ph/') ? path.join(PHD, u.slice(4)) : path.join(ROOT, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await puppeteer.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], protocolTimeout: 900000 });
const p = await b.newPage(); p.on('pageerror', (e) => console.log('[hata]', e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/tools/video/agac.html`); await p.waitForFunction('window.READY === true');
const r = await p.evaluate((u, n, e) => window.BAKE(u, n, e), `/ph/models/${name}/${name}.gltf`, Number(n), Number(elev));
fs.mkdirSync(OUT, { recursive: true });
r.out.forEach((d, i) => fs.writeFileSync(path.join(OUT, `${name}_${String(i).padStart(2, '0')}.png`), Buffer.from(d.slice(22), 'base64')));
fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ n: Number(n), elev: Number(elev), height: r.height, width: r.width, halfH: r.halfH, baseY: r.baseY, cy: r.cy, w: 384, h: 512 }));
console.log(name, r.out.length, 'kart');
await b.close(); srv.close();
