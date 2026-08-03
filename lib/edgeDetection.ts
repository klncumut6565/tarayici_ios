import type { Point } from "./imageProcessing";

export interface DetectionResult {
  corners: [Point, Point, Point, Point] | null;
  debug: string;
}

export type DetectionMode = "live" | "capture" | "track";

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
  track: 800, // takip başarısızsa hızlıca live'a düşebilelim diye kısa
};

/**
 * Bir görüntüde belge kenarlarını otomatik olarak bulur.
 *
 * mode="capture": çekim sonrası tek seferlik, daha yüksek çözünürlük,
 * sonunda kenar oturtma (edge snapping) uygular.
 *
 * mode="live": kamera önizlemesinde sıfırdan tam tarama (maske + bağlı
 * bileşen + hull + minAreaRect). Sahne karmaşıklığına göre maliyeti
 * değişir.
 *
 * mode="track": önceki karede bulunan köşelerin (previousCorners,
 * KAYNAK/video piksel uzayında) etrafında hafif bir kenar-oturtma
 * güncellemesi yapar — native tarayıcı uygulamalarının yaptığı gibi
 * "anchor + takip et". Sahit karmaşıklığından bağımsız, öngörülebilir
 * ve düşük maliyetli. previousCorners verilmezse "live"e düşer.
 *
 * expectedAspect: beklenen genişlik/yükseklik oranı (örn. A4 için
 * ~0.707, kimlik/kart için ~1.586). "live"/"capture" modlarında birden
 * fazla aday bölgeden bu orana en yakın olanı seçmek için kullanılır.
 */
export async function detectDocumentCorners(
  source: HTMLCanvasElement,
  mode: DetectionMode = "capture",
  expectedAspect?: number,
  previousCorners?: [Point, Point, Point, Point]
): Promise<DetectionResult> {
  if (typeof window === "undefined") {
    return { corners: null, debug: "Yalnızca tarayıcıda çalışır" };
  }

  const effectiveMode: DetectionMode = mode === "track" && !previousCorners ? "live" : mode;

  const maxDim = effectiveMode === "capture" ? 900 : 360;
  const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
  const work = document.createElement("canvas");
  work.width = Math.max(1, Math.round(source.width * scale));
  work.height = Math.max(1, Math.round(source.height * scale));
  const ctx = work.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, work.width, work.height);
  const imageData = ctx.getImageData(0, 0, work.width, work.height);

  // Kaynak (video) piksel uzayındaki önceki köşeleri, bu çağrının analiz
  // çözünürlüğüne indir (downscale) — worker her zaman analiz uzayında çalışır.
  const scaledPreviousCorners =
    effectiveMode === "track" && previousCorners
      ? (previousCorners.map((p) => ({ x: p.x * scale, y: p.y * scale })) as [Point, Point, Point, Point])
      : undefined;

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
      resolve({ corners: null, debug: `Algılama zaman aşımına uğradı (${TIMEOUT_MS[effectiveMode] / 1000} sn).` });
    }, TIMEOUT_MS[effectiveMode]);

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

    w.postMessage(
      { id, imageData, mode: effectiveMode, expectedAspect, previousCorners: scaledPreviousCorners },
      [imageData.data.buffer]
    );
  });
}
