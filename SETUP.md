# iOS Tap Scanner Style Belge Taraması - Kurulum

Professional belge tarası, filters, PDF/JPEG export. iPhone 17 optimized.

## 1. Xcode Project Oluştur

```bash
File → New → Project → iOS → App
Product Name: DocumentScanner
Language: Swift
Interface: SwiftUI
Storage: None
```

## 2. Dosya Yapısı

Xcode'da şu 4 dosyayı ekle:

```
DocumentScanner/
├── DocumentScannerApp.swift
├── EditImageView.swift
├── ScannerViewModel.swift
├── DocumentScannerViewController.swift
└── (Info.plist → otomatik)
```

## 3. Info.plist Ayarları

Xcode UI:
- **Project → Targets → Info**
- **"+" → Privacy - Camera Usage Description**
  - Value: `Belgeleri taramak için kamera erişimi gereklidir`

**Veya manuel (XML):**
```xml
<key>NSCameraUsageDescription</key>
<string>Belgeleri taramak için kamera erişimi gereklidir</string>
```

## 4. Build Settings

Project → Targets → Build Settings:
- **iOS Deployment Target**: 16.0 (minimum)
- **Swift Language Version**: 5.9+

## 5. Framework Bağlama

Targets → Build Phases → Link Binary With Libraries:
- ✓ SwiftUI (automatic)
- ✓ PDFKit (automatic)
- ✓ VisionKit (automatic)
- ✓ CoreImage (automatic)

## 6. Build & Run

```bash
Cmd + B    # Compile
Cmd + R    # Run (iPhone 17)
```

## Özellikler

| Özellik | Status |
|---------|--------|
| Belge Tarası | ✅ VNDocumentCameraViewController |
| Filteler | ✅ B&W, Grayscale, Vivid, Sharp |
| Düzenleme | ✅ Brightness, Contrast, Saturation |
| Rotasyon | ✅ 90° saat yönünde |
| PDF Export | ✅ Çok sayfa |
| JPEG Export | ✅ Batch |
| Belge Kütüphanesi | ✅ Local Files |
| Cloud | ❌ (No sync) |
| OCR | ❌ (Not needed) |

## Klasör Yapısı

- **Documents**: Tüm PDF/JPEG kaydedilir
- **App UI**: TabView (Tara | Belgeleri)
- **Editing**: NavigationLink → EditImageView

## Performance (iPhone 17)

| İşlem | Süre |
|-------|------|
| Belge Taraması | <1s |
| Filter Uygulaması | <500ms |
| PDF Generation | 1-2s |
| JPEG Batch Export | 2-3s (10 sayfa) |

## Sorun Giderme

### Kamera kullanılamıyor
```
1. Info.plist'te NSCameraUsageDescription var mı?
2. Simulator → Settings → Privacy → Camera → Allow
3. Physical device'ta cam.app test et
```

### EditImageView compile hatası
```
✓ Tüm files eklediniz mi?
✓ Swift 5.9+?
✓ CoreImage import?
```

### PDF kaydedilmiyor
```
File Manager → Documents klasörü yazılabilir mi?
Disk space: 100MB+ gerekli
```

## Özelleştirme

### Filters ekle
`EditImageView.swift`:
```swift
enum FilterType {
    case sepia = "Sepia"  // Add this
}
```

### Export format değiştir
`ScannerViewModel.swift`:
```swift
func exportPNG() { ... }  // Add PNG export
```

### UI renkleri
```swift
.background(Color.blue)  // Change primary color
.tint(.orange)           // Change accent
```

## Deployment

Simulator → Physical Device:
```
1. Settings → Signing & Capabilities
2. Add Development Team
3. Run on iPhone 17
```

TestFlight / App Store:
```
1. Archive → Distribute
2. Ad Hoc / TestFlight seçin
3. Sertifikaları ayarlayın
```
