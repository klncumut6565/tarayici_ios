export type FilterType = "orijinal" | "gri" | "siyahbeyaz" | "canlı";

export interface ScanPage {
  id: string;
  docId: string;
  order: number;
  imageData: Blob; // işlenmiş (kırpılmış + filtreli) görüntü, JPEG
  filter: FilterType;
  brightness: number; // -50..50
  contrast: number; // -50..50
  createdAt: number;
}

export interface ScanDocument {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pageCount: number;
  coverThumb?: Blob;
}
