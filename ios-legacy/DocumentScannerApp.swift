import SwiftUI
import VisionKit
import PDFKit

@main
struct DocumentScannerApp: App {
    var body: some Scene {
        WindowGroup {
            TabView {
                ScannerView()
                    .tabItem {
                        Label("Tara", systemImage: "camera")
                    }
                
                LibraryView()
                    .tabItem {
                        Label("Belgeleri", systemImage: "doc.text")
                    }
            }
        }
    }
}

struct ScannerView: View {
    @StateObject private var viewModel = ScannerViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                if viewModel.scannedImages.isEmpty {
                    VStack(spacing: 24) {
                        Image(systemName: "document.viewfinder")
                            .font(.system(size: 72))
                            .foregroundColor(.blue)
                        
                        VStack(spacing: 8) {
                            Text("Belge Tarası")
                                .font(.title2)
                                .fontWeight(.bold)
                            Text("Kağıt belgeleri dijital dosyaya dönüştür")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                        
                        Spacer()
                        
                        Button(action: { viewModel.showScanner = true }) {
                            HStack {
                                Image(systemName: "camera.fill")
                                Text("Taramaya Başla")
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .font(.headline)
                        }
                        .padding()
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    VStack {
                        HStack {
                            Text("Taranmış Sayfalar: \(viewModel.scannedImages.count)")
                                .font(.headline)
                            Spacer()
                            Menu {
                                Button("Tümünü Sil", role: .destructive) {
                                    viewModel.scannedImages.removeAll()
                                }
                            } label: {
                                Image(systemName: "ellipsis")
                                    .padding()
                            }
                        }
                        .padding()
                        
                        ScrollView {
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: 12) {
                                ForEach(Array(viewModel.scannedImages.enumerated()), id: \.offset) { index, image in
                                    NavigationLink(destination: EditImageView(viewModel: viewModel, index: index)) {
                                        VStack {
                                            Image(uiImage: image)
                                                .resizable()
                                                .scaledToFill()
                                                .frame(height: 150)
                                                .clipped()
                                                .overlay(alignment: .topTrailing) {
                                                    Button(role: .destructive, action: { viewModel.removeImage(at: index) }) {
                                                        Image(systemName: "xmark.circle.fill")
                                                            .font(.title2)
                                                            .foregroundColor(.red)
                                                            .padding(8)
                                                    }
                                                }
                                            
                                            Text("Sayfa \(index + 1)")
                                                .font(.caption)
                                                .foregroundColor(.gray)
                                        }
                                        .cornerRadius(8)
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.blue, lineWidth: 2))
                                    }
                                }
                            }
                            .padding()
                        }
                        
                        HStack(spacing: 12) {
                            Button(action: { viewModel.showScanner = true }) {
                                HStack {
                                    Image(systemName: "plus")
                                    Text("Sayfa Ekle")
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                            }
                            
                            Menu {
                                Button("PDF Olarak Kaydet", action: { viewModel.exportPDF() })
                                Button("JPEG Olarak Kaydet", action: { viewModel.exportJPEG() })
                            } label: {
                                HStack {
                                    Image(systemName: "arrow.down.doc")
                                    Text("Dışa Aktar")
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                                .background(Color.green)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                            }
                        }
                        .padding()
                    }
                }
                
                if viewModel.isProcessing {
                    VStack(spacing: 16) {
                        ProgressView()
                            .tint(.blue)
                        Text(viewModel.processingMessage)
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    .frame(width: 180, height: 120)
                    .background(Color(.systemBackground))
                    .cornerRadius(16)
                    .shadow(radius: 8)
                }
            }
            .navigationTitle("Belge Tarası")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $viewModel.showScanner) {
                DocumentScannerViewController(images: $viewModel.scannedImages)
            }
            .alert("Başarılı", isPresented: $viewModel.showSuccess) {
                Button("Tamam") { }
            } message: {
                Text(viewModel.successMessage)
            }
            .alert("Hata", isPresented: $viewModel.showError) {
                Button("Tamam") { }
            } message: {
                Text(viewModel.errorMessage ?? "Bilinmeyen hata oluştu")
            }
        }
    }
}

struct LibraryView: View {
    @State private var documents: [DocumentFile] = []
    
    var body: some View {
        NavigationStack {
            VStack {
                if documents.isEmpty {
                    VStack {
                        Image(systemName: "folder")
                            .font(.system(size: 60))
                            .foregroundColor(.gray)
                        Text("Henüz belge yok")
                            .font(.headline)
                            .padding(.top)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(documents) { doc in
                            HStack {
                                Image(systemName: doc.type == "pdf" ? "doc.fill" : "photo.fill")
                                    .foregroundColor(.blue)
                                VStack(alignment: .leading) {
                                    Text(doc.name)
                                        .font(.headline)
                                    Text(doc.sizeFormatted)
                                        .font(.caption)
                                        .foregroundColor(.gray)
                                }
                                Spacer()
                                Text(doc.dateFormatted)
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Belgeleri")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { loadDocuments() }
        }
    }
    
    private func loadDocuments() {
        let fileManager = FileManager.default
        let docPath = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        
        if let files = try? fileManager.contentsOfDirectory(at: docPath, includingPropertiesForKeys: nil) {
            documents = files.map { url in
                let attrs = try? fileManager.attributesOfItem(atPath: url.path)
                let size = (attrs?[.size] as? NSNumber)?.doubleValue ?? 0
                let date = (attrs?[.modificationDate] as? Date) ?? Date()
                
                return DocumentFile(
                    name: url.lastPathComponent,
                    size: size,
                    date: date,
                    type: url.pathExtension.lowercased()
                )
            }
            .sorted { $0.date > $1.date }
        }
    }
}

struct DocumentFile: Identifiable {
    let id = UUID()
    let name: String
    let size: Double
    let date: Date
    let type: String
    
    var sizeFormatted: String {
        let bytes = size
        if bytes < 1024 * 1024 {
            return String(format: "%.1f KB", bytes / 1024)
        } else {
            return String(format: "%.1f MB", bytes / (1024 * 1024))
        }
    }
    
    var dateFormatted: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return formatter.string(from: date)
    }
}

#Preview {
    DocumentScannerApp()
}
