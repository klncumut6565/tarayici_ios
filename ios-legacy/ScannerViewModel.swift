import SwiftUI
import PDFKit

@MainActor
class ScannerViewModel: ObservableObject {
    @Published var scannedImages: [UIImage] = []
    @Published var showScanner = false
    @Published var isProcessing = false
    @Published var processingMessage = ""
    @Published var showSuccess = false
    @Published var showError = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    
    private let documentDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    
    func removeImage(at index: Int) {
        scannedImages.remove(at: index)
    }
    
    // MARK: - PDF Export
    func exportPDF() {
        Task {
            do {
                isProcessing = true
                processingMessage = "PDF oluşturuluyor..."
                
                let pdfURL = try createPDF(images: scannedImages)
                
                successMessage = "PDF kaydedildi: \(pdfURL.lastPathComponent)"
                showSuccess = true
                isProcessing = false
                
                // Share dialog
                await sharePDF(at: pdfURL)
                
            } catch {
                errorMessage = error.localizedDescription
                showError = true
                isProcessing = false
            }
        }
    }
    
    // MARK: - JPEG Export
    func exportJPEG() {
        Task {
            do {
                isProcessing = true
                processingMessage = "JPEG'ler kaydediliyor..."
                
                let dateFormatter = DateFormatter()
                dateFormatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
                let timestamp = dateFormatter.string(from: Date())
                
                for (index, image) in scannedImages.enumerated() {
                    let jpegName = "Belge_\(timestamp)_\(index + 1).jpg"
                    let jpegURL = documentDirectory.appendingPathComponent(jpegName)
                    
                    if let jpegData = image.jpegData(compressionQuality: 0.95) {
                        try jpegData.write(to: jpegURL)
                    }
                }
                
                successMessage = "\(scannedImages.count) sayfa JPEG olarak kaydedildi"
                showSuccess = true
                isProcessing = false
                
            } catch {
                errorMessage = error.localizedDescription
                showError = true
                isProcessing = false
            }
        }
    }
    
    // MARK: - PDF Creation
    private func createPDF(images: [UIImage]) throws -> URL {
        let pdfDocument = PDFDocument()
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        let fileName = "Belge_\(dateFormatter.string(from: Date())).pdf"
        
        for image in images {
            if let pdfPage = PDFPage(image: image) {
                pdfDocument.insert(pdfPage, at: pdfDocument.pageCount)
            }
        }
        
        let pdfURL = documentDirectory.appendingPathComponent(fileName)
        guard pdfDocument.write(to: pdfURL) else {
            throw NSError(domain: "PDF", code: -1, userInfo: [NSLocalizedDescriptionKey: "PDF kaydedilemedi"])
        }
        
        return pdfURL
    }
    
    // Share PDF
    private func sharePDF(at url: URL) async {
        DispatchQueue.main.async {
            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let window = scene.windows.first {
                let activityVC = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                window.rootViewController?.present(activityVC, animated: true)
            }
        }
    }
}
