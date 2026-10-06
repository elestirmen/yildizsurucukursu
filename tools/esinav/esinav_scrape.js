// MEB e-Sınav deneme sayfasındaki soruları (pnlSorular/pnlCevaplar) sırayla kaydeder; sonra her soruya verilen şıkla sınavı bitirir.
const puppeteer = require('puppeteer');
const fs = require('fs');
const TEST = process.argv[2] || '1';
const PICK = process.argv[3] || 'A';
const OUT = `/tmp/claude-1000/-opt-yildiz/9bd61da7-7a98-41a5-88fa-6989677f310d/scratchpad/meb/esinav/test${TEST}/`;
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage();
  p.on('dialog', d => { console.log('DIALOG', d.message()); d.accept(); });
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto('https://esinavdeneme.meb.gov.tr/', { waitUntil: 'networkidle2' });
  await p.type('#txtAdSoyad', 'Deneme');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }), p.click('#btnTest' + TEST)]);
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }), p.evaluate(() => __doPostBack('basla1', ''))]);
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }), p.click('#btnBasla')]);
  await sleep(1500);
  const qs = [];
  for (let i = 1; i <= 50; i++) {
    await p.waitForFunction(n => document.querySelector('#lblNo') && document.querySelector('#lblNo').textContent.trim() === String(n), { timeout: 20000 }, i);
    await sleep(300);
    const d = await p.evaluate(() => ({
      no: document.querySelector('#lblNo').textContent.trim(),
      soru: document.querySelector('#pnlSorular').innerHTML,
      cevap: document.querySelector('#pnlCevaplar').innerHTML,
      imgs: [...document.querySelectorAll('#pnlSorular img, #pnlCevaplar img')].map(i => i.src)
    }));
    qs.push(d);
    if (PICK !== '-') {
      // şıkkı işaretle
      const letter = PICK === 'R' ? 'ABCD'[Math.floor(Math.random() * 4)] : PICK;
      await p.evaluate(L => {
        const tds = [...document.querySelectorAll('#pnlCevaplar td.secenekler')];
        const td = tds.find(t => (t.getAttribute('onclick') || '').includes("_" + L + "'"));
        if (td) td.click();
      }, letter);
      await sleep(700);
    }
    if (i < 50) {
      await p.click('#btnSonraki');
    }
  }
  fs.writeFileSync(OUT + `questions_${PICK}.json`, JSON.stringify(qs, null, 1));
  // görselleri indir
  const cookies = await p.cookies();
  fs.writeFileSync(OUT + 'cookies.txt', cookies.map(c => `${c.name}=${c.value}`).join('; '));
  for (const q of qs) for (const src of q.imgs.filter(u => !u.startsWith('data:'))) {
    const name = src.split('/').pop().split('?')[0];
    if (fs.existsSync(OUT + 'img_' + name)) continue;
    const buf = await p.evaluate(async u => { const r = await fetch(u); const a = new Uint8Array(await r.arrayBuffer()); return Array.from(a); }, src);
    fs.writeFileSync(OUT + 'img_' + name, Buffer.from(buf));
  }
  if (PICK === '-') { await b.close(); return; }
  // sınavı bitir
  await p.click('#btnSinaviBitir');
  await sleep(3000);
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('#btnSinaviBitir')]);
  await sleep(3000);
  if (p.url().includes('SalondanAyril')) { await p.waitForNavigation({ waitUntil: 'networkidle2', timeout: 100000 }).catch(e => console.log('wait', e.message)); await sleep(3000); }
  fs.writeFileSync(OUT + `bitir_${PICK}.html`, await p.content());
  await p.screenshot({ path: OUT + `bitir_${PICK}.png`, fullPage: true });
  console.log('URL', p.url());
  const btns = await p.$$eval('input,button,a', els => els.filter(e => e.type !== 'hidden').map(e => [e.tagName, e.id, e.name, (e.value || e.textContent || '').trim().slice(0, 60), e.getAttribute('onclick') || e.getAttribute('href') || '']));
  console.log(JSON.stringify(btns).slice(0, 3000));
  await b.close();
})();
