import { loadOpenCV } from "./opencvLoader";
import type { Point } from "./imageProcessing";

/**
 * Bir fotoğraf karesinde belge/kart kenarlarını otomatik olarak bulur.
 *
 * Yöntem: gri tonlama → gauss bulanıklaştırma → Canny kenar algılama →
 * genişletme (dilate) → kontur bulma → her konturu çokgene sadeleştirip
 * (approxPolyDP) dört köşeli, dışbükey ve yeterince büyük olanı seçme.
 * Bu klasik "belge tarayıcı" hattı (jscanify, OpenCV döküman tarayıcı
 * örnekleri) ile aynı yaklaşımdır — rastgele/varsayılan köşeler değil,
 * görüntüdeki gerçek kenarlara dayanır.
 *
 * Uygun bir dörtgen bulunamazsa null döner; çağıran taraf bu durumda
 * varsayılan (kenardan içeri hafif payla) köşelere geri düşer.
 */
export async function detectDocumentCorners(
  source: HTMLCanvasElement
): Promise<[Point, Point, Point, Point] | null> {
  let cv: any;
  try {
    cv = await loadOpenCV();
  } catch {
    return null;
  }

  // Performans için küçük bir kopya üzerinde çalış, sonucu orijinal
  // ölçeğe geri çevir.
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

    const imgArea = work.width * work.height;
    let bestPoints: Point[] | null = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

      if (approx.rows === 4) {
        const area = Math.abs(cv.contourArea(approx));
        // Kağıt parçacıkları / gürültü değil, kare gövdesinin makul bir
        // bölümünü kaplayan gerçek belge konturunu istiyoruz.
        if (area > bestArea && area > imgArea * 0.15 && cv.isContourConvex(approx)) {
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

    if (!bestPoints) return null;

    const [tl, tr, br, bl] = orderCorners(bestPoints);
    const inv = 1 / scale;
    return [
      { x: tl.x * inv, y: tl.y * inv },
      { x: tr.x * inv, y: tr.y * inv },
      { x: br.x * inv, y: br.y * inv },
      { x: bl.x * inv, y: bl.y * inv },
    ];
  } catch {
    return null;
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
