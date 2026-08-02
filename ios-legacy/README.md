# iOS Belge Tarası + OCR + PDF

**On-device, internet-free belge taraması ve PDF dönüştürme.**

## 📱 Özellikler

- **VNDocumentCameraViewController**: Apple'ın native belge tarası (otomatik perspektif düzeltme, edge detection)
- **Vision OCR**: On-device Türkçe yazı tanıması (no API calls)
- **PDF Generation**: Resim + OCR metni birlikte PDF'e yazma
- **Multi-page**: Sıradaki sayfa ekle, tekil silme
- **Share**: PDF Share Sheet'e gider

## 🏗️ Mimari

```
DocumentScannerApp.swift
├── ContentView (UI, state binding)
│   ├── DocumentScannerViewController (kamera, VisionKit)
│   └── ScannerViewModel (logic)
│       ├── extractText() [VNRecognizeTextRequest]
│       ├── generatePDF() [PDFKit]
│       └── createTextPage() [UIGraphicsPDFRenderer]
```

## 🚀 Başlangıç

### 1. Xcode'da yeni project
```bash
File > New > Project > iOS App
Product Name: DocumentScanner
Interface: SwiftUI
```

### 2. Dosyaları ekle
- `DocumentScannerApp.swift`
- `ScannerViewModel.swift`
- `DocumentScannerViewController.swift`

### 3. Info.plist
Şu kez ekle:
```xml
<key>NSCameraUsageDescription</key>
<string>Belgeleri taramak için kamera erişimi gereklidir</string>
```

### 4. Build
```
Cmd + R (iPhone 17 simulator)
```

## 🎯 Kullanım

1. **Belge Tara** → VNDocumentCameraViewController açılır
2. **Sayfalar ekle** → Birden fazla sayfa tarayabilirsin
3. **PDF Yap** → OCR + PDF generation başlar (~1-2 saniye)
4. **Share** → AirDrop, Mail, Files vb.

## 🔧 Özelleştirme

### OCR dili değiştir (ek diller)
`ScannerViewModel.swift`, `extractText()` içinde:
```swift
request.recognitionLanguages = ["tr", "en"] // Türkçe + İngilizce
```

### PDF'e OCR metni eklememe (sadece resim)
`createPDF()` içinde şu satırı sil:
```swift
// if index < texts.count ... { }  // Bunu kapat
```

### PDF sayfa boyutu (A4 vs Letter)
`createTextPage()`'de:
```swift
let pageSize = CGSize(width: 595, height: 842) // A4: 595×842 pt
// Letter: 612×792 pt (default)
```

### OCR accuracy seviyesi
`extractText()`'de:
```swift
request.recognitionLevel = .accurate  // .fast veya .accurate
```

## 📊 Performance

| İşlem | iPhone 17 | Notlar |
|-------|-----------|--------|
| Belge Taraması | <1s | Hardware optimized |
| OCR (sayfa) | 1-2s | Vision framework |
| PDF Generation | <500ms | PDFKit + renderer |
| Total | 2-4s | 3 sayfalık belge |

## 🐛 Sık Sorunlar

### Kamera kullanılamıyor
- Info.plist'e `NSCameraUsageDescription` ekledin mi?
- Simulator Settings → Privacy → Camera → Allow

### OCR boş geliyor
- Belge kalitesi düşük → brightness kontrol et
- OCR language support: iOS 15+

### PDF kaydedilmedi
- Documents klasörü yazılabilir mi? (Debugger'da kontrol)
- Disk space yeterli mi?

## 📝 Dosya Yapısı

```
DocumentScanner/
├── DocumentScannerApp.swift          # @main app
├── ScannerViewModel.swift            # @MainActor, Observable
├── DocumentScannerViewController.swift # UIViewControllerRepresentable
├── Info.plist                        # Permissions
└── README.md
```

## 🔐 Privacy

- ✅ Tüm işlemler cihazda (no cloud)
- ✅ Kamera sadece tarama sırasında
- ✅ PDF sadece Documents klasöründe tutulur
- ✅ Backuo'da dahil (iCloud sync için settings'te aç)

## 📦 Dependencies

- **Built-in**: SwiftUI, Vision, VisionKit, PDFKit, FileManager
- **External**: None (zero dependencies)

## 🎨 UI Customization

`ContentView.swift`'te Figma-style renkler:
```swift
.background(Color.blue)        // Primary
.foregroundColor(.white)       // Foreground
.cornerRadius(10)              // Border radius
```

Butonları değiştir:
- "Belge Tara" → Custom text
- Emoji'ler → SF Symbols (bkz. [SF Symbols](https://developer.apple.com/sf-symbols/))

## 📞 İletişim & Destek

Sorular: kodu fork'la ve test et, burada sor.
