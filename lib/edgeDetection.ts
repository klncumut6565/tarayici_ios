import { loadOpenCV } from "./opencvLoader";
import type { Point } from "./imageProcessing";

export interface DetectionResult {
  corners: [Point, Point, Point, Point] | null;
  /** Ne olduğunu (başarı/başarısızlık sebebini) insan tarafından okunabilir açıklar. */
  debug: string;
}

/**
 * Bir fotoğraf karesinde belge/kart kenarlarını otomatik olarak bulur.
 *
 * Yöntem: gri tonlama → gauss bulanıklaştırma → Canny kenar algılama →
 * genişletme (dilate) → kontur bulma → her konturu çokgene sadeleştirip
 * (approxPolyDP) dört köşeli, dışbükey ve yeterince büyük olanı seçme.
 *
 * Her durumda (başarı ya da başarısızlık) `debug` alanında NEDEN o
 * sonuca varıldığını açıklayan bir metin döner ve console'a da yazar,
 * böylece gerçek cihazda "neden algılamıyor" sorusu konsol/ekrandan
 * doğrudan okunabilir.
 */
export async function detectDocumentCorners(source: HTMLCanvasElement): Promise<DetectionResult> {
  let cv: any;
  try {
    cv = await loadOpenCV();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tarayici:edge] OpenCV yüklenemedi:", msg);
    return { corners: null, debug: `OpenCV yüklenemedi: ${msg}` };
  }

  const maxDim = 900;
  const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
  const work = document.createElement("canvas");
  work.width = Math.max(1, Math.round(source.width * scale));
  work.height = Math.max(1, Math.round(source.height * scale));
  work.getContext("2d")!.drawImage(source, 0, 0, work.width, work.height);

  let src: any, gray: any, blurred: any, edges: any, kernel: any, dilated: any;
  let contours: any, hierarchy: any;

  try {
    src = cv.imread(work);
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
    const imgArea = work.width * work.height;
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
        // Kağıt parçacıkları / gürültü değil, kare gövdesinin makul bir
        // bölümünü kaplayan gerçek belge konturunu istiyoruz.
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
      ).toFixed(1)} (gereken minimum %15). Uygun/yeterince büyük bir dörtgen bulunamadı — arka plan kontrastı düşük ya da belge çerçeveyi yeterince doldurmuyor olabilir.`;
      console.warn("[tarayici:edge]", debug);
      return { corners: null, debug };
    }

    const [tl, tr, br, bl] = orderCorners(bestPoints);
    const inv = 1 / scale;
    const debug = `Başarılı: ${totalContours} kontur tarandı, seçilen dörtgenin alan oranı %${(
      (bestArea / imgArea) * 100
    ).toFixed(1)}.`;
    console.log("[tarayici:edge]", debug);
    return {
      corners: [
        { x: tl.x * inv, y: tl.y * inv },
        { x: tr.x * inv, y: tr.y * inv },
        { x: br.x * inv, y: br.y * inv },
        { x: bl.x * inv, y: bl.y * inv },
      ],
      debug,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tarayici:edge] işleme sırasında hata:", msg);
    return { corners: null, debug: `OpenCV işleme hatası: ${msg}` };
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
}

/** Köşeleri sol-üst, sağ-üst, sağ-alt, sol-alt sırasına diz. */
function orderCorners(pts: Point[]): [Point, Point, Point, Point] {
  const sums = pts.map((p) => p.x + p.y);
  const diffs = pts.map((p) => p.x - p.y);
  const tl = pts[sums.indexOf(Math.min(...sums))];
  const br = pts[sums.indexOf(Math.max(...sums))];
  const tr = pts[diffs.indexOf(Math.max(...diffs))];
  const bl = pts[diffs.indexOf(Math.min(...diffs))];
  return [tl, tr, br, bl];
}
