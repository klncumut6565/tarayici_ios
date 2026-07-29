import SwiftUI
import VisionKit

struct DocumentScannerViewController: UIViewControllerRepresentable {
    @Binding var images: [UIImage]
    @Environment(\.dismiss) var dismiss
    
    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let scanner = VNDocumentCameraViewController()
        scanner.delegate = context.coordinator
        return scanner
    }
    
    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(images: $images, dismiss: dismiss)
    }
    
    class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        @Binding var images: [UIImage]
        let dismiss: DismissAction
        
        init(images: Binding<[UIImage]>, dismiss: DismissAction) {
            self._images = images
            self.dismiss = dismiss
        }
        
        // MARK: - VNDocumentCameraViewControllerDelegate
        
        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFinishWith scan: VNDocumentCameraScan
        ) {
            /// Taramanın her sayfasını UIImage'ye dönüştür
            /// VNDocumentCameraViewController otomatik olarak:
            /// - Perspektif düzeltme
            /// - Edge detection
            /// - Brightness/contrast optimize
            for pageIndex in 0..<scan.pageCount {
                let image = scan.imageOfPage(at: pageIndex)
                images.append(image)
            }
            
            dismiss()
        }
        
        func documentCameraViewControllerDidCancel(
            _ controller: VNDocumentCameraViewController
        ) {
            dismiss()
        }
        
        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFailWithError error: Error
        ) {
            print("⚠️ Tarası hatası: \(error.localizedDescription)")
            dismiss()
        }
    }
}
