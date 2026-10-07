# e-Sınav soru bankası üretim hattı

`assets/data/sorular.js`, `assets/data/konular.js`, `assets/q/*.webp`, `hazirlik.html`, `konu-<id>.html` (40 sayfa) ve `e-sinav.html` bu betiklerle üretilir.

## Adımlar

1. **İndirme** — `kaynaklar.txt`'teki MEB arşivlerini `meb/zips` ve `meb/rar` altına indirip açın (`meb/x/<oturum>/`).
2. **Kitapçık seçimi** — `python -I pick_k.py <çalışma_dizini>` her oturumdan K kitapçığını ve sınav tarihini listeler (`k_list.txt`).
3. **Ayrıştırma** — `python -I parse_meb.py <çalışma_dizini>/bank $(cat k_list.txt)`
   PyMuPDF ile soru kökü, şıklar, şekiller (3x kırpma) ve son sayfadaki cevap anahtarı çıkarılır → `bank/raw.json`, `bank/img/`.
4. **Tekilleştirme** — `python -I dedupe.py bank` aynı metin + benzer görseller → tek soru; `src` alanında çıktığı sınavlar.
   Ardından kimlikler (`m0001`…) ders ve kaynak sırasına göre verilir (`bank/dedup_ids.json`). Kimlikler kullanıcı ilerlemesinde kullanıldığından değiştirilmemelidir.
5. **Sınıflandırma** — `data/siniflandirma/batch_*.json`: her soru için ders, konu (`data/topics.json`), açıklama, güncellik (`old`) ve yazım düzeltmeleri. Elle inceleme kararları `data/review.json`.
6. **Güncel e-Sınav soruları** — `esinav_scrape.js` (puppeteer) deneme sitesindeki üç kitapçığı kaydeder, `parse_esinav.py` yapılandırır.
   Cevaplar iki bağımsız çözümle belirlendi (`data/es-sinav/`); yalnızca örtüşenler ve video gerektirmeyenler alındı (`es_final.json`).
7. **Derleme** — `python -I build_bank.py <çalışma_dizini> <site>` → `sorular.js` + WebP görseller (magenta → kırmızı).
8. **Sayfalar** — `python3 build_pages.py <çalışma_dizini> <site>` → `konular.js`, `hazirlik.html`, `konu-<id>.html`,
   `e-sinav.html` ve eski adresleri yönlendiren `konu-anlatimi.html` / `trafik-akademisi.html`. Etkileşimli uygulamalar
   `data/akademi-dersler.html`'den alınıp `APP` eşlemesine göre ilgili konu sayfasına yerleştirilir; konu görselleri
   `assets/img/konu/<id>.webp` (yoksa ders görseli), levha/ikaz lambası konularında `KIT_HEAD` çizimleri kullanılır.
   `SITEMAP_DATE=YYYY-AA-GG` verilirse `sitemap.xml` de yeniden yazılır.
   Varlık sürümleri (`?v=`) `versions.json`'dan okunur: bir CSS/JS dosyası değişince oradaki sayıyı ve `index.html`'deki
   aynı bağlantıyı artırın.
   Konu anlatımlarının kaynağı `data/konular/<konu>.json` (çalışma dizininde `konu_out/`).

Üst menü, alt bilgi ve mobil alt çubuk `partials.py`'de tanımlıdır; ana sayfadaki kopyasıyla aynı tutulmalıdır.
