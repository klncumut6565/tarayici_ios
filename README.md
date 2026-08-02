# Tarayıcı — Mobil PWA Belge Tarayıcı

Telefon kamerasıyla fotoğraf çek, köşeleri düzelt, filtre uygula, çoklu sayfalı PDF olarak paylaş/indir. Tamamen tarayıcıda çalışır — sunucuya hiçbir veri gitmez, tüm belgeler cihazda IndexedDB'de tutulur.

## Neden native yerine PWA?

- Xcode / Mac / Apple Developer hesabı gerekmez
- App Store review süreci yok
- Vercel'e deploy → link paylaş → Safari'de "Ana Ekrana Ekle" → telefonda native app gibi ikon + tam ekran
- Kamera, IndexedDB ve Service Worker sayesinde offline çalışır

## Yerel geliştirme

```bash
npm install
npm run dev
```

`http://localhost:3000` — kamera testi için gerçek cihazdan HTTPS üzerinden erişmek gerekir (localhost istisnadır, `getUserMedia` için).

## Vercel'e deploy

```bash
npm i -g vercel
vercel
```

veya GitHub reposunu Vercel'e bağla (Import Project) — her push'ta otomatik deploy olur.

## Telefonda kurulum (PWA)

1. Deploy edilen linki Safari'de aç (iOS) veya Chrome'da aç (Android)
2. iOS: Paylaş → **Ana Ekrana Ekle**
3. Android: Chrome menüsü → **Ana ekrana ekle / Uygulama yükle**
4. Artık ikon ana ekranda, tam ekran açılıyor, offline çalışıyor

## Mimari

```
app/
  page.tsx            → Belge galerisi (ana sayfa)
  tara/page.tsx        → Kamera → köşe düzeltme → filtre/ayar akışı
  belge/[id]/page.tsx  → Sayfa yönetimi, sıralama, PDF dışa aktarma
components/
  CameraCapture.tsx    → getUserMedia canlı kamera + tarama çizgisi animasyonu
  CornerCropper.tsx    → 4 köşeli sürüklenebilir perspektif düzeltme
  AdjustPanel.tsx       → Filtre (Orijinal/Gri/S-B/Canlı) + parlaklık/kontrast
  BottomNav.tsx         → Alt navigasyon (Belgeler / Tara)
lib/
  db.ts                → IndexedDB (idb) — belge ve sayfa deposu
  imageProcessing.ts    → Canvas tabanlı perspektif warp + filtreler
  pdf.ts                → jsPDF ile çoklu sayfa PDF üretimi + paylaşım
public/
  manifest.json, sw.js  → PWA manifest ve offline shell cache
```

## Veri & Gizlilik

- Hiçbir görüntü sunucuya yüklenmez; tüm işleme cihazda (canvas) yapılır
- Belgeler IndexedDB'de saklanır — uygulama silinirse veriler de silinir
- PDF paylaşımı Web Share API (`navigator.share`) ile yapılır; desteklenmiyorsa indirilir

## Bilinen sınırlamalar

- Kenar algılama otomatik değil — köşeler elle sürüklenir (kalite/karmaşıklık dengesi için tercih edildi)
- iOS Safari'de kamera arka plana alındığında stream tekrar başlatılır
