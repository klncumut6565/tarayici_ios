# Graph Report - tarayici_ios  (2026-11-16)

## Corpus Check
- 42 files · ~21,882 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .css 1, .plist 1)

## Summary
- 426 nodes · 789 edges · 19 communities (15 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cb8ecb07`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DocumentView
- tara/page.tsx
- package.json
- CameraCapture.tsx
- iOS Belge Tarası + OCR + PDF
- app/page.tsx
- edgeDetection.worker.ts
- iOS Tap Scanner Style Belge Taraması - Kurulum
- compilerOptions
- Coordinator
- DocActionSheet.tsx
- next
- ScannerViewModel
- manifest.json
- Tarayıcı — Mobil PWA Belge Tarayıcı
- copy-pdf-worker.js
- next.config.js
- sw.js

## God Nodes (most connected - your core abstractions)
1. `DocumentView()` - 38 edges
2. `BelgelerimPage()` - 22 edges
3. `TaraFlow()` - 19 edges
4. `compilerOptions` - 16 edges
5. `ScannerViewModel` - 15 edges
6. `getDB()` - 14 edges
7. `react` - 14 edges
8. `CornerCropper()` - 13 edges
9. `iOS Belge Tarası + OCR + PDF` - 13 edges
10. `iOS Tap Scanner Style Belge Taraması - Kurulum` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `ScanDocument`  [EXTRACTED]
  components/DocActionSheet.tsx → lib/types.ts
- `DocumentView()` --calls--> `blobToImage()`  [EXTRACTED]
  app/belge/[id]/page.tsx → lib/imageProcessing.ts
- `DocumentView()` --calls--> `canvasToBlob()`  [EXTRACTED]
  app/belge/[id]/page.tsx → lib/imageProcessing.ts
- `DocumentView()` --calls--> `readIntegrationOptions()`  [EXTRACTED]
  app/belge/[id]/page.tsx → lib/scannerModule.ts
- `move()` --calls--> `reorderPages()`  [EXTRACTED]
  app/belge/[id]/page.tsx → lib/db.ts

## Import Cycles
- None detected.

## Communities (19 total, 4 thin omitted)

### Community 7 - "DocumentView"
Cohesion: 0.10
Nodes (52): DocumentPage(), DocumentView(), autoDeliver(), chooseDocType(), filenameFor(), handleIntegrationSend(), handleShareOrDownload(), move() (+44 more)

### Community 12 - "tara/page.tsx"
Cohesion: 0.13
Nodes (26): dist(), Step, StepDot(), TaraFlow(), cancelToStart(), finish(), handleCropConfirm(), handleSave() (+18 more)

### Community 14 - "package.json"
Cohesion: 0.08
Nodes (30): render(), dependencies, idb@^8.0.0, jspdf@^2.5.1, next@14.2.35, pdfjs-dist@^3.11.174, react@^18.3.1, react-dom@^18.3.1 (+22 more)

### Community 19 - "CameraCapture.tsx"
Cohesion: 0.10
Nodes (26): AdjustPanel(), save(), filters, Props, CameraCapture(), Props, Quad, CornerCropper() (+18 more)

### Community 27 - "iOS Belge Tarası + OCR + PDF"
Cohesion: 0.08
Nodes (24): 1. Xcode'da yeni project, 2. Dosyaları ekle, 3. Info.plist, 4. Build, 🚀 Başlangıç, 📦 Dependencies, 📝 Dosya Yapısı, 📞 İletişim & Destek (+16 more)

### Community 29 - "app/page.tsx"
Cohesion: 0.09
Nodes (26): handleFileChosen(), HomePage(), handleFileChosen(), openCamera(), openKimlik(), AddMenu(), CameraIcon(), FilesIcon() (+18 more)

### Community 33 - "edgeDetection.worker.ts"
Cohesion: 0.17
Nodes (21): bilinearSample(), buildPaperScoreAndHistogram(), convexHull(), cross(), detect(), DetectResult, extractBoundaryPoints(), findComponents() (+13 more)

### Community 36 - "iOS Tap Scanner Style Belge Taraması - Kurulum"
Cohesion: 0.10
Nodes (19): 1. Xcode Project Oluştur, 2. Dosya Yapısı, 3. Info.plist Ayarları, 4. Build Settings, 5. Framework Bağlama, 6. Build & Run, Deployment, EditImageView compile hatası (+11 more)

### Community 38 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 47 - "DocActionSheet.tsx"
Cohesion: 0.29
Nodes (4): Busy, DocActionSheet(), Props, SheetButton()

### Community 55 - "next"
Cohesion: 0.11
Nodes (16): AyarlarPage(), choose(), inter, metadata, mono, RootLayout(), viewport, items (+8 more)

### Community 70 - "ScannerViewModel"
Cohesion: 0.06
Nodes (25): CoreImage, DocumentFile, .dateFormatted, .sizeFormatted, DocumentScannerApp, .body, LibraryView, .body (+17 more)

### Community 75 - "manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 105 - "Tarayıcı — Mobil PWA Belge Tarayıcı"
Cohesion: 0.22
Nodes (8): Bilinen sınırlamalar, Mimari, Neden native yerine PWA?, Tarayıcı — Mobil PWA Belge Tarayıcı, Telefonda kurulum (PWA), Vercel'e deploy, Veri & Gizlilik, Yerel geliştirme

### Community 122 - "copy-pdf-worker.js"
Cohesion: 0.29
Nodes (4): dest, fs, path, src

## Knowledge Gaps
- **9 isolated node(s):** `.sizeFormatted`, `.dateFormatted`, `CoreImage`, `original`, `blackWhite` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 169 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `DocumentView`, `tara/page.tsx`, `package.json`, `CameraCapture.tsx`, `app/page.tsx`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `ScannerViewModel` (e.g. with `ScannerView` and `.body`) actually correct?**
  _`ScannerViewModel` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `.sizeFormatted`, `.dateFormatted`, `CoreImage` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DocumentView` be split into smaller, more focused modules?**
  _Cohesion score 0.09728622631848438 - nodes in this community are weakly interconnected._
- **Why does `react` connect `app/page.tsx` to `DocumentView`, `tara/page.tsx`, `package.json`, `DocActionSheet.tsx`, `CameraCapture.tsx`, `next`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `tara/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12643678160919541 - nodes in this community are weakly interconnected._
- **Why does `DocumentView()` connect `DocumentView` to `tara/page.tsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._