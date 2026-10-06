# Ürgüp Yıldız Sürücü Kursu — web sitesi

Özel Ürgüp Yıldız Motorlu Taşıtlar Sürücü Kursu'nun (Ürgüp / Nevşehir) kurumsal web sitesi ve e-Sınav hazırlık merkezi.
Canlı adres: <https://yildiz.perinet.org/>

## Sayfalar

| Sayfa | İçerik |
|---|---|
| `index.html` | Kurumsal ana sayfa: hakkımızda, kurslar (B, A1, A2, A, özel direksiyon), Trafik Akademisi (10 etkileşimli ders), yaş hesaplayıcı, ehliyet süreci, gerekli belgeler, SSS, iletişim ve ön kayıt |
| `e-sinav.html` | e-Sınav Merkezi: deneme sınavı (e-Sınav düzeninde 50 soru / 45 dk), çalışma modu (ders/konu seçimi, anında geri bildirim, açıklama, konu çekmecesi), çıkmış sınavlar, gelişim takibi |
| `konu-anlatimi.html` | 40 başlıkta konu anlatımı (İlk Yardım, Trafik ve Çevre, Araç Tekniği, Trafik Adabı); her konuda çıkmış soru örnekleri |

## Soru bankası

`assets/data/sorular.js` — tamamı gerçek sınav sorusudur:

- **MEB çıkmış soruları:** MEB'in 2012–2016 yıllarında yaptığı 36 Motorlu Taşıt Sürücü Adayları / Kursiyerleri Sınavı'nın yayımlanmış K kitapçıkları ve **resmî cevap anahtarları**. Oturumlar arasında tekrar eden sorular birleştirildi; her sorunun çıktığı sınavlar `src` alanında tutulur.
- **MEB e-Sınav örnek soruları:** MEB'in e-Sınav deneme sitesinde (esinavdeneme.meb.gov.tr) yayımlanan güncel sorular. Bu soruların cevap anahtarı yayımlanmadığından cevaplar iki bağımsız çözümün örtüştüğü durumda alındı ve sitede bu durum belirtilir; video gerektiren sorular alınmadı.
- Mevzuatı değişen sorular (eski sürücü belgesi sınıfları, artık öğretilmeyen ilk yardım uygulamaları, kaldırılan belgeler vb.) `old` alanıyla işaretlidir; deneme sınavına ve çalışma moduna alınmaz, çıkmış sınavlarda puanlamaya katılmaz.
- Soru açıklamaları (`e`) ve konu anlatımları kursumuz tarafından yazılmıştır.

Soru görselleri `assets/q/` altındadır (kitapçıklardan kırpıldı; iki renk baskıdaki magenta, levha kırmızısına çevrildi).

## Yapı

```
index.html, e-sinav.html, konu-anlatimi.html
assets/
  site.css, site.js          temel stiller ve ortak etkileşimler (menü, tema, form, yaş hesaplayıcı…)
  kurumsal.css               kurumsal tasarım katmanı (renkler, tipografi, üst bilgi, hero, kartlar)
  sinav.css, sinav.js        e-Sınav Merkezi
  konu.js                    konu anlatımı sayfası ve konu çekmecesi
  kit.js, academy*.js        Trafik Akademisi (levha/ikaz lambası çizimleri, oyunlar)
  data/sorular.js            soru bankası (üretilir)
  data/konular.js            konu anlatımları (üretilir)
  img/                       kurumsal görseller (WebP)
  q/                         soru görselleri (WebP)
tools/
  generate-layers.mjs        eski hero katmanlarının üreticisi
  esinav/                    soru bankası ve sayfa üretim betikleri (bkz. tools/esinav/README.md)
```

Site tamamen statiktir; derleme adımı gerektirmez. Sunucuda `yildiz-web` (nginx:alpine) konteyneri bu dizini doğrudan yayınlar.
Cloudflare statik dosyaları önbelleğe aldığından CSS/JS/görsel değiştiğinde HTML'deki `?v=` sürüm numarası artırılmalıdır.

## Gizlilik

Site çerez kullanmaz ve ziyaretçi verisi toplamaz. Ön kayıt formu yalnızca ziyaretçinin kendi WhatsApp uygulamasında hazır bir mesaj açar.
e-Sınav ilerlemesi, evrak listesi ve tema tercihi yalnızca ziyaretçinin tarayıcısında (`localStorage`) saklanır.

## Görseller

Kurumsal fotoğraf ve illüstrasyonlar yapay zekâ ile üretilmiştir (Codex görsel üretimi); kursun gerçek araçlarını veya personelini göstermez.

## İletişim

0384 341 36 73 · 0532 452 77 22 · yildizmtsk50@hotmail.com
Cumhuriyet Mah. Güllüce 1 Sk. Turkuaz İş Merkezi No:8/1, 50400 Ürgüp / Nevşehir
