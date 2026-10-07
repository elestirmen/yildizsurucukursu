# Park simülatörü 3B varlıkları

- `assets/vendor/three-park.js` — three.js r186'nın simülatörde kullanılan alt kümesi (MIT lisansı).
  `three-entry.js` dışa aktarılanları listeler. Yeniden derlemek için (three ve esbuild kurulu bir dizinde):
  `esbuild three-entry.js --bundle --format=esm --minify --legal-comments=none --target=es2020 --outfile=three-park.js`,
  ardından dosyanın başına lisans satırını ekleyin.
- `assets/park/arabalar.bin`, `renkler.png` — Kenney Car Kit 3.1 (CC0, www.kenney.nl) modelleri:
  `python3 -I pack_cars.py "<Car Kit>/Models/GLB format" arabalar.bin`; `renkler.png` aynı setteki `Textures/colormap.png`.
  Kaporta rengi, paletteki boya hücresi değiştirilerek boyanır (park-3d.js → `CELL`).

Bu dosyalardan biri değişince `park-sim.js` içindeki `park-3d.js?v=` ya da `park-3d.js` içindeki `?v=` sürümünü artırın.
