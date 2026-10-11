# Kursumuzca hazırlanan animasyonlu sorular

`senaryolar.js` içindeki her sahne başsız Chrome'da kare kare çizilip videoya çevrilir. Sonuç olarak
`assets/v/<id>.mp4` (960×540, sessiz) ve `assets/v/<id>.webp` kapak üretilir; soru metinleri ve cevaplar
`tools/esinav/data/es-sinav/kurs_video.json`'a yazılır. `build_bank.py` bu soruları `kurs: 1` işaretiyle bankaya ekler:
çalışma ve konu sayfalarında çıkar, "çıkmış soru" sayısına ve deneme sınavına girmez.

## Gerekenler (depoda yok)

- three.js paketi: `npm install three@0.180.0` (GLTFLoader ve SkeletonUtils için tam paket).
- Kenney CC0 kitleri (www.kenney.nl), aynı dizine açılmış olarak: Car Kit, City Kit Roads, City Kit Commercial 2.1,
  City Kit Suburban 2.0, Mini Characters. Klasör adları `motor.js` içindeki `KIT` yollarıyla aynı olmalıdır
  (ör. `kenney_car-kit/Models/GLB format/`).
- Global puppeteer ve ffmpeg.

## Çalıştırma

```
NODE_PATH=~/.npm-global/lib/node_modules node tools/video/render.mjs \
  --kenney <kitlerin dizini> --three <node_modules/three> --work <kısa bir geçici dizin> [--only y03,y05] [--preview]
```

`--preview` saniyede 2 karelik bir kare sayfası (`<work>/onizleme-<id>.jpg`) üretir; video yazmaz. Chrome'un soket yolu
uzun dizinlerde açılamadığı için `TMPDIR` değiştirilmez, kareler `--work` altına yazılır.

## Sahne yazma

- Dünya: X doğu, Z güney, metre. Yön açıları: 0 kuzey, 90 doğu. Trafik sağdan akar.
- Araç: `A.car({ id, model, color, path: [[x, z], …], v: [[t, km/s], …] })`. Fren lambası yavaşlamada kendiliğinden yanar;
  `holdBrake`, `left`/`right`/`hazard` (zaman aralıkları), `flash` (selektör), `beacon` (ambulans), `beam` (gece farı).
- Yaya ve top: hız m/sn. Kamera: `fixed`/`keys` (zamanlı noktalar), `follow` (arkadan; `reverse` önden geriye bakar),
  `driver` (sürücü koltuğu, gösterge paneli; `lamps: [[id, t0, t1]]` kit.js ikaz lambaları).
- Levhalar `A.sign(kitKimliği, x, z, bakışYönü)` ile sitedeki kit.js çizimlerinden gelir.
- Videoyu yeniden üretince aynı adla kaydedildiği için Cloudflare eskisini tutabilir; içerik değişirse kimliği değiştirin
  ya da `sorular.js` sürümünü artırın.
