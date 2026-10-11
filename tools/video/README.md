# Kursumuzca hazırlanan animasyonlu sorular

`senaryolar.js` içindeki her sahne başsız Chrome'da kare kare çizilip videoya çevrilir. Sonuç olarak
`assets/v/<id>.mp4` (960×540, sessiz) ve `assets/v/<id>.webp` kapak üretilir; soru metinleri ve cevaplar
`tools/esinav/data/es-sinav/kurs_video.json`'a yazılır. `build_bank.py` bu soruları `kurs: 1` işaretiyle bankaya ekler:
çalışma ve konu sayfalarında çıkar, "çıkmış soru" sayısına ve deneme sınavına girmez.

## Görsel katman

- Gökyüzü ve ortam ışığı: Poly Haven HDRI (gündüz `kloofendal_48d_partly_cloudy_puresky`, gece `qwantani_night_puresky`);
  güneşin yönü HDRI'daki en parlak noktadan hesaplanır, gölgeler gökyüzüyle uyumludur.
- Zemin ve cepheler: Poly Haven PBR dokuları (`motor.js` → `TEXSETS`): asfalt, gri kilit parke, beton, çayır, sıva, kesme taş, kiremit.
- Binalar yordamsal (`house()`): Türk kasabası apartmanları/evleri; pencere, balkon, dükkân ve tabela, güneş enerjili düz çatı ya da kiremit.
- Ağaçlar: Poly Haven `jacaranda_tree` ve `island_tree_02` modellerinin 24 yönden pişirilmiş kartları (`agac/`, 2 görüş yüksekliği).
  Kart kameraya döner; gölgesi güneşe dönük ayrı bir kartla (katman 1) düşer.
- Yayalar: Quaternius'un CC0 insan modelleri (poly.pizza "Man" ve "Animated Woman"), `insan/`.
- Araçlar: Kenney Car Kit; kaporta cilalı boya, camlar yansıtan koyu cam, lambalar hafif ışıyan malzemeye çevrilir.
- Sürücü koltuğu: `kokpit.webp` (Codex ile üretilmiş araç içi, ön cam şeffaf); hız, devir ve ikaz lambaları gösterge ekranına çizilir.
- Son işleme: MSAA, ışık parlaması (bloom), ACES ton eşleme; `--blur 3` ile her kare 3 alt karenin ortalaması (hareket bulanıklığı).

## Gerekenler (depoda yok)

- three.js paketi: `npm install three@0.180.0`.
- Kenney CC0 kitleri (www.kenney.nl): Car Kit, City Kit Roads (koni), aynı dizine açılmış olarak
  (`kenney_car-kit/Models/GLB format/` …).
- Poly Haven indirmeleri: `python3 -I polyhaven.py <ph>/tex tex <ad> 1k` ile `TEXSETS`'teki her doku;
  `python3 -I polyhaven.py <ph>/hdri hdri kloofendal_48d_partly_cloudy_puresky 2k` ve `... qwantani_night_puresky 1k`.
  Ağaç kartlarını yeniden pişirmek için modeller: `polyhaven.py <ph>/models model jacaranda_tree 1k` (yaklaşık 200 MB),
  ardından `bake-agac.mjs` (her model için `6` ve `32` derece; PNG'ler WebP'ye çevrilip `agac/` altına
  `<model>_e<derece>_<nn>.webp` adıyla konur, ölçüler `agaclar.json`'da).
- Global puppeteer ve ffmpeg.

## Çalıştırma

```
NODE_PATH=~/.npm-global/lib/node_modules node tools/video/render.mjs \
  --kenney <Kenney dizini> --three <node_modules/three> --ph <Poly Haven dizini> --work <kısa bir geçici dizin> \
  [--only y03,y05] [--blur 3] [--preview]
```

`--preview` saniyede 2 karelik bir kare sayfası (`<work>/onizleme-<id>.jpg`) üretir; video yazmaz. Chrome'un soket yolu
uzun dizinlerde açılamadığı için `TMPDIR` değiştirilmez, kareler `--work` altına yazılır. Tam çizim kare başına
1–3 saniye sürer (11 sahne ~1 saat).

## Sahne yazma

- Dünya: X doğu, Z güney, metre. Yön açıları: 0 kuzey, 90 doğu. Trafik sağdan akar.
- Araç: `A.car({ id, model, color, path: [[x, z], …], v: [[t, km/s], …] })`. Fren lambası yavaşlamada kendiliğinden yanar;
  `holdBrake`, `left`/`right`/`hazard` (zaman aralıkları), `flash` (selektör), `beacon` (ambulans), `beam` (gece farı).
- Yaya ve top: hız m/sn; yaya kaldırımdaysa ayakları kaldırım yüksekliğine çıkar. Kamera: `fixed`/`keys` (zamanlı noktalar),
  `follow` (arkadan; `reverse` önden geriye bakar), `driver` (sürücü koltuğu; `pitch` derece, `lamps: [[id, t0, t1]]`
  kit.js ikaz lambaları).
- Levhalar `A.sign(kitKimliği, x, z, bakışYönü)` ile sitedeki kit.js çizimlerinden gelir.
- Yazılımsal WebGL tuzakları: uzun ince çizgiler 20 m'lik parçalara bölünür (yoksa bazı karelerde kaybolur);
  `visible` her zaman boolean olmalı; sürücü görünümünde aracın yalnız gövdesi gizlenir (kökü gizlemek farı da söndürür).
- Videoyu yeniden üretince aynı adla kaydedildiği için Cloudflare eskisini tutabilir; `sorular.js` sürümünü artırın.
