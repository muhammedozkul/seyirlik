# Seyirlik

Tarayıcıda çalışan film ve dizi izleme listesi. Kurulum ya da derleme yok; `index.html`'i bir sunucuyla aç:

```bash
python3 -m http.server 8769 --directory ~/Projeler/seyirlik
```

## Özellikler
- **Keşfet:** 102 yapımlık hazır katalog (69 film, 33 dizi), arama, film/dizi ve tür filtresi, sıralama.
- **Otomatik kapak:** Katalogdaki dizilerin kapakları TVmaze'den kendiliğinden gelir. TMDB anahtarı girilirse filmlerin kapakları da gelir.
- **Yapım ekle:** Adını yaz, kapaklı sonuçlardan seç; yıl, tür, süre ve bölüm sayısıyla listene eklenir. İstersen elle de eklenir.
- **Listem:** İzliyorum, İzlenecek, İzledim, Yarım bıraktım, Favoriler.
- **Detay:** Durum, 10 üzerinden puan, not, favori, dizide bölüm sayacı, "IMDb'de aç".
- **Ne izlesem?:** Ruh hali, süre ve kaynağa göre süzen öneri çarkı.
- **İstatistik:** İzlenen film ve bölüm sayısı, toplam saat, ortalama puan, tür dağılımı, son 6 ay, en yüksek puanlar.
- **Rozetler:** 14 başarım.
- Açık/koyu tema, JSON yedek indirme/yükleme. Veriler tarayıcıda (`localStorage`) durur.

## TMDB anahtarı (isteğe bağlı)
themoviedb.org'da ücretsiz hesap aç → Ayarlar → API → "API Key" değerini kopyala → Seyirlik'te ⚙ Ayarlar → Otomatik kapaklar alanına yapıştır. Anahtar yalnız bu tarayıcıda saklanır, yedek dosyasına girmez.

## Dosyalar
- `index.html` sayfa yapısı · `stil.css` görünüm · `katalog.js` hazır katalog · `uygulama.js` tüm davranış

## Kaynaklar
Dizi verileri ve kapakları: [TVmaze](https://www.tvmaze.com) (CC BY-SA). Film verileri: [TMDB](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB. Katalog özetleri Seyirlik için yazılmıştır.
