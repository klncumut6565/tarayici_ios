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
  /** Bu belge dış sisteme (ör. TMGD) gönderildi mi? Yoksa hâlâ cihazda mı bekliyor. */
  uploadStatus: "pending" | "uploaded";
  /** uploadStatus "uploaded" olduğunda ne zaman/nereye gönderildiği. */
  uploadedAt?: number;
  uploadedVia?: "postMessage" | "callback" | "manual";
}
