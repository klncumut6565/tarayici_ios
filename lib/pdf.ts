import { jsPDF } from "jspdf";
import type { ScanPage } from "./types";
import { A4_WIDTH_MM, A4_HEIGHT_MM } from "./documentSizes";

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function pagesToPDF(pages: ScanPage[], title = "belge"): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  for (let i = 0; i < pages.length; i++) {
    const dataUrl = await blobToDataURL(pages[i].imageData);
    const { width, height } = await getImageSize(dataUrl);

    const ratio = width / height;
    let renderW = A4_WIDTH_MM;
    let renderH = renderW / ratio;
    if (renderH > A4_HEIGHT_MM) {
      renderH = A4_HEIGHT_MM;
      renderW = renderH * ratio;
    }
    const x = (A4_WIDTH_MM - renderW) / 2;
    const y = (A4_HEIGHT_MM - renderH) / 2;

    if (i > 0) doc.addPage();
    doc.addImage(dataUrl, "JPEG", x, y, renderW, renderH, undefined, "FAST");
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function sharePDF(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
