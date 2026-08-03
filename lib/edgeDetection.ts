import type { Point } from "./imageProcessing";

export interface DetectionResult {
  corners: [Point, Point, Point, Point] | null;
  debug: string;
}

export type DetectionMode = "live" | "capture";

// Ağır işlem bir Web Worker içinde çalışır, ana thread (arayüz, geri
// tuşu, animasyonlar) hiçbir zaman bloklanmaz. Worker tek seferlik
// oluşturulup yeniden kullanılır. OpenCV/WASM YOK — bkz.
// edgeDetection.worker.ts üstündeki not: WASM indirme/başlatma cihazı
// zorluyordu, kaldırıldı. Bunun yerine saf JS ile gerçek döndürülmüş
// dikdörtgen (rotating calipers / minAreaRect) buluyoruz.
let worker: Worker | null = null;
let requestId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./edgeDetection.worker.ts", import.meta.url));
  }
  return worker;
}

const TIMEOUT_MS: Record<DetectionMode, number> = {
  live: 1200,
  capture: 4000,
};

/**
 * Bir görüntüde belge kenarlarını otomatik olarak bulur.
 *
 * mode="capture": çekim sonrası tek seferlik, daha yüksek çözünürlük,
 * daha toleranslı eşikler (CornerCropper başlangıç köşeleri için).
 *
 * mode="live": kamera önizlemesinde sık aralıklarla, düşük çözünürlükte
 * çalışır (canlı takip overlay'i için) — hız öncelikli.
 */
export async function detectDocumentCorners(
  source: HTMLCanvasElement,
  mode: DetectionMode = "capture"
): Promise<DetectionResult> {
  if (typeof window === "undefined") {
    return { corners: null, debug: "Yalnızca tarayıcıda çalışır" };
  }

  const maxDim = mode === "live" ? 360 : 900;
  const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
  const work = document.createElement("canvas");
  work.width = Math.max(1, Math.round(source.width * scale));
  work.height = Math.max(1, Math.round(source.height * scale));
  const ctx = work.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, work.width, work.height);
  const imageData = ctx.getImageData(0, 0, work.width, work.height);

  return new Promise((resolve) => {
    let settled = false;
    const id = ++requestId;
    let w: Worker;
    try {
      w = getWorker();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      resolve({ corners: null, debug: `Worker başlatılamadı: ${msg}` });
      return;
    }

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      w.removeEventListener("message", handleMessage);
      resolve({ corners: null, debug: `Algılama zaman aşımına uğradı (${TIMEOUT_MS[mode] / 1000} sn).` });
    }, TIMEOUT_MS[mode]);

    function handleMessage(e: MessageEvent) {
      if (e.data?.id !== id || settled) return;
      settled = true;
      clearTimeout(timeoutId);
      w.removeEventListener("message", handleMessage);

      const rawCorners = e.data.corners as Point[] | null;
      const debug = e.data.debug as string;
      if (!rawCorners) {
        resolve({ corners: null, debug });
        return;
      }
      const inv = 1 / scale;
      const corners = rawCorners.map((p) => ({ x: p.x * inv, y: p.y * inv })) as [Point, Point, Point, Point];
      resolve({ corners, debug });
    }

    w.addEventListener("message", handleMessage);
    w.addEventListener("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      w.removeEventListener("message", handleMessage);
      resolve({ corners: null, debug: `Worker hatası: ${err.message}` });
    });

    w.postMessage({ id, imageData, mode }, [imageData.data.buffer]);
  });
}
