import type { Point } from "./imageProcessing";

export interface DetectionResult {
  corners: [Point, Point, Point, Point] | null;
  /** Ne olduğunu (başarı/başarısızlık sebebini) insan tarafından okunabilir açıklar. */
  debug: string;
}

// Ağır OpenCV/Canny işlemi bir Web Worker içinde çalışır, böylece ana
// thread (dolayısıyla arayüz, geri tuşu, animasyonlar) hiçbir zaman
// bloklanmaz. Worker tek seferlik oluşturulup yeniden kullanılır.
let worker: Worker | null = null;
let requestId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./edgeDetection.worker.ts", import.meta.url));
  }
  return worker;
}

const DETECTION_TIMEOUT_MS = 12000;

/**
 * Bir fotoğraf karesinde belge/kart kenarlarını otomatik olarak bulur.
 * İndirgeme (downscale) ve piksel okuma ana thread'de yapılır (ucuz,
 * yerel canvas işlemleri); asıl Canny + kontur analizi worker'a
 * devredilir, ana thread boşta kalır.
 */
export async function detectDocumentCorners(source: HTMLCanvasElement): Promise<DetectionResult> {
  if (typeof window === "undefined") {
    return { corners: null, debug: "Yalnızca tarayıcıda çalışır" };
  }

  const maxDim = 900;
  const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
  const work = document.createElement("canvas");
  work.width = Math.max(1, Math.round(source.width * scale));
  work.height = Math.max(1, Math.round(source.height * scale));
  const ctx = work.getContext("2d")!;
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
      resolve({ corners: null, debug: `Algılama zaman aşımına uğradı (${DETECTION_TIMEOUT_MS / 1000} sn).` });
    }, DETECTION_TIMEOUT_MS);

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

    w.postMessage({ id, imageData }, [imageData.data.buffer]);
  });
}
