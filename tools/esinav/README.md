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
   Cevaplar iki bağımsız çözümle belirlendi (`data/es-sinav/`); yalnızca örtüşenler alındı (`es_final.json`).
   **Animasyonlu sorular:** deneme sitesindeki 10 video soru (`es_video.json`; kitapçık 1 ve 2'de 5'er, işitme engelli
   kitapçığında yok) `https://esinavdeneme.meb.gov.tr/video/<soruID>.mp4` adresinden indirildi, sessizdir.
   `ffmpeg -an -vf scale=960:-2 -c:v libx264 -preset slower -crf 30 -movflags +faststart` ile `assets/v/<id>.mp4`'e,
   kapak karesi `assets/v/<id>.webp`'ye yazıldı. Cevaplar kare kare iki bağımsız çözümle belirlendi
   (`video_cozum1.json`, `video_cozum2.json`, 10/10 örtüştü); `es_final.json`'da `"v": 1` → bankada `v` alanı.
   Deneme sınavı her 50 soruda 5 video soru koyar (`MODES[..].vid`, `assets/sinav.js`).
   **Ek animasyonlu sorular (x01–x09):** MEB tarzı ama kaynağı doğrulanamayan 9 video soru, ehliyetkursu.com.tr'deki
   animasyonlu soru sayfasından (soru metni ve videolar; 10 tanesi MEB'in deneme sitesindekilerle aynıydı, onlar alınmadı).
   Cevaplar iki bağımsız çözümle (`ek_cozum1.json`, `ek_cozum2.json`, 9/9 örtüştü) → `ek_video.json`; bankada `uv: 1`.
   **Kursumuzca hazırlananlar (y01–…):** `tools/video/` sahne motoruyla üretilir (`kurs_video.json`, bankada `kurs: 1`).
   **Türk Kızılay videolarıyla (k01–k14):** ilk yardım soruları, Kızılay'ın YouTube'daki eğitim videolarından bir bölümle
   (`kizilay_video.json`, `yt: [kimlik, başlangıç sn, bitiş sn]`, bankada `kurs: 1`). Videolar indirilip barındırılmaz
   (tüm hakları Kızılay'da): `soru.js` YouTube iframe API ile sessiz başlatır ve bölümü döngüyle oynatır. Cevaplar, yalnız
   bölüm karelerini gören kör bir çözümle 14/14 doğrulandı. `data/kizilay_izle.json` ilk yardım konu sayfalarının anlatım
   sonuna "Videolu anlatım" kartlarını (tıklanınca YouTube oynatıcısı) ve güncel kuralla çelişen yerler için notu koyar.
   `uv` ve `kurs` soruları çalışma ve konu sayfalarında çıkar; "çıkmış soru" sayısına (`stats.guncel`) ve deneme sınavına girmez.
7. **Derleme** — `python -I build_bank.py <çalışma_dizini> <site>` → `sorular.js` + WebP görseller (magenta → kırmızı).
8. **Sayfalar** — `python3 build_pages.py <çalışma_dizini> <site>` → `konular.js`, `hazirlik.html`, `konu-<id>.html`,
   `e-sinav.html` ve eski adresleri yönlendiren `konu-anlatimi.html` / `trafik-akademisi.html`. Etkileşimli uygulamalar
   `data/akademi-dersler.html`'den alınıp `APP` eşlemesine göre ilgili konu sayfasına yerleştirilir; konu görselleri
   `assets/img/konu/<id>.webp` (yoksa ders görseli), levha/ikaz lambası konularında `KIT_HEAD` çizimleri kullanılır.
   Park simülatörünün paneli `data/park-simulatoru.html`'dedir; `SIM` eşlemesindeki konu sayfasına (`tc-park`) ayrı bir
   bölüm (`#simulator`) olarak eklenir ve `assets/park-sim.js` ile çalışır.
   `SITEMAP_DATE=YYYY-AA-GG` verilirse `sitemap.xml` de yeniden yazılır.
   Varlık sürümleri (`?v=`) `versions.json`'dan okunur: bir CSS/JS dosyası değişince oradaki sayıyı ve `index.html`'deki
   aynı bağlantıyı artırın.
   Konu anlatımlarının kaynağı `data/konular/<konu>.json` (çalışma dizininde `konu_out/`).

Üst menü, alt bilgi ve mobil alt çubuk `partials.py`'de tanımlıdır; ana sayfadaki kopyasıyla aynı tutulmalıdır.
