# Ürgüp Yıldız Sürücü Kursu — web sitesi

Özel Ürgüp Yıldız Motorlu Taşıtlar Sürücü Kursu'nun (Ürgüp / Nevşehir) kurumsal web sitesi ve e-Sınav hazırlık merkezi.
Canlı adres: <https://www.urgupyildizsurucu.com/>

## Sayfalar

| Sayfa | İçerik |
|---|---|
| `index.html` | Kurumsal ana sayfa: hakkımızda, kurslar (B manuel/otomatik, BE, D, A1, A2, A, özel direksiyon), yaş hesaplayıcı, ehliyet süreci, gerekli belgeler, Sınava Hazırlık tanıtımı, SSS, iletişim ve ön kayıt |
| `hazirlik.html` | **Sınava Hazırlık**: üç adım (1 Öğren · 2 Çalış · 3 Sınav ol), 4 ders altında 40 konunun listesi ve her konuda ilerleme (okundu, çözülen soru, doğru oranı, uygulama yıldızı), dersler arası karışık çalışma, yanlışlar ve işaretli sorular |
| `konu-<id>.html` | Her konu için tek sayfa (40 adet): konu anlatımı → (10 konuda) etkileşimli uygulama → o konunun çıkmış soruları. `konu-tc-park.html`'de ayrıca 2B/3B **park simülatörü** (ileri, geri geri ve paralel park) |
| `e-sinav.html` | **Sınav ol**: deneme sınavı (e-Sınav düzeninde 50 soru / 45 dk) ve çıkmış sınavlar; sonuçta tekrar edilecek konulara bağlantı |
| `konu-anlatimi.html`, `trafik-akademisi.html` | Eski adresler; yeni yerlerine yönlendirir |

## Soru bankası

`assets/data/sorular.js` — tamamı gerçek sınav sorusudur:

- **MEB çıkmış soruları:** MEB'in 2012–2016 yıllarında yaptığı 36 Motorlu Taşıt Sürücü Adayları / Kursiyerleri Sınavı'nın yayımlanmış K kitapçıkları ve **resmî cevap anahtarları**. Oturumlar arasında tekrar eden sorular birleştirildi; her sorunun çıktığı sınavlar `src` alanında tutulur.
- **MEB e-Sınav örnek soruları:** MEB'in e-Sınav deneme sitesinde (esinavdeneme.meb.gov.tr) yayımlanan güncel sorular. Bu soruların cevap anahtarı yayımlanmadığından cevaplar iki bağımsız çözümün örtüştüğü durumda alındı ve sitede bu durum belirtilir; video gerektiren sorular alınmadı.
- Mevzuatı değişen sorular (eski sürücü belgesi sınıfları, artık öğretilmeyen ilk yardım uygulamaları, kaldırılan belgeler vb.) `old` alanıyla işaretlidir; deneme sınavına ve çalışma moduna alınmaz, çıkmış sınavlarda puanlamaya katılmaz.
- Soru açıklamaları (`e`) ve konu anlatımları kursumuz tarafından yazılmıştır.

Soru görselleri `assets/q/` altındadır (kitapçıklardan kırpıldı; iki renk baskıdaki magenta, levha kırmızısına çevrildi).

## Yapı

```
index.html, hazirlik.html, konu-<id>.html, e-sinav.html
assets/
  site.css, site.js          temel stiller ve ortak etkileşimler (menü, tema, form, yaş hesaplayıcı…)
  kurumsal.css               kurumsal tasarım katmanı (renkler, tipografi, üst bilgi, hero, kartlar)
  sinav.css                  soru, sınav ve konu anlatımı bileşenleri
  hazirlik.css               hazırlık ana sayfası ve konu sayfaları
  soru.js                    ortak soru çekirdeği: soru gösterimi, ilerleme, soru çözme ekranı
  hazirlik.js                hazırlık ana sayfası ve konu sayfası etkileşimleri
  sinav.js                   deneme sınavı ve çıkmış sınavlar
  konu.js                    levha/ikaz lambası/ilk yardım çizimleri ve sınav sayfasındaki konu çekmecesi
  kit.js, academy*.js        etkileşimli uygulamalar (konu sayfalarında tek ders kipinde çalışır)
  park-sim.js                park simülatörü: araç fiziği, çarpışma, park sensörü; 2B kuşbakışı ve 3B takip kamerası
  data/sorular.js            soru bankası (üretilir)
  data/konular.js            konu anlatımları (üretilir)
  img/                       kurumsal görseller (WebP)
  img/konu/                  konu sayfası görselleri (WebP)
  q/                         soru görselleri (WebP)
tools/
  generate-layers.mjs        eski hero katmanlarının üreticisi
  esinav/                    soru bankası ve sayfa üretim betikleri (bkz. tools/esinav/README.md)
```

Site tamamen statiktir; derleme adımı gerektirmez. Hazırlık, konu ve sınav sayfaları
`tools/esinav/build_pages.py` ile üretilir (ortak üst/alt bilgi `tools/esinav/partials.py`, etkileşimli
uygulamaların kaynağı `tools/esinav/data/akademi-dersler.html`). Sunucuda `yildiz-web` (nginx:alpine)
konteyneri bu dizini doğrudan yayınlar.
Cloudflare statik dosyaları önbelleğe aldığından CSS/JS/görsel değiştiğinde `tools/esinav/versions.json`
ve `index.html`'deki `?v=` sürüm numarası artırılmalıdır.

## Gizlilik

Site çerez kullanmaz ve ziyaretçi verisi toplamaz. Ön kayıt formu yalnızca ziyaretçinin kendi WhatsApp uygulamasında hazır bir mesaj açar.
Okunan konular, çözüm ilerlemesi, sınav sonuçları, evrak listesi ve tema tercihi yalnızca ziyaretçinin tarayıcısında (`localStorage`) saklanır.

## Görseller

Kurumsal fotoğraf ve illüstrasyonlar ile konu sayfası görselleri yapay zekâ ile üretilmiştir (Codex görsel üretimi); kursun gerçek araçlarını veya personelini göstermez. Levha ve ikaz lambası konularında yapay zekâ görseli kullanılmaz; doğru çizimler `kit.js`'ten gelir.

## İletişim

0384 341 36 73 · 0532 452 77 22 · yildizmtsk50@hotmail.com
Cumhuriyet Mah. Güllüce 1 Sk. Turkuaz İş Merkezi No:8/1, 50400 Ürgüp / Nevşehir
