import SwiftUI
import CoreImage

struct EditImageView: View {
    @ObservedObject var viewModel: ScannerViewModel
    let index: Int
    @State private var selectedFilter = FilterType.original
    @State private var brightness: Double = 0
    @State private var contrast: Double = 1
    @State private var saturation: Double = 1
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        VStack {
            // Preview
            Image(uiImage: getFilteredImage())
                .resizable()
                .scaledToFit()
                .frame(maxHeight: 400)
                .padding()
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(FilterType.allCases) { filter in
                        VStack {
                            Image(uiImage: applyFilter(viewModel.scannedImages[index], type: filter))
                                .resizable()
                                .scaledToFit()
                                .frame(width: 60, height: 80)
                                .cornerRadius(6)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(selectedFilter == filter ? Color.blue : Color.clear, lineWidth: 2)
                                )
                            
                            Text(filter.rawValue)
                                .font(.caption2)
                        }
                        .onTapGesture { selectedFilter = filter }
                    }
                }
                .padding()
            }
            
            VStack(spacing: 16) {
                // Brightness
                VStack {
                    HStack {
                        Text("Parlaklık")
                            .font(.caption)
                        Spacer()
                        Text(String(format: "%.0f%%", brightness * 100))
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    Slider(value: $brightness, in: -1...1)
                        .tint(.blue)
                }
                
                // Contrast
                VStack {
                    HStack {
                        Text("Kontrast")
                            .font(.caption)
                        Spacer()
                        Text(String(format: "%.0f%%", contrast * 100))
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    Slider(value: $contrast, in: 0.5...2)
                        .tint(.blue)
                }
                
                // Saturation
                VStack {
                    HStack {
                        Text("Doygunluk")
                            .font(.caption)
                        Spacer()
                        Text(String(format: "%.0f%%", saturation * 100))
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    Slider(value: $saturation, in: 0...2)
                        .tint(.blue)
                }
            }
            .padding()
            
            HStack(spacing: 12) {
                Button(action: { rotateImage() }) {
                    HStack {
                        Image(systemName: "rotate.right")
                        Text("Döndür")
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.gray.opacity(0.2))
                    .foregroundColor(.blue)
                    .cornerRadius(10)
                }
                
                Button(action: {
                    viewModel.scannedImages[index] = getFilteredImage()
                    dismiss()
                }) {
                    HStack {
                        Image(systemName: "checkmark")
                        Text("Kaydet")
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
            }
            .padding()
        }
        .navigationTitle("Sayfa \(index + 1) Düzenle")
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func getFilteredImage() -> UIImage {
        var image = applyFilter(viewModel.scannedImages[index], type: selectedFilter)
        image = applyAdjustments(image, brightness: brightness, contrast: contrast, saturation: saturation)
        return image
    }
    
    private func applyFilter(_ image: UIImage, type: FilterType) -> UIImage {
        guard let cgImage = image.cgImage else { return image }
        let ciImage = CIImage(cgImage: cgImage)
        let context = CIContext()
        
        let filter = CIFilter()
        switch type {
        case .original:
            return image
        case .blackWhite:
            filter.name = "CIPhotoEffectMono"
        case .grayscale:
            filter.name = "CIPhotoEffectTonal"
        case .vivid:
            filter.name = "CIPhotoEffectChrome"
        case .sharp:
            filter.name = "CISharpenLuminance"
        }
        
        filter.setValue(ciImage, forKey: kCIInputImageKey)
        
        if let outputImage = filter.outputImage,
           let cgOutput = context.createCGImage(outputImage, from: outputImage.extent) {
            return UIImage(cgImage: cgOutput)
        }
        return image
    }
    
    private func applyAdjustments(_ image: UIImage, brightness: Double, contrast: Double, saturation: Double) -> UIImage {
        guard let cgImage = image.cgImage else { return image }
        let ciImage = CIImage(cgImage: cgImage)
        let context = CIContext()
        
        var outputImage = ciImage
        
        // Brightness
        if brightness != 0 {
            let filter = CIFilter.exposureAdjust()
            filter.inputImage = outputImage
            filter.ev = Float(brightness)
            outputImage = filter.outputImage ?? outputImage
        }
        
        // Contrast
        let contrastFilter = CIFilter.colorControls()
        contrastFilter.inputImage = outputImage
        contrastFilter.contrast = Float(contrast)
        contrastFilter.saturation = Float(saturation)
        outputImage = contrastFilter.outputImage ?? outputImage
        
        if let cgOutput = context.createCGImage(outputImage, from: outputImage.extent) {
            return UIImage(cgImage: cgOutput)
        }
        return image
    }
    
    private func rotateImage() {
        var image = viewModel.scannedImages[index]
        let rotated = UIImage(cgImage: image.cgImage!, scale: image.scale, orientation: .right)
        viewModel.scannedImages[index] = rotated
    }
}

enum FilterType: String, CaseIterable, Identifiable {
    case original = "Orijinal"
    case blackWhite = "Siyah-Beyaz"
    case grayscale = "Gri Tonlar"
    case vivid = "Canlı"
    case sharp = "Keskin"
    
    var id: String { self.rawValue }
}

#Preview {
    struct Preview: View {
        @StateObject var viewModel = ScannerViewModel()
        
        var body: some View {
            NavigationStack {
                EditImageView(viewModel: viewModel, index: 0)
            }
        }
    }
    
    return Preview()
}
