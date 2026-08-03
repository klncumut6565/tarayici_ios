/// <reference lib="webworker" />

// Tüm ağır OpenCV işini (WASM) ana thread'in DIŞINDA burada yapıyoruz.
// Önceki sürüm bu işlemi ana thread'de senkron çalıştırıyordu; Canny +
// kontur analizi büyük görüntülerde birkaç saniye sürebiliyor ve bu süre
// boyunca tüm arayüz (dahil geri tuşu, animasyonlar) donmuş görünüyordu.
// Worker içinde çalıştığı için ana thread hep boşta kalır, kullanıcı
// istediği an geri dönebilir.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cvPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadCv(): Promise<any> {
  if (!cvPromise) {
    cvPromise = import("@techstark/opencv-js").then(
      (mod) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Promise<any>((resolve) => {
          const cv = (mod as { default?: unknown }).default ?? mod;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cvAny = cv as any;
          if (cvAny.Mat) resolve(cvAny);
          else cvAny.onRuntimeInitialized = () => resolve(cvAny);
        })
    );
  }
  return cvPromise;
}

interface Point {
  x: number;
  y: number;
}

function orderCorners(pts: Point[]): [Point, Point, Point, Point] {
  const sums = pts.map((p) => p.x + p.y);
  const diffs = pts.map((p) => p.x - p.y);
  const tl = pts[sums.indexOf(Math.min(...sums))];
  const br = pts[sums.indexOf(Math.max(...sums))];
  const tr = pts[diffs.indexOf(Math.max(...diffs))];
  const bl = pts[diffs.indexOf(Math.min(...diffs))];
  return [tl, tr, br, bl];
}

interface RequestMsg {
  id: number;
  imageData: ImageData;
}

self.onmessage = async (e: MessageEvent<RequestMsg>) => {
  const { id, imageData } = e.data;

  try {
    const cv = await loadCv();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let src: any, gray: any, blurred: any, edges: any, kernel: any, dilated: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contours: any, hierarchy: any;

    try {
      src = cv.matFromImageData(imageData);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

      edges = new cv.Mat();
      cv.Canny(blurred, edges, 50, 150);

      kernel = cv.Mat.ones(5, 5, cv.CV_8U);
      dilated = new cv.Mat();
      cv.dilate(edges, dilated, kernel);

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      const totalContours = contours.size();
      const imgArea = imageData.width * imageData.height;
      let bestPoints: Point[] | null = null;
      let bestArea = 0;
      let quadCount = 0;
      let bestQuadRatio = 0;

      for (let i = 0; i < totalContours; i++) {
        const cnt = contours.get(i);
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          quadCount++;
          const area = Math.abs(cv.contourArea(approx));
          const ratio = area / imgArea;
          if (ratio > bestQuadRatio) bestQuadRatio = ratio;
          if (area > bestArea && ratio > 0.15 && cv.isContourConvex(approx)) {
            const pts: Point[] = [];
            for (let j = 0; j < 4; j++) {
              pts.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
            }
            bestArea = area;
            bestPoints = pts;
          }
        }
        cnt.delete();
        approx.delete();
      }

      if (!bestPoints) {
        const debug = `${totalContours} kontur tarandı, ${quadCount} tanesi 4 köşeliydi, en büyük 4 köşeli konturun alan oranı %${(
          bestQuadRatio * 100
        ).toFixed(1)} (gereken minimum %15). Uygun/yeterince büyük bir dörtgen bulunamadı.`;
        (self as unknown as Worker).postMessage({ id, corners: null, debug });
        return;
      }

      const [tl, tr, br, bl] = orderCorners(bestPoints);
      const debug = `Başarılı: ${totalContours} kontur tarandı, seçilen dörtgenin alan oranı %${(
        (bestArea / imgArea) * 100
      ).toFixed(1)}.`;
      (self as unknown as Worker).postMessage({ id, corners: [tl, tr, br, bl], debug });
    } finally {
      src?.delete();
      gray?.delete();
      blurred?.delete();
      edges?.delete();
      kernel?.delete();
      dilated?.delete();
      contours?.delete();
      hierarchy?.delete();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ id, corners: null, debug: `OpenCV işleme hatası: ${msg}` });
  }
};
