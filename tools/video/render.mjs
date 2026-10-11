// Animasyonlu soru videolarını üretir: senaryolar.js → başsız Chrome'da kare kare çizim → ffmpeg → assets/v/<id>.mp4 (+ .webp kapak)
// Kullanım: NODE_PATH=<puppeteer'ın bulunduğu node_modules> node render.mjs --kenney <Kenney kitleri> --three <three paketi> --ph <Poly Haven indirmeleri>
//   [--only y01,y02] [--fps 25] [--blur 3] [--preview] [--work <geçici dizin>]
// Soru metinleri ve cevaplar tools/esinav/data/es-sinav/kurs_video.json'a yazılır (build_bank.py okur).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const KENNEY = arg('kenney'), THREE = arg('three'), PHD = arg('ph'), BLUR = Number(arg('blur', 3)), FPS = Number(arg('fps', 25)), ONLY = arg('only', ''), PREVIEW = process.argv.includes('--preview');
if (!KENNEY || !THREE || !PHD) { console.error('--kenney, --three ve --ph gerekli'); process.exit(1); }
const OUT = path.join(ROOT, 'assets', 'v');
const WORK = arg('work', os.tmpdir());   // kare ve önizleme dizini
const TMP = fs.mkdtempSync(path.join(WORK, 'yv-'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.hdr': 'application/octet-stream' };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f;
  if (u.startsWith('/kenney/')) f = path.join(KENNEY, u.slice(8));
  else if (u.startsWith('/three/')) f = path.join(THREE, u.slice(7));
  else if (u.startsWith('/ph/')) f = path.join(PHD, u.slice(4));
  else f = path.join(ROOT, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], protocolTimeout: 900000 });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[sayfa]', m.text()); });
page.on('pageerror', (e) => console.log('[hata]', e.message));
page.on('response', (r) => { if (r.status() >= 400) console.log('[yok]', r.status(), r.url()); });
await page.setViewport({ width: 960, height: 540 });
await page.goto(`http://127.0.0.1:${PORT}/tools/video/index.html?blur=${PREVIEW ? 1 : BLUR}`, { waitUntil: 'load' });
await page.waitForFunction('window.READY === true', { timeout: 300000 });
const ids = (await page.evaluate(() => R.ids)).filter((id) => !ONLY || ONLY.split(',').includes(id));
const metas = [];
for (const id of ids) {
  const t0 = Date.now();
  const { dur } = await page.evaluate((id) => R.load(id), id);
  const meta = await page.evaluate((id) => R.meta(id), id);
  metas.push(meta);
  const dir = path.join(TMP, id); fs.mkdirSync(dir, { recursive: true });
  const n = PREVIEW ? Math.ceil(dur * 2) : Math.round(dur * FPS), step = PREVIEW ? 0.5 : 1 / FPS;
  for (let i = 0; i < n; i++) {
    const b64 = await page.evaluate((t) => R.frame(t).toDataURL('image/jpeg', 0.93).slice(23), i * step);
    fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(b64, 'base64'));
  }
  if (PREVIEW) {
    const prev = path.join(WORK, `onizleme-${id}.jpg`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '2', '-i', path.join(dir, 'f%04d.jpg'), '-vf', `scale=480:-2,drawtext=text='%{eif\\:n/2\\:d}.%{eif\\:mod(n\\,2)*5\\:d} sn':x=6:y=6:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.7,tile=4x${Math.ceil(n / 4)}:padding=3`, '-frames:v', '1', prev]);
    console.log(id, 'önizleme', prev, ((Date.now() - t0) / 1000).toFixed(0) + ' sn');
    continue;
  }
  const mp4 = path.join(OUT, id + '.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.jpg'), '-an', '-c:v', 'libx264', '-preset', 'slower', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  const pf = Math.min(n - 1, Math.round((meta.poster != null ? meta.poster : dur * 0.2) * FPS));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, `f${String(pf).padStart(4, '0')}.jpg`), '-c:v', 'libwebp', '-quality', '72', path.join(OUT, id + '.webp')]);
  console.log(id, n, 'kare', (fs.statSync(mp4).size / 1024).toFixed(0) + ' KB', ((Date.now() - t0) / 1000).toFixed(0) + ' sn');
}
if (!PREVIEW) {
  const jf = path.join(ROOT, 'tools', 'esinav', 'data', 'es-sinav', 'kurs_video.json');
  const old = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, 'utf8')) : {};
  for (const m of metas) old[m.id] = m.soru;
  fs.writeFileSync(jf, JSON.stringify(Object.fromEntries(Object.entries(old).sort()), null, 1) + '\n');
}
await browser.close();
server.close();
fs.rmSync(TMP, { recursive: true, force: true });
